const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const fixture={
  version:3,activeVehicleId:'v1',
  vehicles:[{id:'v1',name:'Car',odometer:1000,serviceInterval:10000},{id:'v2',name:'Second'}],
  maintenance:[{id:'same',vehicleId:'v1',date:'2026-02-01',cost:20,currency:'KWD',types:['engine_oil'],odometer:900,workshop:'Garage',notes:'Keep original',custom:'preserve'}],
  expenses:[{id:'same',vehicleId:'v1',date:'2026-03-01',category:'fuel',amount:10,currency:'KWD'},{id:'e2',vehicleId:'v2',date:'2026-03-01',category:'fees',amount:7,currency:'USD'}],
  trips:[{id:'t1',vehicleId:'v1',date:'2026-04-01',expenses:[{id:'te1',type:'fuel',cost:100,currency:'USD'},{id:'te2',type:'maintenance',cost:50,currency:'TRY'}]},{id:'old',vehicleId:'v1',date:'2025-01-01',cost:40,currency:'EUR'}]
};
function setup(){
  const stored=JSON.stringify(fixture),writes=[],nodes=new Map();
  const node=key=>{
    if(!nodes.has(key))nodes.set(key,{value:'',options:[{}],checked:true,innerHTML:'',classList:{toggle(){}},querySelector:s=>node(key+' '+s),querySelectorAll:()=>[],closest:s=>node(s)});
    return nodes.get(key);
  };
  const context=vm.createContext({
    window:{},console,Intl,NodeFilter:{SHOW_TEXT:4},
    localStorage:{getItem:key=>key==='sayyarati-data-v3'?stored:null,setItem:(...args)=>writes.push(args)},
    document:{documentElement:{},querySelector:node,querySelectorAll:()=>[],createTreeWalker:()=>({nextNode:()=>null}),createElement:()=>({set textContent(v){this.innerHTML=String(v??'')}})}
  });
  const prefix=source.slice(0,source.indexOf("  document.addEventListener('click'"));
  vm.runInContext(prefix+`globalThis.api={get data(){return data},totalsFor,currentFinancialTotals,carExpenses,tripTotals,renderReport,renderExpenses,renderHome,renderCurrencyTools,reportRecords,convertedTotals,normalize,load,setRates(value){exchangeRates=value}};})();`,context);
  const api=context.api;
  node('#report-period').value='all';
  return {api,node,writes,stored,plain:v=>JSON.parse(JSON.stringify(v))};
}
test('trip expenses and legacy trip costs never increase vehicle totals',()=>{
  const {api,plain}=setup();
  assert.deepEqual(plain(api.totalsFor('v1')),{KWD:30});
  api.data.trips[0].expenses.push({type:'maintenance',cost:999,currency:'KWD'});
  assert.deepEqual(plain(api.totalsFor('v1')),{KWD:30});
  assert.deepEqual(plain(api.tripTotals(api.data.trips[1])),{EUR:40});
});
test('vehicle expense, new maintenance expense and legacy maintenance never increase trip totals',()=>{
  const {api,plain}=setup();
  const before=plain(api.data.trips.map(api.tripTotals));
  api.data.expenses.push({vehicleId:'v1',category:'fees',amount:5,currency:'KWD'},{vehicleId:'v1',category:'maintenance',amount:8,currency:'KWD'});
  api.data.maintenance.push({vehicleId:'v1',cost:12,currency:'KWD'});
  assert.deepEqual(plain(api.totalsFor('v1')),{KWD:55});
  assert.deepEqual(plain(api.data.trips.map(api.tripTotals)),before);
});
test('legacy maintenance is displayed once with original details and correct edit actions even with duplicate IDs',()=>{
  const {api,node,plain}=setup();
  const before=plain(api.data);
  const records=api.carExpenses(api.data.expenses.filter(r=>r.vehicleId==='v1'),api.data.maintenance);
  api.renderExpenses(records,api.totalsFor('v1'));
  assert.equal(records.length,2);
  assert.match(node('#expense-list').innerHTML,/edit-maintenance/);
  assert.match(node('#expense-list').innerHTML,/edit-expense/);
  assert.match(node('#expense-list').innerHTML,/Garage/);
  assert.match(node('#expense-list').innerHTML,/Keep original/);
  assert.deepEqual(plain(api.data),before);
});
test('current and fleet currency conversion use vehicle-only totals',()=>{
  const {api,plain}=setup();
  api.setRates({KWD:1,USD:2,TRY:4,EUR:3});
  assert.equal(api.convertedTotals(api.currentFinancialTotals(),'USD'),60);
  api.data.activeVehicleId=null;
  assert.deepEqual(plain(api.currentFinancialTotals()),{KWD:30,USD:7});
  assert.equal(api.convertedTotals(api.currentFinancialTotals(),'USD'),67);
  api.setRates(null);
  assert.equal(api.convertedTotals(api.currentFinancialTotals(),'USD'),null);
});
test('annual report excludes trips from car total and includes legacy maintenance',()=>{
  const {api,node}=setup();
  node('#report-period').value='custom';node('#report-from').value='2026-01-01';node('#report-to').value='2026-12-31';
  api.renderReport();
  const html=node('#report-content').innerHTML;
  const car=html.split('<h3>إجمالي مصروفات السيارة</h3>')[1].split('<div class="report-service">')[0];
  assert.match(car,/د.ك/);assert.doesNotMatch(car,/₺|€|\$/);
  assert.match(html,/Garage/);assert.match(html,/إجمالي مصروفات الرحلات/);
  node('[data-report-section="trips"]').checked=false;
  api.renderReport();
  assert.doesNotMatch(node('#report-content').innerHTML,/إجمالي مصروفات الرحلات/);
});
test('loading and displaying old records never writes storage or mutates their original data',()=>{
  const {api,node,writes,stored,plain}=setup();
  const before=plain(api.data);
  api.load();api.currentFinancialTotals();api.carExpenses(api.data.expenses,api.data.maintenance);api.renderReport();
  assert.deepEqual(writes,[]);
  assert.deepEqual(plain(api.data),before);
  assert.equal(JSON.stringify(fixture),stored);
  assert.equal(api.data.maintenance[0].custom,'preserve');
  assert.deepEqual(plain(api.data.maintenance),fixture.maintenance);
});
test('desktop/mobile share expenses entry and retain currency converter and maintenance reminders',()=>{
  const html=fs.readFileSync('index.html','utf8');
  assert.doesNotMatch(html,/id="maintenance-section"|data-nav="maintenance"|data-report-section="maintenance"/);
  assert.ok((html.match(/data-nav="expenses"/g)||[]).length>=2);
  for(const id of ['expense-list','service-alert','currency-converter','final-total-value'])assert.ok(html.includes('id="'+id+'"'));
  assert.ok(source.includes("const KEY='sayyarati-data-v3'"));
});

