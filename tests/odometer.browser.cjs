// Run with Playwright available through NODE_PATH; uses an isolated browser profile.
const {chromium}=require('playwright');
const realOCR=process.env.REAL_OCR==='1';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),KEY='sayyarati-data-v3';
const fixture={version:3,activeVehicleId:'v1',vehicles:[{id:'v1',name:'Test car',odometer:12000,odometerUpdatedAt:'2026-01-01T00:00:00Z',serviceInterval:10000}],expenses:[{id:'e1',vehicleId:'v1',amount:500,currency:'KWD',category:'fuel',date:'2026-01-01'}],maintenance:[],trips:[{id:'t1',vehicleId:'v1',date:'2026-01-01',currency:'KWD',totalCost:200,distanceKm:null,expenses:[{id:'te1',type:'fuel',cost:200,currency:'KWD',maintenanceType:''}]}]};
const server=http.createServer((req,res)=>{
  const file=path.join(root,new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(data)});
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true});
  try{
    for(const width of (realOCR?[390]:[320,390,1280])){
      const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,isMobile:width<500,hasTouch:width<500});
      await context.addInitScript(({fixture,KEY,realOCR})=>{
        localStorage.setItem(KEY,JSON.stringify(fixture));
        if(realOCR)return;
        window.ocrMode='success';
        window.Tesseract={createWorker:async()=>({
          setParameters:async()=>{},terminate:async()=>{},
          recognize:async()=>{
            if(window.ocrMode==='delayed')await new Promise(resolve=>window.finishOCR=resolve);
            if(window.ocrMode==='error')throw Error('Test OCR failure');
            const confidence=window.ocrMode==='unclear'?40:97;
            return {data:{text:'ODO 123456 km',blocks:[{paragraphs:[{lines:[{text:'ODO 123456 km',words:[{text:'123456',confidence}]}]}]}]}};
          }
        })};
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
      assert.equal(await page.locator('#stat-cost-km').count(),0);
      const open=()=>page.locator('[data-action="edit-odometer"]').click();
      const input=page.locator('#app-form [name=odometer]');
      const upload=async()=>{
        const base64=await page.evaluate(()=>{
          const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=220;
          const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1000,220);ctx.fillStyle='#000';ctx.font='72px Arial';ctx.fillText('ODO 123456 km',40,130);
          return canvas.toDataURL('image/png').split(',')[1];
        });
        await page.locator('[data-odometer-file]').setInputFiles({name:'odometer.png',mimeType:'image/png',buffer:Buffer.from(base64,'base64')});
      };
      console.log('Opening odometer form');
      await open();
      assert.equal(await page.locator('[data-odometer-capture]').getAttribute('capture'),'environment');
      const chooser=page.waitForEvent('filechooser');await page.locator('[data-odometer-camera]').click();await chooser;
      console.log('Reading selected image');
      await upload();
      await page.waitForFunction(()=>document.querySelector('[name=odometer]').value==='123456',null,{timeout:65000});
      assert.equal(await snapshot(),before,'OCR must not persist data');
      assert.equal(await page.locator('.odometer-preview').isVisible(),true);
      assert.equal(await page.locator('#app-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true,'dialog must not overflow');
      assert.equal(await page.locator('.odometer-field').evaluate(el=>el.scrollWidth<=el.clientWidth),true,'camera controls must fit');
      await page.screenshot({path:'/private/tmp/sayarti-odometer-'+width+'.png'});
      if(realOCR){console.log('PASS actual Tesseract OCR: 123456 km, preview and storage unchanged');await context.close();continue}
      await page.locator('[data-action="close-dialog"]').click();
      assert.equal(await snapshot(),before,'cancel must not persist');
      await open();assert.equal(await input.inputValue(),'12000');
      await page.evaluate(()=>window.ocrMode='unclear');await upload();
      await page.waitForFunction(()=>document.querySelector('.odometer-status').textContent.includes('لم نتمكن'));
      assert.equal(await input.inputValue(),'12000');
      await page.evaluate(()=>window.ocrMode='error');await upload();
      await page.waitForFunction(()=>document.querySelector('.odometer-status').textContent.includes('لم نتمكن'));
      assert.equal(await input.inputValue(),'12000');
      await page.evaluate(()=>window.ocrMode='delayed');await upload();
      await page.waitForFunction(()=>typeof window.finishOCR==='function');
      await input.fill('13000');await page.evaluate(()=>window.finishOCR());
      await page.waitForTimeout(50);assert.equal(await input.inputValue(),'13000');
      assert.equal(await snapshot(),before);
      await page.evaluate(()=>window.ocrMode='success');await upload();
      await page.waitForFunction(()=>document.querySelector('[name=odometer]').value==='123456',null,{timeout:65000});
      await input.fill('123450');
      await page.locator('#app-form button[type=submit]').click();
      await page.waitForFunction(()=>!document.querySelector('#app-dialog').open);
      const after=JSON.parse(await snapshot());
      assert.equal(after.vehicles[0].odometer,123450);
      for(const key of ['trips','expenses','maintenance'])assert.deepEqual(after[key],JSON.parse(before)[key]);
      assert.doesNotMatch(await snapshot(),/blob:|data:image/);
      await open();await page.evaluate(()=>{window.ocrMode='delayed';delete window.finishOCR});await upload();
      await page.waitForFunction(()=>typeof window.finishOCR==='function');
      await page.locator('[data-action="close-dialog"]').click();
      await open();await page.evaluate(()=>window.finishOCR());await page.waitForTimeout(50);
      assert.equal(await input.inputValue(),'123450','late result must not affect reopened dialog');
      await page.locator('[data-action="close-dialog"]').click();
      await page.locator('[data-action="edit-vehicle"]').click();
      assert.equal(await page.locator('[data-odometer-camera]').count(),1);
      assert.equal(await page.locator('.odometer-field').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
      await page.locator('[data-action="close-dialog"]').click();
      await page.locator('#language-select').evaluate(el=>{el.value='en';el.dispatchEvent(new Event('change',{bubbles:true}))});
      await open();
      assert.match(await page.locator('[data-odometer-camera]').innerText(),/Photograph odometer/);
      assert.equal(errors.length,0,errors.join('\n'));
      console.log('PASS '+width+'px: capture, preview, no auto-save, manual correction, save, cancel, unclear/error, late result isolation and layout');
      await context.close();
    }
  }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
