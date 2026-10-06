import {test} from 'node:test';
import assert from 'node:assert/strict';
import {proCheckoutEndpoint, verifySignature, confirmedPayment} from '../src/pro-checkout.js';
import {proPage} from '../src/render.js';
const uid='11111111-1111-4111-8111-111111111111', id='22222222-2222-4222-8222-222222222222';
const env={PAYMONGO_MODE:'live',PAYMONGO_LIVE_CHECKOUT_ENABLED:'true',PAYMONGO_LIVE_SECRET_KEY:'sk_live_fixture',PAYMONGO_LIVE_WEBHOOK_SECRET:'live_fixture',SUPABASE_URL:'https://nwqmhqiymtqkdihjadrp.supabase.co',SITE_URL:'https://veeays.com',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_fixture',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'};
const record={id,user_id:uid,checkout_id:'cs_fixture',amount:49900,currency:'PHP',livemode:true,created_at:new Date(Date.now()-60000).toISOString()};
const session=()=>({id:'cs_fixture',type:'checkout_session',attributes:{livemode:true,reference_number:id,checkout_url:'https://checkout.paymongo.com/cs_fixture',line_items:[{amount:49900,currency:'PHP',quantity:1}],payments:[{id:'pay_fixture',attributes:{livemode:true,status:'paid',amount:49900,currency:'PHP',source:{type:'qrph'},paid_at:Math.floor(Date.now()/1000)}}]}});
async function signed(raw){const t=Math.floor(Date.now()/1000),bytes=new TextEncoder(); const key=await crypto.subtle.importKey('raw',bytes.encode(env.PAYMONGO_LIVE_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);const mac=await crypto.subtle.sign('HMAC',key,bytes.encode(`${t}.${raw}`));return `t=${t},te=,li=${Array.from(new Uint8Array(mac),x=>x.toString(16).padStart(2,'0')).join('')}`;}
async function mocked(fn,run){const old=globalThis.fetch;globalThis.fetch=fn;try{await run();}finally{globalThis.fetch=old;}}
const request=()=>new Request(env.SITE_URL+'/pro/checkout',{method:'POST',headers:{cookie:'veeays_access=fixture',origin:env.SITE_URL},body:'amount=1&user_id=attacker'});
test('Live checkout uses Live credentials, private live ledger and fixed price',async()=>{
 let inserted,provider=0;
 await mocked(async(url,init)=>{const u=new URL(url);if(u.pathname==='/auth/v1/user')return Response.json({id:uid});
 if(u.hostname==='api.paymongo.com'){provider++;assert.equal(atob(init.headers.Authorization.slice(6)),'sk_live_fixture:');const a=JSON.parse(init.body).data.attributes;assert.equal(a.line_items[0].amount,49900);assert.equal(a.line_items[0].name,'VeeAys Pro — 30 days');assert.equal(a.pass_on_fees,false);assert.match(a.success_url,/^https:\/\/veeays.com\/pro\/return/);return Response.json({data:session()});}
 assert.match(u.pathname,/^\/rest\/v1\/pro_payments$/);if(init.method==='POST'){inserted=JSON.parse(init.body);assert.equal(inserted.user_id,uid);assert.equal(inserted.livemode,true);assert.equal(inserted.amount,49900);}return new Response(null,{status:204});},async()=>{assert.equal((await proCheckoutEndpoint(request(),env)).status,303);assert.equal(provider,1);});
});
test('Live activation flag, staging targets, test keys/allowlist and wrong JWT project fail closed',async()=>{
 await mocked(async url=>{assert.equal(new URL(url).pathname,'/auth/v1/user');return Response.json({id:uid});},async()=>{
 for(const override of [{PAYMONGO_LIVE_CHECKOUT_ENABLED:'false'},{SUPABASE_URL:'https://staging.supabase.co'},{SITE_URL:'https://staging.example'},{PAYMONGO_LIVE_SECRET_KEY:'sk_test_fixture'},{PAYMONGO_TEST_SECRET_KEY:'sk_test_fixture'},{PAYMONGO_TEST_USER_IDS:uid},{SUPABASE_SERVICE_ROLE_KEY:'eyJ.'+btoa(JSON.stringify({ref:'wrong',role:'service_role'}))+'.fixture'}]){assert.ok([403,503].includes((await proCheckoutEndpoint(request(),{...env,...override})).status));}
 });
});
test('Live signature is isolated and authoritative payment rejects wrong modes and amounts',async()=>{
 const raw='{"fixture":true}',header=await signed(raw);assert.equal(await verifySignature(raw,header,env.PAYMONGO_LIVE_WEBHOOK_SECRET,Date.now(),true),true);assert.equal(await verifySignature(raw,header,env.PAYMONGO_LIVE_WEBHOOK_SECRET),false);assert.equal(await verifySignature(raw+' ',header,env.PAYMONGO_LIVE_WEBHOOK_SECRET,Date.now(),true),false);
 assert.equal(confirmedPayment(session(),record,Date.now(),true).id,'pay_fixture');for(const mutate of [s=>s.attributes.livemode=false,s=>s.attributes.payments[0].attributes.livemode=false,s=>s.attributes.payments[0].attributes.amount=1,s=>s.attributes.reference_number=uid]){const s=session();mutate(s);assert.throws(()=>confirmedPayment(s,record,Date.now(),true));}
});
test('Live webhook uses Live acceptance RPC, remains active while new checkout disabled',async()=>{
 const raw=JSON.stringify({data:{id:'evt_fixture',type:'event',attributes:{type:'checkout_session.payment.paid',livemode:true,data:session()}}});let writes=0;
 await mocked(async(url,init)=>{const u=new URL(url);if(u.hostname==='api.paymongo.com')return Response.json({data:session()});if(u.pathname==='/rest/v1/pro_payments')return Response.json([record]);assert.equal(u.pathname,'/rest/v1/rpc/accept_pro_payment');assert.equal(JSON.parse(init.body).p_livemode,true);writes++;return Response.json({duplicate:false});},async()=>{const response=await proCheckoutEndpoint(new Request(env.SITE_URL+'/webhooks/paymongo',{method:'POST',headers:{'paymongo-signature':await signed(raw)},body:raw}),{...env,PAYMONGO_LIVE_CHECKOUT_ENABLED:'false'});assert.equal(response.status,200);assert.equal(writes,1);});
});
test('Live purchase copy states real price and removes test/coming-soon claims',()=>{const html=proPage({user:{id:uid},liveCheckout:true});assert.match(html,/action="\/pro\/checkout"/);assert.match(html,/₱499/);assert.ok(!/TEST MODE|No real money|coming soon/.test(html));});

test('signed Live webhook for a deleted account is acknowledged only after authoritative payment validation',async()=>{
 const raw=JSON.stringify({data:{id:'evt_fixture',type:'event',attributes:{type:'checkout_session.payment.paid',livemode:true,data:session()}}});let writes=0;
 await mocked(async(url,init)=>{const u=new URL(url);if(u.hostname==='api.paymongo.com')return Response.json({data:session()});if(u.pathname==='/rest/v1/pro_payments')return Response.json([{...record,user_id:null}]);assert.equal(u.pathname,'/rest/v1/rpc/accept_pro_payment');assert.equal(JSON.parse(init.body).p_livemode,true);writes++;return Response.json({duplicate:false,expires_at:null,outcome:'account_deleted'});},async()=>{
 const response=await proCheckoutEndpoint(new Request(env.SITE_URL+'/webhooks/paymongo',{method:'POST',headers:{'paymongo-signature':await signed(raw)},body:raw}),env);
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{received:true,outcome:{duplicate:false,expires_at:null,outcome:'account_deleted'}});assert.equal(writes,1);
 });
});

