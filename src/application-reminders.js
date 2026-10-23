import {sessionForRequest,getMyProfile,setSessionCookies} from './auth.js';
import {activePro} from './saved-searches.js';
import {config} from './data.js';
import {esc} from './render.js';
import {boundedText} from './resume-studio.js';
const manilaDay=()=>new Date(Date.now()+28800000).toISOString().slice(0,10);
export async function reminderRest(env,token,userId,method='GET',params={},body,send=fetch){
 const {key,url}=config(env),target=new URL('/rest/v1/job_application_reminders',url);target.searchParams.set('user_id','eq.'+userId);for(const[k,v]of Object.entries(params))target.searchParams.set(k,v);
 const r=await send(target,{method,headers:{apikey:key,Authorization:'Bearer '+token,'content-type':'application/json',Prefer:method==='POST'?'resolution=merge-duplicates,return=representation':'return=representation'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('reminder_storage');return r.status===204?[]:r.json();
}
export function reminderPanel(item,{rows=[],available=false,pro=false}={}){
 if(!available)return '<p class="reminder-note">Reminders are temporarily unavailable. Your application and notes are safe.</p>';
 const row=rows.find(r=>String(r.job_id)===String(item.job_id)),date=row?.remind_on||'',overdue=date&&date<manilaDay();
 return `<section class="reminder-editor" aria-label="Application reminder">${row?`<p class="reminder-badge${overdue?' overdue':''}">${overdue?'Overdue · ':date===manilaDay()?'Today · ':''}${esc(date)} · ${esc(row.label)}</p><a href="/application-reminders?job_id=${esc(item.job_id)}">Add to calendar (.ics)</a>`:''}${pro?`<form method="post" action="/application-reminders"><input type="hidden" name="job_id" value="${esc(item.job_id)}"><label>Remind me on (Manila date)<input name="remind_on" type="date" min="${manilaDay()}" max="2100-12-31" required value="${esc(date)}"></label><label>Next step<input name="label" maxlength="120" required value="${esc(row?.label||'Follow up on application')}"></label><button name="action" value="save">Save reminder</button>${row?'<button name="action" value="clear" formnovalidate>Clear reminder</button>':''}</form>`:row?`<form method="post" action="/application-reminders"><input type="hidden" name="job_id" value="${esc(item.job_id)}"><button name="action" value="clear">Clear reminder</button></form><p class="reminder-note">Your reminder is retained. Active Pro access is required to change it.</p>`:'<p class="reminder-note">Application reminders are included with <a href="/pro">VeeAys Pro</a>. Stages and notes stay free.</p>'}<p class="reminder-note">Shown in My Jobs. Calendar notifications depend on your calendar settings; no reminder email is sent.</p></section>`;
}
export function calendarReminder(row){
 const safe=v=>String(v).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//VeeAys//Application reminders//EN','BEGIN:VEVENT','UID:'+row.job_id+'-application@veeays.com','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z'),'DTSTART;VALUE=DATE:'+row.remind_on.replaceAll('-',''),'SUMMARY:'+safe(row.label),'DESCRIPTION:Review your application in VeeAys My Jobs.','END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
export async function remindersEndpoint(request,env,deps={}){
 const url=new URL(request.url),h=new Headers({'cache-control':'private, no-store','referrer-policy':'strict-origin-when-cross-origin','x-content-type-options':'nosniff'}),reply=(s,status)=>new Response(s,{status,headers:h});
 if(env.PRO_TRACKER_ENABLED!=='true')return reply('Not found',404);
 if(!['GET','POST'].includes(request.method))return reply('Method not allowed',405);
 if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return reply('Refresh the page and try again.',403);
 try{
  const state=await(deps.session||sessionForRequest)(request,env);if(!state.user||!state.accessToken){h.set('location','/login?return=%2Fmy-jobs');return reply('',303);}if(state.refreshed)setSessionCookies(h,state.refreshed);
  const rest=(method,params,body)=>(deps.rest||reminderRest)(env,state.accessToken,state.user.id,method,params,body);
  if(request.method==='GET'){
   const job_id=url.searchParams.get('job_id');if(!/^[1-9]\d{0,18}$/.test(job_id||''))return reply('Invalid application',400);
   const rows=await rest('GET',{job_id:'eq.'+job_id});if(!rows.length)return reply('Reminder not found',404);h.set('content-type','text/calendar; charset=utf-8');h.set('content-disposition','attachment; filename="veeays-reminder.ics"');return reply(calendarReminder(rows[0]),200);
  }
  if(request.headers.get('content-type')?.split(';')[0]!=='application/x-www-form-urlencoded')return reply('Unsupported form',415);
  const form=new URLSearchParams(await boundedText(request,2000)),job_id=form.get('job_id');if(!/^[1-9]\d{0,18}$/.test(job_id||'')||[...form.keys()].some(k=>!['job_id','action','remind_on','label'].includes(k))||[...new Set(form.keys())].some(k=>form.getAll(k).length>1))return reply('Invalid reminder',400);
  if(form.get('action')==='clear')await rest('DELETE',{job_id:'eq.'+job_id});
  else{
   if(!activePro(await(deps.profile||getMyProfile)(env,state.accessToken,state.user.id)))return reply('Active Pro access is required to save reminders.',403);
   const remind_on=form.get('remind_on')||'',label=(form.get('label')||'').trim();
   if(form.get('action')!=='save'||!/^\d{4}-\d{2}-\d{2}$/.test(remind_on)||!Number.isFinite(Date.parse(remind_on))||new Date(remind_on).toISOString().slice(0,10)!==remind_on||remind_on<manilaDay()||remind_on>'2100-12-31'||!label||label.length>120||/[\r\n\x00]/.test(label))return reply('Choose a valid date today or later and a next step up to 120 characters.',400);
   await rest('POST',{on_conflict:'user_id,job_id'},{user_id:state.user.id,job_id,remind_on,label});
  }
  h.set('location','/my-jobs?message=Reminder%20updated');return reply('',303);
 }catch{h.set('location','/my-jobs?error=Reminder%20change%20could%20not%20be%20confirmed');return reply('',303);}
}
