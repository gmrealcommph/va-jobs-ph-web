import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../src/worker.js';

test('public Pro allows same-origin fonts while retaining restrictive resource and form policies',async()=>{
  const response=await handle(new Request('https://veeays.example.com/pro'),{SITE_URL:'https://veeays.example.com'});
  assert.equal(response.status,200);
  const policy=response.headers.get('content-security-policy');
  assert.match(policy,/font-src 'self'(?:;|$)/);
  for(const directive of ["default-src 'none'","script-src 'self'","style-src 'self'","form-action 'self'","frame-ancestors 'none'"])assert.ok(policy.includes(directive),directive);
  assert.doesNotMatch(policy,/font-src[^;]*(?:https:|data:|\*)/);
});
