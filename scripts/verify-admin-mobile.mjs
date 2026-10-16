import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {adminPage} from '../src/admin.js';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_ROOT?resolve(process.env.PLAYWRIGHT_PACKAGE_ROOT,'package.json'):import.meta.url);
const {chromium}=require('playwright');
const root=new URL('../',import.meta.url),output=pathToFileURL(resolve(process.env.ADMIN_TEST_OUTPUT||'../admin-mobile-evidence')+'/');await mkdir(output,{recursive:true});
let baseline=false;
const id='10000000-0000-4000-8000-000000000002';
const analytics={generated_at:new Date().toISOString(),members:100,new_members:20,pro_access:3,paid_pro_members:2,live_jobs:400,new_jobs:30,new_live_jobs:20,revenue:[],daily:[],quick_period:{completed:40,errors:0},queue:[],quick_reads:[],errors:[],imports:[],payment_events:[],runtime:{quick_read_enabled:true},visitors:{available:false},extended:{available:false},actions:[],registrations:{available:false},confirmed_payments:{available:false}};
const member={id,email:'review@mailinator.com',created_at:new Date().toISOString(),full_name:'Synthetic test member',suspended:false,review_reason:'Known disposable domain (limited list)',confirmed_receipts:2};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');res.setHeader('cache-control','no-store');
 if(url.pathname==='/admin'){res.setHeader('content-type','text/html');res.end(adminPage());}
 else if(url.pathname==='/admin/api/analytics'){res.setHeader('content-type','application/json');res.end(JSON.stringify(analytics));}
 else if(url.pathname==='/admin/api/quick-reads'){res.setHeader('content-type','application/json');res.end(JSON.stringify({checked_at:new Date().toISOString(),counts:{queued:10,completed:42,processing:0,failed:1,total:53,stopped_other:0},running:[],runtime_enabled:true,gate:{enabled:true},automation:{enabled:true}}));}
 else if(url.pathname==='/admin/api/members'){res.setHeader('content-type','application/json');res.end(JSON.stringify({members:[member],audit:[],token:'20000000-0000-4000-8000-000000000001',actions_enabled:true}));}
 else {const path=url.pathname.slice(1);if(path.includes('..'))throw Error();const file=baseline&&path==='admin-theme.css'?execFileSync('git',['show',(process.env.ADMIN_BASE_REF||'codex/recovered-production-auth-081b6577')+':public/admin-theme.css'],{cwd:root}):await readFile(new URL('public/'+path,root));res.setHeader('content-type',path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':'image/png');res.end(file);}
 }catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:process.env.ADMIN_TEST_BROWSER||'chrome',headless:true,args:['--disable-gpu']});
const results=[];
try{for(const width of [390,700,1280]){const context=await browser.newContext({viewport:{width,height:844},isMobile:width<701,hasTouch:width<701});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const before of width===390?[true,false]:[false]){baseline=before;await page.goto(`http://127.0.0.1:${server.address().port}/admin`);await page.waitForSelector('#member-management button');await page.waitForFunction(()=>document.getElementById('processing-card')?.textContent.includes('Processed'));
  await page.evaluate(()=>window.scrollTo(0,0));
  const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:190,y:700}]});for(const y of [620,540,460,380,300,220])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:190,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(300);
  const touchY=await page.evaluate(()=>window.scrollY);const overflow=await page.evaluate(()=>({body:getComputedStyle(document.body).overflowY,root:getComputedStyle(document.documentElement).overflowY,width:document.documentElement.scrollWidth,viewport:innerWidth}));
  console.log(JSON.stringify({width,before,touchY,overflow}));assert.ok(overflow.width<=overflow.viewport,'No horizontal overflow');
  if(!before&&width<701)assert.ok(touchY>0,'Touch scroll moves the page');
  if(!before){for(const section of ['members','operations','payments','system-health']){await page.locator('#'+section).scrollIntoViewIfNeeded();assert.ok(await page.locator('#'+section).isVisible());}
   await page.locator('#member-management button').filter({hasText:'Review'}).click();await page.waitForSelector('dialog[open]');await page.locator('dialog textarea').fill('Reviewed synthetic account');await page.locator('dialog input[type=password]').fill('synthetic-password');await page.locator('dialog input:not([type=password])').fill('wrong confirmation');await page.locator('dialog button').filter({hasText:'Confirm action'}).click();await page.waitForFunction(()=>document.querySelector('dialog').textContent.includes('Confirmation does not match'));await page.locator('dialog input[type=password]').fill('');await page.locator('dialog').evaluate(d=>d.scrollTop=d.scrollHeight);assert.ok(await page.locator('dialog').evaluate(d=>d.scrollTop>0||d.scrollHeight<=d.clientHeight));await page.keyboard.press('Escape');await page.waitForSelector('dialog',{state:'detached'});await page.evaluate(()=>window.scrollTo(0,0));await page.mouse.move(Math.min(width-30,300),500);await page.mouse.wheel(0,600);await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>scrollY>0));await page.screenshot({path:new URL(`admin-${width}.png`,output).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:false});
  }
  if(!before){await page.locator('.email-allowance-tile').screenshot({path:new URL(`processing-card-${width}.png`,output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});}
  results.push({width,baseline:before,touchY,overflow,errors});await cdp.detach();
 }
 await context.close();}
 await writeFile(new URL('mobile-verification.json',output),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();server.close();}
