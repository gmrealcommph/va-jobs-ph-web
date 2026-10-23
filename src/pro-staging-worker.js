// Separate Worker and staging Supabase project. This module is NEVER a production entry.
import worker from './worker.js';
import {proAiEndpoint} from './pro-ai.js';
import {ProAiBudget as Budget} from './pro-ai-budget.js';
export {ActiveVisitors} from './active-visitors.js';
export {ResumeBudget} from './resume-studio.js';
// These flags authorize synthetic quota reservations only. send() below never calls a provider.
const fixtureEnv=env=>({...env,PRO_AI_ENABLED:'true',PRO_AI_SPENDING_AUTHORIZED:'true',PRO_AI_MODEL:'gpt-5-mini',PRO_AI_KEY:'fixture-only-no-provider-access',PRO_AI_CACHE_KEY:'b'.repeat(64),PRO_AI_MAX_CALL_MICRO_USD:'100000',PRO_AI_DAILY_MICRO_USD:'1000000',PRO_AI_TOTAL_MICRO_USD:'10000000'});
export class ProAiBudget extends Budget{constructor(ctx,env){super(ctx,fixtureEnv(env));}}
export default{async fetch(request,env,ctx){
 if(!env.SUPABASE_URL?.includes('megedmsfdwtjxjejrxaq.supabase.co'))return new Response('Staging database required',{status:503});
 const path=new URL(request.url).pathname;
 if(path.startsWith('/pro/checkout')||path.startsWith('/webhooks/')||path.startsWith('/internal/')||path.startsWith('/admin')||path.startsWith('/account/delete')||(path==='/signup'&&request.method==='POST'))return new Response('This action is disabled in staging.',{status:403});
 let response;
 if(path.startsWith('/api/pro-tools/')){
  response=await proAiEndpoint(request,fixtureEnv(env),{send:async(url,init)=>{
   const data=JSON.parse(JSON.parse(init.body).input),source=data.resume,field=['experience','summary','projects','skills'].find(k=>source[k]?.trim()),quote=(source[field]||'').split('\n')[0].slice(0,400);
   const value=path.endsWith('cover-letter')?{letter:'Dear hiring team,\n\nI am interested in the '+data.selected_job.title+' role at '+data.selected_job.company+'. '+source.summary+'\n\n'+source.experience+'\n\nI would welcome the opportunity to discuss how my experience could support your team. Thank you for considering my application.'}:{suggestions:[{field,quote,rewrite:quote.replace(/^Answered customer questions/,'Responded to customer questions'),reason:'Example review: use a clear action and a specific responsibility. This staging response preserves your wording; no AI request was made.'}]};
   return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});
  }});
  if(response.ok){const value=await response.json();response=Response.json({...value,demo:true},{headers:response.headers});}
 }else response=await worker.fetch(request,env,ctx);
 const h=new Headers(response.headers);h.set('x-robots-tag','noindex, nofollow');return new Response(response.body,{status:response.status,headers:h});
}};
