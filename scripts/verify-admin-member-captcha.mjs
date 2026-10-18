import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {adminPage} from '../src/admin.js';
const require=createRequire(resolve(process.env.PLAYWRIGHT_PACKAGE_ROOT,'package.json'));
const {chromium}=require('playwright');
const id='10000000-0000-4000-8000-000000000002';let enabled=false,posts=0;
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/admin'){res.setHeader('content-type','text/html');res.end(adminPage());}
 else if(url.pathname==='/admin/api/members'){
  res.setHeader('content-type','application/json');
  if(req.method==='POST'){posts++;let text='';for await(const chunk of req)text+=chunk;assert.equal(JSON.parse(text).captchaToken,'synthetic-token');res.statusCode=403;res.end(JSON.stringify({error:'Synthetic provider rejection'}));}
  else res.end(JSON.stringify({members:[{id,email:'synthetic@example.invalid'}],actions_enabled:enabled,captcha:{required:true,site_key:'synthetic-public-key'},token:'20000000-0000-4000-8000-000000000001'}));
 }else if(url.pathname.startsWith('/admin/api/')){res.setHeader('content-type','application/json');res.end('{}');}
 else{const path=url.pathname.slice(1);if(path.includes('..'))throw Error();res.setHeader('content-type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'image/png');res.end(await readFile(new URL('../public/'+path,import.meta.url)));}
 }catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu']});
const results=[];
try{for(const actions of [false,true]){
 enabled=actions;const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let scripts=0;
 await page.route('https://challenges.cloudflare.com/**',route=>{scripts++;return route.fulfill({contentType:'text/javascript',body:`globalThis.turnstile={render:(host,options)=>{globalThis.challengeOptions=options;return 0;},reset:()=>{globalThis.resets=(globalThis.resets||0)+1;},remove:()=>{globalThis.removes=(globalThis.removes||0)+1;}};`});});
 await page.goto('http://127.0.0.1:'+server.address().port+'/admin');await page.getByRole('button',{name:'Review',exact:true}).click();
 const send=page.getByRole('button',{name:'Confirm action',exact:true});
 if(!actions){assert.equal(await send.count(),0);assert.equal(scripts,0);assert.equal(posts,0);}
 else{
  await page.waitForFunction(()=>!!globalThis.challengeOptions);assert.equal(await send.isDisabled(),true);
  await page.evaluate(()=>challengeOptions.callback('synthetic-token'));assert.equal(await send.isEnabled(),true);
  await page.evaluate(()=>challengeOptions['expired-callback']());assert.equal(await send.isDisabled(),true);
  await page.evaluate(()=>challengeOptions.callback('synthetic-token'));
  await page.locator('dialog textarea').fill('Synthetic review only');await page.locator('dialog input[type=password]').fill('synthetic-password');await page.locator('dialog input:not([type=password])').fill('SUSPEND '+id);await send.click();
  await page.waitForFunction(()=>document.querySelector('dialog').textContent.includes('Synthetic provider rejection'));
  assert.equal(await page.locator('dialog input[type=password]').inputValue(),'');assert.equal(await send.isDisabled(),true);assert.equal(await page.evaluate(()=>resets),1);
  await page.keyboard.press('Escape');await page.waitForSelector('dialog',{state:'detached'});assert.equal(await page.evaluate(()=>removes),1);assert.equal(posts,1);
 }
 assert.deepEqual(errors,[]);results.push({actions_enabled:actions,turnstile_script_requests:scripts,posts,errors});await page.close();
}await writeFile(resolve(process.env.ADMIN_TEST_OUTPUT,'captcha-browser.json'),JSON.stringify({scope:'Synthetic widget and provider responses; no live CAPTCHA or real account',results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();server.close();}
