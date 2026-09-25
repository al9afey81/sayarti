// Run with Playwright available through NODE_PATH; uses an isolated browser profile.
const {chromium}=require('playwright');
const realOCR=process.env.REAL_OCR==='1';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),KEY='sayyarati-data-v3';
const fixture={version:3,activeVehicleId:'v1',vehicles:[{id:'v1',name:'شقران',make:'Toyota',model:'Land Cruiser',trim:'',year:2026,color:'white',fuel:'diesel',plate:'',image:'',imageUrl:'',notes:'',createdAt:'2026-01-01T00:00:00Z',odometer:12000,odometerUpdatedAt:'2026-01-01T00:00:00Z',serviceInterval:10000}],expenses:[{id:'e1',vehicleId:'v1',amount:500,currency:'KWD',category:'fuel',date:'2026-01-01'}],maintenance:[],trips:[{id:'t1',vehicleId:'v1',date:'2026-01-01',currency:'KWD',totalCost:200,distanceKm:null,expenses:[{id:'te1',type:'fuel',cost:200,currency:'KWD',maintenanceType:''}]}]};
const server=http.createServer((req,res)=>{
  const file=path.join(root,new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(data)});
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,channel:"chrome"});
  try{
    for(const width of (realOCR?[390]:[320,390,1280])){
      const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,isMobile:width<500,hasTouch:width<500});
      await context.addInitScript(({fixture,KEY,realOCR})=>{
        localStorage.setItem(KEY,JSON.stringify(fixture));
      },{fixture,KEY,realOCR});
      await context.route('**/auth.js*',route=>route.fulfill({contentType:'application/javascript',body:''}));
      if(!realOCR)await context.route('https://cdn.jsdelivr.net/**',route=>route.abort());
      await context.route('https://fonts.**',route=>route.abort());
      await context.route('https://open.er-api.com/**',route=>route.fulfill({json:{result:'success',rates:{KWD:1,USD:3,EUR:3,TRY:100,SAR:10,AED:10,QAR:10,BHD:1,OMR:1,JOD:2,EGP:100,IQD:4000}}}));
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      console.log('Opening '+width+'px');
      await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
      await page.locator('#auth-gate').evaluate(el=>{el.hidden=true;document.body.classList.add('auth-ready')});
      const snapshot=()=>page.evaluate(KEY=>localStorage.getItem(KEY),KEY);
      const before=await snapshot();
      const save=()=>page.locator('#app-form button[type=submit]').click();
      for(const name of ['Second','Third']){
        await page.locator('[data-action="add-vehicle"]:visible').click();
        await page.locator('#app-form [name=name]').fill(name);await save();
        assert.equal(await page.locator('#vehicle-name').innerText(),name);
      }
      let saved=JSON.parse(await snapshot());assert.equal(saved.vehicles.length,3);
      const second=saved.vehicles.find(v=>v.name==='Second'),third=saved.vehicles.find(v=>v.name==='Third');
      const switchTo=async id=>{await page.locator('[data-action="home"]:visible').first().click();await page.locator('.vehicle-card[data-id="'+id+'"]').click()};
      await switchTo(second.id);
      for(const [date,amount] of [['2026-07-21','12'],['2026-06-21','3'],['2026-06-01','4']]){
        await page.locator('[data-action="add-expense"]:visible').first().click();
        await page.locator('[name=date]').fill(date);await page.locator('[name=amount]').fill(amount);await save();
      }
      assert.deepEqual(await page.locator('.expense-month th').allTextContents(),['يونيو 2026','يوليو 2026']);
      const totals=await page.locator('.expense-month-total .metric-number').allTextContents();assert.deepEqual(totals,['7','12']);
      await page.locator('[data-action="vehicle-report"]').click();
      const report=await page.locator('#report-content').innerText();assert.ok(report.indexOf('يونيو 2026')<report.indexOf('يوليو 2026'));
      assert.equal((report.match(/إجمالي مصروفات الشهر/g)||[]).length,2);
      await page.pdf({path:'/private/tmp/sayyarati-months-'+width+'.pdf',format:'A4'});
      await page.locator('#report-dialog').evaluate(el=>el.close());
      await switchTo(third.id);assert.equal(await page.locator('.expense-month').count(),0);assert.equal(await page.locator('.trip-card').count(),0);
      await switchTo('v1');assert.match(await page.locator('#expense-list').innerText(),/500/);assert.equal(await page.locator('.trip-card').count(),1);
      await switchTo(second.id);
      await page.locator('[data-action="add-expense"]:visible').first().click();
      const beforeOCR=await snapshot();
      if(!realOCR)await page.evaluate(()=>{window.Tesseract={createWorker:async()=>({terminate:async()=>{},recognize:async()=>{const text='Merchant: Desert Fuel\nDate: 2026-07-21\nTOTAL KWD 21.000';return {data:{text,blocks:[{paragraphs:[{lines:text.split('\n').map(text=>({text,words:text.split(' ').map(text=>({text,confidence:97}))}))}]}]}}}})}});
      const base64=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1200;c.height=500;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='48px Arial';['Merchant: Desert Fuel','Date: 2026-07-21','TOTAL KWD 21.000'].forEach((s,i)=>x.fillText(s,50,100+i*120));return c.toDataURL().split(',')[1]});
      const uploadReceipt=()=>page.locator('[data-receipt-file]').setInputFiles({name:'receipt.png',mimeType:'image/png',buffer:Buffer.from(base64,'base64')});
      await uploadReceipt();
      await page.waitForFunction(()=>document.querySelector('[name=amount]').value==='21',null,{timeout:65000});
      assert.equal(await page.locator('[name=date]').inputValue(),'2026-07-21');assert.equal(await page.locator('[name=currency]').inputValue(),'KWD');assert.equal(await page.locator('[name=category]').inputValue(),'fuel');
      assert.equal(await page.locator('.receipt-camera img').isVisible(),true);assert.equal(await snapshot(),beforeOCR);
      await page.locator('[name=amount]').fill('22');await save();
      saved=JSON.parse(await snapshot());assert.equal(saved.expenses.at(-1).amount,22);assert.equal(saved.expenses.at(-1).vehicleId,second.id);
      assert.deepEqual(saved.vehicles[0],JSON.parse(before).vehicles[0]);assert.deepEqual(saved.trips,JSON.parse(before).trips);assert.deepEqual(saved.expenses[0],JSON.parse(before).expenses[0]);
      if(!realOCR){
        await page.locator('[data-action="add-expense"]:visible').first().click();
        const unchanged=await snapshot();
        await page.evaluate(()=>{window.Tesseract={createWorker:async()=>({terminate:async()=>{},recognize:async()=>({data:{text:'unclear',blocks:[]}})})}});
        await uploadReceipt();await page.waitForFunction(()=>document.querySelector('.receipt-camera [role=status]').textContent.includes('لم تظهر'));
        assert.equal(await page.locator('[name=amount]').inputValue(),'');assert.equal(await snapshot(),unchanged);
        await page.locator('[name=amount]').fill('17');assert.equal(await page.locator('[name=amount]').inputValue(),'17');
        await page.locator('[data-action="close-dialog"]').click();assert.equal(await snapshot(),unchanged);
      }
      assert.equal(errors.length,0,errors.join('\n'));
      console.log('PASS '+width+'px: 3 vehicles, switching, isolation, monthly totals, PDF, receipt fields, manual correction, no auto-save, no JS errors'+(realOCR?' (actual OCR)':''));
      await context.close();
    }
  }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
