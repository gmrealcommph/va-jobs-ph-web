import {sessionForRequest,setSessionCookies,getMyProfile} from './auth.js';
import {config,categories} from './data.js';
import {layout,esc,categoryPath} from './render.js';

export const activePro = p => p?.plan==='pro' && p.plan_status==='active' && (!p.pro_expires_at || Date.parse(p.pro_expires_at)>Date.now());
export function searchLink(row) {
  const path=row.category ? categoryPath(row.category) : '/';
  const params=new URLSearchParams();
  if(row.keyword) params.set('q',row.keyword);
  if(row.category && row.sort==='oldest') params.set('sort','oldest');
  return path+(params.size?'?'+params:'');
}
export function searchForm(row={},names=[]) {
  return `<form method="post" class="saved-search-form"><input type="hidden" name="slot" value="${esc(row.slot)}"><label>Name<input name="name" maxlength="60" required value="${esc(row.name)}"></label><label>Keywords<input name="keyword" maxlength="120" value="${esc(row.keyword)}"></label><label>Category<select name="category"><option value="">All categories</option>${names.map(n=>`<option value="${esc(n)}" ${row.category===n?'selected':''}>${esc(n)}</option>`).join('')}</select></label><label>Order<select name="sort"><option value="newest">Newest first</option><option value="oldest" ${row.sort==='oldest'?'selected':''}>Oldest first (category only)</option></select></label><button name="action" value="save">Save preset ${esc(row.slot)}</button>${row.name?'<button name="action" value="delete" formnovalidate>Delete preset</button>':''}</form>`;
}
export async function savedSearchesEndpoint(request,env,{session=sessionForRequest,profile=getMyProfile,loadCategories=categories,send=fetch}={}) {
  const u=new URL(request.url),h=new Headers({'content-type':'text/html; charset=utf-8','cache-control':'private, no-store','x-robots-tag':'noindex','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; style-src 'self'; img-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});
  const reply=(body,status=200)=>new Response(body,{status,headers:h});
  if(!['GET','POST'].includes(request.method))return reply('Method not allowed',405);
  if(request.method==='POST' && request.headers.get('origin')!==u.origin)return reply('Forbidden',403);
  try {
    const state=await session(request,env);
    if(!state.user || !state.accessToken){h.set('location','/login?return=%2Fsaved-searches');return reply('',303);}
    if(state.refreshed)setSessionCookies(h,state.refreshed);
    const p=await profile(env,state.accessToken,state.user.id),pro=activePro(p);
    const page=body=>layout({title:'Saved searches',body:'<section class="wrap saved-searches"><h1>Saved searches</h1>'+body+'</section>',user:state.user,profile:p,noindex:true});
    const {key,url}=config(env),endpoint=new URL('/rest/v1/saved_job_searches',url);
    const rest=async(method,params,body)=>{
      const target=new URL(endpoint);Object.entries(params).forEach(([k,v])=>target.searchParams.set(k,v));
      const r=await send(target,{method,headers:{apikey:key,Authorization:'Bearer '+state.accessToken,'content-type':'application/json',Prefer:method==='POST'?'resolution=merge-duplicates,return=minimal':'return=minimal'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
      if(!r.ok)throw Error('search_storage_unavailable');
      return method==='GET'?r.json():null;
    };
    const names=(await loadCategories(env)).map(c=>typeof c==='string'?c:c.name);
    if(request.method==='POST') {
      if(request.headers.get('content-type')?.split(';')[0]!=='application/x-www-form-urlencoded')return reply('Unsupported form',415);
      const raw=await request.text();if(raw.length>4096)return reply('Form too large',413);
      const f=new URLSearchParams(raw),keys=['slot','name','keyword','category','sort','action'];
      if([...f.keys()].some(k=>!keys.includes(k)) || keys.some(k=>f.getAll(k).length>1) || !/^[1-5]$/.test(f.get('slot')||''))return reply('Invalid preset',400);
      const slot=Number(f.get('slot'));
      if(f.get('action')==='delete')await rest('DELETE',{user_id:'eq.'+state.user.id,slot:'eq.'+slot});
      else {
        if(!pro)return reply(page('<p>Active Pro access is required to save presets.</p><a href="/pro">Explore Pro</a>'),403);
        const name=(f.get('name')||'').trim(),keyword=(f.get('keyword')||'').trim(),category=f.get('category')||'',sort=f.get('sort');
        if(f.get('action')!=='save' || !name || name.length>60 || keyword.length>120 || (category&&!names.includes(category)) || !['newest','oldest'].includes(sort))return reply('Invalid preset',400);
        await rest('POST',{on_conflict:'user_id,slot'},{user_id:state.user.id,slot,name,keyword,category,sort:category?sort:'newest'});
      }
      h.set('location','/saved-searches?saved=1');return reply('',303);
    }
    const rows=await rest('GET',{select:'slot,name,keyword,category,sort',order:'slot.asc'});
    return reply(page(`<link rel="stylesheet" href="/saved-searches.css"><p>Keep up to five keyword and category presets with Pro. Each opens a fresh search of currently available jobs. Saving a search does not subscribe you to email.</p>${u.searchParams.get('saved')==='1'?'<p role="status">Preset changes saved.</p>':''}${!pro?'<p>Your presets are retained. <a href="/pro">Get Pro</a> to use or edit them.</p>':''}${Array.from({length:5},(_,i)=>{const row=rows.find(r=>r.slot===i+1)||{slot:i+1};return `<article><h2>Preset ${i+1}${row.name?': '+esc(row.name):''}</h2>${pro?(row.name?`<p><a class="button" href="${esc(searchLink(row))}">Run search</a></p>`:'')+searchForm(row,names):(row.name?`<form method="post"><input type="hidden" name="slot" value="${i+1}"><button name="action" value="delete">Delete preset</button></form>`:'')}</article>`;}).join('')}`));
  }catch{return reply('<h1>Saved searches need another try</h1><p>Your change could not be confirmed.</p><a href="/saved-searches">Reload saved searches</a>',503);}
}
