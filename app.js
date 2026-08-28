(() => {
  'use strict';
  const KEY='sayyarati-data-v3',V2='shaqran-car-data-v2',V1='shaqran-car-data-v1';
  const CURRENCIES={KWD:{symbol:'د.ك',name:'الدينار الكويتي'},TRY:{symbol:'₺',name:'الليرة التركية'},EUR:{symbol:'€',name:'اليورو'},USD:{symbol:'$',name:'الدولار الأمريكي'},SAR:{symbol:'ر.س',name:'الريال السعودي'}};
  const FIXED_AR={gasoline:'بنزين',diesel:'ديزل',hybrid:'هجين',electric:'كهرباء',other:'أخرى',white:'أبيض',black:'أسود',silver:'فضي',gray:'رمادي',beige:'بيج',brown:'بني',red:'أحمر',blue:'أزرق',green:'أخضر',yellow:'أصفر',orange:'برتقالي',gold:'ذهبي',fuel:'الوقود',maintenance:'الصيانة',parts:'قطع الغيار',insurance:'التأمين',fees:'الرسوم',fines:'مخالفات',other_expense:'مصروف آخر',grocery:'بقالة / سوبرماركت',restaurant:'مطعم',hotel:'فندق',legacy_trip_cost:'تكلفة رحلة سابقة',engine_oil:'تغيير زيت المحرك',oil_filter:'فلتر الزيت',diesel_filter:'فلتر الديزل',air_filter:'فلتر الهواء',tires:'الإطارات',brakes:'الفرامل',other_maintenance:'صيانة أخرى',local:'داخلية',travel:'سفر',offroad:'برية'};
  const LEGACY_CODES=Object.fromEntries(Object.entries(FIXED_AR).map(([code,label])=>[label,code]));
  LEGACY_CODES['الوقود']='fuel';LEGACY_CODES['الصيانة']='maintenance';
  const fixedCode=value=>LEGACY_CODES[value]||value;
  const fixedLabel=value=>FIXED_AR[value]||value;
  const CATEGORIES=['fuel','maintenance','parts','insurance','fees','fines','other_expense'];
  const TRIP_EXPENSE_TYPES=['grocery','restaurant','fuel','hotel','maintenance'];
  const TRIP_EXPENSE_AR={grocery:'بقالة / سوبرماركت',restaurant:'مطعم',fuel:'وقود',hotel:'فندق',maintenance:'صيانة أو سيرفس',legacy_trip_cost:'تكلفة رحلة سابقة'};
  const tripExpenseLabel=value=>TRIP_EXPENSE_AR[value]||fixedLabel(value);
  const SERVICE_TYPES=['engine_oil','oil_filter','diesel_filter','air_filter','tires','brakes','other_maintenance'];
  const VEHICLE_YEARS=Array.from({length:48},(_,index)=>String(2027-index));
  const VEHICLE_COLORS=['white','black','silver','gray','beige','brown','red','blue','green','yellow','orange','gold'];
  const CATALOG=window.VEHICLE_CATALOG||{makes:{},trims:{}};
  const VEHICLE_MAKES=Object.keys(CATALOG.makes);
  const LANGUAGE_KEY='sayyarati-language';
  let language=localStorage.getItem(LANGUAGE_KEY)==='en'?'en':'ar';
  const originalText=new WeakMap(),originalAttrs=new WeakMap();
  const dictionary=window.TRANSLATIONS?.en||{};
  const translationEntries=Object.entries(dictionary).sort((a,b)=>b[0].length-a[0].length);
  const translateText=value=>{
    if(language==='ar')return value;
    const leading=value.match(/^(\s*[＋↑↓→←]\s*)(.*)$/s),core=(leading?leading[2]:value).trim();
    let translated=dictionary[core];
    if(!translated){
      translated=core
        .replace(/^إجمالي\s+/,'Total ')
        .replace(/\sكم متبقية$/,' km remaining')
        .replace(/\sكم$/,' km')
        .replace(/\sسجل$/,' records')
        .replace(/^متبقي\s+/,'Remaining ')
        .replace(/^الموعد عند\s+/,'Due at ')
        .replace(/^تم تجاوز الموعد بمقدار\s+/,'Overdue by ');
      if(/^(الصيانة القادمة|سيتم حذف|حان موعدها)/.test(core))translated=translationEntries.reduce((text,[ar,en])=>text.split(ar).join(en),core).replace(/ كم/g,' km').replace(/ · كل /g,' · Every ');
    }
    return leading?leading[1]+translated:value.replace(core,translated);
  };
  function applyLanguage(root=document){
    document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';document.title=language==='ar'?'سيارتي':'My Car';
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode())){if(['SCRIPT','STYLE'].includes(node.parentElement?.tagName)||node.parentElement?.matches('#vehicle-name,.vehicle-card h2,.note,.report-notes,.report-head h1'))continue;if(!originalText.has(node))originalText.set(node,node.nodeValue);node.nodeValue=language==='ar'?originalText.get(node):translateText(originalText.get(node))}
    const elements=root.querySelectorAll?[root,...root.querySelectorAll('[placeholder],[title],[aria-label]')]:[];
    elements.forEach(el=>{if(!el?.getAttribute)return;let saved=originalAttrs.get(el);if(!saved){saved={};['placeholder','title','aria-label'].forEach(a=>{if(el.hasAttribute(a))saved[a]=el.getAttribute(a)});originalAttrs.set(el,saved)}Object.entries(saved).forEach(([a,v])=>el.setAttribute(a,language==='ar'?v:translateText(v)))});
    const selector=$('#language-select');if(selector)selector.value=language;
  }
  const $=(q,r=document)=>r.querySelector(q), $$=(q,r=document)=>[...r.querySelectorAll(q)];
  const uid=(prefix='id')=>prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
  const num=v=>Math.max(0,Number(v)||0), locale=()=>language==='ar'?'ar-KW':'en-US',fmt=v=>new Intl.NumberFormat(locale(),{maximumFractionDigits:2}).format(num(v));
  const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const stamp=()=>new Date().toISOString();
  const date=v=>v?new Intl.DateTimeFormat(locale(),{day:'numeric',month:'short',year:'numeric'}).format(new Date(v+(v.length===10?'T12:00:00':''))):'—';
  const dateTime=v=>v?new Intl.DateTimeFormat(locale(),{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(new Date(v)):'—';
  const esc=v=>{const x=document.createElement('span');x.textContent=v??'';return x.innerHTML};
  const currencyCode=v=>CURRENCIES[v]?v:'KWD';
  const cash=(value,currency='KWD')=>fmt(value)+' '+CURRENCIES[currencyCode(currency)].symbol;
  const metric=(value,unit='')=>`<span class="metric-number">${fmt(value)}</span>${unit?` <span class="metric-unit">${unit}</span>`:''}`;
  const moneyMetric=(value,currency='KWD',suffix='')=>metric(value,CURRENCIES[currencyCode(currency)].symbol+suffix);
  const vehicleIdOf=r=>String(r.vehicleId||'shaqran');
  const vehicleTitle=v=>v.name?.trim()||[v.make,v.model].filter(Boolean).join(' ')||'مركبة بدون اسم';
  const tripExpenses=r=>Array.isArray(r.expenses)?r.expenses:[];
  const tripTotal=r=>tripExpenses(r).reduce((sum,item)=>sum+num(item.cost),0);
  const tripDistance=r=>r.distanceKm===''||r.distanceKm==null?null:num(r.distanceKm);

  function shaqranVehicle(source={}){
    const v=source.vehicle||{};
    const legacyPoer = v.make === 'Great Wall Poer';
    return {id:'shaqran',name:v.name?.split('|')[0]?.trim()||'شقران',make:legacyPoer?'Great Wall / GWM':(v.make||'Great Wall / GWM'),model:v.modelName||(legacyPoer?'Poer':(typeof v.model==='string'?v.model:'Poer')),trim:v.trim||'',year:num(v.year??v.model)||2025,color:fixedCode(v.color||'أبيض'),fuel:fixedCode(v.fuel||'ديزل'),plate:v.plate||'',image:v.image||'',imageUrl:v.imageUrl||'',odometer:num(v.odometer??source.odometer??12450),odometerUpdatedAt:v.odometerUpdatedAt||stamp(),serviceInterval:Math.max(1000,num(v.serviceInterval)||10000),notes:v.notes||'رفيق الدروب الطويلة والمسارات البعيدة',createdAt:v.createdAt||stamp()};
  }
  function seed(){
    return {version:3,activeVehicleId:null,vehicles:[],maintenance:[],expenses:[],trips:[]};
  }
  function migrate(source,legacyV1=false){
    if(!source||typeof source!=='object')return seed();
    if(source.version===3&&Array.isArray(source.vehicles))return normalize(source);
    const vehicle=shaqranVehicle(legacyV1?{odometer:source.odometer}:source);
    if(legacyV1&&source.nextService&&source.odometer)vehicle.serviceInterval=10000;
    const mapCategory={'ديزل':'الوقود','رسوم طرق':'الرسوم'};
    return normalize({version:3,activeVehicleId:null,vehicles:[vehicle],
      maintenance:(source.maintenance||[]).map(r=>({id:String(r.id||uid('m')),vehicleId:'shaqran',date:r.date||today(),odometer:num(r.odometer??r.km),types:Array.isArray(r.types)?r.types:[r.title||'صيانة أخرى'],notes:r.notes||'',cost:num(r.cost),currency:'KWD',workshop:r.workshop||''})),
      expenses:(source.expenses||[]).map(r=>({id:String(r.id||uid('e')),vehicleId:'shaqran',date:r.date||today(),category:mapCategory[r.type]||r.category||r.type||'مصروف آخر',amount:num(r.amount),currency:'KWD',notes:r.notes||''})),
      trips:(source.trips||[]).map(r=>{const distance=num(r.km),end=num(r.endOdometer)||(num(r.startOdometer)+distance);return{id:String(r.id||uid('t')),vehicleId:'shaqran',date:r.date||today(),start:r.start||'غير محدد',destination:r.destination||'غير محدد',startOdometer:num(r.startOdometer)||Math.max(0,end-distance),endOdometer:end,type:r.type||'داخلية',cost:num(r.cost),currency:'KWD',notes:r.notes||''}})});
  }
  function normalize(source){
    const vehicles=(source.vehicles||[]).map(v=>({id:String(v.id||uid('v')),name:v.name||'',make:v.make||'',model:v.model||'',trim:v.trim||'',year:num(v.year),color:fixedCode(v.color||''),fuel:fixedCode(v.fuel||''),plate:v.plate||'',image:v.image||'',imageUrl:v.imageUrl||'',odometer:num(v.odometer),odometerUpdatedAt:v.odometerUpdatedAt||stamp(),serviceInterval:Math.max(1000,num(v.serviceInterval)||10000),notes:v.notes||'',createdAt:v.createdAt||stamp()}));
    const firstId=vehicles[0]?.id||null;
    const validVehicle=id=>vehicles.some(v=>v.id===String(id))?String(id):firstId;
    const records=(items,prefix)=>Array.isArray(items)?items.map(r=>{const id=String(r.id||uid(prefix)),base={...r,id,vehicleId:validVehicle(vehicleIdOf(r)),currency:currencyCode(r.currency),...(prefix==='m'?{types:(r.types||[]).map(fixedCode)}:{}),...(prefix==='e'?{category:fixedCode(r.category)}:{}),...(prefix==='t'?{type:fixedCode(r.type)}:{})};if(prefix!=='t')return base;const hasExpenses=Array.isArray(r.expenses),legacyCost=num(r.cost),expenses=(hasExpenses?r.expenses:legacyCost?[{id:'legacy_'+id,type:'legacy_trip_cost',cost:legacyCost,maintenanceType:'',legacy:true}]:[]).map((item,index)=>({id:String(item.id||id+'_expense_'+index),type:fixedCode(item.type||'legacy_trip_cost'),cost:num(item.cost),maintenanceType:item.maintenanceType||'',...(item.legacy?{legacy:true}:{})}));const distanceKm=r.distanceKm!==undefined&&r.distanceKm!==null&&r.distanceKm!==''?num(r.distanceKm):(r.endOdometer!==undefined?Math.max(0,num(r.endOdometer)-num(r.startOdometer)):null);return{...base,expenses,totalCost:expenses.reduce((sum,item)=>sum+num(item.cost),0),distanceKm}}):[];
    return{version:3,activeVehicleId:source.activeVehicleId&&vehicles.some(v=>v.id===String(source.activeVehicleId))?String(source.activeVehicleId):null,vehicles,maintenance:records(source.maintenance,'m'),expenses:records(source.expenses,'e'),trips:records(source.trips,'t')};
  }
  function load(){
    try{const current=localStorage.getItem(KEY);if(current)return normalize(JSON.parse(current));const v2=localStorage.getItem(V2);if(v2){const d=migrate(JSON.parse(v2));localStorage.setItem(KEY,JSON.stringify(d));return d}const v1=localStorage.getItem(V1);if(v1){const d=migrate(JSON.parse(v1),true);localStorage.setItem(KEY,JSON.stringify(d));return d}const d=seed();localStorage.setItem(KEY,JSON.stringify(d));return d}catch(e){console.warn(e);return seed()}
  }

  let data=load(),activeForm='',editingId=null,tripFilter='all',pendingDelete=null,currentNav='home',pendingVehicleImage;
  const activeVehicle=()=>data.vehicles.find(v=>v.id===data.activeVehicleId)||null;
  const recordsFor=name=>data[name].filter(r=>r.vehicleId===data.activeVehicleId);
  function save(message){localStorage.setItem(KEY,JSON.stringify(data));render();if(message)toast(message)}
  function totalsFor(vehicleId){
    const totals={};const add=(amount,currency)=>{const c=currencyCode(currency);totals[c]=(totals[c]||0)+num(amount)};
    data.expenses.filter(r=>r.vehicleId===vehicleId).forEach(r=>add(r.amount,r.currency));
    data.maintenance.filter(r=>r.vehicleId===vehicleId).forEach(r=>add(r.cost,r.currency));
    data.trips.filter(r=>r.vehicleId===vehicleId).forEach(r=>add(tripTotal(r),r.currency));
    return totals;
  }
  const totalsHTML=(totals,empty='لا توجد مصاريف')=>Object.keys(totals).length?Object.entries(totals).filter(([,v])=>v>0).map(([c,v])=>`<span class="metric-value">${moneyMetric(v,c)}</span>`).join('<span class="metric-divider"> · </span>')||empty:empty;
  function render(){renderHome();if(activeVehicle())renderVehicle();const detail=!!activeVehicle();$('#home-view').hidden=detail;$('#vehicle-view').hidden=!detail;$$('.main-nav [data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===currentNav));applyLanguage();window.scrollTo?.({top:0,behavior:'instant'})}
  function renderHome(){
    const fleetKm=data.vehicles.reduce((s,v)=>s+num(v.odometer),0),allTotals={};data.vehicles.forEach(v=>Object.entries(totalsFor(v.id)).forEach(([c,value])=>allTotals[c]=(allTotals[c]||0)+value));
    $('#fleet-count').innerHTML=metric(data.vehicles.length);$('#fleet-km').innerHTML=metric(fleetKm);$('#fleet-records').innerHTML=metric(data.maintenance.length+data.expenses.length+data.trips.length);$('#home-distance').innerHTML=metric(fleetKm,'كم');$('#home-trips').innerHTML=metric(data.trips.length,'رحلة');$('#home-expenses').innerHTML=totalsHTML(allTotals);
    const service=data.vehicles.map(v=>{const records=data.maintenance.filter(r=>r.vehicleId===v.id),last=[...records].sort((a,b)=>num(b.odometer)-num(a.odometer)||String(b.date).localeCompare(String(a.date)))[0],base=last?num(last.odometer):Math.floor(num(v.odometer)/v.serviceInterval)*v.serviceInterval;return{v,remaining:base+v.serviceInterval-v.odometer}}).sort((a,b)=>a.remaining-b.remaining)[0];$('#home-service').innerHTML=!service?'—':service.remaining<=0?'حان موعد الصيانة':'متبقي '+metric(service.remaining,'كم');
    $('#vehicle-list').innerHTML=data.vehicles.map(v=>{const records=data.maintenance.filter(r=>r.vehicleId===v.id).length+data.expenses.filter(r=>r.vehicleId===v.id).length+data.trips.filter(r=>r.vehicleId===v.id).length,image=v.image||v.imageUrl||'';return`<article class="vehicle-card panel" data-action="open-vehicle" data-id="${v.id}" tabindex="0">${image?`<div class="vehicle-card-image"><img src="${esc(image)}" alt="صورة المركبة"></div>`:'<div class="vehicle-card-image vehicle-card-placeholder"><span>⌁</span></div>'}<div class="vehicle-card-body"><div class="vehicle-card-top"><span class="vehicle-card-icon">⌁</span><div class="vehicle-menu"><button class="icon-btn" data-action="edit-vehicle-card" data-id="${v.id}" aria-label="تعديل">✎</button><button class="icon-btn delete" data-action="delete-vehicle-card" data-id="${v.id}" aria-label="حذف">×</button></div></div><h2>${esc(vehicleTitle(v))}</h2><p class="model">${esc([v.make,v.model,v.trim,v.year].filter(Boolean).join(' '))}</p><div class="vehicle-card-specs"><div><small>العداد</small><strong>${metric(v.odometer,'كم')}</strong></div><div><small>السجلات</small><strong>${metric(records,'سجل')}</strong></div></div><span class="vehicle-open">فتح الملف ←</span></div></article>`}).join('');
    $('#vehicle-empty').classList.toggle('show',!data.vehicles.length);
  }
  function navigate(section){
    currentNav=section==='trips'?'vehicles':section;const homeSections=['home','vehicles'];
    if(homeSections.includes(section)){data.activeVehicleId=null;save();requestAnimationFrame(()=>{if(section==='vehicles')$('#home-vehicles')?.scrollIntoView({behavior:'smooth',block:'start'})});return}
    if(!activeVehicle()){if(!data.vehicles.length){toast('لا توجد مركبات بعد');return}data.activeVehicleId=data.vehicles[0].id}
    render();requestAnimationFrame(()=>{if(section==='reports')return openReport();const targets={maintenance:'#maintenance-section',expenses:'#expenses-section',trips:'#trips-section',reminders:'#service-alert'};$(targets[section])?.scrollIntoView({behavior:'smooth',block:'start'})})
  }
  function renderVehicle(){
    const v=activeVehicle(),maintenance=recordsFor('maintenance'),expenses=recordsFor('expenses'),trips=recordsFor('trips');
    $('#vehicle-name').textContent=vehicleTitle(v);$('#vehicle-model').textContent=[v.make,v.model,v.trim,v.year].filter(Boolean).join(' ');$('#vehicle-fuel').textContent=fixedLabel(v.fuel)||'—';$('#vehicle-color').textContent=fixedLabel(v.color)||'—';$('#hero-odometer').textContent=fmt(v.odometer);$('#odometer-updated').textContent=dateTime(v.odometerUpdatedAt);$('#vehicle-plate').textContent=v.plate||'دون رقم لوحة';$('#stat-maintenance').innerHTML=metric(maintenance.length);$('#stat-trips').innerHTML=metric(trips.length,'رحلة');
    const tripKm=trips.reduce((s,t)=>s+(tripDistance(t)??0),0),totals=totalsFor(v.id);
    $('#stat-km').innerHTML=metric(tripKm,'كم');$('#stat-expenses').innerHTML=totalsHTML(totals);$('#stat-cost-km').innerHTML=tripKm?Object.entries(totals).filter(([,x])=>x>0).map(([c,x])=>moneyMetric(x/tripKm,c,'/كم')).join('<br>')||'بيانات غير كافية':'بيانات غير كافية';
    renderVehiclePhoto(v);renderService(v,maintenance);renderMaintenance(maintenance);renderExpenses(expenses,totals);renderTrips(trips);
  }
  function renderVehiclePhoto(v){const image=v.image||v.imageUrl||'',photo=$('#vehicle-photo'),empty=$('#vehicle-photo-placeholder');if(image){photo.src=image;photo.hidden=false;empty.hidden=true}else{photo.removeAttribute('src');photo.hidden=true;empty.hidden=false}$('#add-vehicle-photo').hidden=!!image;$('#change-vehicle-photo').hidden=!image;$('#delete-vehicle-photo').hidden=!image}
  function readVehicleImage(file,done){if(!file)return;const allowed=['image/jpeg','image/png','image/webp'];if(!allowed.includes(file.type)){toast('صيغة الصورة غير مدعومة');return}const reader=new FileReader();reader.onload=()=>{const source=String(reader.result),image=new Image();image.onload=()=>{const max=1600,scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);done(canvas.toDataURL('image/webp',.86))};image.onerror=()=>toast('تعذر قراءة الصورة');image.src=source};reader.onerror=()=>toast('تعذر قراءة الصورة');reader.readAsDataURL(file)}
  function updateFormImagePreview(image){const preview=$('#form-vehicle-image-preview'),placeholder=$('#form-vehicle-image-placeholder'),change=$('#form-change-image'),remove=$('#form-delete-image');if(!preview)return;if(image){preview.src=image;preview.hidden=false;placeholder.hidden=true;change.textContent='تغيير الصورة';remove.hidden=false}else{preview.removeAttribute('src');preview.hidden=true;placeholder.hidden=false;change.textContent='إضافة صورة المركبة';remove.hidden=true}applyLanguage($('#vehicle-image-field'))}
  function renderService(v,records){
    const last=[...records].sort((a,b)=>num(b.odometer)-num(a.odometer)||String(b.date).localeCompare(String(a.date)))[0],base=last?num(last.odometer):Math.floor(num(v.odometer)/v.serviceInterval)*v.serviceInterval,target=base+v.serviceInterval,remaining=target-v.odometer,progress=Math.min(100,Math.max(0,(v.odometer-base)/v.serviceInterval*100)),box=$('#service-alert');box.classList.remove('warning','due');$('#service-progress').style.width=progress+'%';$('#service-target').innerHTML='الموعد عند '+metric(target,'كم')+' · كل '+metric(v.serviceInterval,'كم');
    if(remaining<=0){box.classList.add('due');$('#service-remaining').textContent='حان موعد الصيانة';$('#service-message').innerHTML='تم تجاوز الموعد بمقدار '+metric(Math.abs(remaining),'كم')}else{if(remaining<=Math.min(1000,v.serviceInterval*.1))box.classList.add('warning');$('#service-remaining').innerHTML=metric(remaining,'كم')+' متبقية';$('#service-message').textContent=remaining<=1000?'اقترب موعد الصيانة، جهّز موعدك الآن':'كل شيء على ما يرام'}
  }
  function toggleTable(id,empty,count){$(empty).classList.toggle('show',!count);$('.table-wrap',$(id).closest('.table-card')).hidden=!count}
  function renderMaintenance(records){
    const sorted=[...records].sort((a,b)=>String(b.date).localeCompare(String(a.date)));$('#maintenance-list').innerHTML=sorted.map(r=>`<tr><td>${date(r.date)}</td><td><strong>${esc((r.types||[]).map(fixedLabel).join('، ')||'صيانة أخرى')}</strong><span class="note">${esc(r.notes||'بلا ملاحظات')}</span></td><td class="metric-cell">${metric(r.odometer,'كم')}</td><td>${esc(r.workshop||'—')}</td><td class="money metric-cell">${moneyMetric(r.cost,r.currency)}</td><td><div class="row-actions"><button class="icon-btn" data-action="edit-maintenance" data-id="${r.id}">✎</button><button class="icon-btn delete" data-action="delete-maintenance" data-id="${r.id}">×</button></div></td></tr>`).join('');toggleTable('#maintenance-list','#maintenance-empty',sorted.length)
  }
  function renderExpenses(records,totals){
    $('#expense-totals').innerHTML=Object.entries(totals).filter(([,v])=>v>0).map(([c,v])=>`<div class="currency-total"><small>إجمالي ${c} · ${CURRENCIES[c].name}</small><strong>${moneyMetric(v,c)}</strong></div>`).join('')||'<div class="empty">لا توجد تكاليف مسجلة</div>';
    $('#expense-categories').innerHTML=CATEGORIES.map(cat=>{const by={};records.filter(r=>r.category===cat).forEach(r=>by[r.currency]=(by[r.currency]||0)+num(r.amount));return`<div class="category-item"><small>${fixedLabel(cat)}</small><strong class="multi-money">${totalsHTML(by,'—')}</strong></div>`}).join('');
    const sorted=[...records].sort((a,b)=>String(b.date).localeCompare(String(a.date)));$('#expense-list').innerHTML=sorted.map(r=>`<tr><td>${date(r.date)}</td><td><span class="badge">${esc(fixedLabel(r.category))}</span></td><td><span class="note">${esc(r.notes||'—')}</span></td><td class="money metric-cell">${moneyMetric(r.amount,r.currency)}</td><td><div class="row-actions"><button class="icon-btn" data-action="edit-expense" data-id="${r.id}">✎</button><button class="icon-btn delete" data-action="delete-expense" data-id="${r.id}">×</button></div></td></tr>`).join('');toggleTable('#expense-list','#expense-empty',sorted.length)
  }
  function renderTrips(all){
    let records=[...all];if(tripFilter==='upcoming')records=records.filter(r=>r.date>=today());if(tripFilter==='past')records=records.filter(r=>r.date<today());records.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    $('#trip-list').innerHTML=records.map(r=>{const distance=tripDistance(r),expenseList=tripExpenses(r).map(item=>`<li><span>${esc(tripExpenseLabel(item.type))}${item.type==='maintenance'&&item.maintenanceType?` · ${esc(item.maintenanceType)}`:''}</span><strong>${moneyMetric(item.cost,r.currency)}</strong></li>`).join('');return`<article class="trip-card panel"><div class="trip-top"><span class="trip-type">${esc(fixedLabel(r.type))}</span><span class="trip-date">${date(r.date)}</span></div><div class="route"><div><small>من</small><strong>${esc(r.start)}</strong></div><span class="route-arrow">←</span><div><small>إلى</small><strong>${esc(r.destination)}</strong></div></div>${expenseList?`<div class="trip-expense-summary"><small>مصروفات الرحلة</small><ul>${expenseList}</ul></div>`:''}<div class="trip-meta">${distance!==null?`<div><small>إجمالي المسافة المقطوعة للرحلة</small><strong>${metric(distance,'كم')}</strong></div>`:''}<div><small>إجمالي تكلفة الرحلة</small><strong class="trip-cost">${moneyMetric(tripTotal(r),r.currency)}</strong></div><div class="trip-actions"><button class="icon-btn" data-action="edit-trip" data-id="${r.id}">✎</button><button class="icon-btn delete" data-action="delete-trip" data-id="${r.id}">×</button></div></div>${r.notes?`<span class="note" style="margin-top:12px">${esc(r.notes)}</span>`:''}</article>`}).join('');$('#trip-empty').classList.toggle('show',!records.length)
  }

  const reportCash=(value,currency='KWD')=>new Intl.NumberFormat(locale(),{minimumFractionDigits:currency==='KWD'?3:0,maximumFractionDigits:currency==='KWD'?3:2}).format(num(value))+' '+CURRENCIES[currencyCode(currency)].symbol;
  function openReport(){if(!activeVehicle())return;$('#report-period').value='all';$$('.report-date').forEach(x=>x.hidden=true);$$('[data-report-section]').forEach(x=>x.checked=true);$('#report-from').value='';$('#report-to').value=today();renderReport();$('#report-dialog').showModal()}
  function reportRecords(name){const all=recordsFor(name),custom=$('#report-period').value==='custom',from=$('#report-from').value,to=$('#report-to').value;return custom?all.filter(r=>(!from||r.date>=from)&&(!to||r.date<=to)):all}
  function reportTable(headers,rows){return rows.length?'<div class="table-wrap"><table><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>':'<div class="report-empty">لا توجد سجلات ضمن الفترة المحددة</div>'}
  function renderReport(){
    const v=activeVehicle();if(!v)return;
    const included=key=>$('[data-report-section="'+key+'"]').checked,maintenance=reportRecords('maintenance').sort((a,b)=>String(b.date).localeCompare(String(a.date))),expenses=reportRecords('expenses').sort((a,b)=>String(b.date).localeCompare(String(a.date))),trips=reportRecords('trips').sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const totals={},expenseTotals={};const add=(target,amount,currency)=>{const c=currencyCode(currency);target[c]=(target[c]||0)+num(amount)};maintenance.forEach(r=>add(totals,r.cost,r.currency));expenses.forEach(r=>{add(totals,r.amount,r.currency);add(expenseTotals,r.amount,r.currency)});trips.forEach(r=>add(totals,tripTotal(r),r.currency));
    const totalsMarkup=source=>Object.entries(source).filter(([,x])=>x>0).map(([c,x])=>'<span class="report-total">إجمالي '+c+': <b>'+moneyMetric(x,c)+'</b></span>').join('')||'<span class="report-total">لا توجد تكاليف</span>';
    const tripKm=trips.reduce((sum,r)=>sum+(tripDistance(r)??0),0),generated=new Intl.DateTimeFormat(locale(),{dateStyle:'long',timeStyle:'short'}).format(new Date()),image=v.image||v.imageUrl||'';
    let html='<header class="report-head"><div><span class="report-brand">سيارتي - سجل المركبة</span><h1>'+esc(vehicleTitle(v))+'</h1><p>'+esc([v.make,v.model,v.trim,v.year].filter(Boolean).join(' · '))+'</p></div><p>تاريخ إنشاء التقرير<br><strong>'+generated+'</strong></p></header>';
    if(included('vehicle'))html+='<section class="report-section"><h2>معلومات المركبة</h2><div class="report-vehicle">'+(image?'<img src="'+esc(image)+'" alt="صورة المركبة">':'')+'<div class="report-info"><div><small>الاسم</small><strong>'+esc(v.name||'—')+'</strong></div><div><small>الشركة المصنعة</small><strong>'+esc(v.make||'—')+'</strong></div><div><small>الموديل</small><strong>'+esc(v.model||'—')+'</strong></div><div><small>الفئة / الطراز</small><strong>'+esc(v.trim||'—')+'</strong></div><div><small>سنة الصنع</small><strong>'+metric(v.year)+'</strong></div><div><small>اللون</small><strong>'+esc(fixedLabel(v.color)||'—')+'</strong></div><div><small>نوع الوقود</small><strong>'+esc(fixedLabel(v.fuel)||'—')+'</strong></div><div><small>رقم اللوحة</small><strong>'+esc(v.plate||'—')+'</strong></div><div><small>العداد الحالي</small><strong>'+metric(v.odometer,'كم')+'</strong></div><div><small>آخر تحديث للعداد</small><strong>'+dateTime(v.odometerUpdatedAt)+'</strong></div></div></div></section>';
    if(included('maintenance'))html+='<section class="report-section"><h2>سجل الصيانة</h2>'+reportTable(['التاريخ','الصيانة','العداد','الورشة','الملاحظات','التكلفة'],maintenance.map(r=>'<tr><td>'+date(r.date)+'</td><td>'+esc((r.types||[]).map(fixedLabel).join('، '))+'</td><td>'+metric(r.odometer,'كم')+'</td><td>'+esc(r.workshop||'—')+'</td><td class="report-notes">'+esc(r.notes||'—')+'</td><td>'+moneyMetric(r.cost,r.currency)+'</td></tr>'))+'</section>';
    if(included('expenses'))html+='<section class="report-section"><h2>سجل المصاريف</h2>'+reportTable(['التاريخ','التصنيف','الملاحظات','المبلغ'],expenses.map(r=>'<tr><td>'+date(r.date)+'</td><td>'+esc(fixedLabel(r.category))+'</td><td class="report-notes">'+esc(r.notes||'—')+'</td><td>'+moneyMetric(r.amount,r.currency)+'</td></tr>'))+'<div class="report-totals">'+totalsMarkup(expenseTotals)+'</div></section>';
    if(included('trips'))html+='<section class="report-section"><h2>سجل الرحلات</h2>'+reportTable(['التاريخ','من','إلى','النوع','عداد البداية','مصروفات الرحلة','إجمالي المسافة','إجمالي التكلفة'],trips.map(r=>'<tr><td>'+date(r.date)+'</td><td>'+esc(r.start)+'</td><td>'+esc(r.destination)+'</td><td>'+esc(fixedLabel(r.type))+'</td><td>'+metric(r.startOdometer)+'</td><td class="report-notes">'+(tripExpenses(r).map(item=>esc(tripExpenseLabel(item.type)+(item.type==='maintenance'&&item.maintenanceType?' · '+item.maintenanceType:''))+' — '+moneyMetric(item.cost,r.currency)).join('<br>')||'—')+'</td><td>'+(tripDistance(r)===null?'—':metric(tripDistance(r),'كم'))+'</td><td>'+moneyMetric(tripTotal(r),r.currency)+'</td></tr>'))+'</section>';
    if(included('stats')){const last=[...recordsFor('maintenance')].sort((a,b)=>num(b.odometer)-num(a.odometer))[0],base=last?num(last.odometer):Math.floor(num(v.odometer)/v.serviceInterval)*v.serviceInterval,target=base+v.serviceInterval,remaining=target-v.odometer;html+='<section class="report-section"><h2>الإحصائيات والصيانة القادمة</h2><div class="report-stats"><div class="report-stat"><small>كيلومترات الرحلات</small><strong>'+metric(tripKm,'كم')+'</strong></div><div class="report-stat"><small>عمليات الصيانة</small><strong>'+metric(maintenance.length)+'</strong></div><div class="report-stat"><small>المصاريف</small><strong>'+metric(expenses.length,'سجل')+'</strong></div><div class="report-stat"><small>الرحلات</small><strong>'+metric(trips.length,'رحلة')+'</strong></div></div><div class="report-totals">'+totalsMarkup(totals)+'</div><div class="report-service"><strong>الصيانة القادمة: </strong>'+(remaining<=0?'حان موعدها — متجاوزة بمقدار '+metric(Math.abs(remaining),'كم'):'متبقي '+metric(remaining,'كم'))+' · الموعد عند '+metric(target,'كم')+'</div></section>'}
    html+='<footer class="report-footer">سيارتي · تقرير خاص بالمركبة المختارة · العملات معروضة دون تحويل</footer>';$('#report-content').innerHTML=html;applyLanguage($('#report-content'))
  }

  const field=(label,name,type='text',value='',o={})=>`<label class="field${o.full?' full':''}"><span>${label}${o.required===false?'':' <em>*</em>'}</span><input name="${name}" type="${type}" value="${esc(value)}"${o.required===false?'':' required'}${o.min!==undefined?` min="${o.min}"`:''}${o.step?` step="${o.step}"`:''}${o.placeholder?` placeholder="${esc(o.placeholder)}"`:''}></label>`;
  const area=(label,name,value='')=>`<label class="field full"><span>${label}</span><textarea name="${name}" placeholder="ملاحظات اختيارية">${esc(value)}</textarea></label>`;
  const select=(label,name,options,selected,full=false)=>`<label class="field${full?' full':''}"><span>${label} <em>*</em></span><select name="${name}" required>${options.map(o=>{const value=typeof o==='string'?o:o.value,text=typeof o==='string'?o:o.text;return`<option value="${esc(value)}"${value===selected?' selected':''}>${esc(text)}</option>`}).join('')}</select></label>`;
  const currencySelect=(selected='KWD')=>select('العملة','currency',Object.entries(CURRENCIES).map(([value,c])=>({value,text:value+' — '+c.symbol+' — '+c.name})),currencyCode(selected));
  function tripExpenseRow(item={}){const type=item.type||'fuel',types=type==='legacy_trip_cost'?[...TRIP_EXPENSE_TYPES,'legacy_trip_cost']:TRIP_EXPENSE_TYPES;return`<div class="trip-expense-row" data-expense-id="${esc(item.id||uid('te'))}"><label class="field"><span>نوع المصروف <em>*</em></span><select name="tripExpenseType" required>${types.map(value=>`<option value="${value}"${value===type?' selected':''}>${esc(tripExpenseLabel(value))}</option>`).join('')}</select></label><label class="field"><span>التكلفة <em>*</em></span><input name="tripExpenseCost" type="number" value="${esc(item.cost??'')}" min="0" step=".001" required></label><label class="field trip-maintenance-type"${type==='maintenance'?'':' hidden'}><span>نوع الصيانة <em>*</em></span><input name="tripMaintenanceType" type="text" value="${esc(item.maintenanceType||'')}" placeholder="مثال: تغيير زيت، فلاتر، إطارات، إصلاح"${type==='maintenance'?' required':''}></label><button class="icon-btn delete trip-expense-delete" type="button" data-action="delete-trip-expense" aria-label="حذف المصروف">×</button></div>`}
  function openForm(type,recordId=null,vehicleOverride=null){
    activeForm=type;editingId=recordId?String(recordId):null;const v=vehicleOverride||activeVehicle();let title='',kicker=editingId?'تعديل السجل':'سجل جديد',html='',initialVehicleImage='';
    if(type==='vehicle'){
      const x=vehicleOverride||{name:'',make:'Toyota',model:'Land Cruiser',trim:'',year:2026,color:'white',fuel:'diesel',plate:'',odometer:0,notes:''};
      pendingVehicleImage=undefined;
      initialVehicleImage=x.image||x.imageUrl||'';
      const knownMake=VEHICLE_MAKES.includes(x.make),makeChoice=knownMake?x.make:'شركة أخرى',models=CATALOG.makes[x.make]||[],knownModel=models.includes(x.model),modelChoice=knownModel?x.model:'موديل آخر',trims=CATALOG.trims[x.make+'|'+x.model]||[],knownTrim=!x.trim||trims.includes(x.trim),trimChoice=!x.trim?'بدون فئة':knownTrim?x.trim:'فئة أخرى',knownColor=VEHICLE_COLORS.includes(x.color),selectedColor=knownColor?x.color:'custom_color';
      title=editingId?'تعديل بيانات المركبة':'إضافة مركبة';kicker='مرآب سيارتي';
      html=field('اسم المركبة (اختياري)','name','text',x.name,{required:false,placeholder:'مثال: شقران أو الجيب'})
        +select('الشركة المصنعة','make',[...VEHICLE_MAKES,'شركة أخرى'],makeChoice)
        +`<label class="field" id="custom-make-field"${knownMake?' hidden':''}><span>اسم الشركة <em>*</em></span><input name="customMake" value="${esc(knownMake?'':x.make)}" placeholder="اكتب اسم الشركة"${knownMake?'':' required'}></label>`
        +select('الموديل','model',[...models,'موديل آخر'],modelChoice)
        +`<label class="field" id="custom-model-field"${knownModel?' hidden':''}><span>اسم الموديل <em>*</em></span><input name="customModel" value="${esc(knownModel?'':x.model)}" placeholder="اكتب اسم الموديل"${knownModel?'':' required'}></label>`
        +select('الفئة / الطراز','trim',['بدون فئة',...trims,'فئة أخرى'],trimChoice)
        +`<label class="field" id="custom-trim-field"${trimChoice==='فئة أخرى'?'':' hidden'}><span>اسم الفئة <em>*</em></span><input name="customTrim" value="${esc(trimChoice==='فئة أخرى'?x.trim:'')}" placeholder="اكتب اسم الفئة"${trimChoice==='فئة أخرى'?' required':''}></label>`
        +select('سنة الصنع','year',VEHICLE_YEARS,String(x.year||2026))+select('اللون','color',[...VEHICLE_COLORS.map(value=>({value,text:fixedLabel(value)})),{value:'custom_color',text:'لون آخر'}],selectedColor)
        +`<label class="field" id="custom-color-field"${knownColor?' hidden':''}><span>اسم اللون <em>*</em></span><input name="customColor" type="text" value="${esc(knownColor?'':x.color)}" placeholder="مثال: لؤلؤي"${knownColor?'':' required'}></label>`
        +select('نوع الوقود','fuel',['gasoline','diesel','hybrid','electric','other'].map(value=>({value,text:fixedLabel(value)})),x.fuel)+field('رقم اللوحة (اختياري)','plate','text',x.plate,{required:false})+field('العداد الحالي (كم)','odometer','number',x.odometer,{min:0})+`<div class="field full vehicle-image-field" id="vehicle-image-field"><span>صورة المركبة</span><div class="form-image-preview"><img id="form-vehicle-image-preview" alt="صورة المركبة" hidden><div id="form-vehicle-image-placeholder" class="form-image-placeholder">⌁</div></div><div class="form-image-actions"><button type="button" class="soft-btn" id="form-change-image" data-action="choose-form-vehicle-image">إضافة صورة المركبة</button><button type="button" class="text-btn danger-text" id="form-delete-image" data-action="delete-form-vehicle-image" hidden>حذف الصورة</button></div><input id="form-vehicle-image-input" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" hidden></div>`+area('ملاحظات','notes',x.notes)
    }
    if(type==='odometer'){title='تعديل قراءة العداد';kicker=v.name;html=field('قراءة العداد الحالية (كم)','odometer','number',v.odometer,{min:0,full:true})}
    if(type==='settings'){title='إعدادات الصيانة القادمة';kicker=v.name;html=field('فترة الصيانة الافتراضية (كم)','serviceInterval','number',v.serviceInterval,{min:1000,full:true})}
    if(type==='maintenance'){const r=data.maintenance.find(x=>x.id===editingId)||{date:today(),odometer:v.odometer,types:[],cost:'',currency:'KWD',workshop:'',notes:''};title=editingId?'تعديل سجل الصيانة':'إضافة سجل صيانة';html=field('التاريخ','date','date',r.date)+field('قراءة العداد (كم)','odometer','number',r.odometer,{min:0})+'<div class="field full"><span>نوع الصيانة <em>*</em></span><div class="checks">'+SERVICE_TYPES.map(t=>`<label class="check"><input type="checkbox" name="types" value="${t}"${r.types?.includes(t)?' checked':''}> ${fixedLabel(t)}</label>`).join('')+'</div></div>'+field('التكلفة','cost','number',r.cost,{min:0,step:'.001'})+currencySelect(r.currency)+field('الورشة أو الوكالة','workshop','text',r.workshop,{placeholder:'اسم مقدم الخدمة',full:true})+area('ملاحظات الصيانة','notes',r.notes)}
    if(type==='expense'){const r=data.expenses.find(x=>x.id===editingId)||{date:today(),category:'fuel',amount:'',currency:'KWD',notes:''};title=editingId?'تعديل المصروف':'إضافة مصروف';html=field('التاريخ','date','date',r.date)+select('التصنيف','category',CATEGORIES.map(value=>({value,text:fixedLabel(value)})),r.category)+field('المبلغ','amount','number',r.amount,{min:0,step:'.001'})+currencySelect(r.currency)+area('الملاحظات','notes',r.notes)}
    if(type==='trip'){const r=data.trips.find(x=>x.id===editingId)||{date:today(),start:'',destination:'',startOdometer:v.odometer,type:'local',expenses:[],totalCost:0,distanceKm:null,currency:'KWD',notes:''};title=editingId?'تعديل الرحلة':'إضافة رحلة';html=field('نقطة الانطلاق','start','text',r.start)+field('الوجهة','destination','text',r.destination)+field('تاريخ الرحلة','date','date',r.date)+select('نوع الرحلة','type',['local','travel','offroad'].map(value=>({value,text:fixedLabel(value)})),r.type)+field('عداد البداية','startOdometer','number',r.startOdometer,{min:0})+currencySelect(r.currency)+`<section class="trip-expenses-field field full"><div class="trip-expenses-head"><span>مصروفات الرحلة</span><button type="button" class="soft-btn" data-action="add-trip-expense">＋ إضافة مصروف</button></div><div id="trip-expense-rows">${tripExpenses(r).map(tripExpenseRow).join('')}</div></section><label class="field full trip-total-field"><span>إجمالي تكلفة الرحلة</span><input name="totalCost" type="text" value="" readonly aria-readonly="true"></label>`+area('ملاحظات الرحلة','notes',r.notes)+field('إجمالي المسافة المقطوعة للرحلة (km)','distanceKm','number',tripDistance(r)??'',{min:0,required:false,full:true})}
    $('#dialog-kicker').textContent=kicker;$('#dialog-title').textContent=title;$('#form-fields').innerHTML=html;$('#app-dialog').showModal();
    if(type==='vehicle'){setupVehicleDependencies();updateFormImagePreview(initialVehicleImage)}
    if(type==='trip')setupTripForm();applyLanguage($('#app-dialog'));setTimeout(()=>$('input,select,textarea',$('#app-form'))?.focus(),0)
  }
  function setupTripForm(){
    const form=$('#app-form'),rows=$('#trip-expense-rows',form),currency=$('[name=currency]',form),total=$('[name=totalCost]',form);
    const updateTotal=()=>{const sum=$$('[name=tripExpenseCost]',rows).reduce((value,input)=>value+num(input.value),0);total.value=cash(sum,currency.value)};
    const updateMaintenance=row=>{const show=$('[name=tripExpenseType]',row).value==='maintenance',field=$('.trip-maintenance-type',row),input=$('[name=tripMaintenanceType]',row);field.hidden=!show;input.required=show;if(!show)input.value=''};
    rows.addEventListener('input',updateTotal);rows.addEventListener('change',e=>{if(e.target.matches('[name=tripExpenseType]'))updateMaintenance(e.target.closest('.trip-expense-row'));updateTotal()});currency.addEventListener('change',updateTotal);$$('.trip-expense-row',rows).forEach(updateMaintenance);updateTotal();
  }
  function setupVehicleDependencies(){
    const form=$('#app-form'),make=$('[name=make]',form),model=$('[name=model]',form),trim=$('[name=trim]',form),color=$('[name=color]',form);
    const customMake=$('[name=customMake]',form),customModel=$('[name=customModel]',form),customTrim=$('[name=customTrim]',form),customColor=$('[name=customColor]',form);
    const toggle=(input,wrapper,show)=>{wrapper.hidden=!show;input.required=show};
    const options=(values,selected)=>values.map(value=>`<option${value===selected?' selected':''}>${esc(value)}</option>`).join('');
    const updateTrim=(preferred='')=>{
      const actualMake=make.value==='شركة أخرى'?customMake.value.trim():make.value;
      const actualModel=model.value==='موديل آخر'?customModel.value.trim():model.value;
      const values=CATALOG.trims[actualMake+'|'+actualModel]||[];
      const selected=preferred?(values.includes(preferred)?preferred:'فئة أخرى'):'بدون فئة';
      trim.innerHTML=options(['بدون فئة',...values,'فئة أخرى'],selected);
      if(selected==='فئة أخرى'&&preferred)customTrim.value=preferred;
      toggle(customTrim,$('#custom-trim-field'),selected==='فئة أخرى');
      applyLanguage(trim);
    };
    const updateModel=(preferred='')=>{
      const actualMake=make.value==='شركة أخرى'?customMake.value.trim():make.value;
      const values=CATALOG.makes[actualMake]||[];
      const selected=preferred?(values.includes(preferred)?preferred:'موديل آخر'):(values[0]||'موديل آخر');
      model.innerHTML=options([...values,'موديل آخر'],selected);
      if(selected==='موديل آخر'&&preferred)customModel.value=preferred;
      toggle(customModel,$('#custom-model-field'),selected==='موديل آخر');
      updateTrim('');
      applyLanguage(model);
    };
    make.addEventListener('change',()=>{toggle(customMake,$('#custom-make-field'),make.value==='شركة أخرى');if(make.value!=='شركة أخرى')customMake.value='';updateModel('')});
    model.addEventListener('change',()=>{toggle(customModel,$('#custom-model-field'),model.value==='موديل آخر');if(model.value!=='موديل آخر')customModel.value='';updateTrim('')});
    trim.addEventListener('change',()=>{toggle(customTrim,$('#custom-trim-field'),trim.value==='فئة أخرى');if(trim.value!=='فئة أخرى')customTrim.value=''});
    color.addEventListener('change',()=>{toggle(customColor,$('#custom-color-field'),color.value==='custom_color');if(color.value!=='custom_color')customColor.value=''});
  }
  function upsert(name,r){const i=data[name].findIndex(x=>x.id===r.id);if(i<0)data[name].push(r);else data[name][i]=r}
  function submit(e){
    e.preventDefault();const fd=new FormData(e.currentTarget),x=Object.fromEntries(fd),v=activeVehicle();
    if(activeForm==='vehicle'){const existing=data.vehicles.find(z=>z.id===editingId),finalMake=x.make==='شركة أخرى'?x.customMake.trim():x.make,finalModel=x.model==='موديل آخر'?x.customModel.trim():x.model,finalTrim=x.trim==='فئة أخرى'?x.customTrim.trim():(x.trim==='بدون فئة'?'':x.trim),finalColor=x.color==='custom_color'?x.customColor.trim():x.color;if(!finalMake)return toast('اكتب اسم الشركة');if(!finalModel)return toast('اكتب اسم الموديل');if(x.trim==='فئة أخرى'&&!finalTrim)return toast('اكتب اسم الفئة');if(!finalColor)return toast('اكتب اسم اللون');const changedImage=pendingVehicleImage!==undefined,record={id:editingId||uid('v'),name:x.name.trim(),make:finalMake,model:finalModel,trim:finalTrim,year:num(x.year),color:finalColor,fuel:x.fuel,plate:x.plate.trim(),image:changedImage?pendingVehicleImage:(existing?.image||''),imageUrl:changedImage?'':(existing?.imageUrl||''),odometer:num(x.odometer),odometerUpdatedAt:existing?.odometer===num(x.odometer)?existing.odometerUpdatedAt:stamp(),serviceInterval:existing?.serviceInterval||10000,notes:x.notes.trim(),createdAt:existing?.createdAt||stamp()};upsert('vehicles',record);data.activeVehicleId=record.id;pendingVehicleImage=undefined}
    if(activeForm==='odometer'){v.odometer=num(x.odometer);v.odometerUpdatedAt=stamp()}
    if(activeForm==='settings')v.serviceInterval=Math.max(1000,num(x.serviceInterval));
    if(activeForm==='maintenance'){const types=fd.getAll('types');if(!types.length)return toast('اختر نوع صيانة واحداً على الأقل');upsert('maintenance',{id:editingId||uid('m'),vehicleId:v.id,date:x.date,odometer:num(x.odometer),types,cost:num(x.cost),currency:currencyCode(x.currency),workshop:x.workshop.trim(),notes:x.notes.trim()})}
    if(activeForm==='expense')upsert('expenses',{id:editingId||uid('e'),vehicleId:v.id,date:x.date,category:x.category,amount:num(x.amount),currency:currencyCode(x.currency),notes:x.notes.trim()});
    if(activeForm==='trip'){const expenses=$$('.trip-expense-row',e.currentTarget).map(row=>{const type=$('[name=tripExpenseType]',row).value;return{id:row.dataset.expenseId||uid('te'),type,cost:num($('[name=tripExpenseCost]',row).value),maintenanceType:type==='maintenance'?$('[name=tripMaintenanceType]',row).value.trim():''}}),distanceValue=String(x.distanceKm??'').trim(),totalCost=expenses.reduce((sum,item)=>sum+item.cost,0);upsert('trips',{id:editingId||uid('t'),vehicleId:v.id,date:x.date,start:x.start.trim(),destination:x.destination.trim(),startOdometer:num(x.startOdometer),type:x.type,expenses,totalCost,cost:totalCost,currency:currencyCode(x.currency),notes:x.notes.trim(),distanceKm:distanceValue===''?null:num(distanceValue)})}
    $('#app-dialog').close();save(editingId?'تم تحديث البيانات':'تم حفظ البيانات')
  }
  function askDelete(kind,recordId,label){pendingDelete={kind,id:String(recordId)};$('#confirm-message').textContent=kind==='vehicle'?'سيتم حذف مركبة «'+label+'» وجميع سجلاتها المرتبطة نهائياً. لا يمكن التراجع عن ذلك.':'سيتم حذف '+label+' نهائياً من سجل هذه المركبة.';applyLanguage($('#confirm-dialog'));$('#confirm-dialog').showModal()}
  function performDelete(){if(!pendingDelete)return;const {kind,id}=pendingDelete;if(kind==='vehicle'){data.vehicles=data.vehicles.filter(v=>v.id!==id);['maintenance','expenses','trips'].forEach(k=>data[k]=data[k].filter(r=>r.vehicleId!==id));if(data.activeVehicleId===id)data.activeVehicleId=null}else data[kind]=data[kind].filter(r=>r.id!==id);pendingDelete=null;$('#confirm-dialog').close();save('تم الحذف بنجاح')}
  function exportData(){const payload={...data,app:'سياراتي',exportedAt:stamp()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='sayyarati-backup-'+today()+'.json';document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);toast('تم تصدير جميع بيانات سيارتي')}
  function importData(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(reader.result);if(parsed.version===3&&Array.isArray(parsed.vehicles))data=normalize(parsed);else if(parsed.vehicle||parsed.odometer)data=migrate(parsed,!!parsed.odometer&&!parsed.vehicle);else throw Error();save('تمت استعادة جميع المركبات والسجلات')}catch{toast('الملف غير صالح أو ليس نسخة سيارتي')}finally{$('#import-file').value=''}};reader.readAsText(file)}
  function toast(message){const el=$('#toast');el.textContent=message;applyLanguage(el);el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2400)}

  document.addEventListener('click',e=>{
    const nav=e.target.closest('[data-nav]');if(nav){e.preventDefault();e.stopPropagation();navigate(nav.dataset.nav);return}
    const b=e.target.closest('[data-action]');if(b){e.stopPropagation();const a=b.dataset.action,rid=b.dataset.id;
      if(a==='home'){currentNav='home';data.activeVehicleId=null;save()}
      if(a==='open-vehicle'){currentNav='vehicles';data.activeVehicleId=String(rid);save()}
      if(a==='add-vehicle')openForm('vehicle');
      if(a==='choose-vehicle-image')$('#vehicle-photo-input').click();
      if(a==='delete-vehicle-image'){const v=activeVehicle();if(v){v.image='';v.imageUrl='';save('تم حذف الصورة')}}
      if(a==='choose-form-vehicle-image')$('#form-vehicle-image-input').click();
      if(a==='delete-form-vehicle-image'){pendingVehicleImage='';updateFormImagePreview('')}
      if(a==='vehicle-report')openReport();
      if(a==='close-report')$('#report-dialog').close();
      if(a==='edit-vehicle'||a==='edit-vehicle-card'){const vehicle=a==='edit-vehicle'?activeVehicle():data.vehicles.find(v=>v.id===String(rid));openForm('vehicle',vehicle.id,vehicle)}
      if(a==='delete-vehicle'||a==='delete-vehicle-card'){const vehicle=a==='delete-vehicle'?activeVehicle():data.vehicles.find(v=>v.id===String(rid));askDelete('vehicle',vehicle.id,vehicleTitle(vehicle))}
      if(a==='edit-odometer')openForm('odometer');if(a==='service-settings')openForm('settings');
      if(a==='add-maintenance')openForm('maintenance');if(a==='edit-maintenance')openForm('maintenance',rid);if(a==='delete-maintenance')askDelete('maintenance',rid,'سجل الصيانة');
      if(a==='add-expense')openForm('expense');if(a==='edit-expense')openForm('expense',rid);if(a==='delete-expense')askDelete('expenses',rid,'المصروف');
      if(a==='add-trip-expense'){const rows=$('#trip-expense-rows');rows.insertAdjacentHTML('beforeend',tripExpenseRow());applyLanguage(rows.lastElementChild);$('[name=tripExpenseType]',rows.lastElementChild).focus()}
      if(a==='delete-trip-expense'){const row=b.closest('.trip-expense-row'),rows=row.parentElement;row.remove();rows.dispatchEvent(new Event('input',{bubbles:true}))}
      if(a==='add-trip')openForm('trip');if(a==='edit-trip')openForm('trip',rid);if(a==='delete-trip')askDelete('trips',rid,'الرحلة');if(a==='close-dialog')$('#app-dialog').close()
    }
    const tab=e.target.closest('[data-trip-filter]');if(tab){tripFilter=tab.dataset.tripFilter;$$('.tab').forEach(x=>x.classList.toggle('active',x===tab));renderTrips(recordsFor('trips'))}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('.vehicle-card')){data.activeVehicleId=e.target.dataset.id;save()}});
  $('#app-form').addEventListener('submit',submit);$('.close-btn').onclick=()=>$('#app-dialog').close();$('#app-dialog').onclick=e=>{if(e.target===$('#app-dialog'))$('#app-dialog').close()};
  $('#cancel-delete').onclick=()=>{pendingDelete=null;$('#confirm-dialog').close()};$('#confirm-delete').onclick=performDelete;
  $('#export-btn').onclick=exportData;$('#import-btn').onclick=()=>$('#import-file').click();$('#import-file').onchange=e=>importData(e.target.files[0]);
  $('#vehicle-photo-input').onchange=e=>{const input=e.currentTarget;readVehicleImage(input.files[0],image=>{const v=activeVehicle();if(v){v.image=image;v.imageUrl='';save('تم حفظ صورة المركبة')}input.value=''})};
  document.addEventListener('change',e=>{if(e.target.id==='form-vehicle-image-input'){const input=e.target;readVehicleImage(input.files[0],image=>{pendingVehicleImage=image;updateFormImagePreview(image);input.value=''})}});
  $('#report-period').onchange=e=>{$$('.report-date').forEach(x=>x.hidden=e.target.value!=='custom');renderReport()};
  $$('[data-report-section]').forEach(x=>x.onchange=renderReport);
  $('#report-from').onchange=renderReport;$('#report-to').onchange=renderReport;
  $('#print-report').onclick=()=>window.print();
  $('#report-dialog').onclick=e=>{if(e.target===$('#report-dialog'))$('#report-dialog').close()};
  $('#language-select').onchange=e=>{language=e.target.value==='en'?'en':'ar';localStorage.setItem(LANGUAGE_KEY,language);render();if($('#app-dialog').open)applyLanguage($('#app-dialog'));if($('#report-dialog').open)renderReport();if($('#confirm-dialog').open)applyLanguage($('#confirm-dialog'))};
  render();
})();
