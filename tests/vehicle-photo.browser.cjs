// NODE_PATH must point to Playwright. ENGINE=webkit and optional WEBKIT_EXECUTABLE
// select WebKit. Every test uses isolated storage, never a user's browser profile.
const {chromium,webkit,devices}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),KEY='sayyarati-data-v3';
const vehicle=(id,name)=>({id,name,make:'Jeep',model:'Wrangler',trim:'',year:2024,color:'white',fuel:'gasoline',plate:'',image:'',imageUrl:'',odometer:100,odometerUpdatedAt:'2026-01-01',serviceInterval:10000,notes:'preserve',createdAt:'2026-01-01'});
const fixture={version:3,activeVehicleId:'photo-test',vehicles:[vehicle('shaqran','شقران'),vehicle('jeep','الجيب'),vehicle('photo-test','اختبار الصورة')],maintenance:[],expenses:[{id:'e1',vehicleId:'shaqran',date:'2026-01-01',category:'fuel',currency:'KWD',amount:12}],trips:[]};
fixture.vehicles[0].image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
fixture.vehicles[1].imageUrl='assets/car.png';
const server=http.createServer((req,res)=>{
  const file=path.join(root,new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
  try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'image/png');res.end(fs.readFileSync(file))}catch{res.writeHead(404);res.end()}
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    const engine=process.env.ENGINE||'chromium';
    browser=await (engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='webkit'?(process.env.WEBKIT_EXECUTABLE?{executablePath:process.env.WEBKIT_EXECUTABLE}:{}):{channel:'chrome'})});
    const context=await browser.newContext({...devices['iPhone 13']});
    await context.route('**/auth.js*',r=>r.fulfill({contentType:'application/javascript',body:''}));
    await context.route('https://cdn.jsdelivr.net/**',r=>r.abort());await context.route('https://fonts.**',r=>r.abort());
    await context.route('https://open.er-api.com/**',r=>r.fulfill({json:{result:'success',rates:Object.fromEntries(['KWD','TRY','EUR','USD','SAR','IQD','QAR','BHD','AED','OMR'].map(c=>[c,1]))}}));
    const page=await context.newPage(),uncaught=[],diagnostics=[];
    page.on('pageerror',e=>uncaught.push(e.message));page.on('console',m=>{if(m.type()==='error'&&m.text().includes('[vehicle-photo]'))diagnostics.push(m.text())});
    await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load'});
    await page.evaluate(({KEY,fixture})=>localStorage.setItem(KEY,JSON.stringify(fixture)),{KEY,fixture});
    const ready=async()=>{await page.locator('#auth-gate').evaluate(el=>{el.hidden=true;document.body.classList.add('auth-ready')})};
    await page.reload();await ready();const state=()=>page.evaluate(KEY=>JSON.parse(localStorage.getItem(KEY)),KEY),baseline=await state();
    const protectedData=async()=>{const d=await state();assert.deepEqual(d.vehicles.slice(0,2),baseline.vehicles.slice(0,2));for(const key of ['maintenance','expenses','trips'])assert.deepEqual(d[key],baseline[key])};
    const visiblePhoto=async()=>{await page.waitForFunction(()=>{const img=document.querySelector('#vehicle-photo');return !img.hidden&&img.complete&&img.naturalWidth>0});assert.ok(await page.locator('#vehicle-photo').evaluate(el=>el.naturalWidth<=1280&&el.naturalHeight<=1280))};
    const showReport=async()=>{await page.locator('[data-action="vehicle-report"]').click();await page.waitForFunction(()=>{const img=document.querySelector('#report-content .report-vehicle img');return img?.complete&&img.naturalWidth>0});await page.evaluate(()=>{window.printedPhotoReady=false;window.print=()=>{const img=document.querySelector('#report-content .report-vehicle img');window.printedPhotoReady=!!(img?.complete&&img.naturalWidth)}});await page.locator('#print-report').click();await page.waitForFunction(()=>window.printedPhotoReady);await page.locator('#report-dialog').evaluate(el=>el.close())};
    const storedPhoto=async id=>page.evaluate(async id=>{const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('sayyarati-vehicle-photos',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});try{const blob=await new Promise((resolve,reject)=>{const tx=db.transaction('images','readonly'),req=tx.objectStore('images').get(id);tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error)});return{size:blob.size,type:blob.type}}finally{db.close()}},id);
    await page.locator('#vehicle-photo-input').setInputFiles(path.join(root,'assets','car.png'));
    await page.waitForFunction(KEY=>!!JSON.parse(localStorage.getItem(KEY)).vehicles[2].imageId,KEY);
    await visiblePhoto();let saved=await state();assert.equal(saved.vehicles[2].image,'');assert.equal(saved.vehicles[2].imageUrl,'');const firstPhoto=await storedPhoto(saved.vehicles[2].imageId);assert.equal(firstPhoto.type,'image/jpeg');assert.ok(firstPhoto.size<=72*1024);
    await page.reload();await ready();await visiblePhoto();await showReport();await protectedData();assert.equal(diagnostics.length,0);
    console.log('PASS: photo stored as JPEG Blob in IndexedDB; only imageId in LocalStorage; reload, report and print work. Engine='+engine);
    const originalBytes=await page.evaluate(async()=>{
      const canvas=document.createElement('canvas');canvas.width=4000;canvas.height=3000;
      const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(4000,3000);let seed=123456;
      for(let i=0;i<pixels.data.length;i+=4){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;pixels.data[i]=seed&255;pixels.data[i+1]=(seed>>>8)&255;pixels.data[i+2]=(seed>>>16)&255;pixels.data[i+3]=255}
      ctx.putImageData(pixels,0,0);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));canvas.width=0;canvas.height=0;
      const dt=new DataTransfer();dt.items.add(new File([blob],'large.png',{type:'image/png'}));const input=document.querySelector('#vehicle-photo-input');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));return blob.size;
    });assert.ok(originalBytes>25*1024*1024);
    const priorPhotoId=saved.vehicles[2].imageId;
    await page.waitForFunction(({KEY,old})=>JSON.parse(localStorage.getItem(KEY)).vehicles[2].imageId!==old,{KEY,old:priorPhotoId});
    saved=await state();const largePhoto=await storedPhoto(saved.vehicles[2].imageId);assert.ok(largePhoto.size<=72*1024);assert.equal(saved.vehicles[2].image,'');assert.deepEqual(await storedPhoto(priorPhotoId),firstPhoto);await page.reload();await ready();await visiblePhoto();await showReport();await protectedData();
    console.log('PASS: '+originalBytes+' byte PNG compressed to '+largePhoto.size+' byte JPEG in IndexedDB; old stored image retained.');
    await page.locator('[data-action="add-vehicle"]:visible').click();
    await page.locator('[name=make]').selectOption('Nissan');await page.locator('[name=model]').selectOption('Patrol');await page.locator('[name=year]').selectOption('2024');
    await page.locator('#app-form [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#app-dialog').open);
    // Exhaust actual quota in the isolated context, without mocking setItem.
    const quota=await page.evaluate(()=>{let low=0,high=12*1024*1024,name='';while(high-low>1024){const mid=Math.floor((low+high)/2);try{localStorage.setItem('photo-test-filler','x'.repeat(mid));low=mid}catch(e){name=e.name;high=mid}}localStorage.setItem('photo-test-filler','x'.repeat(Math.max(0,low-28*1024)));return name});
    assert.equal(quota,'QuotaExceededError');await page.locator('#vehicle-photo-input').setInputFiles(path.join(root,'assets','car.png'));
    await page.waitForFunction(KEY=>!!JSON.parse(localStorage.getItem(KEY)).vehicles.at(-1).imageId,KEY);
    saved=await state();assert.equal(saved.vehicles.at(-1).image,'');assert.equal(diagnostics.length,0);
    await page.reload();await ready();await visiblePhoto();await showReport();await protectedData();
    console.log('PASS: photo saved with nearly full LocalStorage; no application QuotaExceededError; protected data unchanged.');
    await page.evaluate(()=>localStorage.removeItem('photo-test-filler'));
    // Photo selected inside the add form must be saved too, not just previewed.
    await page.locator('[data-action="add-vehicle"]:visible').click();
    await page.locator('[name=make]').selectOption('Nissan');await page.locator('[name=model]').selectOption('Patrol');await page.locator('[name=year]').selectOption('2024');
    await page.locator('#form-vehicle-image-input').setInputFiles(path.join(root,'assets','car.png'));
    await page.waitForFunction(()=>document.querySelector('#form-vehicle-image-preview').src.startsWith('data:image/jpeg;')&&!document.querySelector('#app-form [type=submit]').disabled);
    const count=(await state()).vehicles.length;await page.locator('#app-form [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#app-dialog').open);
    assert.equal((await state()).vehicles.length,count+1);await page.reload();await ready();await visiblePhoto();await showReport();await protectedData();
    // Replacing a photo from the edit form updates the same vehicle, not a new one.
    const editedId=(await state()).activeVehicleId;
    await page.locator('[data-action="edit-vehicle"]').click();await page.locator('#form-vehicle-image-input').setInputFiles(path.join(root,'assets','fleet-hero.png'));
    await page.waitForFunction(()=>!document.querySelector('#app-form [type=submit]').disabled);
    await page.locator('#app-form [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#app-dialog').open);
    assert.equal((await state()).vehicles.length,count+1);assert.equal((await state()).activeVehicleId,editedId);await page.reload();await ready();await visiblePhoto();await showReport();await protectedData();
    console.log('PASS: photos saved through add/edit forms, persist after reload and appear in report; no duplicate vehicle.');
    const currentId=(await state()).activeVehicleId;
    const switchTo=async id=>{await page.locator('[data-action="home"]:visible').first().click();await page.locator('.vehicle-card[data-id="'+id+'"]').click()};
    for(const id of ['shaqran','jeep']){await switchTo(id);await page.waitForFunction(()=>{const img=document.querySelector('#vehicle-photo');return img.complete&&img.naturalWidth>0});await showReport()}
    await switchTo(currentId);await visiblePhoto();await protectedData();
    console.log('PASS: legacy base64 and imageUrl photos still render and print; Shaqran and Jeep records unchanged.');
    const beforeExport=await state(),downloadPromise=page.waitForEvent('download');await page.locator('#export-btn').evaluate(el=>el.click());
    const download=await downloadPromise,stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
    const backup=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    assert.ok(backup.vehicles.at(-1).image.startsWith('data:image/jpeg;base64,'));assert.equal(backup.vehicles.at(-1).imageId,undefined);assert.deepEqual(backup.vehicles.slice(0,2),baseline.vehicles.slice(0,2));assert.deepEqual(await state(),beforeExport);
    console.log('PASS: backup includes IndexedDB photos without putting base64 back into LocalStorage.');
    await page.evaluate(()=>{window.originalPhotoAdd=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(){throw new DOMException('Simulated image storage failure','UnknownError')}});
    await page.locator('#vehicle-photo-input').setInputFiles(path.join(root,'assets','car.png'));
    await page.waitForFunction(()=>document.querySelector('[data-image-status]')?.textContent.includes('Console'));
    assert.deepEqual(await state(),beforeExport);assert.ok(diagnostics.some(text=>text.includes('indexedDB-write')&&text.includes('UnknownError')));
    await page.evaluate(()=>IDBObjectStore.prototype.add=window.originalPhotoAdd);await visiblePhoto();
    console.log('PASS: IndexedDB failure preserves old photo reference and all vehicle data.');
    const before=await state();await page.locator('#vehicle-photo-input').setInputFiles({name:'bad.heic',mimeType:'image/heic',buffer:Buffer.from('invalid')});
    await page.waitForFunction(()=>document.querySelector('[data-image-status]')?.textContent.includes('HEIC'));assert.deepEqual(await state(),before);assert.ok(diagnostics.some(text=>text.includes('decode')&&text.includes('EncodingError')));
    await page.evaluate(()=>{window.originalToBlob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(callback){callback(null)}});
    await page.locator('#vehicle-photo-input').setInputFiles(path.join(root,'assets','car.png'));await page.waitForFunction(()=>document.querySelector('[data-image-status]')?.textContent.includes('Console'));
    assert.deepEqual(await state(),before);assert.ok(diagnostics.some(text=>text.includes('canvas-toBlob')));await page.evaluate(()=>HTMLCanvasElement.prototype.toBlob=window.originalToBlob);
    assert.deepEqual(uncaught,[]);await protectedData();console.log('PASS: separate decode/toBlob diagnostics; failed uploads preserve existing photo; no uncaught JS errors.');
  }finally{if(browser)await browser.close();server.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