test('deleted-account receipt still rejects an unpaid authoritative checkout without invoking acceptance',async()=>{
 const raw=JSON.stringify({data:{id:'evt_fixture',type:'event',attributes:{type:'checkout_session.payment.paid',livemode:true,data:session()}}});
 await mocked(async(url)=>{const u=new URL(url);if(u.hostname==='api.paymongo.com'){const s=session();s.attributes.payments[0].attributes.status='pending';return Response.json({data:s});}if(u.pathname==='/rest/v1/pro_payments')return Response.json([{...record,user_id:null}]);throw new Error('Acceptance must not be called');},async()=>{
 const response=await proCheckoutEndpoint(new Request(env.SITE_URL+'/webhooks/paymongo',{method:'POST',headers:{'paymongo-signature':await signed(raw)},body:raw}),env);
 assert.equal(response.status,422);
 });
});

test('receipt return uses authenticated ownership filter and cannot expose a deleted-account receipt',async()=>{
 await mocked(async(url,init)=>{const u=new URL(url);if(u.pathname==='/auth/v1/user')return Response.json({id:uid});assert.equal(u.pathname,'/rest/v1/pro_payments');assert.equal(u.searchParams.get('user_id'),'eq.'+uid);assert.ok(!init.method || init.method==='GET');return Response.json([]);},async()=>{
 const response=await proCheckoutEndpoint(new Request(env.SITE_URL+'/pro/return?payment='+id,{headers:{cookie:'veeays_access=fixture'}}),env);
 assert.equal(response.status,404);
 });
});
