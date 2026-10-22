// Basic consent mode: no Google request or identifier until explicit opt-in.
export const MEASUREMENT_ID='G-LHDG8M183F';
const denied={analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'};
const read=key=>{try{return localStorage.getItem(key);}catch{return null;}};
const write=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
const blocked=()=>navigator.globalPrivacyControl===true||navigator.doNotTrack==='1';
const permitted=()=>read('veeays_analytics_choice_v2')==='yes'&&!blocked();
export function safePage(path){
 if(/^\/(?:admin|api|webhooks|auth|account\/delete|job-alerts\/unsubscribe)(?:\/|$)/.test(path))return null;
 if(/^\/jobs\/[1-9]\d{0,18}$/.test(path))return path;
 if(/^\/categories\/[^/]+$/.test(path))return '/categories/detail';
 if(/^\/resources\/[^/]+$/.test(path))return '/resources/guide';
 return new Set(['/','/jobs','/categories','/employers','/about','/contact','/pro','/pro/return','/privacy','/terms','/refund-policy','/disclaimer','/resources','/resume-studio','/signup','/login','/check-email','/onboarding','/matches','/my-jobs','/saved-searches','/job-alerts','/email-preferences']).has(path)?path:null;
}
if(typeof window!=='undefined'&&!window.__veeaysAnalytics){
 window.__veeaysAnalytics=true;
 let loaded=false,lastPage=null,timer=null,id=null;
 function gtag(){window.dataLayer=window.dataLayer||[];window.dataLayer.push(arguments);}
 const page=()=>safePage(location.pathname);
 function load(){
  if(loaded||!page()||!permitted())return;
  // An existing container must be audited, never silently install a second owner.
  if(document.querySelector('script[src*="googletagmanager.com"]'))return;
  loaded=true;window['ga-disable-'+MEASUREMENT_ID]=false;
  gtag('consent','default',denied);
  gtag('consent','update',{...denied,analytics_storage:'granted'});
  gtag('js',new Date());
  gtag('config',MEASUREMENT_ID,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,ignore_referrer:true,page_location:location.origin+page(),page_referrer:'',page_title:'VeeAys',debug_mode:location.hostname!=='veeays.com',cookie_expires:1800,cookie_update:false});
  const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+MEASUREMENT_ID;script.referrerPolicy='no-referrer';document.head.append(script);
 }
 function event(name,params={}){
  if(!permitted()||!page())return;load();if(!loaded)return;
  gtag('event',name,{send_to:MEASUREMENT_ID,page_location:location.origin+page(),page_referrer:'',page_title:'VeeAys',...params});
 }
 function pageview(){const p=page();if(p&&permitted()&&location.pathname!==lastPage){if(loaded)gtag('set',{page_location:location.origin+p,page_referrer:'',page_title:'VeeAys'});event('page_view');if(loaded)lastPage=location.pathname;}}
 async function conversions(){
  if(!permitted())return;
  const cookie=document.cookie.match(/(?:^|; )veeays_signup=([0-9a-f-]{36})(?:;|$)/);
  if(cookie){const key='veeays_ga_signup_'+cookie[1];if(!read(key)){event('sign_up',{method:'email'});if(loaded)write(key,'1');}if(loaded)document.cookie='veeays_signup=; Path=/; Secure; SameSite=Lax; Max-Age=0';}
  const receipt=document.querySelector('[data-analytics-purchase]');
  if(receipt&&/^[a-f0-9]{64}$/.test(receipt.dataset.analyticsPurchase)){
   const transaction=receipt.dataset.analyticsPurchase,key='veeays_ga_purchase_'+transaction;
   if(!read(key)){event('purchase',{transaction_id:transaction,value:499,currency:'PHP',items:[{item_id:'veeays_pro_30d',item_name:'VeeAys Pro 30 days',price:499,quantity:1}]});if(loaded)write(key,'1');}
  }
 }
 const ping=remove=>{if(!id)return;fetch('/activity',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({id,consent:!remove,remove:!!remove}),signal:AbortSignal.timeout(5000)}).catch(()=>{});};
 function active(){if(document.hidden||!permitted()||!page())return;let stored;try{stored=JSON.parse(read('veeays_active'));}catch{}if(!stored||stored.expires<Date.now()){stored={id:crypto.randomUUID(),expires:Date.now()+1800000};write('veeays_active',JSON.stringify(stored));}id=stored.id;ping(false);}
 function sync(){
  clearInterval(timer);
  if(permitted()){
   window['ga-disable-'+MEASUREMENT_ID]=false;if(loaded)gtag('consent','update',{...denied,analytics_storage:'granted'});
   pageview();conversions();active();timer=setInterval(active,30000);
  }else{
   window['ga-disable-'+MEASUREMENT_ID]=true;if(loaded)gtag('consent','update',denied);
   if(!id){try{id=JSON.parse(read('veeays_active'))?.id;}catch{}}ping(true);id=null;lastPage=null;document.cookie='veeays_signup=; Path=/; Secure; SameSite=Lax; Max-Age=0';try{localStorage.removeItem('veeays_active');}catch{}
   for(const part of document.cookie.split(';')){const name=part.trim().split('=')[0];if(/^_ga(?:_|$)/.test(name)){for(const domain of ['',location.hostname,'.'+location.hostname,'.veeays.com'])document.cookie=name+'=; Path=/; Max-Age=0; Secure; SameSite=Lax'+(domain?'; Domain='+domain:'');}}
  }
 }
 // Only actual path changes count; query/filter/hash changes may contain PII.
 for(const method of ['pushState','replaceState']){const original=history[method];history[method]=function(...args){const result=original.apply(this,args);pageview();return result;};}
 window.addEventListener('popstate',pageview);
 window.addEventListener('veeays:consent',sync);
 window.addEventListener('storage',e=>{if(e.key==='veeays_analytics_choice_v2')sync();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
 sync();
}
