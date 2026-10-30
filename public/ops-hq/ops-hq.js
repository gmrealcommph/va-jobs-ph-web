/* backup sources for the 3D library, and a visible message instead of a silent "Loading…" */
function __loadErr(m){var l=document.getElementById('load');if(l&&l.style.display!=='none'){l.style.cssText='display:flex;pointer-events:auto;text-align:center;padding:2cqw;font-size:1.1cqw;color:#7a2a1a;background:rgba(255,240,225,.92)';l.textContent=m}}
addEventListener('error',function(e){__loadErr(window.THREE?'Something went wrong: '+(e.message||'script error'):'The 3D library could not be downloaded (blocked or offline). Check your connection, VPN or ad-blocker, then reload.')});
addEventListener('unhandledrejection',function(e){__loadErr('Something went wrong while loading: '+((e.reason&&e.reason.message)||e.reason))});
setTimeout(function(){if(!window.THREE)__loadErr('The 3D library could not be downloaded (blocked or offline). Check your connection, VPN or ad-blocker, then reload.')},8000);

const META={"n": 145662, "t": 297679},ANCH={"plate": 0.13072527945041656, "b1": 0.16311946511268616, "b2": 0.1628967672586441, "b3": 0.16268974542617798, "lamp": 0.05787656456232071, "mug": 0.0861816555261612};
const B64="/ops-hq/m_intake.bin";
const CB64="/ops-hq/m_comms.bin",CMETA={"n": 164887, "t": 340281},CANCH={"plate": {"x": -0.0085, "y": 0.0519, "w": 0.2769, "h": 0.0565, "z": 0.1412}, "lamp": [0.1893, 0.2141, 0.03], "mug": [-0.0932, 0.1474, 0.1], "H": 0.34905242919921875, "W": 0.5367507934570312};
const RB64="/ops-hq/m_refer.bin",RMETA={"n": 174396, "t": 357012};
const JB64="/ops-hq/m_jobs.bin",JMETA={"n": 164576, "t": 340894};
const QB64="/ops-hq/m_reads.bin",QMETA={"n": 151520, "t": 308491};
const HB64="/ops-hq/m_health.bin",HMETA={"n": 152955, "t": 319547};
const PB64="/ops-hq/m_pro.bin",PMETA={"n": 161451, "t": 331250},XB64="/ops-hq/m_chief.bin",XMETA={"n": 138357, "t": 266169};
(async()=>{
const T=window.THREE,$=id=>document.getElementById(id);
const stage=$('stage'),cv=$('cv'),layer=$('layer');
let RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;
try{renderer=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true})}catch(e){$('load').textContent='This browser could not start 3D graphics.';return}
if(typeof DecompressionStream==='undefined'){$('load').textContent='This browser is too old to open the model. Try a recent Chrome, Edge, Safari or Firefox.';return}
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.NoToneMapping;renderer.setClearColor(0x000000,0);
const scene=new T.Scene();
const camera=new T.PerspectiveCamera(30,1672/941,.5,400);
const lin=c=>new T.Color(c).convertSRGBToLinear();
const FONT='Nunito, system-ui, sans-serif';
const S=6;                                  // build size of the model; the slot rescales it per desk
const fmt=v=>typeof v==='number'?v.toLocaleString('en-US'):(v==null?'—':String(v));
const lerp=(a,b,t)=>a+(b-a)*t;
const hemi=new T.HemisphereLight(0xfff3df,0xcaa070,1.0);scene.add(hemi);
const sun=new T.DirectionalLight(0xffe9c8,.5);sun.position.set(-6,14,12);scene.add(sun);

/* ---------- canvas helpers ---------- */
const redraws=[];
function rr(c,X,Y,W,H,r){c.beginPath();c.moveTo(X+r,Y);c.arcTo(X+W,Y,X+W,Y+H,r);c.arcTo(X+W,Y+H,X,Y+H,r);c.arcTo(X,Y+H,X,Y,r);c.arcTo(X,Y,X+W,Y,r);c.closePath()}
function cvTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.anisotropy=8;const o={t,c,x,w,h,draw:()=>{x.clearRect(0,0,w,h);draw(x,w,h);t.needsUpdate=true}};o.draw();redraws.push(o.draw);return o}

/* ---------- the model ---------- */
async function unpack(url){const r=await fetch(url,{credentials:'same-origin'});if(!r.ok)throw new Error('model '+url+' '+r.status);return await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()}
let LOADN=0;const LOADT=8;function prog(){const l=$('load');if(l)l.textContent='Loading the team… '+(++LOADN)+' / '+LOADT}
const buf=await unpack(B64);prog();
const n=META.n,tn=META.t;
const pos=new Float32Array(buf,0,n*3),nb=new Int8Array(buf,n*12,n*3),cb=new Uint8Array(buf,n*15,n*3);
const nor=new Float32Array(n*3);for(let i=0;i<n*3;i++)nor[i]=nb[i]/127;
const lut=new Float32Array(256);for(let i=0;i<256;i++)lut[i]=Math.pow(i/255,2.2);
const col=new Float32Array(n*3);for(let i=0;i<n*3;i++)col[i]=lut[cb[i]];
const geo=new T.BufferGeometry();
geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setAttribute('normal',new T.BufferAttribute(nor,3));geo.setAttribute('color',new T.BufferAttribute(col,3));geo.setIndex(new T.BufferAttribute(new Uint32Array(buf.slice(n*18,n*18+tn*12)),1));geo.computeBoundingSphere();
const vmat=new T.MeshStandardMaterial({vertexColors:true,roughness:.85,metalness:0});
const MODEL_H=.3516;                              // model height in its own units

