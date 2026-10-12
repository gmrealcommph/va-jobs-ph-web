// Only opaque event fingerprints and registration times reach the browser.
export class RegistrationTracker {
  constructor(){this.initialized=false;this.seen=new Set();this.startedAt=0;}
  observe(snapshot){
    if(!snapshot?.available || !Array.isArray(snapshot.events)) return [];
    const events=snapshot.events.filter(e=>/^[a-f0-9]{32}$/.test(e.event_id||'') && Number.isFinite(Date.parse(e.registered_at)));
    if(!this.initialized){
      this.startedAt=Date.parse(snapshot.generated_at)-120000;
      if(!Number.isFinite(this.startedAt))return [];
      events.forEach(e=>this.seen.add(e.event_id));this.initialized=true;return [];
    }
    const fresh=[];
    for(const event of events){
      if(!this.seen.has(event.event_id) && Date.parse(event.registered_at)>=this.startedAt)fresh.push(event);
      this.seen.add(event.event_id);
    }
    return fresh;
  }
}
export function refreshDelay(seconds,failures=0){
  if(![15,30,60].includes(seconds))return 0;
  return Math.min(300000,seconds*1000*2**Math.min(5,Math.max(0,failures)));
}
export function playRegistrationChime(context){
  if(!context || context.state!=='running')return false;
  const now=context.currentTime;
  // One sharp strike with inharmonic partials gives a small metal desk bell its ring.
  for(const [frequency,level,decay] of [[1760,0.11,0.8],[2816,0.055,0.55],[3872,0.03,0.3]]){
    const tone=context.createOscillator(),gain=context.createGain(),start=now;
    tone.type='sine';tone.frequency.setValueAtTime(frequency,start);
    gain.gain.setValueAtTime(0.0001,start);
    gain.gain.exponentialRampToValueAtTime(level,start+0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001,start+decay);
    tone.connect(gain);gain.connect(context.destination);
    tone.start(start);tone.stop(start+decay+0.02);
  }
  return true;
}

export class PaymentTracker {
  constructor(){this.initialized=false;this.seen=new Map();this.startedAt=0;}
  observe(snapshot){
    const generated=Date.parse(snapshot?.generated_at);
    if(!snapshot?.available||!Array.isArray(snapshot.events)||!Number.isFinite(generated))return [];
    const events=snapshot.events.filter(e=>/^[a-f0-9]{32}$/.test(e.event_id||'')&&Number.isFinite(Date.parse(e.confirmed_at))&&Date.parse(e.confirmed_at)<=generated&&Number.isSafeInteger(e.amount_minor)&&e.amount_minor>0&&e.currency==='PHP');
    if(!this.initialized){this.startedAt=generated;events.forEach(e=>this.seen.set(e.event_id,Date.parse(e.confirmed_at)));this.initialized=true;return [];}
    const fresh=[];
    for(const event of events){
      const at=Date.parse(event.confirmed_at);
      if(!this.seen.has(event.event_id)&&at>=this.startedAt)fresh.push(event);
      this.seen.set(event.event_id,at);
    }
    for(const [id,at] of this.seen)if(at<generated-86400000)this.seen.delete(id);
    return fresh;
  }
}
export function playPaymentCelebration(context){
  if(!context||context.state!=='running')return false;
  // A bright ascending major arpeggio, followed by a soft octave sparkle.
  for(const [offset,frequency,level,duration] of [[0,523.25,.07,.28],[.12,659.25,.07,.28],[.24,783.99,.07,.3],[.36,1046.5,.08,.55],[.39,2093,.018,.35]]){
    const start=context.currentTime+offset,tone=context.createOscillator(),gain=context.createGain();
    tone.type='sine';tone.frequency.setValueAtTime(frequency,start);
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(level,start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    tone.connect(gain);gain.connect(context.destination);tone.start(start);tone.stop(start+duration+.02);
  }
  return true;
}
