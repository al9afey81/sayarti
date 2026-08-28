(() => {
  'use strict';
  const REDIRECT_URL='https://al9afey81.github.io/sayarti/';
  const body=document.body,gate=document.querySelector('#auth-gate'),form=document.querySelector('#auth-form');
  const email=document.querySelector('#auth-email'),password=document.querySelector('#auth-password'),message=document.querySelector('#auth-message');
  const googleButton=document.querySelector('#google-auth-btn'),emailButton=document.querySelector('#email-auth-btn');
  const signinTab=document.querySelector('#signin-tab'),signupTab=document.querySelector('#signup-tab');
  const userBox=document.querySelector('#auth-user'),userName=document.querySelector('#auth-user-name'),avatar=document.querySelector('#auth-avatar');
  const signoutButton=document.querySelector('#signout-btn'),languageSelect=document.querySelector('#language-select');
  let mode='signin',client=null,busy=false;
  const isEnglish=()=>document.documentElement.lang==='en';
  const copy=(ar,en)=>isEnglish()?en:ar;
  const setMessage=(ar='',en='',error=false)=>{message.textContent=copy(ar,en);message.classList.toggle('error',error)};
  const setBusy=value=>{busy=value;googleButton.disabled=value;emailButton.disabled=value;signinTab.disabled=value;signupTab.disabled=value};
  function setMode(next){
    mode=next;const signup=mode==='signup';
    signinTab.classList.toggle('active',!signup);signupTab.classList.toggle('active',signup);
    signinTab.setAttribute('aria-selected',String(!signup));signupTab.setAttribute('aria-selected',String(signup));
    password.autocomplete=signup?'new-password':'current-password';
    emailButton.textContent=copy(signup?'إنشاء حساب':'تسجيل الدخول',signup?'Create Account':'Sign In');
    setMessage();
  }
  function showSession(session){
    const user=session?.user||null;
    body.classList.toggle('auth-ready',!!user);body.classList.remove('auth-pending');
    gate.hidden=!!user;userBox.hidden=!user;
    if(!user)return;
    const metadata=user.user_metadata||{},name=metadata.full_name||metadata.name||user.email||copy('مستخدم','User');
    userName.textContent=name;userName.title=user.email||name;
    const image=metadata.avatar_url||metadata.picture||'';
    if(image){avatar.src=image;avatar.hidden=false}else{avatar.removeAttribute('src');avatar.hidden=true}
  }
  function friendlyError(error){
    const value=String(error?.message||'');
    if(/invalid login credentials/i.test(value))return copy('البريد الإلكتروني أو كلمة المرور غير صحيحة.','Incorrect email or password.');
    if(/email not confirmed/i.test(value))return copy('أكد بريدك الإلكتروني أولاً، ثم حاول تسجيل الدخول.','Confirm your email first, then try signing in.');
    if(/password.*6|weak password/i.test(value))return copy('يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.','Password must be at least 6 characters.');
    if(/already registered|already been registered/i.test(value))return copy('يوجد حساب مسجل بهذا البريد.','An account already exists for this email.');
    return copy('تعذر إكمال العملية. حاول مرة أخرى.','Could not complete the request. Please try again.');
  }
  async function signInGoogle(){
    if(busy||!client)return;setBusy(true);setMessage('جارٍ تحويلك إلى Google…','Redirecting to Google…');
    const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:REDIRECT_URL}});
    if(error){setMessage(friendlyError(error),friendlyError(error),true);setBusy(false)}
  }
  async function submitEmail(event){
    event.preventDefault();if(busy||!client)return;setBusy(true);setMessage();
    const credentials={email:email.value.trim(),password:password.value};
    const result=mode==='signup'?await client.auth.signUp({...credentials,options:{emailRedirectTo:REDIRECT_URL}}):await client.auth.signInWithPassword(credentials);
    if(result.error){const text=friendlyError(result.error);setMessage(text,text,true);setBusy(false);return}
    if(mode==='signup'&&!result.data.session){setMessage('تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد الحساب.','Account created. Check your email to confirm it.');form.reset();setBusy(false);return}
    showSession(result.data.session);setBusy(false);form.reset();
  }
  async function signOut(){
    if(busy||!client)return;setBusy(true);const {error}=await client.auth.signOut({scope:'local'});setBusy(false);
    if(error){setMessage(friendlyError(error),friendlyError(error),true);return}showSession(null)
  }
  function initialize(){
    try{
      const config=window.SAYARTI_SUPABASE_CONFIG;
      if(!window.supabase?.createClient||!config?.url||!config?.publishableKey)throw new Error('Missing Supabase configuration');
      client=window.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      client.auth.onAuthStateChange((_event,session)=>{showSession(session);setBusy(false)});
      client.auth.getSession().then(({data,error})=>{if(error)throw error;showSession(data.session)}).catch(()=>{body.classList.remove('auth-pending');setMessage('تعذر الاتصال بخدمة تسجيل الدخول. تحقق من الإنترنت وحاول مجدداً.','Could not connect to sign-in. Check your connection and try again.',true)});
    }catch(error){console.error(error);body.classList.remove('auth-pending');setMessage('تعذر تحميل خدمة تسجيل الدخول. أعد تحميل الصفحة.','Could not load sign-in. Reload the page.',true)}
  }
  signinTab.addEventListener('click',()=>setMode('signin'));signupTab.addEventListener('click',()=>setMode('signup'));
  googleButton.addEventListener('click',signInGoogle);form.addEventListener('submit',submitEmail);signoutButton.addEventListener('click',signOut);
  languageSelect.addEventListener('change',()=>requestAnimationFrame(()=>setMode(mode)));
  initialize();
})();
