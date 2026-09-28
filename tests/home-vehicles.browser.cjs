// Run with Playwright available through NODE_PATH. Uses isolated test data only.
const {chromium,devices}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),KEY='sayyarati-data-v3',artifacts=path.join(root,'artifacts','home-vehicles');
const vehicle=(id,name,make,model,year,odometer,serviceInterval,imageUrl)=>({id,name,make,model,year,odometer,serviceInterval,imageUrl,trim:'',image:'',color:'white',fuel:'diesel',plate:'',notes:'protected',createdAt:'2026-01-01',odometerUpdatedAt:'2026-09-01'});
const fixture={version:3,activeVehicleId:null,vehicles:[vehicle('shaqran','شقران','Great Wall / GWM','Poer',2025,12450,10000,'assets/fleet-hero.png'),vehicle('jeep','الجيب','Jeep','Wrangler',2020,81200,5000,'assets/fleet-hero.png'),{...vehicle('patrol','باترول','Nissan','Patrol',2024,20500,7500,''),imageId:'test-patrol-photo'}],maintenance:[{id:'m1',vehicleId:'shaqran',date:'2026-09-01',odometer:12000,cost:20,currency:'KWD',types:['engine_oil']},{id:'m2',vehicleId:'jeep',date:'2026-09-01',odometer:80000,cost:30,currency:'KWD',types:['engine_oil']},{id:'m3',vehicleId:'patrol',date:'2026-09-01',odometer:20000,cost:10,currency:'KWD',types:['engine_oil']}],expenses:[{id:'e1',vehicleId:'shaqran',date:'2026-09-01',category:'fuel',amount:15,currency:'KWD'},{id:'e2',vehicleId:'jeep',date:'2026-09-01',category:'fuel',amount:70,currency:'KWD'},{id:'e3',vehicleId:'patrol',date:'2026-09-01',category:'fuel',amount:9,currency:'KWD'}],trips:[{id:'t1',vehicleId:'shaqran',date:'2026-09-01',start:'الكويت',destination:'الوفرة',startOdometer:12000,type:'local',currency:'KWD',expenses:[],distanceKm:120},{id:'t2',vehicleId:'jeep',date:'2026-09-01',start:'الكويت',destination:'الجهراء',startOdometer:80000,type:'local',currency:'KWD',expenses:[],distanceKm:30},{id:'t3',vehicleId:'jeep',date:'2026-09-02',start:'الجهراء',destination:'الكويت',startOdometer:80030,type:'local',currency:'KWD',expenses:[],distanceKm:40}]};
fixture.trips.forEach(trip=>{trip.totalCost=0});
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'image/png');res.end(fs.readFileSync(file))}catch{res.writeHead(404);res.end()}});
(async()=>{
  fs.mkdirSync(artifacts,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
  try{for(const mobile of [true,false]){
    const width=mobile?390:1440,label=mobile?'mobile':'desktop',context=await browser.newContext(mobile?{...devices['iPhone 13'],viewport:{width:390,height:844}}:{viewport:{width:1440,height:1000}});
    await context.route('**/auth.js*',r=>r.fulfill({contentType:'application/javascript',body:''}));await context.route('https://cdn.jsdelivr.net/**',r=>r.abort());await context.route('https://fonts.**',r=>r.abort());
    await context.route('https://open.er-api.com/**',r=>r.fulfill({json:{result:'success',rates:Object.fromEntries(['KWD','TRY','EUR','USD','SAR','IQD','QAR','BHD','AED','OMR'].map(c=>[c,1]))}}));
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text())});
    await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load'});
    await page.evaluate(async({KEY,fixture})=>{const blob=await(await fetch('/assets/fleet-hero.png')).blob();const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('sayyarati-vehicle-photos',1);req.onupgradeneeded=()=>req.result.createObjectStore('images');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});await new Promise((resolve,reject)=>{const tx=db.transaction('images','readwrite');tx.objectStore('images').put(blob,'test-patrol-photo');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();localStorage.setItem(KEY,JSON.stringify(fixture))},{KEY,fixture});
    const ready=async()=>{await page.locator('#auth-gate').evaluate(el=>{el.hidden=true;document.body.classList.add('auth-ready')});await page.waitForFunction(()=>[...document.querySelectorAll('#vehicle-list img')].every(img=>img.complete&&img.naturalWidth>0))};
    await page.reload();await ready();const state=()=>page.evaluate(KEY=>JSON.parse(localStorage.getItem(KEY)),KEY),before=await state();
    const numbers=()=>page.locator('.vehicle-number b').allTextContents();assert.deepEqual(await numbers(),['1','2','3']);
    assert.deepEqual(await page.locator('.vehicle-card').evaluateAll(cards=>cards.map(c=>c.dataset.id)),fixture.vehicles.map(v=>v.id));
    assert.equal(await page.locator('.home-stats').count(),0);assert.equal(await page.locator('#vehicle-view').isVisible(),false);assert.equal(await page.locator('.final-total').isVisible(),false);
    assert.equal(await page.locator('#home-vehicles').evaluate(el=>el.previousElementSibling.classList.contains('fleet-hero')),true);
    assert.equal(await page.locator('.vehicle-card-specs').count(),3);assert.equal(await page.locator('.vehicle-card-specs>div').count(),3);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:path.join(artifacts,label+'-home.png'),fullPage:true});
    await page.locator('.fleet-hero [data-nav="vehicles"]').click();await page.waitForTimeout(500);
    const rows=await page.locator('.vehicle-card').evaluateAll(cards=>cards.map(c=>Math.round(c.getBoundingClientRect().top)));assert.ok(rows.every(y=>Math.abs(y-rows[0])<=1));
    await page.screenshot({path:path.join(artifacts,label+'-vehicles.png')});
    if(mobile){
      const box=await page.locator('#vehicle-list').boundingBox(),session=await context.newCDPSession(page),y=Math.max(30,box.y+90);
      const start=await page.locator('#vehicle-list').evaluate(el=>el.scrollLeft);
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:75,y}]});
      for(let x=100;x<=335;x+=25){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});await page.waitForTimeout(25)}
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(600);
      const end=await page.locator('#vehicle-list').evaluate(el=>el.scrollLeft);assert.ok(Math.abs(end-start)>60,'Native touch swipe should scroll horizontally');
      await page.screenshot({path:path.join(artifacts,'mobile-swiped.png')});
    }
    const expected=[{id:'shaqran',expense:35,km:120,trips:1,remaining:9550},{id:'jeep',expense:100,km:70,trips:2,remaining:3800},{id:'patrol',expense:19,km:0,trips:0,remaining:7000}];
    for(const [i,item] of expected.entries()){
      const card=page.locator('.vehicle-card[data-id="'+item.id+'"]');await card.scrollIntoViewIfNeeded();await(i===1?card.locator('.vehicle-open'):card.locator('h2')).click();
      assert.equal((await state()).activeVehicleId,item.id);assert.equal(await page.locator('#vehicle-name').textContent(),fixture.vehicles[i].name);
      const metric=async selector=>Number((await page.locator(selector+' .metric-number').first().textContent()).replace(/,/g,''));
      assert.equal(await metric('#stat-expenses'),item.expense);assert.equal(await metric('#stat-km'),item.km);assert.equal(await metric('#stat-trips'),item.trips);assert.equal(await metric('#service-remaining'),item.remaining);assert.equal(await page.locator('.final-total').isVisible(),true);
      if(i===0)await page.screenshot({path:path.join(artifacts,label+'-profile.png'),fullPage:true});
      await page.locator('[data-action="home"]:visible').first().click();assert.equal(await page.locator('.final-total').isVisible(),false);
    }
    let after=await state();for(const key of ['vehicles','maintenance','expenses','trips'])assert.deepEqual(after[key],before[key]);
    await page.reload();await ready();assert.deepEqual(await numbers(),['1','2','3']);
    // Test add/delete numbering on disposable fixtures only. Protected vehicles stay intact.
    await page.locator('[data-action="add-vehicle"]:visible').first().click();await page.locator('[name=name]').fill('Test fourth');await page.locator('[name=make]').selectOption('Nissan');await page.locator('[name=model]').selectOption('Patrol');await page.locator('[name=year]').selectOption('2024');await page.locator('#app-form [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#app-dialog').open);
    const fourth=(await state()).activeVehicleId;await page.locator('[data-action="home"]:visible').first().click();assert.deepEqual(await numbers(),['1','2','3','4']);
    await page.locator('[data-action="delete-vehicle-card"][data-id="patrol"]').click();await page.locator('#confirm-delete').click();assert.deepEqual(await numbers(),['1','2','3']);
    after=await state();assert.deepEqual(after.vehicles.map(v=>v.id),['shaqran','jeep',fourth]);assert.deepEqual(after.vehicles.slice(0,2),before.vehicles.slice(0,2));assert.equal(after.vehicles.some(v=>'number' in v||'sequence' in v),false);
    assert.equal(await page.evaluate(async()=>{const db=await new Promise(r=>{const q=indexedDB.open('sayyarati-vehicle-photos',1);q.onsuccess=()=>r(q.result)});return new Promise(r=>{const q=db.transaction('images').objectStore('images').get('test-patrol-photo');q.onsuccess=()=>{db.close();r(q.result instanceof Blob)}})}),true);
    assert.deepEqual(errors,[]);console.log('PASS '+width+'px: numbering, horizontal layout'+(mobile?' and actual touch swipe':'')+', correct card/button selection, isolated statistics, reload, sequential renumbering after deletion, unchanged protected records/images, no JS errors.');await context.close();
  }}finally{await browser.close();server.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
