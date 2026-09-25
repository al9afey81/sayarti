/* Receipt recognition runs in the browser. Images are never uploaded or persisted. */
(function(root){
  'use strict';
  const digits=text=>String(text||'').replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/٫/g,'.').replace(/٬/g,',');
  function readingFrom(data){
    const lines=(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[]));
    const trusted=lines.filter(l=>{const words=l.words||[];return words.length&&words.every(w=>Number.isFinite(w.confidence)&&w.confidence>=80)}).map(l=>digits(l.text).trim());
    const text=trusted.join('\n'),out={},unique=values=>[...new Set(values)];
    const amounts=[];
    for(const line of trusted){
      if(!/\b(?:grand\s+total|total|amount\s+due)\b|الإجمالي|الاجمالي|المجموع|إجمالي|اجمالي/i.test(line)||/sub\s*total|tax|vat|ضريبة|قبل|خصم/i.test(line))continue;
      const numbers=line.match(/\d[\d,]*(?:\.\d{1,3})?/g)||[];
      if(numbers.length===1&&/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,3})?$/.test(numbers[0])){const value=Number(numbers[0].replace(/,/g,''));if(Number.isFinite(value)&&value>0)amounts.push(value)}
    }
    if(unique(amounts).length===1)out.amount=String(amounts[0]);
    const dates=[];
    for(const line of trusted){
      for(const m of line.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b|\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/g)){
        const y=Number(m[1]||m[6]),month=Number(m[2]||m[5]),day=Number(m[3]||m[4]);
        // A day-first date is accepted only when its order is unambiguous.
        if(!m[1]&&day<=12&&day!==month)continue;
        const d=new Date(Date.UTC(y,month-1,day));
        if(y>=2000&&y<=2100&&d.getUTCFullYear()===y&&d.getUTCMonth()===month-1&&d.getUTCDate()===day)dates.push(d.toISOString().slice(0,10));
      }
    }
    if(unique(dates).length===1)out.date=dates[0];
    const currencies={KWD:/\bKWD\b|د\.?\s*ك|دينار كويتي/i,USD:/\bUSD\b|US\$/i,EUR:/\bEUR\b|€/i,TRY:/\bTRY\b|₺/i,SAR:/\bSAR\b|ريال سعودي/i,AED:/\bAED\b|درهم إماراتي/i,QAR:/\bQAR\b/i,BHD:/\bBHD\b/i,OMR:/\bOMR\b/i,IQD:/\bIQD\b/i};
    const codes=Object.keys(currencies).filter(c=>currencies[c].test(text));if(codes.length===1)out.currency=codes[0];
    const categories={fuel:/\b(fuel|petrol|diesel|gasoline)\b|بنزين|ديزل|وقود/i,maintenance:/\b(maintenance|oil change|repair|garage)\b|صيانة|تغيير زيت|ورشة/i,restaurant:/\b(restaurant|cafe)\b|مطعم|مقهى/i,hotel:/\bhotel\b|فندق/i,grocery:/\b(grocery|supermarket)\b|بقالة|سوبرماركت/i,road_tolls:/\b(toll|salik)\b|سالك|رسوم طرق/i};
    const types=Object.keys(categories).filter(c=>categories[c].test(text));if(types.length===1)out.category=types[0];
    const merchant=trusted.map(l=>l.match(/^(?:merchant|store|المحل|الجهة)\s*[:：]\s*(.{2,80})$/i)).filter(Boolean);if(merchant.length===1)out.merchant=merchant[0][1];
    return out;
  }
  let library;
  function loadLibrary(){
    if(root.Tesseract)return Promise.resolve(root.Tesseract);
    if(!library)library=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      const timeout=setTimeout(()=>fail(),20000);
      function fail(){clearTimeout(timeout);script.remove();library=null;reject(Error('OCR unavailable'))}
      script.src='https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';
      script.onload=()=>{clearTimeout(timeout);if(root.Tesseract)resolve(root.Tesseract);else fail()};
      script.onerror=fail;document.head.append(script);
    });
    return library;
  }
  function mount(form,dialog){
    const panel=document.createElement('section');panel.className='field full receipt-camera';
    panel.innerHTML='<div class="form-image-actions"><button type="button" class="soft-btn" data-receipt-camera>تصوير الفاتورة</button><button type="button" class="soft-btn" data-receipt-gallery>رفع فاتورة</button></div><p class="form-hint">تُقرأ الصورة محلياً. راجع القيم قبل الحفظ؛ الإدخال اليدوي متاح دائماً. الصورة للمعاينة والقراءة فقط.</p><input type="file" accept="image/*" capture="environment" data-receipt-capture hidden><input type="file" accept="image/*" data-receipt-file hidden><img class="odometer-preview" alt="معاينة الفاتورة" hidden><p role="status" aria-live="polite"></p>';
    form.querySelector('#form-fields').prepend(panel);
    const capture=panel.querySelector('[data-receipt-capture]'),gallery=panel.querySelector('[data-receipt-file]'),preview=panel.querySelector('img'),status=panel.querySelector('[role=status]');
    let serial=0,disposed=false,worker=null,url=null,timer;
    const cancel=()=>{serial++;clearTimeout(timer);if(worker){void worker.terminate().catch(()=>{});worker=null}panel.removeAttribute('aria-busy')};
    const changed=e=>{if(e.target.matches('[name]')){cancel();status.textContent='راجع القيم التي أدخلتها ثم اضغط حفظ البيانات.'}};
    form.addEventListener('input',changed);form.addEventListener('change',changed);
    const failed=()=>{status.textContent='تعذرت قراءة الفاتورة بوضوح. أدخل القيم يدوياً أو اختر صورة أوضح.'};
    panel.querySelector('[data-receipt-camera]').onclick=()=>capture.click();panel.querySelector('[data-receipt-gallery]').onclick=()=>gallery.click();
    async function recognize(file){
      cancel();if(!file||disposed)return;const job=serial,current=()=>!disposed&&serial===job&&dialog.open;
      if(url)URL.revokeObjectURL(url);preview.hidden=true;preview.removeAttribute('src');
      if(!file.type.startsWith('image/')||file.size>25*1024*1024){failed();return}
      status.textContent='جارٍ قراءة الفاتورة… يمكنك الإدخال يدوياً في أي وقت.';panel.setAttribute('aria-busy','true');
      timer=setTimeout(()=>{if(current()){cancel();failed()}},60000);
      try{
        url=URL.createObjectURL(file);const image=new Image();const loaded=new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject});image.src=url;await loaded;if(!current())return;
        preview.src=url;preview.hidden=false;
        const scale=Math.min(1,2400/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
        const engine=await loadLibrary();if(!current())return;
        const created=await engine.createWorker(['eng','ara'],1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',langPath:'https://tessdata.projectnaptha.com/4.0.0'});
        if(!current()){await created.terminate();return}worker=created;
        const result=await created.recognize(canvas,{}, {text:true,blocks:true});if(!current())return;
        const reading=readingFrom(result.data);
        for(const [name,value] of Object.entries(reading)){const input=form.elements.namedItem(name);if(input)input.value=value}
        if(reading.date)form.elements.namedItem('date').dispatchEvent(new Event('input',{bubbles:true}));
        status.textContent=Object.keys(reading).length?'تمت قراءة بعض بيانات الفاتورة. راجع جميع القيم وأكمل الناقص ثم اضغط حفظ البيانات.':'لم تظهر بيانات مؤكدة. أدخل القيم يدوياً أو اختر صورة أوضح.';
      }catch(error){if(current())failed()}
      finally{if(serial===job)cancel()}
    }
    for(const picker of [capture,gallery])picker.onchange=()=>{const file=picker.files[0];picker.value='';void recognize(file)};
    const dispose=()=>{if(disposed)return;disposed=true;cancel();if(url)URL.revokeObjectURL(url);form.removeEventListener('input',changed);form.removeEventListener('change',changed);form.removeEventListener('submit',cancel);dialog.removeEventListener('close',dispose);dialog.removeEventListener('cancel',dispose)};
    form.addEventListener('submit',cancel);dialog.addEventListener('close',dispose);dialog.addEventListener('cancel',dispose);return dispose;
  }
  const api={readingFrom,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.ReceiptOCR=api;
})(typeof window==='object'?window:globalThis);
