import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proCheckoutEndpoint, confirmedPayment, verifySignature } from '../src/pro-checkout.js';
import { handle } from '../src/worker.js';
import { proPage } from '../src/render.js';

const uid = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const env = { PAYMONGO_MODE: 'test', PAYMONGO_TEST_SECRET_KEY: 'sk_test_fixture', PAYMONGO_TEST_WEBHOOK_SECRET: 'webhook_fixture',
  PAYMONGO_TEST_USER_IDS: uid, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_fixture', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
  SUPABASE_URL: 'https://db.example.com', SITE_URL: 'https://veeays.example.com' };
const record = { id, user_id: uid, checkout_id: 'cs_fixture', amount: 49900, currency: 'PHP', status: 'pending', created_at: new Date(Date.now()-60000).toISOString() };
function session() { return { id: 'cs_fixture', type: 'checkout_session', attributes: {
  livemode: false, reference_number: id, checkout_url: 'https://checkout.paymongo.com/cs_fixture',
  line_items: [{ amount: 49900, currency: 'PHP', quantity: 1 }],
  payments: [{ id: 'pay_fixture', attributes: { livemode: false, status: 'paid', amount: 49900, currency: 'PHP',
    source: { type: 'qrph' }, paid_at: Math.floor(Date.now()/1000) } }] } }; }
