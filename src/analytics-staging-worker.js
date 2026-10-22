// Staging entry only: never bind this entry to the production Worker.
import worker from './worker.js';
import {activeVisitorCount} from './active-visitors.js';
export {ActiveVisitors} from './active-visitors.js';
export {ResumeBudget} from './resume-studio.js';
export default {
 async fetch(request,env,ctx){
  if(new URL(request.url).pathname==='/__qa/active-visitors'&&request.method==='GET')return Response.json(await activeVisitorCount(env),{headers:{'cache-control':'no-store','x-robots-tag':'noindex'}});
  if(!['GET','HEAD'].includes(request.method)&&new URL(request.url).pathname!=='/activity')return Response.json({error:'Staging is read-only; registration, payments and data changes are disabled.'},{status:403,headers:{'cache-control':'no-store'}});
  const response=await worker.fetch(request,env,ctx);const headers=new Headers(response.headers);headers.set('x-robots-tag','noindex, nofollow');return new Response(response.body,{status:response.status,headers});
 }
};
