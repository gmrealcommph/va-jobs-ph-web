import {recordCompletion} from './tool-completions.js';
import {MODEL_VERSION,NICHES,validateAnswers,rankNiches} from '../public/niche-model.js';
import {sessionForRequest,setSessionCookies,authFetch,getJobPreferences,saveJobPreferences,getMyProfile} from './auth.js';
import {query,literal} from './data.js';
import {layout,esc,jobPath} from './render.js';

const endpoint='/niche-finder';
export function savedFinder(user){const saved=user?.user_metadata?.niche_finder;if(saved?.version!==MODEL_VERSION)return null;try {return {version:MODEL_VERSION,answers:validateAnswers(saved.answers),results:rankNiches(saved.answers),selected:Array.isArray(saved.selected)?[...new Set(saved.selected)].filter(id=>NICHES.some(n=>n.id===id)).slice(0,3):[],updatedAt:Number.isFinite(Date.parse(saved.updatedAt))?new Date(saved.updatedAt).toISOString():null};}catch{return null;}}
export async function nicheJobs(env,niche){
 const params={select:'id,title,company,category,location',category:`eq.${niche.category}`,order:'posted_at.desc.nullslast,id.desc'};
 const terms={video:['video','editor'],design:['designer','graphic','design'],tech:['technical support','web support','website','wordpress','helpdesk'],leads:['lead generation','prospecting','sales development']};
 if(terms[niche.id])params.or='('+terms[niche.id].map(t=>'title.ilike.'+literal('*'+t+'*')).join(',')+')';
 // Reuse the same eligibility/visibility view as the production job board.
 return (await query(env,params,{limit:3})).rows;
}
export function nichePage({saved=null,results=[],jobs={},jobErrors=[],editing=false,notice='',error='',preview=false}={}){
 const summary=saved&&!editing;
 const data=JSON.stringify({answers:saved?.answers||{}}).replaceAll('<','\\u003c');
 const resultsHtml=results.map((n,i)=>`<article class="nf-result"><span class="nf-number">0${i+1} · EXPLORE</span><h2>${esc(n.name)}</h2><p>${esc(n.explanation)}</p><h3>Why explore this?</h3><p>${n.reasons.length?'You chose: '+n.reasons.map(esc).join('; ')+'.':'You’re still exploring. This is a starting point to try, with no strong preference identified yet.'}</p><h3>Your first small step</h3><p>${esc(n.firstStep)}</p><h3>Current VeeAys opportunities</h3>${jobErrors.includes(n.id)?'<p>Jobs could not load right now. Please try again.</p>':jobs[n.id]?.length?`<ul class="nf-jobs">${jobs[n.id].map(j=>`<li><a href="${jobPath(j)}">${esc(j.title)}</a><span>${esc(j.company)} · ${esc(j.location)}</span></li>`).join('')}</ul>`:'<p>No current listings found for this niche. You can still explore and practise.</p>'}<a href="/categories/${encodeURIComponent(n.category)}">Explore ${esc(n.category)} jobs →</a></article>`).join('');
 return `<link rel="stylesheet" href="/niche-finder.css?v=1"><section class="nf-shell"><header class="nf-intro"><div class="kicker">FREE CAREER DISCOVERY · BETTER JOBS. FROM HOME.</div><h1>Don’t know your niche?<br><em>Let’s find it together.</em></h1><p>A niche is simply a type of work you could focus on. You don’t need to know yours—or have remote-work experience—to begin.</p><p>14 short questions · about 5 minutes · always optional</p><div class="nf-actions"><a href="/jobs">Skip for now — browse jobs →</a><a href="/onboarding">I already know my roles</a></div></header>${preview?'<p class="nf-notice">Staging preview · sample member · saves stay in this preview only. Live job listings are read-only.</p>':''}${notice?`<p class="nf-notice" role="status">${esc(notice)}</p>`:''}${error?`<p class="nf-error" role="alert">${esc(error)}</p>`:''}
 ${summary?`<section class="nf-summary"><div class="kicker">YOUR NEXT POSSIBILITIES</div><h2>Three paths worth exploring.</h2><p>These reflect your answers, not a skills test or a hiring promise. Listings are currently visible to Filipino applicants on VeeAys; check each employer’s experience, tools and schedule requirements.</p><p>Saved privately to your account${saved.updatedAt?' · '+esc(new Date(saved.updatedAt).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'})):''}. You can change your answers or choices anytime.</p><div class="nf-results">${resultsHtml}</div>
 <form method="post" action="/niche-finder/preferences" class="nf-card"><h2>Choose what to explore in your profile</h2><p>Your discovery results are already saved. Select up to three niches to use for matching. This updates only your target roles; your pay, schedule, experience, skills and email settings stay as they are. Writing and data entry currently map to “Other” in the existing matcher; use the job links above for those niches.</p><div class="nf-selections">${NICHES.map(n=>`<label><input type="checkbox" name="selected" value="${n.id}" ${saved.selected?.includes(n.id)?'checked':''}>${esc(n.name)}</label>`).join('')}</div><button type="submit">Save choices &amp; update my roles</button><a href="/onboarding">Edit full matching profile</a></form><div class="nf-actions"><a class="button secondary" href="/niche-finder?edit=1">Edit answers</a><a class="button secondary" href="/niche-finder?retake=1">Retake from the start</a><a href="/matches">My Matches →</a></div><p>Your saved results stay in place until you finish a new questionnaire.</p></section>`:
 `<section class="nf-card" id="nf-quiz"><div id="nf-progress" role="status" aria-live="polite"></div><progress id="nf-meter" max="14" value="0" aria-label="Question progress"></progress><form method="post" action="/niche-finder" id="nf-form"><input type="hidden" name="answers" id="nf-answers"><input type="hidden" name="completion_id" value="${crypto.randomUUID()}"><div id="nf-question"></div><p id="nf-error" role="alert"></p><div class="nf-actions"><button type="button" id="nf-back">Back</button><button type="submit" id="nf-next">Continue →</button></div></form><noscript><p>Turn on JavaScript to use the adaptive questions. You can also <a href="/onboarding">choose roles directly</a> or browse jobs freely.</p></noscript></section><script type="application/json" id="nf-data">${data}</script><script src="/niche-finder.js?v=1" type="module"></script>`}
 <footer class="nf-privacy"><p>Your answers and results are private account data, stored until you replace them or delete your account. No answers are sent to AI or browser analytics. We count completed forms anonymously. <a href="/privacy">Privacy details</a> · <a href="/account/delete">Account deletion</a></p></footer></section>`;
}
export async function nicheEndpoint(request,env){
 const url=new URL(request.url);if(![endpoint,endpoint+'/preferences'].includes(url.pathname))return null;
 const h=new Headers({'cache-control':'no-store','x-robots-tag':'noindex, nofollow','referrer-policy':'same-origin'});
 if(!['GET','HEAD','POST'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{...Object.fromEntries(h),Allow:'GET, HEAD, POST'}});
 // Missing Origin is rejected on mutations; no cross-site form can change a member’s profile.
 if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return new Response('Forbidden',{status:403,headers:h});
 const state=await sessionForRequest(request,env);
 if(state.refreshed&&typeof state.refreshed==='object')setSessionCookies(h,state.refreshed);
 if(!state.user||!state.accessToken){h.set('location','/login?return=%2Fniche-finder');return new Response(null,{status:303,headers:h});}
 if(!state.user.email_confirmed_at&&!state.user.confirmed_at){h.set('location','/check-email?return=%2Fniche-finder');return new Response(null,{status:303,headers:h});}
 const saved=savedFinder(state.user);
 let profile=null;try{profile=await getMyProfile(env,state.accessToken,state.user.id);}catch{}
 const page=(body,status=200)=>{h.set('content-type','text/html; charset=utf-8');h.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");return new Response(request.method==='HEAD'?null:layout({title:'Niche Finder',description:'Explore remote work that could suit you.',canonical:url.origin+endpoint,body,noindex:true,user:state.user,profile}),{status,headers:h});};
 const save=async value=>{const {response,data}=await authFetch(env,'/auth/v1/user',{method:'PUT',headers:{Authorization:'Bearer '+state.accessToken},body:JSON.stringify({data:{niche_finder:value}})});if(!response.ok||!data?.id)throw Error('save');};
 try{
  if(request.method==='POST'){
   if(Number(request.headers.get('content-length'))>12000)return new Response('Request too large',{status:413,headers:h});
   const body=await request.text();if(body.length>12000)return new Response('Request too large',{status:413,headers:h});
   const form=new URLSearchParams(body);
   if(url.pathname.endsWith('/preferences')){
    if(!saved)throw Error('Complete the questionnaire first.');
    const selected=[...new Set(form.getAll('selected'))];
    if(selected.length<1||selected.length>3||selected.some(id=>!NICHES.some(n=>n.id===id)))throw Error('Choose between one and three niches.');
    const current=await getJobPreferences(env,state.accessToken,state.user.id);
    const roles=[...new Set(selected.map(id=>NICHES.find(n=>n.id===id).role))];
    if(current){
     const {response,data}=await authFetch(env,'/rest/v1/job_preferences?user_id=eq.'+encodeURIComponent(state.user.id),{method:'PATCH',headers:{Authorization:'Bearer '+state.accessToken,Prefer:'return=representation'},body:JSON.stringify({target_roles:roles})});
     if(!response.ok||!Array.isArray(data)||data.length!==1)throw Error('preferences');
    }else await saveJobPreferences(env,state.accessToken,{user_id:state.user.id,target_roles:roles,email_strong_matches:false,daily_digest:false});
    try{await save({...saved,results:undefined,selected,updatedAt:new Date().toISOString()});}catch{return page(nichePage({saved,results:saved.results,error:'Matching roles were updated, but your niche choices could not be saved. Please retry.'}),502);}
    h.set('location',endpoint+'?updated=1');
   }else{
    let answers;try{answers=validateAnswers(JSON.parse(form.get('answers')||'null'));}catch{throw Error('Please review your answers and complete all 14 questions.');}
    const results=rankNiches(answers);
    await save({version:MODEL_VERSION,answers,selected:results.map(n=>n.id),updatedAt:new Date().toISOString()});
    if(request.headers.get('dnt')!=='1'&&request.headers.get('sec-gpc')!=='1')await recordCompletion(env,'niche_finder',form.get('completion_id'));
    h.set('location',endpoint+'?saved=1');
   }
   return new Response(null,{status:303,headers:h});
  }
  const editing=url.searchParams.has('edit')||url.searchParams.has('retake');const results=saved?.results||[];const jobs={},jobErrors=[];
  if(saved&&!editing)await Promise.all(results.map(async n=>{try{jobs[n.id]=await nicheJobs(env,n);}catch{jobErrors.push(n.id);}}));
  return page(nichePage({saved:url.searchParams.has('retake')?null:saved,results,jobs,jobErrors,editing,notice:url.searchParams.has('updated')?'Niche choices saved and matching roles updated.':url.searchParams.has('saved')?'Your discovery results are saved. Your matching preferences have not changed.':''}));
 }catch(error){const allowed=['Choose between one and three niches.','Complete the questionnaire first.','Please review your answers and complete all 14 questions.'];return page(nichePage({saved,results:saved?.results||[],error:allowed.includes(error.message)?error.message:'We could not save your changes. Your previous results are still available. Please try again.'}),allowed.includes(error.message)?400:502);}
}
