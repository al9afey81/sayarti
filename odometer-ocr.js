/* Optional, on-device OCR. No vehicle data or images are persisted here. */
(function(root){
  'use strict';
  const digits=text=>String(text||'').replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c));
  function readingFrom(result){
    const lines=(result.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[]));
    const candidates=[];
    for(const line of lines){
      const text=digits(line.text).trim();
      // Reject speed, trip meters, range and miles; never silently convert units.
      if(/\b(trip|range|mph|miles?|km\s*\/\s*h|kmh)\b|رحلة|مدى|ميل|كم\s*\/\s*س/i.test(text))continue;
      const match=text.match(/^(?:(?:ODO|ODOMETER|TOTAL|العداد|عداد)\s*[:：]?\s*)?([0-9]{1,7}|[0-9]{1,3}(?:[,٬ ][0-9]{3}){1,2})\s*(?:km|كلم|كم)?$/i);
      if(!match)continue;
      const numericWords=(line.words||[]).filter(w=>/[0-9]/.test(digits(w.text)));
      const confident=numericWords.length>0&&numericWords.every(w=>Number.isFinite(w.confidence)&&w.confidence>=85);
      const number=Number(match[1].replace(/[,٬ ]/g,''));
      const explicit=/ODO|TOTAL|العداد|عداد/i.test(text);
      const km=/km|كلم|كم/i.test(text);
      if(number>9999999||(!explicit&&!km&&match[1].length<4))continue;
      candidates.push({number,explicit,confident});
    }
    const explicit=candidates.filter(c=>c.explicit);
    if(/\b(mph|miles?)\b|ميل/i.test(result.text||''))return null;
    if(!explicit.length&&/\b(trip|range)\b|رحلة|مدى/i.test(result.text||''))return null;
    const chosen=explicit.length?explicit:candidates;
    // More than one plausible reading is ambiguous, even when values coincide.
    return chosen.length===1&&chosen[0].confident?chosen[0].number:null;
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
  function mount(input,dialog){
    const en=()=>document.documentElement.lang==='en';
    const t=(ar,english)=>en()?english:ar;
    const panel=document.createElement('div');
    panel.className='odometer-camera';
    panel.innerHTML='<div class="odometer-camera-actions"><button type="button" class="soft-btn" data-odometer-camera><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h4l2-3h4l2 3h4v14H4Z"/><circle cx="12" cy="13" r="4"/></svg><span>'+'تصوير العداد'+'</span></button><button type="button" class="text-btn" data-odometer-gallery>'+'اختيار صورة'+'</button></div><p class="form-hint">'+'صوّر رقم العداد عن قرب بوضوح مع علامة ODO أو km، ثم راجع الرقم قبل الحفظ.'+'</p><input type="file" accept="image/*" capture="environment" data-odometer-capture hidden><input type="file" accept="image/*" data-odometer-file hidden><img class="odometer-preview" alt="'+'معاينة صورة العداد'+'" hidden><p class="odometer-status" role="status" aria-live="polite"></p>';
    const field=input.closest('.field');
    const container=document.createElement('div');container.className=field.className+' odometer-field';
    field.replaceWith(container);container.append(field,panel);
    input.inputMode='numeric';
    const camera=panel.querySelector('[data-odometer-capture]'),gallery=panel.querySelector('[data-odometer-file]');
    const preview=panel.querySelector('img'),status=panel.querySelector('[role=status]');
    let serial=0,disposed=false,worker=null,photoURL=null,timer=null;
    const message=text=>{status.textContent=text};
    const failed=()=>message(t('لم نتمكن من قراءة العداد بوضوح. أدخل الرقم يدوياً أو اختر صورة أوضح.','The odometer could not be read clearly. Enter it manually or choose a clearer photo.'));
    const releaseWorker=()=>{if(worker){void worker.terminate().catch(()=>{});worker=null}};
    const cancel=()=>{serial++;clearTimeout(timer);releaseWorker();panel.removeAttribute('aria-busy')};
    const changed=()=>{cancel();message(t('راجع الرقم الذي أدخلته ثم اضغط حفظ البيانات.','Review your entered reading, then select Save Data.'))};
    input.addEventListener('input',changed);
    panel.querySelector('[data-odometer-camera]').onclick=()=>camera.click();
    panel.querySelector('[data-odometer-gallery]').onclick=()=>gallery.click();

    async function recognize(file){
      if(!file||disposed)return;
      cancel();const job=serial;
      if(photoURL){URL.revokeObjectURL(photoURL);photoURL=null}
      preview.hidden=true;preview.removeAttribute('src');
      if(file.size>25*1024*1024||!(file.type.startsWith('image/')||/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name))){failed();return}
      const current=()=>!disposed&&serial===job&&dialog.open&&input.isConnected;
      panel.setAttribute('aria-busy','true');
      message(t('جارٍ قراءة العداد… يمكنك إدخاله يدوياً في أي وقت.','Reading the odometer… You can enter it manually at any time.'));
      timer=setTimeout(()=>{if(current()){cancel();failed()}},60000);
      try{
        photoURL=URL.createObjectURL(file);
        const image=new Image();
        const loaded=new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject});
        image.src=photoURL;await loaded;if(!current())return;
        preview.src=photoURL;preview.hidden=false;
        const scale=Math.min(1,2000/Math.max(image.naturalWidth,image.naturalHeight));
        const canvas=document.createElement('canvas');
        canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
        canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
        const engine=await loadLibrary();if(!current())return;
        const created=await engine.createWorker(['eng','ara'],1,{
          workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',
          corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',
          langPath:'https://tessdata.projectnaptha.com/4.0.0'
        });
        if(!current()){await created.terminate();return}
        worker=created;
        await created.setParameters({tessedit_pageseg_mode:'11'});
        const result=await created.recognize(canvas,{}, {text:true,blocks:true});
        if(!current())return;
        const reading=readingFrom(result.data);
        if(reading===null){failed();return}
        input.value=String(reading);
        message(t('تمت قراءة العداد. راجع الرقم وعدّله عند الحاجة، ثم اضغط حفظ البيانات.','Odometer read. Review or correct the reading, then select Save Data.'));
      }catch(error){if(current())failed()}
      finally{if(serial===job){clearTimeout(timer);releaseWorker();panel.removeAttribute('aria-busy')}}
    }
    for(const picker of [camera,gallery])picker.onchange=()=>{const file=picker.files[0];picker.value='';void recognize(file)};
    const dispose=()=>{
      if(disposed)return;
      disposed=true;cancel();if(photoURL)URL.revokeObjectURL(photoURL);
      preview.removeAttribute('src');input.removeEventListener('input',changed);
      dialog.removeEventListener('close',dispose);dialog.removeEventListener('cancel',dispose);
      dialog.querySelector('form').removeEventListener('submit',cancel);
    };
    dialog.addEventListener('close',dispose);dialog.addEventListener('cancel',dispose);
    dialog.querySelector('form').addEventListener('submit',cancel);
    return dispose;
  }
  const api={readingFrom,mount};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.OdometerOCR=api;
})(typeof window==='object'?window:globalThis);
