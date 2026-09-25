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