test('explicit 500 KWD car / 200 KWD trips: displayed totals stay separate, never 700',()=>{
  const {api,node,writes,plain}=setup();
  api.data.vehicles=api.data.vehicles.slice(0,1);
  api.data.expenses=[{id:'general',vehicleId:'v1',date:'2026-03-01',category:'fuel',amount:350,currency:'KWD'},
    {id:'service',vehicleId:'v1',date:'2026-03-02',category:'maintenance',amount:100,currency:'KWD'}];
  api.data.maintenance=[{id:'legacy-service',vehicleId:'v1',date:'2026-02-01',types:['engine_oil'],cost:50,currency:'KWD'}];
  api.data.trips=[{id:'trip',vehicleId:'v1',date:'2026-04-01',expenses:[
    {type:'fuel',cost:150,currency:'KWD'},{type:'maintenance',cost:50,currency:'KWD'}]}];
  api.setRates({KWD:1,USD:2,EUR:3,TRY:4,SAR:5});
  node('#final-currency').value='KWD';
  node('#converter-from').value='KWD';node('#converter-to').value='USD';node('#converter-amount').value='1';
  const original=plain(api.data);
  const text=html=>html.replace(/<[^>]*>/g,' ').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const checkDisplays=(car,trip)=>{
    api.renderHome();api.renderCurrencyTools();api.renderReport();
    api.renderExpenses(api.carExpenses(api.data.expenses,api.data.maintenance),api.totalsFor('v1'));
    assert.deepEqual(plain(api.totalsFor('v1')),{KWD:car});
    assert.deepEqual(plain(api.tripTotals(api.data.trips[0])),{KWD:trip});
    for(const id of ['#home-expenses','#final-total-value','#expense-totals']){
      assert.match(text(node(id).innerHTML),new RegExp('\\b'+car+'\\b'));
      assert.doesNotMatch(text(node(id).innerHTML),/\b700\b/);
    }
    const report=node('#report-content').innerHTML;
    const carSection=report.split('<h3>إجمالي مصروفات السيارة</h3>')[1].split('<div class="report-service">')[0];
    const tripSection=report.split('<h2>إجمالي مصروفات الرحلات</h2>')[1].split('</section>')[0];
    assert.match(text(carSection),new RegExp('\\b'+car+'\\b'));
    assert.match(text(tripSection),new RegExp('\\b'+trip+'\\b'));
    assert.doesNotMatch(text(report),/\b700\b/);
  };
  checkDisplays(500,200);
  assert.deepEqual(plain(api.data),original);
  node('#report-period').value='custom';node('#report-from').value='2026-01-01';node('#report-to').value='2026-12-31';
  checkDisplays(500,200);
  api.data.trips[0].expenses.push({type:'maintenance',cost:25,currency:'KWD'});
  checkDisplays(500,225);
  api.data.expenses.push({id:'extra',vehicleId:'v1',date:'2026-05-01',category:'maintenance',amount:30,currency:'KWD'});
  checkDisplays(530,225);
  assert.deepEqual(writes,[]);
});