async function signature(raw, t = Math.floor(Date.now()/1000), secret = env.PAYMONGO_TEST_WEBHOOK_SECRET) {
  const bytes = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', bytes.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, bytes.encode(`${t}.${raw}`));
  return `t=${t},te=${Array.from(new Uint8Array(mac), x => x.toString(16).padStart(2,'0')).join('')},li=`;
}
async function withFetch(fn, run) { const old = globalThis.fetch; globalThis.fetch = fn; try { await run(); } finally { globalThis.fetch = old; } }
const request = (path, init = {}) => new Request(env.SITE_URL+path, { headers: { cookie: 'veeays_access=fixture', origin: env.SITE_URL }, ...init });
test('worker checkout route requires authenticated user and rejects unsupported methods', async () => {
  await withFetch(async () => { throw new Error('No anonymous network calls expected'); }, async () => {
    assert.equal((await handle(new Request(env.SITE_URL+'/pro/checkout', { method: 'POST' }), env)).status, 401);
  });
});
test('unique server-created reference and authenticated ownership; ignores browser fields', async () => {
  const calls=[], ids=[];
  await withFetch(async (url, init) => {
    const u=new URL(url); const body=init?.body ? JSON.parse(init.body) : null; calls.push({u,init,body});
    if(u.pathname==='/auth/v1/user') return Response.json({id:uid});
    if(u.hostname==='api.paymongo.com') {
      assert.equal(u.pathname,'/v2/checkout_sessions'); assert.match(init.headers.Authorization,/^Basic /);
      assert.equal(body.data.attributes.line_items[0].amount,49900);
      assert.equal(body.data.attributes.line_items[0].currency,'PHP');
      assert.deepEqual(body.data.attributes.payment_method_types,['qrph']);
      assert.equal(body.data.attributes.reference_number,ids.at(-1));
      assert.equal(body.data.attributes.success_url,`${env.SITE_URL}/pro/return?payment=${ids.at(-1)}`);
      const s=session(); s.id='cs_'+ids.length; return Response.json({data:s});
    }
    if(init.method==='POST') { assert.equal(body.user_id,uid); assert.equal(body.amount,49900); ids.push(body.id); }
    return new Response(null,{status:204});
  }, async () => {
    for(let i=0;i<2;i++) { const res=await proCheckoutEndpoint(request('/pro/checkout',{method:'POST',body:'user_id=attacker&amount=1&plan=pro'}),env);
      assert.equal(res.status,303); assert.match(res.headers.get('location'),/^https:\/\/checkout.paymongo.com\//); assert.ok(!res.headers.get('location').includes('sk_test')); }
    assert.notEqual(ids[0],ids[1]);
  });
});
test('CSRF, allowlist, disabled mode and live key fail before provider calls', async () => {
  await withFetch(async url => { assert.equal(new URL(url).pathname,'/auth/v1/user'); return Response.json({id:uid}); },async()=>{
    assert.equal((await proCheckoutEndpoint(request('/pro/checkout',{method:'POST',headers:{cookie:'veeays_access=fixture',origin:'https://evil.example'}}),env)).status,403);
    assert.equal((await proCheckoutEndpoint(request('/pro/checkout',{method:'POST',headers:{cookie:'veeays_access=fixture'}}),env)).status,403);
    assert.equal((await proCheckoutEndpoint(request('/pro/checkout',{method:'POST'}),{...env,PAYMONGO_TEST_USER_IDS:''})).status,403);
    assert.equal((await proCheckoutEndpoint(request('/pro/checkout',{method:'POST'}),{...env,PAYMONGO_MODE:'live'})).status,403);
    assert.equal((await proCheckoutEndpoint(request('/pro/checkout',{method:'POST'}),{...env,PAYMONGO_TEST_SECRET_KEY:'sk_live_fixture'})).status,503);
    assert.equal((await proCheckoutEndpoint(request('/pro/checkout'),env)).status,405);
  });
});
test('signature verifies exact raw payload and rejects tampering, live and stale signatures',async()=>{
  const raw='{"a":1}', sig=await signature(raw);
  assert.equal(await verifySignature(raw,sig,env.PAYMONGO_TEST_WEBHOOK_SECRET),true);
  for(const [body,header] of [[raw+' ',sig],[raw,sig.replace('te=','li=')],[raw,await signature(raw,1)],[raw,sig+',t=2']])
    assert.equal(await verifySignature(body,header,env.PAYMONGO_TEST_WEBHOOK_SECRET),false);
});
test('authoritative payment rejects wrong ownership, amount, currency, state, mode and timestamp',()=>{
  assert.equal(confirmedPayment(session(),record).id,'pay_fixture');
  const changes=[s=>s.id='cs_other',s=>s.attributes.reference_number=crypto.randomUUID(),s=>s.attributes.livemode=true,
    s=>s.attributes.line_items[0].amount=1,s=>s.attributes.line_items[0].currency='USD',s=>s.attributes.line_items[0].quantity=2,
    s=>s.attributes.payments[0].attributes.amount=1,s=>s.attributes.payments[0].attributes.currency='USD',
    s=>s.attributes.payments[0].attributes.status='pending',s=>s.attributes.payments[0].attributes.livemode=true,
    s=>s.attributes.payments[0].attributes.paid_at=null,s=>s.attributes.payments[0].attributes.paid_at=1,
    s=>s.attributes.payments[0].attributes.source.type='card',s=>s.attributes.payments.push(s.attributes.payments[0]),
    s=>s.attributes.payments[0].attributes.refunds=[{}]];
  for(const change of changes) {const s=session();change(s);assert.throws(()=>confirmedPayment(s,record));}
});
test('signed webhook retrieves merchant checkout and invokes atomic acceptance for both envelopes',async()=>{
  for(const classic of [true,false]) {
    const event={type:'checkout_session.payment.paid',livemode:false,data:session()};
    const raw=JSON.stringify({data:classic ? {id:'evt_fixture',type:'event',attributes:event} : event});
    let writes=0,reads=0;
    await withFetch(async(url,init)=>{
      const u=new URL(url);
      if(u.pathname==='/rest/v1/pro_test_payments')return Response.json([record]);
      if(u.hostname==='api.paymongo.com'){reads++;assert.equal(u.pathname,'/v1/checkout_sessions/cs_fixture');return Response.json({data:session()});}
      assert.equal(u.pathname,'/rest/v1/rpc/accept_pro_test_payment');writes++;
      const body=JSON.parse(init.body);assert.equal(body.p_id,id);assert.equal(body.p_amount,49900);assert.equal(body.p_livemode,false);
      return Response.json({duplicate:false,outcome:'granted'});
    },async()=>{const res=await proCheckoutEndpoint(new Request(env.SITE_URL+'/webhooks/paymongo',{method:'POST',headers:{'paymongo-signature':await signature(raw)},body:raw}),env);
      assert.equal(res.status,200);assert.equal(writes,1);assert.equal(reads,1);});
  }
});
test('signed synthetic event cannot activate when provider reports unpaid',async()=>{
  const raw=JSON.stringify({data:{type:'checkout_session.payment.paid',livemode:false,data:session()}});
  await withFetch(async url=>{
    if(new URL(url).hostname!=='api.paymongo.com')return Response.json([record]);
    const s=session();s.attributes.payments=[];return Response.json({data:s});
  },async()=>{assert.equal((await proCheckoutEndpoint(new Request(env.SITE_URL+'/webhooks/paymongo',{method:'POST',headers:{'paymongo-signature':await signature(raw)},body:raw}),env)).status,422);});
});
test('webhook rejects forged/live/unknown-checkout events and retries transient provider failure without a write',async()=>{
  const send=async(event,header)=>{
    const raw=JSON.stringify({data:event});
    return proCheckoutEndpoint(new Request(env.SITE_URL+'/webhooks/paymongo',{method:'POST',headers:{'paymongo-signature':header ?? await signature(raw)},body:raw}),env);
  };
  const event={type:'checkout_session.payment.paid',livemode:false,data:session()};
  await withFetch(async()=>{throw new Error('Rejected event must not contact storage/provider');},async()=>{
    assert.equal((await send(event,'t=1,te=bad,li=')).status,400);
    assert.equal((await send({...event,livemode:true})).status,422);
    assert.equal((await send({...event,data:{...session(),attributes:{reference_number:'invalid'}}})).status,422);
  });
  await withFetch(async url=>{
    if(new URL(url).hostname==='api.paymongo.com')return new Response(null,{status:503});
    assert.equal(new URL(url).pathname,'/rest/v1/pro_test_payments');return Response.json([record]);
  },async()=>{assert.equal((await send(event)).status,503);});
  await withFetch(async url=>{assert.equal(new URL(url).pathname,'/rest/v1/pro_test_payments');return Response.json([]);},async()=>{
    assert.equal((await send(event)).status,422);
  });
});
test('return page never writes or contacts provider; ownership and confirmed/pending states',async()=>{
  for(const status of ['pending','confirmed']) await withFetch(async(url,init)=>{
    assert.equal(init.method === undefined || init.method === 'GET',true,'return must only read');
    const u=new URL(url);assert.notEqual(u.hostname,'api.paymongo.com');
    if(u.pathname==='/auth/v1/user')return Response.json({id:uid});
    assert.equal(u.searchParams.get('user_id'),'eq.'+uid);
    return Response.json([{...record,status,entitlement_expires_at:'2026-11-05T00:00:00Z',entitlement_outcome:'granted'}]);
  },async()=>{const res=await handle(request(`/pro/return?payment=${id}&plan=pro&success=true`),env);assert.equal(res.status,200);
    assert.match(await res.text(),status==='confirmed'?/Test payment confirmed/:/Returning here does not activate Pro/);assert.equal(res.headers.get('cache-control'),'no-store');});
  await withFetch(async url=>Response.json(new URL(url).pathname==='/auth/v1/user'?{id:uid}:[]),async()=>{
    assert.equal((await proCheckoutEndpoint(request(`/pro/return?payment=${id}`),env)).status,404);
  });
});
test('Pro keeps established classes and only exposes test form to permitted account',()=>{
  assert.match(proPage({user:{id:uid},testCheckout:true}),/action="\/pro\/checkout"/);
  assert.match(proPage({testCheckout:true}),/pro-comparison-board/);
  assert.doesNotMatch(proPage({user:{id:uid}}),/action="\/pro\/checkout"/);
});
test('Pro form redirect is allowed only for the test account; private response is not cached',async()=>{
  await withFetch(async url=>{
    const u=new URL(url);
    if(u.pathname==='/auth/v1/user')return Response.json({id:uid});
    if(u.pathname==='/rest/v1/profiles')return Response.json([{id:uid,plan:'free',plan_status:'inactive'}]);
    return Response.json([],{headers:{'content-range':'0-0/0'}});
  },async()=>{
    const res=await handle(request('/pro'),env);
    assert.equal(res.status,200);assert.match(res.headers.get('content-security-policy'),/form-action 'self' https:\/\/checkout.paymongo.com/);
    assert.equal(res.headers.get('cache-control'),'no-store');assert.match(await res.text(),/action="\/pro\/checkout"/);
  });
});
