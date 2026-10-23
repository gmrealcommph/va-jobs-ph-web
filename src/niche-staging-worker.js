// Isolated preview: never forward a write, credential, or scheduled event to production.
import worker from './worker.js';
import {nichePage,nicheJobs} from './niche-finder.js';
import {MODEL_VERSION,validateAnswers,rankNiches,NICHES} from '../public/niche-model.js';
import {layout} from './render.js';
export {ActiveVisitors} from './active-visitors.js';
export {ResumeBudget} from './resume-studio.js';
export default {async fetch(request,env,ctx){
 const url=new URL(request.url),h=new Headers({'cache-control':'no-store','x-robots-tag':'noindex, nofollow','referrer-policy':'same-origin'});
 if(['/niche-finder','/niche-finder/preferences'].includes(url.pathname)){
  let saved=null;try{const raw=(request.headers.get('cookie')||'').split(';').map(c=>c.trim()).find(c=>c.startsWith('nf_demo='));saved=JSON.parse(decodeURIComponent(raw?.slice(8)||'null'));if(saved){saved.answers=validateAnswers(saved.answers);saved.results=rankNiches(saved.answers);saved.selected=(saved.selected||[]).filter(id=>NICHES.some(n=>n.id===id)).slice(0,3);}}catch{saved=null;}
  if(request.method==='POST'){
   if(request.headers.get('origin')!==url.origin)return new Response('Forbidden',{status:403});
   const text=await request.text();if(text.length>12000)return new Response('Too large',{status:413});const form=new URLSearchParams(text);
   try{if(url.pathname.endsWith('/preferences')){if(!saved)throw Error();const selected=form.getAll('selected');if(!selected.length||selected.length>3||selected.some(id=>!NICHES.some(n=>n.id===id)))throw Error();saved.selected=selected;}
   else{const answers=validateAnswers(JSON.parse(form.get('answers')));saved={version:MODEL_VERSION,answers,selected:rankNiches(answers).map(n=>n.id),updatedAt:new Date().toISOString()};}
   h.append('set-cookie','nf_demo='+encodeURIComponent(JSON.stringify({...saved,results:undefined}))+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600');h.set('location','/niche-finder?saved=1');return new Response(null,{status:303,headers:h});}catch{return new Response('Review your answers or choose one to three niches. Go back to retry.',{status:400,headers:h});}
  }
  const editing=url.searchParams.has('edit')||url.searchParams.has('retake'),results=saved?.results||[],jobs={},jobErrors=[];
  if(saved&&!editing)await Promise.all(results.map(async n=>{try{jobs[n.id]=await nicheJobs(env,n);}catch{jobErrors.push(n.id);}}));
  const body=nichePage({saved:url.searchParams.has('retake')?null:saved,results,jobs,jobErrors,editing,preview:true});h.set('content-type','text/html; charset=utf-8');h.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  return new Response(request.method==='HEAD'?null:layout({title:'Niche Finder preview',description:'VeeAys staging preview',canonical:url.origin+'/niche-finder',noindex:true,user:{id:'preview'},body}),{headers:h});
 }
 if(!['GET','HEAD'].includes(request.method)||url.pathname.startsWith('/auth/')||['/logout','/signup','/login','/pro/checkout','/account/delete'].includes(url.pathname))return new Response('Staging is read-only. Account and payment actions are disabled.',{status:403,headers:h});
 const clean=new Request(request,{headers:new Headers([...request.headers].filter(([k])=>!['cookie','authorization'].includes(k.toLowerCase())))});
 const response=await worker.fetch(clean,env,ctx);const headers=new Headers(response.headers);headers.set('x-robots-tag','noindex, nofollow');return new Response(response.body,{status:response.status,headers});
}};
