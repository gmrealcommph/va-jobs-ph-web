export const analyticsCsp=policy=>policy.replace(/script-src 'self'/,"script-src 'self' https://www.googletagmanager.com").replace(/connect-src 'self'/,"connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com");
export function registrationCookie(request,user){
 if(request.headers.get('sec-gpc')==='1'||request.headers.get('dnt')==='1'||!/(?:^|; )veeays_ga4_consent=yes(?:;|$)/.test(request.headers.get('cookie')||'')||!user?.identities?.length)return null;
 return 'veeays_signup='+crypto.randomUUID()+'; Path=/; Secure; SameSite=Lax; Max-Age=300';
}
export async function purchaseReceipt(record,live){
 if(!live||record?.livemode!==true||record.status!=='confirmed'||record.amount!==49900||record.currency!=='PHP')return '';
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('veeays-ga-purchase:'+record.id));
 const id=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
 return '<span hidden data-analytics-purchase="'+id+'"></span>';
}
