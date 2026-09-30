const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readingFrom}=require('../receipt-ocr.js');
const result=(text,confidence=97)=>({text,blocks:[{paragraphs:[{lines:text.split('\n').map(text=>({text,words:text.split(' ').map(text=>({text,confidence}))}))}]}]});
test('receipt extracts explicit total, ISO date, currency, merchant and category',()=>{
  assert.deepEqual(readingFrom(result('Merchant: Desert Fuel\nDate: 2026-07-21\nSubtotal 20\nVAT 1\nTOTAL KWD 21.000')),{amount:'21',date:'2026-07-21',currency:'KWD',category:'fuel',merchant:'Desert Fuel'});
});
test('receipt recognizes Arabic digits and unambiguous date',()=>{
  assert.deepEqual(readingFrom(result('مطعم\n٢١/٠٧/٢٠٢٦\nالإجمالي SAR ١٢٣٫٥٠')),{amount:'123.5',date:'2026-07-21',currency:'SAR',category:'restaurant'});
});
test('unclear or conflicting readings are not guessed',()=>{
  assert.deepEqual(readingFrom(result('TOTAL KWD 20\n2026-07-21',40)),{});
  assert.deepEqual(readingFrom(result('TOTAL 20\nTOTAL 30\nUSD EUR\n01/02/2026\n2026-02-31')),{});
  assert.deepEqual(readingFrom(result('TOTAL 21,50')),{});
  assert.deepEqual(readingFrom(result('Cash 100\nChange 80\n$20')),{});
});
test('maintenance line items become editable details without inventing unclear text',()=>{
  const parsed=readingFrom(result('Merchant: Service Center\nOil change 15\nOil filter 5\nBrake repair 30\nTOTAL KWD 50\n2026-09-21'),true);
  assert.equal(parsed.amount,'50');
  assert.equal(parsed.maintenanceDetails,'Oil change 15\nOil filter 5\nBrake repair 30');
  assert.equal(parsed.category,'maintenance');
  assert.equal(readingFrom(result('Oil change 15',30),true).maintenanceDetails,'Oil change 15');
  assert.equal(readingFrom(result('تغيير زيت المحرك ١٥\nفلتر الزيت ٥'),true).maintenanceDetails,'تغيير زيت المحرك ١٥\nفلتر الزيت ٥');
});

