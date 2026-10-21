import {PDFDocument,StandardFonts,rgb,pushGraphicsState,popGraphicsState,moveTo,appendBezierCurve,closePath,clip,endPath} from './vendor/pdf-lib.esm.min.js';
import {labels} from './resume-tools.js';
export const designs={
 "classic": {
  "family": "serif",
  "name": 43,
  "rail": "left",
  "art": "portfolio",
  "color": "#004c3b",
  "paper": "#faf9f3",
  "photo": true,
  "heading": "caps",
  "gap": 22
 },
 "editorial": {
  "family": "serif",
  "name": 48,
  "rail": "left",
  "art": "editorial",
  "color": "#71392b",
  "paper": "#fff4e9",
  "photo": true,
  "heading": "caps",
  "gap": 22
 },
 "executive": {
  "family": "serif",
  "name": 43,
  "rail": "left",
  "art": "executive",
  "color": "#003e30",
  "paper": "#fffefd",
  "photo": true,
  "heading": "caps",
  "gap": 22
 },
 "modern": {
  "family": "serif",
  "name": 45,
  "rail": "left",
  "art": "geometric",
  "color": "#006667",
  "paper": "#fffdf7",
  "photo": true,
  "heading": "caps",
  "gap": 22
 },
 "minimalist": {
  "family": "serif",
  "name": 58,
  "rail": "left",
  "art": "luxury",
  "color": "#444b27",
  "paper": "#fcf8ed",
  "photo": true,
  "heading": "caps",
  "gap": 22
 },
 "creative": {
  "family": "serif",
  "name": 44,
  "rail": "left",
  "art": "flow",
  "color": "#64307d",
  "paper": "#fff8f7",
  "photo": true,
  "heading": "caps",
  "gap": 22
 },
 "tech": {
  "family": "serif",
  "name": 44,
  "rail": "left",
  "art": "tech",
  "color": "#073748",
  "paper": "#fcfcf9",
  "photo": true,
  "heading": "caps",
  "gap": 22
 },
 "corporate": {
  "family": "serif",
  "name": 43,
  "rail": "left",
  "art": "corporate",
  "color": "#063e70",
  "paper": "#ffffff",
  "photo": true,
  "heading": "caps",
  "gap": 22
 },
 "fresh": {
  "family": "serif",
  "name": 45,
  "rail": "left",
  "art": "graduate",
  "color": "#006442",
  "paper": "#fffff8",
  "photo": true,
  "heading": "caps",
  "gap": 22,
  "early": true
 },
 "bold": {
  "family": "sans",
  "name": 57,
  "rail": "left",
  "art": "statement",
  "color": "#181d1b",
  "paper": "#faf1e1",
  "photo": true,
  "heading": "caps",
  "gap": 22
 },
 "contemporary": {
  "family": "serif",
  "name": 43,
  "rail": "left",
  "art": "nature",
  "color": "#425631",
  "paper": "#faf5e8",
  "photo": true,
  "heading": "caps",
  "gap": 22
 },
 "signature": {
  "family": "serif",
  "name": 44,
  "rail": "left",
  "art": "signature",
  "color": "#25442c",
  "paper": "#fff6e8",
  "photo": true,
  "heading": "caps",
  "gap": 22
 }
};
const W=595.28,H=841.89,M=43,B=789,colors={forest:'#0F3D2E',ink:'#202d26',slate:'#334d70',plum:'#653e62'};
let resources;
async function fonts(){return resources??= (async()=>{const pdf=await PDFDocument.create();const names={sans:StandardFonts.Helvetica,sansBold:StandardFonts.HelveticaBold,serif:StandardFonts.TimesRoman,serifBold:StandardFonts.TimesRomanBold,mono:StandardFonts.Courier,monoBold:StandardFonts.CourierBold};const f={};for(const [k,v]of Object.entries(names))f[k]=await pdf.embedFont(v);return f;})();}
export function wrap(text,width,size,font){
 const result=[];
 for(const paragraph of text.replace(/\r\n?/g,'\n').split('\n')){
  if(!paragraph){result.push('');continue;}
  let line='';
  // Keep every character, including repeated spaces and explicit blank lines.
  for(const token of paragraph.match(/\S+\s*|\s+/g)||[]){
   if(font.widthOfTextAtSize(line+token,size)<=width){line+=token;continue;}
   if(line){result.push(line);line='';}
   for(const char of token){if(font.widthOfTextAtSize(line+char,size)>width&&line){result.push(line);line='';}line+=char;}
  }
  if(line)result.push(line);
 }
 return result;
}
export async function compose(d,style='classic',accent='forest',photo=null){
 const cfg=designs[style]||designs.classic,f=await fonts(),font=f[cfg.family],bold=f[cfg.family+'Bold'],a=accent==='forest'?(cfg.color||colors.forest):(colors[accent]||colors.forest),pages=[];
 // Validate before constructing any export, so unsupported scripts cannot be corrupted.
 try{for(const value of Object.values(d))font.encodeText(value.replace(/\r\n?|\n/g,''));}catch{throw Error('This PDF font supports Latin-script text only. Your text is preserved. Use Print / Save as PDF for other scripts; verify the saved file before sharing.');}
 const rect=(p,x,y,w,h,fill)=>p.push({kind:'rect',x,y,w,h,fill});
 const path=(p,d,fill)=>p.push({kind:'path',x:0,y:0,d,fill});
 const line=(p,x,y,w,fill=a,weight=1)=>rect(p,x,y,w,weight,fill);
 const text=(p,t,x,y,size=10,family=cfg.family,weight=false,fill='#263139')=>p.push({kind:'text',text:t,x,y,size,family,bold:weight,fill,advance:f[family+(weight?'Bold':'')].widthOfTextAtSize(t,size)});
 const art=cfg.art,muted='#687379',gold='#c6a571',paper=cfg.paper||'#ffffff';

 // Artwork is editable vector geometry, shared by preview and PDF.
 const sidebar=['portfolio','executive','tech'].includes(art),soft='#e9ddc6';
 function leaf(p,x,y,scale=1,fill='#a5ac7d',flip=1){
  const tx=v=>x+v*scale*flip,ty=v=>y+v*scale;
  path(p,'M '+tx(0)+' '+ty(95)+' C '+tx(-10)+' '+ty(45)+' '+tx(3)+' '+ty(10)+' '+tx(38)+' '+ty(0)+' C '+tx(48)+' '+ty(40)+' '+tx(28)+' '+ty(78)+' '+tx(0)+' '+ty(95)+' Z',fill);
  path(p,'M '+tx(0)+' '+ty(95)+' L '+tx(36)+' '+ty(5)+' L '+tx(2)+' '+ty(95)+' Z','#727b51');
  for(let j=1;j<5;j++){const yy=15+j*14;path(p,'M '+tx(34-yy*.31)+' '+ty(yy)+' L '+tx(6)+' '+ty(yy-9)+' L '+tx(32-yy*.31)+' '+ty(yy+1)+' Z','#c5c9a5');}
 }
 function botanical(p,x,y,scale=1){path(p,`M ${x+5*scale} ${y+235*scale} C ${x+16*scale} ${y+150*scale} ${x+7*scale} ${y+80*scale} ${x+14*scale} ${y+20*scale} L ${x+15*scale} ${y+20*scale} C ${x+8*scale} ${y+80*scale} ${x+17*scale} ${y+150*scale} ${x+6*scale} ${y+235*scale} Z`,'#7d865d');for(let i=0;i<5;i++)leaf(p,x+(i%2?32:-8)*scale,y+i*32*scale,(.7+i*.06)*scale,i%2?'#a2aa7b':'#c1c5a2',i%2?1:-1);}
 function circle(p,x,y,r,fill){const k=r*.55228475;path(p,`M ${x+r} ${y} C ${x+r} ${y+k} ${x+k} ${y+r} ${x} ${y+r} C ${x-k} ${y+r} ${x-r} ${y+k} ${x-r} ${y} C ${x-r} ${y-k} ${x-k} ${y-r} ${x} ${y-r} C ${x+k} ${y-r} ${x+r} ${y-k} ${x+r} ${y} Z`,fill);}
 function background(p,i){
  rect(p,0,0,W,H,paper);
  if(sidebar)rect(p,0,0,205,H,art==='tech'?'#071e30':a);
  if(art==='portfolio'){
   path(p,'M 0 0 L 205 0 C 253 88 171 167 203 265 C 226 345 151 406 205 490 L 205 842 L 0 842 Z',a);
   path(p,'M 0 0 L 47 0 C 35 112 111 181 53 249 L 0 280 Z','#386e55');
   path(p,'M 0 570 C 141 486 108 735 205 702 L 205 842 L 0 842 Z','#003729');
   path(p,'M 595 0 L 510 0 C 502 45 550 67 595 81 Z','#dce6d8');
   botanical(p,572,8,.36);
  }
  if(art==='editorial'){
   rect(p,0,i?0:280,195,i?H:H-280,'#f7dfd1');
   if(!i){rect(p,343,0,253,259,'#f6ad96');for(let j=0;j<17;j++)path(p,`M ${320+j*15} 0 L ${365+j*15} 0 L ${245+j*15} 230 L ${230+j*15} 225 Z`,j%3?'#f7b59f':'#e7836d');}
   path(p,'M 0 757 C 32 778 20 837 78 842 L 0 842 Z','#e99379');
   for(let j=0;j<7;j++)path(p,`M ${450+j*19} 842 L ${465+j*19} 801 L ${475+j*19} 811 L ${462+j*19} 842 Z`,'#dc7b65');
  }
  if(art==='executive'){
   rect(p,198,0,7,H,'#d4b269');
   botanical(p,568,12,.42);
   path(p,'M 0 635 C 98 552 162 732 198 680 L 198 842 L 0 842 Z','#003429');
  }
  if(art==='geometric'){
   if(!i){path(p,'M 180 0 L 595 0 L 595 246 L 350 246 Z',a);path(p,'M 450 0 L 595 0 L 595 247 L 327 247 Z','#003d46');path(p,'M 595 0 L 595 246 L 470 246 Z','#eea580');path(p,'M 180 0 L 298 0 L 385 121 L 348 159 Z','#008b88');}
   path(p,'M 0 0 L 72 0 L 0 76 Z','#e0ece3');path(p,'M 595 665 L 595 842 L 413 842 Z',a);path(p,'M 595 728 L 595 842 L 482 842 Z','#004d53');path(p,'M 0 814 L 28 842 L 0 842 Z','#efb091');
  }
  if(art==='luxury'){
   if(!i&&!photo)botanical(p,490,0,1.08);
   path(p,'M 0 759 C 30 802 12 831 68 842 L 0 842 Z','#eadfc7');
   rect(p,205,i?58:300,.65,i?715:481,'#d9cbaa');
  }
  if(art==='flow'){
   for(const [x,y,r,c]of [[0,35,72,'#ffc5b5'],[595,0,65,'#ffe29a'],[588,125,43,'#ddcff1'],[17,183,42,'#c4b7ef'],[577,266,67,'#ffb4a9'],[0,773,49,'#ffdc8b'],[590,832,61,'#f5c9de']])circle(p,x,y,r,c);
   rect(p,29,i?60:302,161,i?724:482,'#fbebef');
   for(let j=0;j<13;j++)path(p,`M 0 ${100+j*5} C 45 ${111+j*5} 6 ${196+j*3} 50 ${218+j*3} L 49 ${219+j*3} C 5 ${198+j*3} 44 ${112+j*5} 0 ${101+j*5} Z`,'#9da6de');
  }
  if(art==='tech'){
   if(!i){rect(p,205,0,391,255,'#061727');rect(p,28,27,190,195,'#184355');path(p,'M 209 215 L 230 194 L 230 221 L 195 256 L 171 256 Z','#00a780');}
   if(!i)for(let j=0;j<8;j++)path(p,`M 595 ${j*17} L ${553-j*8} ${j*17} L ${515-j*8} ${45+j*17} L ${486-j*8} ${45+j*17} L ${486-j*8} ${46+j*17} L ${516-j*8} ${46+j*17} L ${554-j*8} ${1+j*17} L 595 ${1+j*17} Z`,'#1a546c');
   path(p,'M 0 754 L 35 754 L 58 778 L 58 818 L 110 818 L 110 820 L 56 820 L 56 780 L 34 756 L 0 756 Z','#226477');
  }
  if(art==='corporate'){
   rect(p,0,0,205,H,a);if(!i)rect(p,205,0,391,276,'#ffffff');
   path(p,'M 514 0 L 595 0 L 595 81 Z','#d1ad61');path(p,'M 540 0 L 595 0 L 595 55 Z','#e5c98a');
   path(p,'M 595 632 L 546 684 L 595 736 Z','#d1ad61');
   if(!i){rect(p,0,228,W,47,'#fffefd');path(p,'M 0 228 L 38 266 L 0 303 Z','#d1ad61');}
  }
  if(art==='graduate'){
   path(p,'M 0 0 L 196 0 C 270 67 146 130 180 223 L 0 223 Z','#b7dfc7');
   path(p,'M 481 0 L 595 0 L 595 108 C 523 79 551 45 481 0 Z','#c4e293');
   path(p,'M 0 657 C 51 679 10 738 63 768 L 55 842 L 0 842 Z','#a7d79e');path(p,'M 595 647 C 518 693 589 747 537 790 L 551 842 L 595 842 Z','#ceeaa2');leaf(p,561,190,.48,'#98bd7c',-1);leaf(p,572,266,.55,'#b4cf88',-1);
  }
  if(art==='statement'){
   if(!i){rect(p,0,0,W,277,'#171e1c');rect(p,355,0,241,277,'#b9b9b1');}
   else rect(p,0,0,W,24,'#171e1c');
   rect(p,205,i?52:308,.65,i?732:476,'#d7c7a6');
  }
  if(art==='nature'){
   path(p,'M 0 0 L 100 0 C 109 65 29 103 50 195 L 0 224 Z','#bdc59c');
   if(!i){path(p,'M 238 0 C 300 77 221 140 267 218 L 286 218 C 230 141 328 77 265 0 Z','#e9d6b5');botanical(p,30,4,.73);botanical(p,565,101,.7);}
   path(p,'M 595 733 L 595 842 L 509 842 C 565 806 539 779 595 733 Z','#dce0c5');
  }
  if(art==='signature'){
   path(p,'M 0 710 C 115 833 164 745 294 809 C 435 885 499 779 595 814 L 595 842 L 0 842 Z','#153c2b');
   path(p,'M 0 704 C 115 827 164 739 294 803 C 435 879 499 773 595 808 L 595 812 C 499 777 435 883 294 807 C 164 743 115 831 0 708 Z','#c9a455');
   if(!i)path(p,'M 595 241 C 559 201 534 237 503 237 L 595 200 Z','#173f2b');
  }
 }
 const make=()=>{const cmds=[];background(cmds,pages.length);pages.push(cmds);return cmds;};let page=make();
 function footer(p,i){
  const fx=['portfolio','executive','tech','corporate'].includes(art)?220:M;
  line(p,fx,810,W-M-fx,art==='signature'?'#c6a571':'#d1d6d5',.5);
  text(p,String(i+1).padStart(2,'0'),W-M-15,821,8,'sans',true,['signature','geometric'].includes(art)?'#ffffff':muted);
 }
 let headEnd;

 let railStart=300,mainStart=300;
 function portrait(x,y,size,back=paper,round=true){
  if(!photo)return;
  if(round){const frame={editorial:'#fff4e9',geometric:'#e9b28b',luxury:gold,statement:'#e6cf9f'}[art]||(art==='executive'||art==='signature'?gold:'#d6dfcb');circle(page,x+size/2,y+size/2,size/2+4,frame);}
  page.push({kind:'image',x,y,w:size,h:size,src:photo,round});
 }
 function header(){
  const settings={portfolio:[234,44,319,257,254],editorial:[35,42,302,305,305],executive:[239,47,314,240,241],geometric:[38,45,269,291,291],luxury:[35,41,348,309,310],flow:[279,52,278,302,302],tech:[280,44,279,288,288],corporate:[241,49,314,300,300],graduate:[248,43,302,277,277],statement:[35,38,309,305,305],nature:[263,43,284,282,282],signature:[240,40,307,263,277]}[art];
  let [x,y,width,ms,rs]=settings,fill=art==='tech'||art==='statement'?'#ffffff':a;
  if(art==='portfolio')portrait(27,26,160,a);
  if(art==='editorial')portrait(369,31,196,'#f6ad96');
  if(art==='executive')portrait(34,35,136,a);
  if(art==='geometric')portrait(365,29,195,'#003d46');
  if(art==='luxury')portrait(405,35,153,paper);
  if(art==='flow')portrait(43,42,174,'#f9e5ed');
  if(art==='tech')portrait(35,35,176,'#184355',false);
  if(art==='corporate')portrait(29,32,147,a);
  if(art==='graduate')portrait(22,29,176,'#b7dfc7');
  if(art==='statement')portrait(365,27,215,'#b9b9b1');
  if(art==='nature')portrait(39,43,173,paper);
  if(art==='signature')portrait(35,37,161,paper);
  let size=cfg.name;if((d.name||'').length>28)size-=9; if(art==='statement')for(const word of (d.name||'Your name').toUpperCase().split(/\s+/))size=Math.min(size,309/f.sansBold.widthOfTextAtSize(word,1));
  const name=d.name||'Your name';
  const words=name.trim().split(/\s+/),display=words.length>1?words.slice(0,-1).join(' ')+'\n'+words.at(-1):name;
  for(const t of wrap(art==='statement'?display.toUpperCase():display,width,size,art==='statement'?f.sansBold:font)){text(page,t,x,y,size,cfg.family,art==='statement',fill);y+=size*.98;}
  y+=18;
  if(d.headline){for(const t of wrap(d.headline.toUpperCase(),width,10,f.sansBold)){text(page,t,x,y,10,'sans',true,art==='statement'?'#edc778':fill);y+=15;}y+=10;}
  const contactInRail=!['flow','corporate','nature','signature'].includes(art);
  if(!contactInRail&&art!=='corporate'&&d.contact){y+=3;for(const t of wrap(d.contact,width,8.5,f.sans)){text(page,t,x,y,8.5,'sans',false,fill);y+=13;}y+=6;}
  if(art==='corporate'&&d.contact){let cy=237;for(const t of wrap(d.contact,530,8,f.sans)){text(page,t,38,cy,8,'sans',false,'#073748');cy+=12;}ms=Math.max(ms,cy+24);rs=Math.max(rs,cy+25);const band=page.find(c=>c.kind==='rect'&&c.y===228&&c.w===W);if(band)band.h=Math.max(47,cy+8-228);}
  // Contact stays separate from the name, and may paginate without losing text.
  mainStart=Math.max(ms,y+27);railStart=rs;
  if(contactInRail&&d.contact){
   let cy=art==='portfolio'?215:art==='executive'?207:art==='tech'?287:rs;
   const cf=sidebar?'#ffffff':'#303b32';
   const contactRows=wrap(d.contact,147,8.2,f.sans);
   if(cy+contactRows.length*13>730)throw Error('Contact details fill the sidebar. Shorten the header before exporting; your text is preserved.');
   for(const t of contactRows){text(page,t,31,cy,8.2,'sans',false,cf);cy+=13;}
   railStart=Math.max(rs,cy+27);
  }
  if(art==='tech'||art==='statement'){
   // Long names grow the dark header before flowing the document body.
   if(y>245){const bottom=y+15;page.splice(2,0,{kind:'rect',x:205,y:0,w:W-205,h:bottom,fill:art==='tech'?'#061727':'#171e1c'});mainStart=Math.max(mainStart,bottom+25);}
  }
  headEnd=mainStart;
 }

 header();
 // A header can be long, but bounds remain explicit and no content is discarded.
 if(headEnd>B-65)throw Error('Name and contact details fill the first page. Shorten the header before exporting; your text is preserved.');
 const bodyBottom=art==='signature'?727:B;
 const order=cfg.early?['summary','education','projects','experience','skills']:cfg.skillsFirst?['summary','skills','experience','projects','education']:['summary','experience','education','skills','projects'];
 const railKeys=cfg.rail?['skills']:[];
 const mainKeys=order.filter(k=>!railKeys.includes(k));
 function flow(keys,x,width,start,rail=false){let index=0,y=start,p=pages[0];const railDark=rail&&['portfolio','executive','tech','corporate'].includes(art),bodyFill=railDark?'#ffffff':'#263139',sectionFill=railDark?'#edc788':a;const labelRows=cfg.heading==='label'&&!rail,iconRail=rail&&['executive','corporate'].includes(art),contentX=x+(labelRows?125:iconRail?20:0),contentWidth=width-(labelRows?125:iconRail?20:0);
  function next(){index++;p=pages[index]||make();y=65;}
  function heading(key,continued=false){
   const title=labels[key]+(continued?' (continued)':'');
   const quiet=cfg.heading==='quiet',size=quiet?13:rail||cfg.heading==='label'?9:10;
   const number=String(order.indexOf(key)+1).padStart(2,'0');
   const inset=cfg.heading==='number'?34:cfg.heading==='bar'?7:0;
   const titleFont=cfg.heading==='number'?f.sansBold:bold;
   const actualSize=cfg.heading==='number'?9:size;
   const titleText=cfg.heading==='code'?'/ '+title.toUpperCase():quiet||cfg.heading==='panel'?title:title.toUpperCase();
   const rows=wrap(titleText,(labelRows?99:width)-inset-(cfg.heading==='bar'?7:0),actualSize,f.sansBold),height=rows.length*(actualSize+4)+14;
   if(y+height+32>bodyBottom)next();const headingTop=y;
   if(cfg.heading==='bar')rect(p,x,y-4,width,height-9,a);
   if(cfg.heading==='panel')rect(p,x-8,y-7,width+16,height,'#edf4ef');
   if(cfg.heading==='number')text(p,number,x,y-3,20,'serif',false,sectionFill);
   rows.forEach((row,i)=>text(p,row,x+inset,y+i*(actualSize+4),actualSize,'sans',true,cfg.heading==='bar'?'#ffffff':sectionFill));
   if(['rule','number','label','code'].includes(cfg.heading))line(p,x,y+height-10,cfg.heading==='label'?45:width,a,cfg.heading==='label'?2:.6);
   y+=height;return {top:headingTop,bottom:y};
  }
  for(const key of keys)if(d[key]?.trim()){
   let label=heading(key);if(labelRows)y=label.top;
   const denseSkills=rail&&key==='skills'&&d[key].length>500;const size=rail?(denseSkills?8:9):10,leading=rail?(iconRail&&!denseSkills?24:16):15.5;
   const lines=wrap(d[key],contentWidth,size,['experience','projects','education'].includes(key)?f.sansBold:f.sans);
   for(let i=0;i<lines.length;i++){
    const startsEntry=['experience','education','projects'].includes(key)&&lines[i]&&(i===0||!lines[i-1]);
    const keepLines=startsEntry?Math.min(3,lines.length-i):i+1<lines.length&&lines[i+1]&&(i+2===lines.length||!lines[i+2])?2:1;
    if(y+leading*keepLines>bodyBottom){next();label=heading(key,true);if(labelRows)y=label.top;}
    // Blank lines are retained as paragraph space, never swallowed at page boundaries.
    if(rail&&key==='skills'&&lines[i]&&art!=='tech'&&!iconRail){const dark=railDark;const pillW=Math.min(contentWidth+10,f.sans.widthOfTextAtSize(lines[i],size)+12);const px=contentX-5,py=y-2,ph=leading-1,pr=ph/2;path(p,`M ${px+pr} ${py} L ${px+pillW-pr} ${py} Q ${px+pillW} ${py} ${px+pillW} ${py+pr} Q ${px+pillW} ${py+ph} ${px+pillW-pr} ${py+ph} L ${px+pr} ${py+ph} Q ${px} ${py+ph} ${px} ${py+pr} Q ${px} ${py} ${px+pr} ${py} Z`,dark?'#dce8d8':art==='flow'?'#f0d7e7':'#e8e1cb');}
    if(iconRail&&lines[i]){circle(p,x+5,y+5,7,gold);circle(p,x+5,y+5,6,a);rect(p,x+2,y+2,6,6,gold);rect(p,x+3,y+3,4,4,a);}
    if(art==='tech'&&key==='skills'&&lines[i]){rect(p,contentX-5,y-2,contentWidth+10,leading-1,'#24445e');rect(p,contentX-5,y-2,2,leading-1,'#67d4d2');}
    if(art==='flow'&&key==='experience'){rect(p,contentX-8,y,1,leading,'#c6d7cc');if(i===0||!lines[i-1])rect(p,contentX-10,y+3,5,5,a);}
    text(p,lines[i],contentX,y,size,'sans',['experience','projects','education'].includes(key)&&(i===0||!lines[i-1]),rail&&key==='skills'&&art!=='tech'&&!iconRail?'#1d3d30':bodyFill);y+=leading;
   }
   y=Math.max(y,labelRows?label.bottom:0)+cfg.gap;
  }
 }

 const mainX=art==='editorial'||art==='geometric'||art==='luxury'||art==='flow'||art==='statement'||art==='nature'||art==='signature'||art==='graduate'?228:239;
 // Main text and skills continue independently on A4 pages; artwork reserves both columns.
 flow(mainKeys,mainX,552-mainX,mainStart);
 flow(railKeys,33,144,railStart,true);
 pages.forEach(footer);return {pages,style,accent,width:W,height:H};
}
const families={sans:'Arial, Helvetica, sans-serif',serif:'"Times New Roman", Times, serif',mono:'"Courier New", monospace'};
export function showPages(root,plan){
 root.replaceChildren();root.classList.add('paginated-resume');root.dataset.style=plan.style;
 const ns='http://www.w3.org/2000/svg',doc=root.ownerDocument;
 for(const [i,commands]of plan.pages.entries()){
  const page=doc.createElement('div');page.className='resume-page';page.setAttribute('aria-label',`Page ${i+1} of ${plan.pages.length}`);
  const svg=doc.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('width',String(W));svg.setAttribute('height',String(H));
  for(const c of commands){const el=doc.createElementNS(ns,c.kind==='text'?'text':c.kind==='image'?'image':c.kind==='path'?'path':'rect');
   for(const [k,v]of Object.entries(c.kind==='text'?{x:c.x,y:c.y+c.size*.83,fill:c.fill,'font-size':c.size,'font-family':families[c.family],'font-weight':c.bold?'bold':'normal','xml:space':'preserve',...(c.text?{textLength:c.advance,lengthAdjust:'spacingAndGlyphs'}:{})}:c.kind==='image'?{x:c.x,y:c.y,width:c.w,height:c.h,href:c.src}:c.kind==='path'?{d:c.d,fill:c.fill}:{x:c.x,y:c.y,width:c.w,height:c.h,fill:c.fill}))el.setAttribute(k,String(v));
   if(c.kind==='image'&&c.round){const clipId='portrait-'+i+'-'+commands.indexOf(c),cp=doc.createElementNS(ns,'clipPath'),shape=doc.createElementNS(ns,'circle');cp.setAttribute('id',clipId);shape.setAttribute('cx',c.x+c.w/2);shape.setAttribute('cy',c.y+c.h/2);shape.setAttribute('r',c.w/2);cp.append(shape);svg.append(cp);el.setAttribute('clip-path','url(#'+clipId+')');}
   if(c.kind==='text')el.textContent=c.text;svg.append(el);
  }
  page.append(svg);root.append(page);
 }
}
function color(hex){return rgb(...hex.match(/[0-9a-f]{2}/gi).map(x=>parseInt(x,16)/255));}
export async function pdfBytes(plan){
 const pdf=await PDFDocument.create(),cache={};pdf.setTitle('Résumé');pdf.setCreator('Résumé document');
 const names={sans:StandardFonts.Helvetica,sansBold:StandardFonts.HelveticaBold,serif:StandardFonts.TimesRoman,serifBold:StandardFonts.TimesRomanBold,mono:StandardFonts.Courier,monoBold:StandardFonts.CourierBold};
 for(const [k,v]of Object.entries(names))cache[k]=await pdf.embedFont(v);
 const imageCache=new Map();
 for(const commands of plan.pages){const page=pdf.addPage([W,H]);for(const c of commands){
  if(c.kind==='text')page.drawText(c.text,{x:c.x,y:H-c.y-c.size*.83,size:c.size,font:cache[c.family+(c.bold?'Bold':'')],color:color(c.fill)});
  else if(c.kind==='path')page.drawSvgPath(c.d,{x:0,y:H,color:color(c.fill)});
  else if(c.kind==='rect')page.drawRectangle({x:c.x,y:H-c.y-c.h,width:c.w,height:c.h,color:color(c.fill)});
  else{if(!imageCache.has(c.src))imageCache.set(c.src,await pdf.embedJpg(c.src));if(c.round){const r=c.w/2,k=r*.55228475,x=c.x+r,y=H-c.y-r;page.pushOperators(pushGraphicsState(),moveTo(x+r,y),appendBezierCurve(x+r,y+k,x+k,y+r,x,y+r),appendBezierCurve(x-k,y+r,x-r,y+k,x-r,y),appendBezierCurve(x-r,y-k,x-k,y-r,x,y-r),appendBezierCurve(x+k,y-r,x+r,y-k,x+r,y),closePath(),clip(),endPath());}
   page.drawImage(imageCache.get(c.src),{x:c.x,y:H-c.y-c.h,width:c.w,height:c.h});if(c.round)page.pushOperators(popGraphicsState());}
 }}return pdf.save();
}

