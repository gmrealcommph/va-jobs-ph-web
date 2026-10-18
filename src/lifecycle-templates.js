// Reviewable templates only. Import into the existing email service; no sender or cron.
export const sequence = [
 {id:'welcome',day:0,kind:'existing',subject:'Welcome VeeAy {{firstName}} — glad you’re here!',preview:'Your remote-work adventure starts with one small step.',title:'Welcome VeeAy {{firstName}}',tag:'YOUR NEXT CHAPTER',paragraphs:[
  'Salamat for joining VeeAys! Your next chapter has a home here. 🌱',
  'Start with a few roles that fit your skills, schedule and goals. No need to open 47 tabs before breakfast.',
  'See a Quick Read? Use it for a quick overview, then check the employer’s original listing before you apply.'
 ],tip:'One small win today: find one role you’d be excited to explore.',cta:'Explore the job board',path:'/jobs',closing:'Small steps count. We’re cheering you on!',note:'Reference concept only. Keep the existing welcome automation and intentional greeting; do not add a second welcome.'},
 {id:'verify-day-2',day:2,kind:'verification',subject:'One little click, VeeAy ✉️',preview:'Confirm your email to finish setting up your account.',title:'One little click. A fresh start.',tag:'LET’S FINISH SETTING UP',paragraphs:[
  'Your VeeAys account is waiting for its final high-five: email verification. ✋',
  'Find your original verification email and follow its confirmation link. If it’s playing hide-and-seek, check Spam or Promotions.',
  'Can’t find it, or has the link expired? Reply to this email and we’ll help you get back on track.'
 ],tip:'You don’t need to share your password or verification code with anyone to get help.',cta:'Open VeeAys',path:'/login',closing:'A little nudge from your VeeAys crew.'},
 {id:'getting-started',day:2,kind:'onboarding',subject:'Your first small win starts here 🌱',preview:'Pick your preferences. Explore a few roles. Keep it simple.',title:'Less tab chaos. More “this fits me.”',tag:'YOUR TWO-MINUTE START',paragraphs:[
  'Let’s make your job search feel a little less like a scavenger hunt.',
  'Choose the roles, schedules and work setup you prefer. Then give a few suitable listings a closer look.',
  'When a Quick Read is available, use it to scan the essentials. Always read the original listing before applying.'
 ],tip:'Today’s tiny mission: pick one role that fits your skills and read it all the way through.',cta:'Find my next opportunity',path:'/jobs',closing:'One good next step beats a hundred open tabs.',note:'Preserve the currently active digest sender and its eligibility. The newer weekly-Free/daily-Pro path is not activated by this sequence. Never invent matches or send a duplicate digest.'},
 {id:'verify-day-5',day:5,kind:'verification',subject:'Still room for you here, VeeAy 🌱',preview:'One final reminder to confirm your VeeAys email.',title:'Your next chapter can wait a little.',tag:'ONE LAST GENTLE NUDGE',paragraphs:[
  'Life gets busy. Inbox tabs multiply. We get it.',
  'If you still want to finish setting up VeeAys, open your original verification email and follow the confirmation link.',
  'If the link has expired or you need help finding it, reply to this email. This is our final scheduled verification reminder.'
 ],tip:'No rush, no guilt. You can come back when the time is right.',cta:'Open VeeAys',path:'/login',closing:'We’ll be here when you’re ready.'},
 {id:'profile-tip',day:5,kind:'tip',subject:'Give your next application a little sparkle ✨',preview:'One clear example is stronger than a list of buzzwords.',title:'Show the skill. Add the proof.',tag:'VEEAY’S LITTLE CAREER BOOST',paragraphs:[
  '“Organized and hardworking” is a start. A clear example gives an employer something to picture.',
  'Try this: “I organized a shared inbox using labels and reply templates so the team could find urgent requests faster.” Use your own real experience—even a school, volunteer or personal project counts as an example.',
  'Keep your profile and preferences up to date, then tailor your application to the role. Accuracy beats sparkle for sparkle’s sake.'
 ],tip:'Tiny mission: replace one vague claim with one honest example of what you did.',cta:'Review my profile and preferences',path:'/onboarding',closing:'You bring the skills. Let’s help them shine.'},
 {id:'pro-introduction',day:7,kind:'promotion',subject:'Meet Pro, your job-search sidekick 🌿',preview:'Explore VeeAys Pro and decide whether it fits your routine.',title:'A little backup for your next chapter.',tag:'MEET VEEAYS PRO',paragraphs:[
  'By now, you’ve had a chance to look around. Want to see what a little extra help could look like?',
  'VeeAys Pro brings tools such as personalized matches and eligible job email updates into your search. Check the Pro page for current features, pricing and terms.',
  'Have a look when you’re ready. Pro is optional, and a subscription never guarantees an interview or a job.'
 ],tip:'Choose tools that suit your routine and budget. A thoughtful application still does the heavy lifting.',cta:'Explore VeeAys Pro',path:'/pro',closing:'Your pace. Your next step. Your VeeAys crew.'},
 {id:'safer-search',day:10,kind:'tip',subject:'Good opportunities don’t need blind trust 🔎',preview:'A quick pause can help you spot a suspicious listing.',title:'Before you apply, do a little detective work.',tag:'SMART SEARCH, CALM MIND',paragraphs:[
  'A shiny job title is exciting. A quick check is your trusty sidekick.',
  'Check the company’s own website and the original listing. Be cautious about requests to pay upfront, buy equipment from a named seller, share passwords or send verification codes.',
  'If something feels off, pause before sharing personal information or moving money. A listing on a job board is still worth checking independently.'
 ],tip:'Tiny mission: verify the employer and application destination before your next application.',cta:'Browse with a sharper eye',path:'/jobs',closing:'A little curious. A little cautious. Very VeeAy.'},
 {id:'interview-tip',day:14,kind:'tip',subject:'Your next interview: bring a story 🎤',preview:'Prepare one clear example before the questions begin.',title:'Less “umm…” More “here’s an example.”',tag:'YOUR INTERVIEW WARM-UP',paragraphs:[
  'You don’t need a perfectly memorized speech. Start with one true story about solving a problem.',
  'Use four simple beats: What was happening? What needed doing? What did you do? What changed?',
  'Practise saying it out loud, then prepare one thoughtful question about the role. Honest, specific and human is a good combination.'
 ],tip:'Tiny mission: record a 60-second practice answer. Listen once and make one improvement.',cta:'Explore roles worth preparing for',path:'/jobs',closing:'Deep breath, VeeAy. You have a story to tell.'}
];