async function mkGeo(src,m){const bf=await unpack(src);prog();const n=m.n,tn=m.t;
 const pos=new Float32Array(bf,0,n*3),nb=new Int8Array(bf,n*12,n*3),cb=new Uint8Array(bf,n*15,n*3);const nor=new Float32Array(n*3);for(let i=0;i<n*3;i++)nor[i]=nb[i]/127;const col=new Float32Array(n*3);for(let i=0;i<n*3;i++)col[i]=lut[cb[i]];
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('normal',new T.BufferAttribute(nor,3));g.setAttribute('color',new T.BufferAttribute(col,3));g.setIndex(new T.BufferAttribute(new Uint32Array(bf.slice(n*18,n*18+tn*12)),1));g.computeBoundingSphere();return g}
/* ---------- desks: where each one stands in the picture (pixels of the 1672x941 image) ---------- */
const D=[
 {id:'intake',name:'Member Intake',color:'#2fa36b',ic:'people',px:240,py:574,h:222,hd:.164,card:[155,262,288],rows:()=>[['New Today',st.newM],['Total Members',fmt(st.tot)],['Growth',st.grow]]},
 {id:'jobs',name:'Jobs Operations',color:'#f0793a',ic:'brief',px:590,py:548,h:212,mh:.7126,hd:.252,card:[521,262,268],rows:()=>[['Active Jobs',fmt(st.jobs)],['New Today',st.newJ],['Processing',st.jp]]},
 {id:'reads',name:'Quick Reads',color:'#f2b034',ic:'doc',px:1010,py:548,h:212,mh:.3464,hd:.159,card:[955,262,246],rows:()=>[['Queued',st.qd],['Processing',st.qp],['Completed',fmt(st.qc)],['Failed',st.qf,1]]},
 {id:'pro',name:'Pro Membership',color:'#f0b429',ic:'crown',px:1395,py:574,h:222,mh:.3546,hd:.193,card:[1291,262,278],rows:()=>[['Active Pro',st.pro],['New Today',st.upg],['Expiring Soon',st.exp]]},
 {id:'comms',name:'Communications',color:'#2f8fd8',ic:'mega',px:214,py:782,h:215,mh:.349,hd:.143,card:[58,790,252],rows:()=>[['Sent Today',st.sent],['Delivered',st.deliv],['Suppressed',st.supp,1]]},
 {id:'refer',name:'Refer & Earn',color:'#3aa35a',ic:'plus',px:524,py:788,h:215,mh:.729,hd:.326,card:[392,790,244],rows:()=>[['Verified Signups',st.ref],['Eligible Conversions',st.rw],['On Hold',st.hold]]},
 {id:'chief',name:'Chief of Staff',color:'#7a4a8e',ic:null,px:845,py:800,h:300,mh:.434,hd:.274,card:null,rows:()=>[]},
 {id:'health',name:'System Health',color:'#6b7a89',ic:'gear',px:1232,py:788,h:232,mh:.609,hd:.283,card:[1090,780,264],rows:()=>[['Admin data',st.db,'h'],['Reads worker',st.edge,'h'],['Reads queue',st.q],['Alerts',st.alerts,1]]}];
const st={db:'Healthy',edge:'Healthy',tot:2557,newM:142,jobs:2466,newJ:57,jp:23,qd:12,qp:6,qc:1824,qf:8,pro:2,upg:1,exp:0,ref:0,rw:0,hold:0,sent:0,deliv:0,supp:22,q:3,alerts:0,tasks:5,done:11,grow:'+6%'};
const DEMO0=JSON.stringify(st);
const byId={};D.forEach(d=>byId[d.id]=d);
const ICON={people:'<circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9" r="2.6"/><path d="M3 19c0-3.6 3-5.6 6-5.6s6 2 6 5.6z"/><path d="M15.4 14.4c3 0 5.6 1.5 5.6 4.6h-4.2z"/>',brief:'<path d="M3 9h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M8 9V6.5h8V9" fill="none" stroke="#fff" stroke-width="2"/>',doc:'<path d="M6 3h8l5 5v13H6z"/><path d="M9 12h7M9 15h7M9 18h5" stroke="#f2b034" stroke-width="1.6"/>',crown:'<path d="M3 19L2 7l5 4 5-7 5 7 5-4-1 12z"/>',mega:'<path d="M3 10v4l11 5V5z"/><rect x="15" y="9" width="5" height="6" rx="2.5"/>',plus:'<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c0-4 3-6 6.5-6s6.500 2 6.500 6z"/><path d="M19 8v6M16 11h6" stroke="#fff" stroke-width="2.2" fill="none"/>',gear:'<circle cx="12" cy="12" r="4.6" fill="none" stroke="#fff" stroke-width="3"/><circle cx="12" cy="12" r="8.2" fill="none" stroke="#fff" stroke-width="3.2" stroke-dasharray="3 3.1"/>'};
function cardHTML(d){return'<div class="hd"><span class="ic" style="background:'+d.color+'"><svg viewBox="0 0 24 24">'+ICON[d.ic]+'</svg></span><b>'+d.name+'</b><span class="bars"><i style="height:45%"></i><i style="height:70%"></i><i style="height:100%"></i></span></div>'+d.rows().map(r=>{const v=r[1],bad=r[2]===1&&Number(String(v).replace(/,/g,''))>0;const hc=r[2]==='h'?({Healthy:'ok',Warning:'warn',Critical:'bad'}[v]||''):'';return'<div class="rw"><span>'+r[0]+'</span><b class="'+(bad?'bad':r[2]===2?'ok':hc)+'">'+((r[2]===2||r[2]==='h')?'● ':'')+fmt(v)+'</b></div>'}).join('')}
D.forEach(d=>{
 if(d.card){const el=document.createElement('div');el.className='card';el.style.cssText='left:'+(d.card[0]+d.card[2]*.14)/16.72+'%;top:'+d.card[1]/9.41+'%;width:'+d.card[2]*.72/16.72+'%;--c:'+d.color;el.addEventListener('click',()=>select(d));layer.appendChild(el);d.el=el}
 const tg=document.createElement('div');tg.className='tag';tg.textContent=d.name;tg.style.left=d.px/16.72+'%';tg.style.top=(d.py-26)/9.41+'%';layer.appendChild(tg);d.tag=tg;
 d.slot=new T.Group();d.slot.visible=false;scene.add(d.slot);d.hop=0;d.tilt=0;d.shake=0;d.pulse=0;d.flash=0;d.yaw=Math.max(-.6,Math.min(.6,Math.atan((836-d.px)/950)));
});
function refreshCards(){D.forEach(d=>{if(d.el)d.el.innerHTML=cardHTML(d)})}refreshCards();

