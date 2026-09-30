// Run with Playwright available through NODE_PATH; uses an isolated browser profile.
const {chromium}=require('playwright');
const realOCR=process.env.REAL_OCR==='1';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),KEY='sayyarati-data-v3';
const fixture={version:3,activeVehicleId:'v1',vehicles:[{id:'v1',name:'شقران',make:'Toyota',model:'Land Cruiser',trim:'',year:2026,color:'white',fuel:'diesel',plate:'',image:'',imageUrl:'',notes:'',createdAt:'2026-01-01T00:00:00Z',odometer:12000,odometerUpdatedAt:'2026-01-01T00:00:00Z',serviceInterval:10000}],expenses:[{id:'e1',vehicleId:'v1',amount:500,currency:'KWD',category:'fuel',date:'2026-01-01'}],maintenance:[{id:'old-maintenance',vehicleId:'v1',date:'2026-05-01',odometer:10000,types:['engine_oil'],cost:5,currency:'KWD',workshop:'Garage',notes:'old',custom:'preserved'}],trips:[{id:'t1',vehicleId:'v1',date:'2026-01-01',currency:'KWD',totalCost:200,distanceKm:null,expenses:[{id:'te1',type:'fuel',cost:200,currency:'KWD',maintenanceType:''}]}]};
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
        if(!localStorage.getItem(KEY))localStorage.setItem(KEY,JSON.stringify(fixture));
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
      const open=()=>page.locator('[data-action="add-expense"]:visible').first().click();
      await open();await page.locator('[name=category]').selectOption('maintenance');
      assert.equal(await page.locator('[name=maintenanceDetails]').isVisible(),true);
      if(!realOCR)await page.evaluate(()=>{window.mode='success';window.Tesseract={createWorker:async()=>({terminate:async()=>{},recognize:async()=>{if(window.mode==='error')throw Error('test');if(window.mode==='delayed')await new Promise(resolve=>window.finishOCR=resolve);const text='Oil change 15\nOil filter 5\nBrake repair 30\nTOTAL KWD 50\n2026-09-21';return{data:{text,blocks:[{paragraphs:[{lines:text.split('\n').map(text=>({text,words:[{text,confidence:window.mode==='unclear'?30:97}]}))}]}]}}}})}});
      const base64=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1400;c.height=720;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='48px Arial';['Oil change 15','Oil filter 5','Brake repair 30','TOTAL KWD 50','2026-09-21'].forEach((s,i)=>x.fillText(s,50,100+i*120));return c.toDataURL().split(',')[1]});
      const upload=()=>page.locator('[data-receipt-file]').setInputFiles({name:'maintenance.png',mimeType:'image/png',buffer:Buffer.from(base64,'base64')});
      await upload();await page.waitForFunction(()=>document.querySelector('[name=maintenanceDetails]').value.includes('Oil filter'),null,{timeout:65000});
      assert.equal(await page.locator('[name=amount]').inputValue(),'50');assert.equal(await snapshot(),before);
      await page.locator('[name=maintenanceDetails]').fill('تغيير زيت المحرك\nتبديل فلتر الزيت — مراجعة المستخدم');
      await save();let saved=JSON.parse(await snapshot()),record=saved.expenses.at(-1);
      assert.match(record.receiptImage,/^data:image\/jpeg;base64,/);assert.match(record.maintenanceDetails,/مراجعة المستخدم/);
      assert.deepEqual(saved.vehicles,JSON.parse(before).vehicles);assert.deepEqual(saved.trips,JSON.parse(before).trips);assert.deepEqual(saved.expenses[0],JSON.parse(before).expenses[0]);
      await page.reload();await page.locator('#auth-gate').evaluate(e=>{e.hidden=true;document.body.classList.add('auth-ready')});
      assert.match(await page.locator('#expense-list').innerText(),/مراجعة المستخدم/);assert.equal(await page.locator('#expense-list .maintenance-receipt img').count(),1);
      await page.locator('[data-action="edit-expense"][data-id="'+record.id+'"]').click();
      assert.equal(await page.locator('[name=maintenanceDetails]').inputValue(),record.maintenanceDetails);assert.equal(await page.locator('[name=receiptImage]').inputValue(),record.receiptImage);
      await save();
      await page.locator('[data-action="vehicle-report"]').click();assert.match(await page.locator('#report-content').innerText(),/مراجعة المستخدم/);assert.equal(await page.locator('#report-content .maintenance-receipt img').count(),1);
      await page.pdf({path:'/private/tmp/maintenance-receipt-'+width+'.pdf',format:'A4'});await page.locator('#report-dialog').evaluate(e=>e.close());
      if(!realOCR)await page.evaluate(()=>{window.mode='success';window.Tesseract={createWorker:async()=>({terminate:async()=>{},recognize:async()=>{if(window.mode==='error')throw Error('test');if(window.mode==='delayed')await new Promise(resolve=>window.finishOCR=resolve);const text='Oil change 15\nOil filter 5\nBrake repair 30\nTOTAL KWD 50\n2026-09-21';return{data:{text,blocks:[{paragraphs:[{lines:text.split('\n').map(text=>({text,words:[{text,confidence:window.mode==='unclear'?30:97}]}))}]}]}}}})}});
      if(!realOCR){
        for(const mode of ['unclear','error']){
          await open();await page.locator('[name=category]').selectOption('maintenance');await page.evaluate(mode=>window.mode=mode,mode);await upload();
          await page.waitForFunction(()=>!document.querySelector('.receipt-camera').hasAttribute('aria-busy'));
          if(mode==='unclear')assert.match(await page.locator('[name=maintenanceDetails]').inputValue(),/Oil filter/);else assert.equal(await page.locator('[name=maintenanceDetails]').inputValue(),'');assert.match(await page.locator('[name=receiptImage]').inputValue(),/^data:image/);
          await page.locator('[data-action="close-dialog"]').click();
        }
        // Late OCR must not overwrite a manual correction.
        await open();await page.locator('[name=category]').selectOption('maintenance');await page.evaluate(()=>{window.mode='delayed';delete window.finishOCR});await upload();await page.waitForFunction(()=>typeof window.finishOCR==='function');
        await page.locator('[name=maintenanceDetails]').fill('إدخال يدوي');await page.evaluate(()=>window.finishOCR());assert.equal(await page.locator('[name=maintenanceDetails]').inputValue(),'إدخال يدوي');
        await page.locator('[name=amount]').fill('10');
        const beforeFailure=await snapshot();
        await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='sayyarati-data-v3')throw new DOMException('Full','QuotaExceededError');return window.originalSet.call(this,key,value)}});
        await save();assert.equal(await page.locator('#app-dialog').evaluate(e=>e.open),true);assert.equal(await snapshot(),beforeFailure);assert.equal(await page.locator('[name=maintenanceDetails]').inputValue(),'إدخال يدوي');
        await page.evaluate(()=>Storage.prototype.setItem=window.originalSet);await save();assert.equal(JSON.parse(await snapshot()).expenses.length,3);
        await page.locator('[data-action="edit-expense"][data-id="'+record.id+'"]').click();await page.locator('[data-receipt-remove]').click();await save();assert.equal(JSON.parse(await snapshot()).expenses.find(e=>e.id===record.id).receiptImage,'');
        // Existing maintenance records use the same OCR and retain their original metadata.
        await page.locator('[data-action="edit-maintenance"][data-id="old-maintenance"]').click();await page.evaluate(()=>window.mode='success');await upload();await page.waitForFunction(()=>document.querySelector('[name=cost]').value==='50');await save();
        const legacy=JSON.parse(await snapshot()).maintenance[0];assert.equal(legacy.custom,'preserved');assert.match(legacy.receiptImage,/^data:image/);assert.match(legacy.maintenanceDetails,/Oil filter/);
      }
      assert.deepEqual(errors,[]);console.log('PASS maintenance receipt '+width+'px'+(realOCR?' actual OCR':''));await context.close();
    }
  }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
