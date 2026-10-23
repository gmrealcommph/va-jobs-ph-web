// Limited paid evaluation only. NEVER use this entry for production.
import worker from './worker.js';
import {sessionForRequest} from './auth.js';
import {proAiEndpoint} from './pro-ai.js';
import {ProAiBudget as Budget,digest} from './pro-ai-budget.js';
// One-time carry-forward of the completed local tests; cannot reduce counters.
export class ProAiBudget extends Budget{
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(path!=='/carry-forward'&&path!=='/paused-status')return super.fetch(request);
  if(this.env.PRO_AI_ENABLED!=='false'||this.env.PRO_AI_SPENDING_AUTHORIZED!=='false')return new Response('',{status:409});
  const key='user:'+await digest(this.env.PRO_TEST_USER_ID);
  if(path==='/paused-status')return Response.json({global:await this.ctx.storage.get('global')||null,user:await this.ctx.storage.get(key)||null,carried:!!await this.ctx.storage.get('local-tests-carried-v1')});
  let b;try{b=await request.json();}catch{return new Response('',{status:400});}
  if(b?.global?.total!==200000||b.global.daily!==200000||b?.user?.count!==2||b.user.daily!==2||![b.global.day,b.user.day,b.user.start,b.user.last].every(Number.isSafeInteger)||b.user.start>b.user.last||b.user.last>Date.now())return new Response('',{status:400});
  const result=await this.ctx.storage.transaction(async tx=>{
   if(await tx.get('local-tests-carried-v1'))return 200;
   if((await tx.get('global'))?.total||await tx.get(key))return 409;
   await tx.put('global',b.global);await tx.put(key,b.user);await tx.put('local-tests-carried-v1',true);return 200;
  });return Response.json({carried:result===200},{status:result});
 }
}
export {ActiveVisitors} from './active-visitors.js';
export {ResumeBudget} from './resume-studio.js';
export default {async fetch(request,env,ctx){
 if(env.SUPABASE_URL!=='https://megedmsfdwtjxjejrxaq.supabase.co'||env.PRO_AI_TOTAL_MICRO_USD!=='500000'||env.PRO_AI_DAILY_MICRO_USD!=='500000'||env.PRO_AI_MAX_CALL_MICRO_USD!=='100000')return new Response('Live-test guard unavailable',{status:503});
 const path=new URL(request.url).pathname;
 if(['/__qa/budget','/__qa/carry-forward','/__qa/paused-status'].includes(path)||path.startsWith('/api/pro-tools/')){
  if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)return new Response('Same-origin test request required',{status:403});
  const state=await sessionForRequest(request,env);if(state.user?.id!==env.PRO_TEST_USER_ID)return new Response('Test account required',{status:403});
  if(env.PRO_TEST_TOKEN&&request.headers.get('x-pro-test-token')!==env.PRO_TEST_TOKEN)return new Response('Test access required',{status:403});
  if(path==='/__qa/budget')return env.PRO_AI_BUDGET.get(env.PRO_AI_BUDGET.idFromName('pro-ai-v1')).fetch('https://budget/status',{method:'POST',body:'{}'});
  if(path==='/__qa/carry-forward'){if(request.method!=='POST')return new Response('',{status:405});return env.PRO_AI_BUDGET.get(env.PRO_AI_BUDGET.idFromName('pro-ai-v1')).fetch('https://budget/carry-forward',{method:'POST',body:await request.text()});}
  if(path==='/__qa/paused-status')return env.PRO_AI_BUDGET.get(env.PRO_AI_BUDGET.idFromName('pro-ai-v1')).fetch('https://budget/paused-status',{method:'POST',body:'{}'});
  return proAiEndpoint(request,env);
 }
 if(!['GET','HEAD'].includes(request.method)||path.startsWith('/auth/')||path.startsWith('/pro/checkout')||path.startsWith('/admin')||path.startsWith('/internal/')||path.startsWith('/webhooks/'))return new Response('Staging read-only',{status:403});
 const response=await worker.fetch(request,env,ctx),h=new Headers(response.headers);h.set('x-robots-tag','noindex, nofollow');return new Response(response.body,{status:response.status,headers:h});
}};