/* ---------- Member Intake: the real model with its details ---------- */
const girl=D[0];
const rig=new T.Group();rig.scale.setScalar(S);
const mesh=new T.Mesh(geo,vmat);rig.add(mesh);girl.slot.add(rig);girl.body=rig;girl.slot.visible=true;girl.tag.style.display='none';
function decal(w,h,tex,x,y,z){const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:tex.t,roughness:.8,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));m.position.set(x,y,z);rig.add(m);return m}
decal(.166,.032,cvTex(1060,206,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#f6dfb2');g.addColorStop(1,'#eccb8e');c.fillStyle=g;rr(c,2,2,w-4,h-4,40);c.fill();c.strokeStyle='#c9964f';c.lineWidth=7;rr(c,10,10,w-20,h-20,34);c.stroke();c.fillStyle='#3a2414';c.font='800 112px '+FONT;c.textAlign='center';c.textBaseline='middle';c.fillText('Member Intake',w/2,h/2+6)}),-.0435,.0635,ANCH.plate+.0012);
[['New Members','#3f6b4a','#eef3e0',.091,ANCH.b1],['Welcome','#efe3c6','#3a3a2a',.0675,ANCH.b2],['Community','#e08a2c','#fff6e6',.0465,ANCH.b3]].forEach(([t,bg,ink,y,z])=>{
 decal(.076,.0165,cvTex(608,132,(c,w,h)=>{c.fillStyle=bg;rr(c,0,0,w,h,16);c.fill();c.fillStyle=ink;c.font='800 82px '+FONT;c.textAlign='center';c.textBaseline='middle';c.fillText(t,w/2,h/2+4)}),.108,y,z+.0012)});
const RAD=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.4,'rgba(255,255,255,.4)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new T.CanvasTexture(c)})();
const glow=new T.Sprite(new T.SpriteMaterial({map:RAD,color:0xffd27a,blending:T.AdditiveBlending,transparent:true,depthWrite:false,opacity:.35}));glow.scale.set(.2,.2,1);glow.position.set(.116,.208,ANCH.lamp+.03);rig.add(glow);
const steam=[0,1,2].map(i=>{const s=new T.Sprite(new T.SpriteMaterial({map:RAD,color:0xffffff,transparent:true,depthWrite:false,opacity:0}));rig.add(s);return{s,ph:i*.9}});
const steamBase=new T.Vector3(-.095,.157,ANCH.mug);

/* ---------- face: eyes, lids, mouth and tears drawn over the model ---------- */
const FACES=[];
const INK='#2a2622',MINK='#b2603c',MRED='#8a3028';
const EW=256,EH=316,EWU=.04,EHU=EWU*EH/EW,MW=256,MH=160,MWU=.032,MHU=MWU*MH/MW;
const EXPR={neutral:{mouth:'smile'},happy:{arc:1,mouth:'grin'},cry:{lid:.16,water:1,sad:.2,mouth:'wail',tears:1},surprised:{big:1,mouth:'o'},sleepy:{lid:.55,mouth:'flat'},wink:{mouth:'grin',winkR:1}};
function newFace(rig,mesh,FACE,SKIN,k,MS,ink){const fc={MS:MS,ink:ink,k:k||1,rig,mesh,FACE,SKIN,base:'neutral',over:null,overT:0,auto:true,bp:0,bt:1+Math.random()*3,look:0,lookTo:0,lookNext:3,tear:0,sad:0,ready:false,eyes:[],mouth:null,tears:[],paths:[]};FACES.push(fc);return fc}
function feather(c,w,h,rx,ry,inner,SKIN){c.save();c.translate(w/2,h/2);c.scale(1,ry/rx);const g=c.createRadialGradient(0,0,0,0,0,rx);g.addColorStop(0,'rgba('+SKIN+',1)');g.addColorStop(inner,'rgba('+SKIN+',1)');g.addColorStop(1,'rgba('+SKIN+',0)');c.fillStyle=g;c.beginPath();c.arc(0,0,rx,0,7);c.fill();c.restore()}
function drawEye(c,st,lid,lx,arc,SKIN,INK){INK=INK||'#2a2622';
 c.clearRect(0,0,EW,EH);feather(c,EW,EH,EW/2,EH/2,.72,SKIN);
 const cx=EW/2+lx,cy=EH/2;let w=90,h=170;if(st.big){w=104;h=196}
 c.lineCap='round';
 if(arc){c.strokeStyle=INK;c.lineWidth=28;c.beginPath();c.arc(cx,cy+34,50,Math.PI*1.13,Math.PI*1.87);c.stroke();return}
 if(lid>.9){c.strokeStyle=INK;c.lineWidth=15;c.beginPath();c.moveTo(cx-w*.6,cy+4);c.quadraticCurveTo(cx,cy+34,cx+w*.6,cy+4);c.stroke();return}
 c.fillStyle=INK;rr(c,cx-w/2,cy-h/2,w,h,w/2);c.fill();
 if(st.water){c.save();rr(c,cx-w/2,cy-h/2,w,h,w/2);c.clip();c.fillStyle='rgba(120,200,255,.6)';c.fillRect(0,cy+h*.05,EW,h);c.restore();c.fillStyle='rgba(170,225,255,.85)';c.beginPath();c.ellipse(cx,cy+h/2-4,w*.62,12,0,0,7);c.fill()}
 c.fillStyle='rgba(255,255,255,.92)';c.beginPath();c.arc(cx-w*.17,cy-h*.27,w*((st.big||st.water)?.22:.16),0,7);c.fill();
 c.fillStyle='rgba(255,255,255,.65)';c.beginPath();c.arc(cx+w*.16,cy+h*.12,w*.08,0,7);c.fill();
 if(lid>.02){const ly=cy-h/2+lid*h;
  c.save();c.beginPath();c.ellipse(EW/2,EH/2,EW/2*.72,EH/2*.72,0,0,7);c.clip();
  c.fillStyle='rgb('+SKIN+')';c.beginPath();c.moveTo(0,0);c.lineTo(EW,0);c.lineTo(EW,ly);c.quadraticCurveTo(cx,ly+26,0,ly);c.closePath();c.fill();c.restore();
  if(lid>.2){c.save();c.beginPath();c.rect(cx-w*.62,0,w*1.24,EH);c.clip();c.strokeStyle=INK;c.lineWidth=13;c.beginPath();c.moveTo(EW,ly);c.quadraticCurveTo(cx,ly+26,0,ly);c.stroke();c.restore()}}
}
function drawMouth(c,k,SKIN){
 c.clearRect(0,0,MW,MH);feather(c,MW,MH,MW/2,MH/2,.62,SKIN);const cx=MW/2;c.lineCap='round';c.lineJoin='round';
 if(k==='smile'){c.strokeStyle=MINK;c.lineWidth=9;c.beginPath();c.arc(cx,52,48,Math.PI*.22,Math.PI*.78);c.stroke()}
 else if(k==='flat'){c.strokeStyle=MINK;c.lineWidth=9;c.beginPath();c.moveTo(cx-24,76);c.lineTo(cx+24,76);c.stroke()}
 else if(k==='grin'){const p=()=>{c.beginPath();c.moveTo(cx-46,58);c.quadraticCurveTo(cx,50,cx+46,58);c.quadraticCurveTo(cx+42,114,cx,114);c.quadraticCurveTo(cx-42,114,cx-46,58);c.closePath()};p();c.fillStyle=MRED;c.fill();c.save();p();c.clip();c.fillStyle='#ef7f86';c.beginPath();c.ellipse(cx,112,28,18,0,0,7);c.fill();c.restore();c.strokeStyle=MRED;c.lineWidth=6;p();c.stroke()}
 else if(k==='wail'){c.fillStyle=MRED;c.beginPath();c.moveTo(cx-42,110);c.quadraticCurveTo(cx,26,cx+42,110);c.quadraticCurveTo(cx,92,cx-42,110);c.fill();c.strokeStyle=MRED;c.lineWidth=6;c.stroke()}
 else if(k==='o'){c.fillStyle=MRED;c.beginPath();c.ellipse(cx,78,20,28,0,0,7);c.fill();c.fillStyle='#ef7f86';c.beginPath();c.ellipse(cx,94,12,10,0,0,7);c.fill()}
}
function setExpr(fc,name,hold){if(!EXPR[name])return;if(hold){fc.over=name;fc.overT=hold}else{fc.base=name;fc.over=null}}
function buildFace(fc){
 const {rig,mesh,FACE,k}=fc,slot=rig.parent,sv=[slot.position.clone(),slot.scale.clone(),slot.rotation.clone()];
 slot.position.set(0,0,0);slot.scale.set(1,1,1);slot.rotation.set(0,0,0);slot.updateMatrixWorld(true);
 const ray=new T.Raycaster(),Z=new T.Vector3(0,0,1);
 const hit=(x,y)=>{ray.set(new T.Vector3(x*S,y*S,12),new T.Vector3(0,0,-1));const h=ray.intersectObject(mesh,false)[0];return h?{p:h.point.clone().divideScalar(S),n:h.face.normal.clone()}:null};
 const surf=(x,y)=>{const c=hit(x,y);if(!c)return null;const d=.008,a=hit(x+d,y),b=hit(x-d,y),u=hit(x,y+d),v=hit(x,y-d);if(a&&b&&u&&v){const n=a.p.clone().sub(b.p).cross(u.p.clone().sub(v.p)).normalize();if(n.z<0)n.negate();c.n=n}if(c.n.z<0)c.n.negate();return c};
 const place=(m,s,off)=>{m.position.copy(s.p).addScaledVector(s.n,off);m.quaternion.setFromUnitVectors(Z,s.n);m.userData.q=m.quaternion.clone()};
 const mk=(wu,hu,cw,ch)=>{const cn=document.createElement('canvas');cn.width=cw;cn.height=ch;const tx=new T.CanvasTexture(cn);tx.encoding=T.sRGBEncoding;tx.anisotropy=8;const m=new T.Mesh(new T.PlaneGeometry(wu,hu),new T.MeshStandardMaterial({map:tx,transparent:true,roughness:.85,metalness:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));m.receiveShadow=true;m.renderOrder=2;rig.add(m);return{m,c:cn.getContext('2d'),tx,key:''}};
 const sL=surf(...FACE.eyeL),sR=surf(...FACE.eyeR),sM=surf(...FACE.mouth);
 if(!sL||!sR||!sM){console.warn('face anchors missed');slot.position.copy(sv[0]);slot.scale.copy(sv[1]);slot.rotation.copy(sv[2]);slot.updateMatrixWorld(true);return}
 [sL,sR].forEach((s,i)=>{const d=mk(EWU*k,EHU*k,EW,EH);place(d.m,s,.002*k);d.side=i;fc.eyes.push(d)});
 fc.mouth=mk(MWU*k,MHU*k,MW,MH);place(fc.mouth.m,sM,.002*k);
 // tear paths down each cheek
 const tc=document.createElement('canvas');tc.width=48;tc.height=128;const x=tc.getContext('2d');
 const gr=x.createLinearGradient(0,0,0,128);gr.addColorStop(0,'rgba(150,215,255,0)');gr.addColorStop(.7,'rgba(150,215,255,.7)');gr.addColorStop(1,'rgba(190,232,255,.95)');
 x.fillStyle=gr;x.fillRect(19,0,10,100);x.fillStyle='rgba(175,225,255,.95)';x.beginPath();x.arc(24,100,19,0,7);x.fill();x.fillStyle='rgba(255,255,255,.9)';x.beginPath();x.arc(18,94,6,0,7);x.fill();
 const ttx=new T.CanvasTexture(tc);ttx.encoding=T.sRGBEncoding;
 [FACE.eyeL,FACE.eyeR].forEach((pt,i)=>{const path=[];for(let y=pt[1]-.0165*k;y>=pt[1]-.0615*k;y-=.0065*k){const h=hit(pt[0]+(i?.003:-.003)*k,y);if(!h)break;path.push(h)}fc.paths.push(path);
  for(let k=0;k<3;k++){const m=new T.Mesh(new T.PlaneGeometry(.0063*k,.0168*k),new T.MeshBasicMaterial({map:ttx,transparent:true,depthWrite:false,opacity:0,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-6}));m.renderOrder=3;m.visible=false;rig.add(m);fc.tears.push({m,i,k})}});
 slot.position.copy(sv[0]);slot.scale.copy(sv[1]);slot.rotation.copy(sv[2]);slot.updateMatrixWorld(true);
 fc.ready=true;
}
function setAll(n){FACES.forEach(fc=>setExpr(fc,n))}
const QZ=new T.Quaternion(),ZA=new T.Vector3(0,0,1);
function faceTick(dt,t){FACES.forEach(fc=>faceOne(fc,dt,t))}
function faceOne(fc,dt,t){
 if(!fc.ready)return;
 let ex=fc.base;if(fc.over&&fc.overT>0){ex=fc.over;fc.overT-=dt}else fc.over=null;
 const st=EXPR[ex];
 if(fc.auto&&!RM&&fc.bp===0){fc.bt-=dt;if(fc.bt<=0){fc.bp=.001;fc.bt=Math.random()<.2?.3:2.2+Math.random()*3}}
 let bl=0;if(fc.bp>0){fc.bp+=dt/.22;if(fc.bp>=1)fc.bp=0;else bl=Math.sin(fc.bp*Math.PI)}
 fc.lookNext-=dt;if(fc.lookNext<=0){fc.lookTo=RM||ex!=='neutral'?0:[-9,0,0,9][Math.floor(Math.random()*4)];fc.lookNext=1.5+Math.random()*3}
 fc.look+=(fc.lookTo-fc.look)*Math.min(1,dt*8);
 fc.sad+=((st.sad||0)-fc.sad)*Math.min(1,dt*6);
 fc.eyes.forEach(d=>{
  let lid=Math.max(st.lid||0,bl);if(st.winkR&&d.side===1)lid=1;
  const arc=!!st.arc,lx=Math.round(fc.look);
  const key=ex+'|'+(lid*24|0)+'|'+lx+'|'+arc;
  if(key!==d.key){d.key=key;drawEye(d.c,st,lid,lx,arc,fc.SKIN,fc.ink);d.tx.needsUpdate=true}
  d.m.quaternion.copy(d.m.userData.q).multiply(QZ.setFromAxisAngle(ZA,(d.side?1:-1)*fc.sad))});
 if(fc.mouth.key!==st.mouth){fc.mouth.key=st.mouth;drawMouth(fc.mouth.c,st.mouth,fc.MS||fc.SKIN);fc.mouth.tx.needsUpdate=true}
 fc.mouth.m.scale.set(1,ex==='cry'?1+Math.sin(t*20)*.1:1,1);
 fc.tear+=((st.tears?1:0)-fc.tear)*Math.min(1,dt*4);
 fc.tears.forEach(q=>{const path=fc.paths[q.i];const on=fc.tear>.02&&path.length>1;q.m.visible=on;if(!on)return;
  const ph=(t*.6+q.k/3+q.i*.17)%1,u=ph*(path.length-1),i0=Math.min(path.length-2,Math.floor(u)),f=u-i0;
  const a=path[i0],b=path[i0+1];q.m.position.copy(a.p).lerp(b.p,f);const n=a.n.clone().lerp(b.n,f).normalize();q.m.position.addScaledVector(n,.002*fc.k);q.m.quaternion.setFromUnitVectors(ZA,n);
  q.m.material.opacity=fc.tear*Math.min(1,ph*8)*Math.min(1,(1-ph)*4)});
}
const FACEBTN=document.querySelectorAll('[data-face]');
FACEBTN.forEach(b=>b.onclick=()=>{setAll(b.dataset.face);FACEBTN.forEach(o=>o.setAttribute('aria-pressed',o===b))});
$('bBlink').onclick=()=>{FACES.forEach(fc=>fc.bp=.001)};
$('bAuto').onclick=e=>{const a=!FACES[0].auto;FACES.forEach(fc=>fc.auto=a);e.currentTarget.setAttribute('aria-pressed',a)};


girl.fc=newFace(rig,mesh,{eyeL:[-.0433,.2045],eyeR:[.0113,.2045],mouth:[-.0163,.1855]},'245,167,94');buildFace(girl.fc);

/* ---------- copies of the model for the preview ---------- */
const OPT={comms:{b:CB64,m:CMETA,a:CANCH,plate:{text:'Communications',x:CANCH.plate.x,y:CANCH.plate.y,w:.262,h:.05,z:CANCH.plate.z},face:{eyeL:[-.0505,.2245],eyeR:[.0035,.2245],mouth:[-.0215,.2085]},skin:'249,160,86',sw:1.45,sd:1,lamp:[CANCH.lamp[0],CANCH.lamp[1],.03],steam:[CANCH.mug[0],CANCH.mug[1],.1]},
 health:{b:HB64,m:HMETA,a:null,plate:{text:'System Health',x:-.005,y:.155,w:.33,h:.056,z:.2825},face:{eyeL:[-.062,.452],eyeR:[.048,.452],mouth:[-.003,.409]},skin:'32,22,14',ms:'230,140,75',ink:'#f1dfbd',fk:2,sw:2.5,sd:1.8,lamp:[.336,.456,.1],steam:null},
 pro:{b:PB64,m:PMETA,a:null,plate:{text:'Pro Membership',x:.005,y:.055,w:.25,h:.048,z:.0725},face:{eyeL:[-.014,.2115],eyeR:[.0405,.2205],mouth:[.0135,.194]},skin:'251,160,88',fk:1.5,sw:1.4,sd:1.3,lamp:[.155,.225,.06],steam:null},
 chief:{b:XB64,m:XMETA,a:null,plate:{text:'Chief of Staff',x:.011,y:.113,w:.17,h:.032,z:.192},face:{eyeL:[-.0405,.2875],eyeR:[.0035,.2875],mouth:[-.0165,.2565]},skin:'245,152,87',fk:.95,sw:1.7,sd:1.9,lamp:[.195,.2675,.06],steam:null},
 reads:{b:QB64,m:QMETA,a:null,plate:{text:'Quick Reads',x:.009,y:.062,w:.27,h:.052,z:.1545},face:{eyeL:[-.0247,.2255],eyeR:[.0186,.2255],mouth:[-.0007,.2066]},skin:'236,152,73',sw:1.3,sd:1,lamp:[.163,.236,.1],steam:null},
 jobs:{b:JB64,m:JMETA,a:null,plate:{text:'Jobs Operations',x:-.013,y:.114,w:.48,h:.078,z:.2335},face:{eyeL:[-.045,.46],eyeR:[.065,.46],mouth:[.008,.41]},skin:'252,161,77',fk:2.2,sw:2.6,sd:1.4,lamp:[.34,.455,.07],steam:null},
 refer:{b:RB64,m:RMETA,a:null,plate:{text:'Refer & Earn',x:.05,y:.224,w:.385,h:.06,z:.3115},face:{eyeL:[-.0515,.498],eyeR:[.0495,.498],mouth:[-.0010,.448]},skin:'245,154,84',fk:2.1,sw:2.5,sd:1.7,lamp:[.34,.5,.19],steam:null}};
async function addChar(d,o){const g=await mkGeo(o.b,o.m);const r=new T.Group();r.scale.setScalar(S);const ms=new T.Mesh(g,vmat);r.add(ms);d.slot.add(r);d.body=r;d.slot.visible=true;d.tag.style.display='none';d.real=true;d.sw=o.sw;d.sd=o.sd;
 const pl=o.plate;const m=new T.Mesh(new T.PlaneGeometry(pl.w,pl.h),new T.MeshStandardMaterial({map:cvTex(1048,Math.round(1048*pl.h/pl.w),(c,w,h)=>{const gr=c.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#f0dcae');gr.addColorStop(1,'#e7cb90');c.fillStyle=gr;rr(c,2,2,w-4,h-4,h*.17);c.fill();c.strokeStyle='#b9874a';c.lineWidth=7;rr(c,8,8,w-16,h-16,h*.15);c.stroke();c.fillStyle='#3a2414';let fs=h*.52;c.font='800 '+fs+'px '+FONT;while(c.measureText(pl.text).width>w*.84&&fs>20){fs-=4;c.font='800 '+fs+'px '+FONT}c.textAlign='center';c.textBaseline='middle';c.fillText(pl.text,w/2,h/2+h*.03)}).t,roughness:.8,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));m.position.set(pl.x,pl.y,pl.z+.0012);r.add(m);
 const glow=new T.Sprite(new T.SpriteMaterial({map:RAD,color:0xffd27a,blending:T.AdditiveBlending,transparent:true,depthWrite:false,opacity:.3}));const k=o.m.k||1;glow.scale.set(.18*k,.18*k,1);glow.position.set(o.lamp[0],o.lamp[1]-.005,o.lamp[2]);r.add(glow);
 const steam=o.steam?[0,1,2].map(i=>{const s=new T.Sprite(new T.SpriteMaterial({map:RAD,color:0xffffff,transparent:true,depthWrite:false,opacity:0}));r.add(s);return{s,ph:i*.9+.3}}):[];
 d.fx={glow,steam,sb:o.steam?new T.Vector3(...o.steam):null};
 d.fc=newFace(r,ms,o.face,o.skin,o.fk,o.ms,o.ink);buildFace(d.fc)}
const comms=byId.comms,refer=byId.refer,jobs=byId.jobs,reads=byId.reads,pro=byId.pro,chief=byId.chief,health=byId.health;
D.slice(1).filter(d=>d!==comms&&d!==refer&&d!==jobs&&d!==reads&&d!==pro&&d!==chief&&d!==health).forEach(d=>{const r=new T.Group();r.scale.setScalar(S);r.add(new T.Mesh(geo,vmat));d.slot.add(r);d.body=r});
await Promise.all([[comms,'comms'],[refer,'refer'],[jobs,'jobs'],[reads,'reads'],[pro,'pro'],[chief,'chief'],[health,'health']].map(a=>addChar(a[0],OPT[a[1]])));
const SH=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(50,24,8,.85)');g.addColorStop(.55,'rgba(50,24,8,.45)');g.addColorStop(1,'rgba(50,24,8,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new T.CanvasTexture(c)})();
D.forEach(d=>{const s=new T.Mesh(new T.PlaneGeometry(.62*S,.44*S),new T.MeshBasicMaterial({map:SH,transparent:true,depthWrite:false}));s.rotation.x=-Math.PI/2;s.position.set(.02*S,.01,.02*S);d.slot.add(s);d.shadow=s;const s2=new T.Mesh(new T.PlaneGeometry(.44*S,.3*S),new T.MeshBasicMaterial({map:SH,transparent:true,depthWrite:false}));s2.rotation.x=-Math.PI/2;s2.position.set(0,.012,.01*S);d.slot.add(s2);if(d.sw){s.scale.set(d.sw,d.sd,1);s2.scale.set(d.sw,d.sd,1)}});

/* ---------- put each desk where it stands in the picture ---------- */
const CAMH=10,PITCH=.24,GROUND=new T.Plane(new T.Vector3(0,1,0),0);
function place(){
 const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.position.set(0,CAMH,0);camera.rotation.set(-PITCH,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 const f=(h/2)/Math.tan(camera.fov*Math.PI/360),fwd=new T.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
 const ray=new T.Raycaster(),hit=new T.Vector3();
 D.forEach(d=>{const nx=(d.px/1672)*2-1,ny=-((d.py/941)*2-1);ray.setFromCamera({x:nx,y:ny},camera);
  if(!ray.ray.intersectPlane(GROUND,hit))return;const depth=hit.clone().sub(camera.position).dot(fwd);
  const target=d.h/941*h;                                  // wanted height in screen pixels
  const sc=target*depth/(f*(d.mh||MODEL_H));d.slot.position.copy(hit);d.slot.position.z-=(d.hd||.16)*sc;d.slot.position.y-=.0025*sc;d.slot.scale.setScalar(sc/S);
  d.shadow.scale.setScalar(1);})}
new ResizeObserver(place).observe(stage);place();

/* ---------- events ---------- */
const GOOD={
 intake:()=>{st.newM++;st.tot++;return'+1 member'},
 jobs:()=>{const k=3+Math.floor(Math.random()*12);st.jobs+=k;st.newJ+=k;return'+'+k+' jobs'},
 reads:()=>{st.qc++;st.qp=Math.max(0,st.qp-1);return'Article published'},
 pro:()=>{st.pro++;st.upg++;return'New Pro member'},
 refer:()=>{st.ref++;st.rw++;return'+1 referral'},
 comms:()=>{const k=5+Math.floor(Math.random()*30);st.sent+=k;st.deliv+=k-1;return k+' emails sent'},
 health:()=>'All systems go',
 chief:()=>{if(st.tasks>0)st.tasks--;st.done++;return'Task done'}};
const nums={};
function setNum(el,val,anim){const s=fmt(val),prev=nums[el.id]||'';nums[el.id]=s;
 if(prev.length!==s.length){el.innerHTML=[...s].map(c=>'<i>'+c+'</i>').join('')}
 else [...s].forEach((c,k)=>{const i=el.children[k];if(i.textContent!==c){i.textContent=c;if(anim&&!RM)i.animate([{transform:'translateY(-35%)',opacity:.2},{transform:'none',opacity:1}],{duration:420,easing:'ease-out'})}})}
setNum($('nTot'),st.tot,false);setNum($('nJobs'),st.jobs,false);
function pop(d,txt,color){const el=document.createElement('div');el.className='pop';el.textContent=txt;el.style.background=color;const cx=d.card?d.card[0]+d.card[2]/2:d.px,cy=d.card?d.card[1]-20:d.py-d.h-30;el.style.left=cx/16.72+'%';el.style.top=cy/9.41+'%';layer.appendChild(el);
 el.animate([{opacity:0,transform:'translate(-50%,.6cqw)'},{opacity:1,transform:'translate(-50%,0)',offset:.15},{opacity:1,transform:'translate(-50%,-1.4cqw)',offset:.8},{opacity:0,transform:'translate(-50%,-1.8cqw)'}],{duration:2100,easing:'ease-out'}).onfinish=()=>el.remove()}
function confetti(d){if(RM)return;const cs=['#e8a22c','#2f8f5b','#d4533b','#3b7dd8','#a35cc4'];for(let i=0;i<28;i++){const el=document.createElement('div');el.className='cf';el.style.background=cs[i%5];el.style.left=d.px/16.72+'%';el.style.top=(d.py-d.h)/9.41+'%';layer.appendChild(el);
 const dx=(Math.random()-.5)*14,up=-(6+Math.random()*8);el.animate([{transform:'translate(0,0) rotate(0)',opacity:1},{transform:'translate('+dx*.5+'cqw,'+up+'cqw) rotate('+Math.random()*400+'deg)',opacity:1,offset:.4},{transform:'translate('+dx+'cqw,'+(up+14)+'cqw) rotate('+Math.random()*800+'deg)',opacity:0}],{duration:1500+Math.random()*500,easing:'ease-out'}).onfinish=()=>el.remove()}}
function tween(dur,fn,done){tws.push({t:0,dur,fn,done})}const tws=[];
let sel=null;
function react(id,kind,o){const d=byId[id];if(!d)return;let label;o=o||{};
 const sim=!o.live&&!LIVE.on;
 if(window.opsHq&&window.opsHq.onReact)window.opsHq.onReact(id,kind,o,sim);   // only the offline demo may change counters; live reactions and live-mode previews are visual only
 if(kind==='alert'){if(sim&&id==='health')st.alerts++;label=o.label||(sim?'Check this':'Preview');if(!RM)tween(.9,p=>{d.shake=Math.sin(p*Math.PI*14)*.004*(1-p)},()=>d.shake=0);if(d.fc)setExpr(d.fc,'surprised',1.8)}
 else{label=o.label||(sim?GOOD[id]():'Preview');confetti(d);if(!RM)tween(1.4,p=>{d.hop=Math.abs(Math.sin(p*Math.PI*3))*.012*(1-p*.4);d.tilt=Math.sin(p*Math.PI*6)*.05*(1-p)},()=>{d.hop=0;d.tilt=0});tween(1.2,p=>{d.pulse=Math.sin(p*Math.PI)},()=>d.pulse=0);if(d.fc)setExpr(d.fc,'happy',2.8)}
 pop(d,label,kind==='alert'?'#d4533b':d.color);refreshCards();setNum($('nTot'),st.tot,true);setNum($('nJobs'),st.jobs,true);
 if(d.el){d.el.classList.add('hot');setTimeout(()=>d.el.classList.remove('hot'),900)}if(sel===d)showInfo(d)}
window.react=react;


/* ---------- live data: ONE endpoint, contract = GET /admin/api/ops-hq ---------- */
const LIVE={url:window.OPS_HQ_URL||'/admin/api/ops-hq',on:false,since:null,seen:new Set(),order:[],first:true,quiet:true,more:0,ok:false,at:0,fails:0,timer:null,gen:null,stale:true};
const EVT={member_registered:'+1 member',job_added:'New jobs',quick_read_completed:'Article published',quick_read_failed:'Summary failed',pro_upgrade:'New Pro member',pro_renewal:'Pro renewed',referral_verified:'+1 referral',referral_eligible:'Reward eligible',email_delivered:'Email delivered',email_bounced:'Email bounced',health_warning:'Check system',health_recovered:'Back to normal',task_done:'Task done',task_created:'New task'};
const HLAB={healthy:'Healthy',warning:'Warning',critical:'Critical',unknown:'Unknown'};
function liveChip(){const c=document.querySelector('.demo');if(!c)return;
 if(!LIVE.on){c.textContent='Simulated demo data';c.style.color='';return}
 const age=LIVE.at?Math.round((Date.now()-LIVE.at)/1000):null;
 const bad=!LIVE.ok||LIVE.stale||(age!=null&&age>90);
 c.textContent=!LIVE.at?'Connecting to live data…':bad?'Live data stale · last update '+(age<120?age+'s':Math.round(age/60)+'m')+' ago':'Live · updated '+age+'s ago';c.style.color=bad?'#b3402a':'#2a7a4a'}
function applyMetrics(m){if(!m||typeof m!=='object')return false;const g=(a,b)=>m[a]&&m[a][b]!==undefined?m[a][b]:null;
 st.newM=g('intake','new_today');st.tot=g('intake','total');const gp=g('intake','growth_pct');st.grow=gp==null?null:(gp>=0?'+':'')+gp+'%';
 st.jobs=g('jobs','active');st.newJ=g('jobs','new_today');st.jp=g('jobs','processing');
 st.qd=g('reads','queued');st.qp=g('reads','running');st.qc=g('reads','ready_total');st.qf=g('reads','failed');
 st.pro=g('pro','active');st.upg=g('pro','upgrades_today');st.exp=g('pro','expiring_7d');
 st.ref=g('refer','verified_signups');st.rw=g('refer','eligible_conversions');st.hold=g('refer','on_hold');
 st.sent=g('comms','accepted_today');st.deliv=g('comms','delivered_today');st.supp=g('comms','suppressed_or_bounced_today');
 st.db=HLAB[g('health','database')]||'Unknown';st.edge=HLAB[g('health','edge')]||'Unknown';st.q=g('health','queue_depth');st.alerts=g('health','alerts');
 st.tasks=g('chief','open');st.done=g('chief','done');
 refreshCards();setNum($('nTot'),st.tot,true);setNum($('nJobs'),st.jobs,true);return true}
const GAP_MS=300000,OVERLAP_MS=120000,MAX_CATCHUP=40;
function applyPayload(j){if(!j||typeof j!=='object'||!applyMetrics(j.metrics))throw new Error('bad payload');
 const gap=LIVE.at>0&&Date.now()-LIVE.at>GAP_MS;           // long disconnection / sleeping tablet: do not replay the backlog as animations
 LIVE.stale=!!j.stale;LIVE.gen=j.generated_at;LIVE.at=Date.now();LIVE.ok=true;LIVE.fails=0;LIVE.incomplete=!!j.incomplete;
 const more=j.has_more===true;
 const ev=(Array.isArray(j.events)?j.events:[]).filter(e=>e&&e.event_id&&byId[e.desk]&&(e.kind==='good'||e.kind==='alert')).sort((a,b)=>(a.occurred_at<b.occurred_at?-1:a.occurred_at>b.occurred_at?1:(a.event_id<b.event_id?-1:1)));
 const fresh=ev.filter(e=>!LIVE.seen.has(e.event_id));      // ids, not timestamps, decide what is new, so equal timestamps are safe
 fresh.forEach(e=>{LIVE.seen.add(e.event_id);LIVE.order.push(e.event_id);if(e.occurred_at&&(!LIVE.since||e.occurred_at>LIVE.since))LIVE.since=e.occurred_at});
 while(LIVE.order.length>800)LIVE.seen.delete(LIVE.order.shift());
 LIVE.more=more?LIVE.more+1:0;                               // server says more events are waiting: poll again soon
 const quiet=LIVE.first||gap||LIVE.quiet;                   // first load, reconnect and the whole silent catch-up (including its last page): numbers only
 LIVE.quiet=more&&(LIVE.first||gap||LIVE.quiet);LIVE.first=false;
 if(quiet)return;
 const grp={};fresh.forEach(e=>{const k=e.desk+'|'+e.kind+'|'+e.type;(grp[k]=grp[k]||{e,n:0}).n+=Math.max(1,e.count|0)});
 Object.values(grp).slice(0,4).forEach((g,i)=>setTimeout(()=>{const lab=(EVT[g.e.type]||(g.e.kind==='alert'?'Check this':'New activity'))+(g.n>1?' ×'+g.n:'');react(g.e.desk,g.e.kind,{live:true,label:lab})},i*900))}
function sinceParam(){if(!LIVE.since)return'';const t=Date.parse(LIVE.since);return Number.isFinite(t)?'?since='+encodeURIComponent(new Date(t-(LIVE.more>0?0:OVERLAP_MS)).toISOString()):''}   // overlap catches late-committed rows (dedupe is by id); no overlap while paging, so paging always advances
async function livePoll(){if(!LIVE.on||document.hidden)return;
 try{const r=await fetch(LIVE.url+sinceParam(),{credentials:'include',cache:'no-store',headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error('http '+r.status);applyPayload(await r.json())}
 catch(e){LIVE.ok=false;LIVE.fails++;if(!LIVE.at)applyMetrics({})}
 liveChip();clearTimeout(LIVE.timer);if(LIVE.on)LIVE.timer=setTimeout(livePoll,LIVE.ok&&LIVE.more>0&&LIVE.more<MAX_CATCHUP?1500:Math.min(60000,15000*Math.pow(2,Math.min(LIVE.fails,2))))}
function setLive(on){LIVE.on=on;$('bLive').textContent='Live data: '+(on?'on':'off');$('bLive').setAttribute('aria-pressed',on);
 if(on){demo=false;$('bDemo').textContent='Demo mode: off';$('bDemo').setAttribute('aria-pressed',false);LIVE.first=true;LIVE.quiet=true;LIVE.more=0;LIVE.since=null;LIVE.seen.clear();LIVE.order=[];LIVE.at=0;applyMetrics({});liveChip();livePoll()}
 else{clearTimeout(LIVE.timer);Object.assign(st,JSON.parse(DEMO0));demo=true;$('bDemo').textContent='Demo mode: on';$('bDemo').setAttribute('aria-pressed',true);refreshCards();setNum($('nTot'),st.tot,true);setNum($('nJobs'),st.jobs,true);liveChip()}}
$('bLive').onclick=()=>setLive(!LIVE.on);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&LIVE.on)livePoll()});
setInterval(liveChip,5000);
window.opsHq={apply:applyPayload,state:LIVE,react,st,setLive,sinceParam};


/* ---------- display: fill the whole screen (tablet) ---------- */
const AR=1672/941;let viewMode='fill';try{viewMode=localStorage.getItem('opshq_view')||'fill'}catch(e){}
function layoutStage(){if(!document.body.classList.contains('kiosk'))return;const vw=innerWidth,vh=innerHeight;
 const w=viewMode==='fill'?Math.min(Math.max(vw,vh*AR),vw*1.08):Math.min(vw,vh*AR),h=w/AR;
 stage.style.width=w+'px';stage.style.height=h+'px';stage.style.left=(vw-w)/2+'px';stage.style.top=(vh-h)/2+'px'}
function setKiosk(on){document.body.classList.toggle('kiosk',on);if(on){document.body.style.setProperty('--bgurl','url('+$('bg').src+')');layoutStage()}else{stage.style.cssText='';document.body.classList.remove('panel')}}
function setView(m){viewMode=m;try{localStorage.setItem('opshq_view',m)}catch(e){}$('bView').textContent='View: '+(m==='fill'?'fill screen':'show whole scene');$('bView').setAttribute('aria-pressed',m!=='fill');layoutStage()}
addEventListener('resize',layoutStage);addEventListener('orientationchange',()=>setTimeout(layoutStage,200));
$('bView').onclick=()=>setView(viewMode==='fill'?'fit':'fill');
$('gear').onclick=()=>document.body.classList.toggle('panel');
$('bFull').onclick=()=>{const d=document.documentElement;try{if(document.fullscreenElement)document.exitFullscreen();else (d.requestFullscreen||d.webkitRequestFullscreen).call(d)}catch(e){}};
document.addEventListener('fullscreenchange',()=>{$('bFull').setAttribute('aria-pressed',!!document.fullscreenElement);setTimeout(layoutStage,100)});
setKiosk(true);setView(viewMode);

/* ---------- controls ---------- */
const selDesk=$('selDesk');D.forEach(d=>{const o=document.createElement('option');o.value=d.id;o.textContent=d.name;selDesk.appendChild(o)});
function showInfo(d){$('info').innerHTML='<b>'+d.name+'</b>'+(d.rows().length?' — '+d.rows().map(r=>r[0]+': '+r[1]).join(' · '):'')}
function select(d){sel=d;selDesk.value=d.id;showInfo(d)}
selDesk.onchange=()=>select(byId[selDesk.value]);
$('bGood').onclick=()=>react(selDesk.value,'good');$('bBad').onclick=()=>react(selDesk.value,'alert');
let night=false,nk=0;$('bNight').onclick=e=>{night=!night;e.currentTarget.setAttribute('aria-pressed',night);stage.classList.toggle('night',night)};
let demo=true,demoT=2;$('bDemo').onclick=e=>{if(LIVE.on)return;demo=!demo;e.currentTarget.textContent='Demo mode: '+(demo?'on':'off');e.currentTarget.setAttribute('aria-pressed',demo)};
if(window.OPS_HQ_URL||/[?&]live=1/.test(location.search)||location.pathname.indexOf('/admin/ops-hq')===0)setLive(true);
$('load').style.display='none';

/* ---------- loop ---------- */
let last=performance.now(),simT=0;
function frame(now){
 requestAnimationFrame(frame);
 if(document.hidden){last=now;return}
 const dt=Math.min(.05,(now-last)/1000);last=now;simT+=dt;const t=simT,amp=RM?0:1;
 for(let i=tws.length-1;i>=0;i--){const w=tws[i];w.t+=dt;const p=Math.min(1,w.t/w.dur);w.fn(p);if(p>=1){tws.splice(i,1);w.done&&w.done()}}
 if(demo&&!LIVE.on){demoT-=dt;if(demoT<=0){demoT=3.5+Math.random()*3.5;const d=D[Math.floor(Math.random()*D.length)];react(d.id,Math.random()<.12?'alert':'good')}}
 nk+=((night?1:0)-nk)*Math.min(1,dt*3);hemi.intensity=lerp(1.0,.5,nk);sun.intensity=lerp(.5,.15,nk);
 D.forEach((d,i)=>{if(!d.slot.visible||!d.body)return;const br=Math.sin(t*1.7+i)*amp;
  d.body.position.set(d.shake*S,0,0);d.body.rotation.set(0,d.yaw+d.tilt*.4,0);d.body.scale.set(S,S*(1+br*.005+d.hop*1.6),S)});
 glow.material.opacity=lerp(.3,.75,nk)+(amp?Math.sin(t*2.2)*.05:0)+girl.pulse*.3;
 steam.forEach(q=>{const k=amp?((t*.3+q.ph)%1):.3;q.s.position.set(steamBase.x+Math.sin(k*6+q.ph)*.008,steamBase.y+k*.09,steamBase.z);q.s.material.opacity=amp?Math.sin(k*Math.PI)*.35:0;const sc=.04+k*.06;q.s.scale.set(sc,sc,1)});
 faceTick(dt,t);
 D.forEach(d=>{const x=d.fx;if(!x)return;x.glow.material.opacity=lerp(.28,.7,nk)+(amp?Math.sin(t*2.1+1)*.05:0)+d.pulse*.3;if(x.sb)x.steam.forEach(q=>{const k=amp?((t*.3+q.ph)%1):.3;q.s.position.set(x.sb.x+Math.sin(k*6+q.ph)*.008,x.sb.y+k*.09,x.sb.z);q.s.material.opacity=amp?Math.sin(k*Math.PI)*.35:0;const sc=.04+k*.06;q.s.scale.set(sc,sc,1)})});
 renderer.render(scene,camera);
}
requestAnimationFrame(frame);
})();
