// Pure scheduling policy. Authoritative account, consent and delivery data are supplied by the server.
export const DAY=86400000;
export const STEPS=Object.freeze([
 {id:'verify-day-2',day:2,end:4,category:'verification'},
 {id:'getting-started',day:2,end:4,category:'tips'},
 {id:'verify-day-5',day:5,end:7,category:'verification'},
 {id:'profile-tip',day:5,end:7,category:'tips'},
 {id:'pro-introduction',day:7,end:9,category:'pro'},
 {id:'safer-search',day:10,end:12,category:'tips'},
 {id:'interview-tip',day:14,end:17,category:'tips'}
]);
export function dueStep(person,now,control) {
 const age=(now-Date.parse(person.createdAt))/DAY;
 if(!Number.isFinite(now)||!Number.isFinite(age)||!Number.isFinite(Date.parse(control.startAt))||
    Date.parse(person.createdAt)<Date.parse(control.startAt)||!person.exists||person.banned||person.suppressed) return null;
 const confirmed=Number.isFinite(Date.parse(person.confirmedAt));
 // Never infer promotional consent from registration, confirmation or digest preferences.
 for(const step of STEPS){
  if(age<step.day||age>=step.end||person.completed?.includes(step.id))continue;
  if(step.category==='verification'){
   if(confirmed||control.remindersVerified!==true)continue;
  }else{
   if(!confirmed||now-Date.parse(person.confirmedAt)<2*DAY)continue;
   const consent=person.consent?.[step.category];
   if(consent?.enabled!==true||!Number.isFinite(Date.parse(consent.at))||Date.parse(consent.at)>now)continue;
   // A recent opt-in must not release messages from earlier milestones.
   if(Date.parse(consent.at)>Date.parse(person.createdAt)+step.day*DAY)continue;
   if(step.id==='profile-tip'&&person.profileComplete!==false)continue;
   if(step.category==='pro'&&person.plan!=='free')continue;
   if(now-Date.parse(person.lastOptionalAttemptAt)<2*DAY||now-Date.parse(person.lastOtherAttemptAt)<DAY)continue;
  }
  return step;
 }
 return null;
}
