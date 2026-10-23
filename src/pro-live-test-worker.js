// Limited paid evaluation only. NEVER use this entry for production.
import worker from './worker.js';
import {sessionForRequest} from './auth.js';
import {proAiEndpoint} from './pro-ai.js';
export {ProAiBudget} from './pro-ai-budget.js';
export {ActiveVisitors} from './active-visitors.js';
export {ResumeBudget} from './resume-studio.js';
export default {async fetch(request,env,ctx){
 if(env.SUPABASE_URL!=='https://megedmsfdwtjxjejrxaq.supabase.co'||env.PRO_AI_TOTAL_MICRO_USD!=='500000'||env.PRO_AI_DAILY_MICRO_USD!=='500000'||env.PRO_AI_MAX_CALL_MICRO_USD!=='100000')return new Response('Live-test guard unavailable',{status:503});
 const path=new URL(request.url).pathname;
 if(path==='/__qa/budget'||path.startsWith('/api/pro-tools/')){
  if(!env.PRO_TEST_TOKEN||request.headers.get('x-pro-test-token')!==env.PRO_TEST_TOKEN)return new Response('Test access required',{status:403});
  if(path==='/__qa/budget')return env.PRO_AI_BUDGET.get(env.PRO_AI_BUDGET.idFromName('pro-ai-v1')).fetch('https://budget/status',{method:'POST',body:'{}'});
  const state=await sessionForRequest(request,env);if(state.user?.id!==env.PRO_TEST_USER_ID)return new Response('Test account required',{status:403});
  return proAiEndpoint(request,env);
 }
 if(!['GET','HEAD'].includes(request.method)||path.startsWith('/auth/')||path.startsWith('/pro/checkout')||path.startsWith('/admin')||path.startsWith('/internal/')||path.startsWith('/webhooks/'))return new Response('Staging read-only',{status:403});
 const response=await worker.fetch(request,env,ctx),h=new Headers(response.headers);h.set('x-robots-tag','noindex, nofollow');return new Response(response.body,{status:response.status,headers:h});
}};
