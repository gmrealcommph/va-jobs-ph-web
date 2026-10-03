import { sessionForRequest, getJobPreferences, setStrongMatchPreference, setSessionCookies } from './auth.js';
import { layout } from './render.js';

export async function emailPreferences(request, env) {
  const url = new URL(request.url);
  const headers = new Headers({'cache-control':'no-store','x-content-type-options':'nosniff',
    'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; style-src 'self'; img-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});
  if (!['GET','POST'].includes(request.method)) return new Response('Method not allowed',{status:405});
  // Require browser same-origin POST; cookies use SameSite=Lax as in the existing auth flow.
  if (request.method==='POST' && request.headers.get('origin')!==url.origin) return new Response('Forbidden',{status:403});
  const state=await sessionForRequest(request,env);
  if (!state.user || !state.accessToken) return Response.redirect(`${url.origin}/login?return=%2Femail-preferences`,303);
  if (state.refreshed) setSessionCookies(headers,state.refreshed);
  try {
    if (request.method==='POST') {
      const form=await request.formData();
      const value=form.get('email_strong_matches');
      if (!['true','false'].includes(value)) return new Response('Invalid preference',{status:400});
      await setStrongMatchPreference(env,state.accessToken,state.user.id,value==='true');
      headers.set('location','/email-preferences?saved=1');
      return new Response(null,{status:303,headers});
    }
    const prefs=await getJobPreferences(env,state.accessToken,state.user.id);
    const body=`<section class="wrap"><h1>Email preferences</h1>${url.searchParams.get('saved')==='1' ? '<p>Your email preference has been saved.</p>' : ''}${prefs ? `<form method="post" action="/email-preferences"><fieldset><legend>Strong Match Alerts</legend><p>Receive grouped alerts for strong matches while your Pro subscription is active.</p><label><input type="radio" name="email_strong_matches" value="true" ${prefs.email_strong_matches===true ? 'checked' : ''}> On</label><label><input type="radio" name="email_strong_matches" value="false" ${prefs.email_strong_matches!==true ? 'checked' : ''}> Off</label></fieldset><button type="submit">Save email preference</button></form>` : '<p>Complete your job preferences first.</p><a href="/onboarding">Set up job preferences</a>'}<p><a href="/matches">My Matches</a></p></section>`;
    return new Response(layout({title:'Email preferences',description:'Manage your VeeAys email alerts.',canonical:`${url.origin}/email-preferences`,body,noindex:true,user:state.user}),{headers});
  } catch {
    return new Response('We could not load or save your email preference. Please try again.',{status:503,headers});
  }
}
