// Dedicated Durable Object: hashed member IDs, quotas and encrypted 24h results.
// Reservations charge the full worst-case bound even if a request fails.
const DAY=86400000;
export const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
export function spendingConfig(env){
 const cost=Number(env.PRO_AI_MAX_CALL_MICRO_USD),daily=Number(env.PRO_AI_DAILY_MICRO_USD),total=Number(env.PRO_AI_TOTAL_MICRO_USD);
 return env.PRO_AI_SPENDING_AUTHORIZED==='true'&&env.PRO_AI_ENABLED==='true'&&[cost,daily,total].every(Number.isSafeInteger)&&cost>=100000&&daily>=cost&&total>=daily&&total<=10000000&&env.PRO_AI_MODEL==='gpt-5-mini'&&/^[a-f0-9]{64}$/i.test(env.PRO_AI_CACHE_KEY||'')?{cost,daily,total}:null;
}
async function cipherKey(env){return crypto.subtle.importKey('raw',Uint8Array.from(env.PRO_AI_CACHE_KEY.match(/../g),n=>parseInt(n,16)),'AES-GCM',false,['encrypt','decrypt']);}
async function seal(env,value){const iv=crypto.getRandomValues(new Uint8Array(12)),bytes=new TextEncoder().encode(JSON.stringify(value));return {iv:[...iv],data:[...new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await cipherKey(env),bytes))]};}
async function open(env,value){return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(value.iv)},await cipherKey(env),new Uint8Array(value.data))));}
export class ProAiBudget{
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async fetch(request){
  let b;try{b=await request.json();}catch{return new Response('',{status:400});}
  if(new URL(request.url).pathname==='/purge'){
   if(!/^[a-f0-9]{64}$/.test(b.uid||''))return new Response('',{status:400});
   await this.ctx.storage.transaction(async tx=>{await tx.put('deleted:'+b.uid,true);for(const prefix of ['cache:'+b.uid+':','lease:'])for(const[key,value]of await tx.list({prefix})){if(prefix.startsWith('cache:')||value.uid===b.uid){await tx.delete(key);if(value.hash)await tx.delete('pending:'+value.hash);}}await tx.delete('user:'+b.uid);});return Response.json({purged:true});
  }
  const cfg=spendingConfig(this.env);if(!cfg)return Response.json({error:'Spending authorization unavailable'},{status:503});
  if(new URL(request.url).pathname==='/status')return Response.json({global:await this.ctx.storage.get('global')||{total:0,daily:0},limits:cfg,receipts:[...await this.ctx.storage.list({prefix:'receipt:'})].map(([,v])=>v)});
  if(!/^[a-f0-9]{64}$/.test(b.uid||'')||!/^[a-f0-9]{64}$/.test(b.hash||''))return new Response('',{status:400});
  const now=Date.now(),path=new URL(request.url).pathname,key='cache:'+b.uid+':'+b.hash;
  if(path==='/settle'){
   const usage=b.usage;
   if(!usage||!['input_tokens','output_tokens','cached_tokens'].every(k=>Number.isSafeInteger(usage[k])&&usage[k]>=0)||usage.cached_tokens>usage.input_tokens||usage.input_tokens>100000||usage.output_tokens>1800||typeof b.response_id!=='string'||b.response_id.length>160)return new Response('',{status:400});
   const saved=await this.ctx.storage.transaction(async tx=>{const lease=await tx.get('lease:'+b.reservation);if(!lease||lease.uid!==b.uid||lease.hash!==b.hash||lease.until<now)return false;await tx.put('receipt:'+b.reservation,{at:now,response_id:b.response_id,request_id:String(b.request_id||'').slice(0,160),status:String(b.status||'unknown').slice(0,40),model:String(b.model||'').slice(0,100),usage});return true;});return Response.json({saved},{status:saved?200:409});
  }
  if(path==='/result'){
   if(!/^[a-f0-9-]{36}$/.test(b.reservation||'')||(!b.value||JSON.stringify(b.value).length>18000))return new Response('',{status:400});
   const sealed=await seal(this.env,b.value);
   const saved=await this.ctx.storage.transaction(async tx=>{const lease=await tx.get('lease:'+b.reservation);if(!lease||lease.uid!==b.uid||lease.hash!==b.hash||lease.until<now||await tx.get('deleted:'+b.uid))return false;await tx.put(key,{until:now+DAY,...sealed});await tx.delete('lease:'+b.reservation);return true;});return Response.json({saved},{status:saved?200:409});
  }
  if(path!=='/reserve')return new Response('',{status:404});
  const cached=await this.ctx.storage.get(key);if(cached?.until>now){try{return Response.json({cached:true,value:await open(this.env,cached)});}catch{return new Response('',{status:503});}}
  const outcome=await this.ctx.storage.transaction(async tx=>{
   if(await tx.get('deleted:'+b.uid))return {status:403};
   const userKey='user:'+b.uid;let user=await tx.get(userKey)||{start:now,count:0,last:0,day:0,daily:0};
   if(now-user.start>=30*DAY)user={start:now,count:0,last:0,day:0,daily:0};
   const day=Math.floor(now/DAY);if(user.day!==day){user.day=day;user.daily=0;}
   if(user.count>=10||user.daily>=3||now-user.last<60000)return {status:429};
   let global=await tx.get('global')||{total:0,day,daily:0};if(global.day!==day){global.day=day;global.daily=0;}
   if(global.total+cfg.cost>cfg.total||global.daily+cfg.cost>cfg.daily)return {status:503};
   const pending=await tx.get('pending:'+b.hash);if(pending>now)return {status:409};
   const reservation=crypto.randomUUID();user.count++;user.daily++;user.last=now;global.total+=cfg.cost;global.daily+=cfg.cost;
   await tx.put(userKey,user);await tx.put('global',global);await tx.put('pending:'+b.hash,now+60000);await tx.put('lease:'+reservation,{uid:b.uid,hash:b.hash,until:now+60000});
   return {status:200,reservation,remaining:10-user.count};
  });
  const alarm=await this.ctx.storage.getAlarm();if(alarm===null||alarm>now+DAY)await this.ctx.storage.setAlarm(now+DAY);
  return Response.json(outcome,{status:outcome.status});
 }
 async alarm(){const now=Date.now();for(const prefix of ['cache:','lease:','pending:','user:']){const rows=await this.ctx.storage.list({prefix});for(const [key,value]of rows){const until=prefix==='user:'?value.last+30*DAY:prefix==='pending:'?value:value.until;if(until<=now)await this.ctx.storage.delete(key);}}await this.ctx.storage.setAlarm(now+DAY);}
}

export async function purgeProAiCache(env,userId){if(!env.PRO_AI_BUDGET)return;const uid=await digest(userId),stub=env.PRO_AI_BUDGET.get(env.PRO_AI_BUDGET.idFromName('pro-ai-v1'));const r=await stub.fetch('https://budget/purge',{method:'POST',body:JSON.stringify({uid})});if(!r.ok)throw Error('AI cache deletion unconfirmed');}
