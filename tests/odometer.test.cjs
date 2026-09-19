const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {readingFrom}=require('../odometer-ocr.js');
function result(lines,confidence=96){
  return {text:lines.join('\n'),blocks:[{paragraphs:[{lines:lines.map(text=>({text,words:text.split(' ').map(text=>({text,confidence}))}))}]}]};
}
test('clear odometer reading accepts Western, Arabic and Persian digits and thousands separators',()=>{
  for(const line of ['ODO 123456 km','123456 km','123456','ODO ١٢٣٤٥٦ كم','ODO ۱۲۳۴۵۶ km','123,456 km','123٬456 كم','123 456 km']){
    assert.equal(readingFrom(result([line])),123456,line);
  }
  assert.equal(readingFrom(result(['ODO 0 km'])),0);
});
test('unclear, low-confidence, decimal, conflicting or malformed readings never produce a number',()=>{
  for(const lines of [[],[''],['12O456 km'],['123.4 km'],['123456 km','234567 km'],['ODO 123456','ODO 234567'],['12:34'],['25 C'],['120'],['12345678 km']]){
    assert.equal(readingFrom(result(lines)),null,lines.join(' / '));
  }
  assert.equal(readingFrom(result(['ODO 123456'],84)),null);
  assert.equal(readingFrom({text:'123456 km'}),null);
});
test('trip, range, speed and miles are not accepted as the odometer',()=>{
  for(const lines of [['TRIP 1234 km'],['RANGE','1234 km'],['TRIP A','1234 km'],['120 km/h'],['ODO 123456 miles']]){
    assert.equal(readingFrom(result(lines)),null);
  }
  assert.equal(readingFrom(result(['TRIP 150.2 km','ODO 123456 km'])),123456);
});
test('cost per kilometer is removed from UI and calculations',()=>{
  for(const file of ['app.js','index.html','translations.js']){
    assert.doesNotMatch(fs.readFileSync(file,'utf8'),/stat-cost-km|التكلفة لكل كم|Cost per km|x\/tripKm/);
  }
});