test('Description rows preserve Arabic and unfamiliar parts regardless of word confidence',()=>{
 const parsed=readingFrom(result('INVOICE\nDescription Qty Amount\nجلدة عمود التوازن ٢\nFront stabilizer bush\nتركيب القطعة\nTOTAL KWD 40',18),true);
 assert.equal(parsed.maintenanceDetails,'جلدة عمود التوازن ٢\nFront stabilizer bush\nتركيب القطعة');
 assert.equal(parsed.amount,undefined);
});
test('raw OCR text without blocks remains available for manual review',()=>{
 assert.equal(readingFrom({text:'Description\nتبديل سير المكينة\nتنظيف الثروتل\nSubtotal 30'},true).maintenanceDetails,'تبديل سير المكينة\nتنظيف الثروتل');
 assert.equal(readingFrom({text:''},true).maintenanceDetails,undefined);
});
test('table crop uses detected Description geometry and stops before totals',()=>{
 const {descriptionRegion}=require('../receipt-ocr.js');
 const box=(x0,y0,x1,y1)=>({x0,y0,x1,y1});
 const data={blocks:[{paragraphs:[{lines:[
 {text:'Description Quantity Amount',bbox:box(30,100,800,120),words:[{text:'Description',bbox:box(30,100,140,120)},{text:'Quantity',bbox:box(420,100,490,120)},{text:'Amount',bbox:box(700,100,800,120)}]},
 {text:'Unfamiliar part',bbox:box(30,140,300,160)},
 {text:'Subtotal 90',bbox:box(700,300,800,320)}
 ]}]}]};
 assert.deepEqual(descriptionRegion(data,900,500),{x:15,y:125,width:390,height:165});
 assert.equal(descriptionRegion({text:'Description'},900,500),null);
});
test('Description rows keep vertical order and never fall back to adjacent numeric columns',()=>{
 const {descriptionRows}=require('../receipt-ocr.js');
 const word=(text,x0,y0,x1,y1)=>({text,bbox:{x0,y0,x1,y1}});
 const line=(y,text,words)=>({text,bbox:{x0:20,y0:y,x1:800,y1:y+20},words});
 const lines=[
 line(220,'تركيب قطعة 1.00 Units 25.000',[word('تركيب قطعة',30,220,200,240),word('1.00 Units',430,220,510,240),word('25.000',700,220,790,240)]),
 line(130,'العداد الحالي 330300كم',[word('العداد الحالي 330300كم',30,130,300,150)]),
 line(180,'قطعة أصلية 8 سلندر 70.000',[word('قطعة أصلية 8 سلندر',30,180,310,200),word('70.000',700,180,790,200)]),
 line(260,'السيرفس القادم علي 338300كم',[word('السيرفس القادم علي 338300كم',30,260,350,280)])
 ];
 const rows=descriptionRows({blocks:[{paragraphs:[{lines}]}]},{x:15,y:125,width:390,height:165});
 assert.deepEqual(rows.map(r=>r.text),['قطعة أصلية 8 سلندر','تركيب قطعة']);
 assert.doesNotMatch(rows.map(r=>r.text).join('\n'),/Units|25\.000|70\.000|العداد|السيرفس/);
});
test('row Amount takes precedence over different Unit Price and Quantity, in description order',()=>{
 const {rowAmounts,pricedDetails}=require('../receipt-ocr.js');
 const w=(text,x,y,confidence=96)=>({text,confidence,bbox:{x0:x,y0:y,x1:x+50,y1:y+15}});
 const header={text:'Description Quantity Unit Price Amount',words:[w('Description',10,10),w('Quantity',400,10),w('Unit',550,10),w('Price',610,10),w('Amount',800,10)]};
 const first={text:'Part',bbox:{y0:100,y1:120},words:[w('Part',10,100),w('2',410,100),w('35.000',600,100),w('70.000',800,100)]};
 const second={text:'Labor',bbox:{y0:150,y1:170},words:[w('Labor',10,150),w('5',410,150),w('5.000',600,150),w('25.000',800,150)]};
 const data={blocks:[{paragraphs:[{lines:[header,second,first]}]}]};
 assert.deepEqual(rowAmounts(data,[first,second]),[70,25]);
 assert.equal(pricedDetails(['Part','Labor'],[70,25],'KWD'),'Part — 70.000 د.ك\nLabor — 25.000 د.ك');
 second.words.at(-1).confidence=40;assert.deepEqual(rowAmounts(data,[first,second]),[70,null]);
 assert.equal(pricedDetails(['Part','Labor'],[70,null],'KWD'),'Part — 70.000 د.ك\nLabor');
 header.words.pop();assert.deepEqual(rowAmounts(data,[first,second]),[null,null]);
});
test('ambiguous row association and multiple amounts are left unpriced',()=>{
 const {rowAmounts}=require('../receipt-ocr.js');
 const w=(text,x,y)=>({text,confidence:96,bbox:{x0:x,y0:y,x1:x+50,y1:y+15}});
 const header={text:'Description Unit Price Amount',words:[w('Description',10,10),w('Price',600,10),w('Amount',800,10)]};
 const row={bbox:{y0:100,y1:125},words:[w('30.000',800,100)]};
 const data={blocks:[{paragraphs:[{lines:[header,row]}]}]};
 assert.deepEqual(rowAmounts(data,[row,{bbox:{y0:105,y1:130}}]),[null,null]);
 row.words.push(w('35.000',860,100));assert.deepEqual(rowAmounts(data,[row]),[null]);
});
test('invoice total trusts the label and number without requiring clear currency punctuation',()=>{
 const {invoiceTotal}=require('../receipt-ocr.js');
 const data={blocks:[{paragraphs:[{lines:[{text:'Total 160.000 J.»',words:[{text:'Total',confidence:96},{text:'160.000',confidence:95},{text:'J.»',confidence:30}]}]}]}]};
 assert.equal(invoiceTotal(data),'160');
 data.blocks[0].paragraphs[0].lines[0].words[1].confidence=20;assert.equal(invoiceTotal(data),undefined);
});
test('merchant header extraction is generic across Latin and Arabic business names',()=>{
 const {merchantFrom}=require('../receipt-ocr.js');
 const l=(text,y,height=20,confidence=92)=>({text,bbox:{x0:20,y0:y,x1:300,y1:y+height},words:text.split(' ').map(text=>({text,confidence}))});
 const data=lines=>({blocks:[{paragraphs:[{lines}]}]});
 assert.equal(merchantFrom(data([l('NORTH-AUTO',10,30),l('North Auto',60),l('Street 20',90),l('Customer: John Smith',150)])),'NORTH-AUTO');
 assert.equal(merchantFrom(data([l('مركز النور',10,35),l('مركز النور',70),l('شارع 10',100)])),'مركز النور');
 assert.equal(merchantFrom(data([l('Bright Motors',10,40),l('Building 10',65,18),l('Phone: 12345',90,18)])),'Bright Motors');
 assert.equal(merchantFrom(data([l('المورد: مؤسسة السلام',80)])),'مؤسسة السلام');
});
test('merchant extraction leaves unclear, ambiguous and customer-only headers manual',()=>{
 const {merchantFrom}=require('../receipt-ocr.js');
 const l=(text,y,confidence=92)=>({text,bbox:{x0:20,y0:y,x1:300,y1:y+30},words:[{text,confidence}]});
 const data=lines=>({blocks:[{paragraphs:[{lines}]}]});
 assert.equal(merchantFrom(data([l('North Auto',10,40),l('North Auto',60)])),undefined);
 assert.equal(merchantFrom(data([l('INVOICE',10),l('Customer: John Smith',60)])),undefined);
 assert.equal(merchantFrom(data([l('North Auto',10),l('Other Company',42),l('North Auto',90)])),undefined);
 assert.equal(merchantFrom(data([l('John Smith',10)])),undefined);
 assert.equal(merchantFrom(data([l('Merchant: First Shop',10),l('Seller: Second Shop',60)])),undefined);
});