const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const first=v=>typeof v==='string' && /^[\p{L}\p{M}][\p{L}\p{M}’' -]{0,39}$/u.test(v.trim()) ? v.trim().split(/\s/)[0] : '';
export function renderEmail(id,options={}) {
 const email=sequence.find(e=>e.id===id); if(!email)throw Error('Unknown template');
 const name=first(options.firstName); const personalize=s=>s.replaceAll('{{firstName}}',name).replace(/VeeAy\s+—/,'VeeAy —').trim();
 const subject=personalize(email.subject),title=personalize(email.title),greeting=name?`Hi ${name},`:'Hi VeeAy,';
 const headlineParts={
  welcome:['Welcome','VeeAy '+name],
  'verify-day-2':['One little click.','A fresh start.'],
  'getting-started':['Less tab chaos.','More “this fits me.”'],
  'verify-day-5':['Your next chapter','can wait a little.'],
  'profile-tip':['Show the skill.','Add the proof.'],
  'pro-introduction':['A little backup','for your next chapter.'],
  'safer-search':['Before you apply,','do a little detective work.'],
  'interview-tip':['Less “umm…”','More “here’s an example.”']
 }[id];
 const headingHtml='<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F3D2E;border-radius:12px;border-bottom:5px solid #b3ef73;margin:0 0 26px"><tr><td style="padding:26px 24px"><h1 style="font-family:&#39;Arial Rounded MT Bold&#39;,&#39;Trebuchet MS&#39;,Arial,sans-serif;font-size:42px;font-weight:800;line-height:1.04;letter-spacing:-1.5px;margin:0;color:#fffdf3">'+escape(headlineParts[0])+'<br><span style="color:#b3ef73">'+escape(headlineParts[1].trim())+'</span></h1></td></tr></table>';
 const preview=options.preview===true;
 if(email.kind==='existing'&&!preview)throw Error('Use existing welcome sender');
 const optional=!['verification','existing'].includes(email.kind);
 if(optional&&!preview&&!options.unsubscribeUrl)throw Error('Subscription footer required');
 const unsubscribe=options.unsubscribeUrl || 'https://example.invalid/preview-only-unsubscribe';
 const parsed=new URL(unsubscribe);if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error('Invalid unsubscribe URL');
 const footer=optional?'You received this because you chose VeeAys onboarding/tips or Pro introduction emails. Manage your choices below.':'This account message helps you finish setting up VeeAys.';
 const address=options.mailingAddress||'';
 const cta='https://veeays.com'+email.path;
 const text=[subject,greeting,...email.paragraphs,'Tiny boost: '+email.tip,email.cta+': '+cta,email.closing,'The VeeAys team','Better Jobs. From Home.',footer,optional?'Unsubscribe: '+unsubscribe:'',optional?'Manage email preferences: https://veeays.com/member-emails':'','Need a hand? support@veeays.com',address].filter(Boolean).join('\n\n');
 const html=`<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title><style>@media(max-width:480px){.pad{padding:24px 20px!important}h1{font-size:32px!important}}</style></head><body style="margin:0;background:#F8F6EE;font-family:Arial,Helvetica,sans-serif;color:#0F3D2E"><div lang="en" dir="ltr"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escape(email.preview)}</div><table class="outer" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F6EE"><tr><td align="center" style="padding:24px 12px"><table class="card" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#fff;border-radius:18px;border-top:7px solid #22B07D"><tr><td class="pad copy" style="padding:32px;color:#0F3D2E;font-size:16px;line-height:1.7"><a href="https://veeays.com"><img src="https://veeays.com/veeays-logo.png" alt="Visit VeeAys" width="150" style="display:block;height:auto;width:150px;border:0;background:#fff;border-radius:6px"></a><p style="font-size:14px;margin:8px 0 30px">Better Jobs. From Home.</p>${preview?'<p style="font-size:13px;color:#7a4714">DESIGN PREVIEW · NOT SENT</p>':''}<p style="font-size:12px;letter-spacing:2px;font-weight:bold;margin-bottom:12px">${escape(email.tag)}</p>${headingHtml}<p>${escape(greeting)}</p>${email.paragraphs.map(p=>'<p style="margin:0 0 18px">'+escape(p)+'</p>').join('')}<table class="tip" role="presentation" width="100%" cellpadding="20" cellspacing="0" style="background:#edf5e8;border-radius:12px;color:#0F3D2E;margin:24px 0"><tr><td><strong>A little VeeAys boost 🌱</strong><br>${escape(email.tip)}</td></tr></table><table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#0F3D2E" style="border-radius:8px;mso-padding-alt:14px 22px"><a href="${escape(cta)}" style="display:inline-block;background:#0F3D2E;color:#fff;padding:14px 22px;font-size:16px;line-height:24px;font-weight:bold;text-decoration:none;border-radius:8px">${escape(email.cta)} →</a></td></tr></table><p style="margin-top:28px">${escape(email.closing)}<br>The VeeAys team</p></td></tr><tr><td class="foot" style="padding:24px 32px;background:#F8F6EE;color:#0F3D2E;font-size:14px;line-height:1.7">${escape(footer)}<br>Need a hand? <a class="footer-link" href="mailto:support@veeays.com" style="color:#0F3D2E">Email the VeeAys team</a>.${optional?`<br><a class="footer-link" href="${escape(unsubscribe)}" style="color:#0F3D2E">Unsubscribe from onboarding and tips</a> · <a class="footer-link" href="https://veeays.com/member-emails" style="color:#0F3D2E">Manage email preferences</a><br>${escape(address)}`:''}</td></tr></table></td></tr></table></div></body></html>`;
 return {subject,html,text};
}
