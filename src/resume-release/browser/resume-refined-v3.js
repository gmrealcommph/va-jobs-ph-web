export const refinedIds=new Set(['classic','editorial','executive','modern','minimalist','creative','tech','corporate','fresh','bold','contemporary','signature']);
export function composeRefined(d,style,accent,photo,f,wrap){
 const W=595.28,H=841.89,B=787;
 const modern=style==='classic',creative=style==='editorial',executive=style==='executive';
 const defaults={classic:'#455c53',editorial:'#237970',executive:'#303833',modern:'#17656a',minimalist:'#514a3e',creative:'#6c4777',tech:'#193c54',corporate:'#163e67',fresh:'#286649',bold:'#252927',contemporary:'#65734c',signature:'#233347'};
 const a=accent==='forest'?defaults[style]:({ink:'#29342e',slate:'#365775',plum:'#674c65'}[accent]||defaults[style]),ink='#29342f',muted='#607069';
 const other=!modern&&!creative&&!executive,labelsLayout=style==='contemporary';
 for(const value of Object.values(d))try{f.sans.encodeText(String(value||'').replace(/\r\n?|\n/g,''));}catch{throw Error('This PDF font supports Latin-script text only. Your text is preserved. Use Print / Save as PDF for other scripts.');}
 const pages=[[]],pageLayouts=[{}],bands=[];
 const leading=14.7,body=11;
 const rect=(p,x,y,w,h,fill)=>p.push({kind:'rect',x,y,w,h,fill});
 const text=(p,t,x,y,size=body,bold=false,fill=ink,family='sans',region='main',extra={})=>{
  const c={kind:'text',text:t,x,y,size,bold,fill,family,region,advance:f[family+(bold?'Bold':'')].widthOfTextAtSize(t,size),...extra};p.push(c);return c;
 };
 function getPage(index){while(pages.length<=index){pages.push([]);pageLayouts.push({});}return pages[index];}
 function write(p,value,x,y,width,size=body,bold=false,fill=ink,family='sans',region='main'){
  value=String(value||'');const lh=size===body?leading:size*1.32;
  for(const row of wrap(value,width,size,f[family+(bold?'Bold':'')])){text(p,row,x,y,size,bold,fill,family,region,{lineHeight:lh,maxWidth:width});y+=lh;}return y;
 }
 let railBottom=0,skillRemainder='';
 if(creative&&(d.contact?.trim()||d.skills?.trim())){
  const p=pages[0],sx=24,sw=132;let sy=34;
  if(d.contact){text(p,'CONTACT',sx,sy,9,true,a,'sans','rail');sy+=24;
   for(const item of d.contact.split(/\s·\s|\n/)){sy=write(p,item,sx,sy,sw,9.5,false,ink,'sans','rail')+5;}sy+=15;
  }
  if(d.skills){text(p,'SKILLS & TOOLS',sx,sy,9,true,a,'sans','rail');sy+=25;
   const source=d.skills.replace(/\r\n?/g,'\n').split('\n');let used=0;
   for(let i=0;i<source.length;i++){
    const row=source[i],rr=wrap(row,sw,10.5,f.sans),height=row?rr.length*14+5:7;
    if(sy+height>460){used=i;break;}
    if(row)for(const t of rr){text(p,t,sx,sy,10.5,row==='Tools',ink,'sans','rail',{lineHeight:14,maxWidth:sw});sy+=14;}
    sy+=row?5:7;used=i+1;
   }
   skillRemainder=source.slice(used).join('\n').trim();
  }
  railBottom=sy+17;pageLayouts[0].railBottom=railBottom;
 }
 function bounds(index,cy,key=''){
  if(creative&&pageLayouts[index]?.railBottom&&cy<pageLayouts[index].railBottom+17)return {x:203,w:363.28,region:'top-main'};
  return labelsLayout?{x:143,w:409.28,region:'main'}:{x:43,w:509.28,region:'main'};
 }
 let p=pages[0],y=34;
 if(other){
  y=otherHeader(p);
  if(style==='tech'){p.find(c=>c.kind==='rect'&&c.fill==='#102f43').h=y-25;const rule=p.find(c=>c.kind==='rect'&&c.fill==='#62bdad');rule.y=y-41;}
  if(style==='modern')for(const c of p)if(c.kind==='rect'&&(c.w===18||c.fill==='#e7f0ed'))c.h=y-24;
 }else if(executive){
  const initials=(d.name||'Your name').trim().split(/\s+/).map(v=>v[0]).slice(0,2).join('');
  if(photo)p.push({kind:'image',x:43,y:37,w:64,h:64,src:photo,round:false,region:'portrait'});else text(p,initials,43,37,44,false,'#263029','serif','monogram');
  y=write(p,d.name||'Your name',132,36,420,33,false,'#263029','serif','header')+6;
  y=write(p,d.headline||'',132,y,420,9.5,true,a,'sans','header')+8;
  y=write(p,d.contact||'',132,y,420,9.5,false,muted,'sans','header')+13;
  rect(p,43,y,509,.65,'#87958d');y+=25;
 }else if(modern){
  rect(p,0,0,W,128,'#333e39');rect(p,0,128,W,4,'#afc1b5');if(photo)p.push({kind:'image',x:488,y:29,w:64,h:64,src:photo,round:false,region:'portrait'});
  y=write(p,d.name||'Your name',43,29,photo?427:509,31,true,'#ffffff','sans','header')+7;
  y=write(p,d.headline||'',43,y,photo?427:509,10.5,true,'#dbe8df','sans','header')+8;
  const ch=write(p,d.contact||'',43,y,509,9.5,false,'#f0f5ef','sans','header');y=Math.max(154,ch+28);const bg=p.find(c=>c.kind==='rect'&&c.fill==='#333e39');bg.h=y-26;const rule=p.find(c=>c.fill==='#afc1b5');rule.y=y-26;
 }else{
  const {x,w}=bounds(0,0);if(photo)p.push({kind:'image',x:503,y:40,w:56,h:56,src:photo,round:false,region:'portrait'});rect(p,x,34,28,3,'#ef927d');
  y=write(p,d.name||'Your name',x,49,photo?w-70:w,29,true,a,'sans','header')+7;
  y=write(p,d.headline||'',x,y,photo?w-70:w,10.5,true,muted,'sans','header')+10;
  rect(p,x,y,w,.65,'#c6ded5');y+=24;
 }
 const titles={summary:style==='tech'?'PROFILE':modern?'PROFILE':'PROFILE',experience:modern?'EXPERIENCE':'PROFESSIONAL EXPERIENCE',skills:'SKILLS & TOOLS',education:'EDUCATION & CERTIFICATIONS',projects:'SELECTED PROJECTS'};
 function flow(keys,start,index=0,fixed=null,overrides={}){
  let cy=start,pi=index,page=getPage(pi),current='',jobBox=null;
  function box(){return fixed?{...fixed,region:fixed.region}:jobBox?.page===pi?jobBox:bounds(pi,cy,current);}
  function next(){pi++;page=getPage(pi);cy=72;}
  function heading(key,cont=false){
   if(cy+60>B)next();const b=box();
   const title=(titles[key]||key)+(cont?' / CONTINUED':'');
   if(other){
    otherHeading(page,key,title,b,cy);const rr=wrap(title,labelsLayout?83:b.w,style==='bold'?14:10,style==='tech'?f.monoBold:f.sansBold);cy+=labelsLayout?4:Math.max(style==='bold'?35:29,rr.length*13+15);
   }else if(modern){
    const rr=wrap(title,b.w-14,9.5,f.sansBold),height=rr.length*12+15;
    rect(page,b.x-6,cy-6,b.w+12,height,'#e9f0eb');
    for(const t of rr){text(page,t,b.x+1,cy,9.5,true,a,'sans',b.region);cy+=12;}cy+=16;
   }else if(executive){
    const rr=wrap(title,b.w,10.5,f.serif);
    for(const t of rr){text(page,t,b.x,cy,10.5,false,a,'serif',b.region);cy+=13;}
    rect(page,b.x,cy+2,b.w,.4,'#c8d1ca');cy+=17;
   }else{
    const rr=wrap(title,b.w,9.5,f.sansBold);
    for(const t of rr){text(page,t,b.x,cy,9.5,true,a,'sans',b.region);cy+=12;}
    rect(page,b.x,cy+3,25,2,'#ee9b87');cy+=19;
   }
  }
  function paragraph(value,{bold=false,size=body,fill=ink,bullet=false,keep=false}={}){
   let b=box(),indent=bullet?11:0,rr=wrap(value,b.w-indent,size,f[bold?'sansBold':'sans']),lh=size===body?leading:size*1.32;
   const need=rr.length*lh+4;
   if(need<150&&cy+need>B||keep&&cy+Math.min(4,rr.length+2)*lh>B){next();heading(current,true);b=box();rr=wrap(value,b.w-indent,size,f[bold?'sansBold':'sans']);}
   for(let n=0;n<rr.length;n++){
    if(cy+lh>B){const tail=rr.slice(n).join('');next();heading(current,true);b=box();rr=wrap(tail,b.w-indent,size,f[bold?'sansBold':'sans']);n=0;}
    text(page,rr[n],b.x+(bullet?11:0),cy,size,bold,fill,'sans',b.region,{lineHeight:lh,maxWidth:b.w-indent});
    cy+=lh;
   }
   cy+=bold?4:executive?2:3;
  }
  for(const key of keys){const raw=(overrides[key]??d[key])?.trim();if(!raw)continue;current=key;heading(key);let first=true;
   const source=(key==='skills'&&!creative?raw.split('\n\n').map(s=>s.replace(/\n/g,' · ')).join('\n\n'):raw).split('\n');let certificates=false;
   for(let j=0;j<source.length;j++){
    const line=source[j];if(!line.trim()){cy+=key==='experience'?10:6;first=true;jobBox=null;continue;}
    const job=key==='experience'&&first&&line.match(/^(.+?)\s+\|\s+(.+?)\s+\|\s+((?:19|20)\d{2}.*)$/);
    if(job){
     if(cy+85>B){next();heading(key,true);}
     if(style==='signature'){
      const b=box(),ds=9.5,dw=f.sans.widthOfTextAtSize(job[3],ds);
      cy=write(page,job[1],b.x,cy,b.w,12.5,true,ink,'serif',b.region)+4;
      const companyRows=wrap(job[2],b.w-dw-18,10.5,f.sansBold);
      for(let k=0;k<companyRows.length;k++){
       text(page,companyRows[k],b.x,cy,10.5,true,a,'sans',b.region,{lineHeight:14,maxWidth:b.w-dw-18,keepNext:true});
       if(k===0)text(page,job[3],b.x+b.w-dw,cy+.83,ds,false,muted,'sans',b.region,{alignedDate:true,alignWithY:cy});
       cy+=14;
      }
      cy+=4;first=false;continue;
     }
     const b=box(),roleSize=modern?12.5:12,ds=9.5,dw=f.sans.widthOfTextAtSize(job[3],ds),roleW=b.w-dw-18;
     if(creative)jobBox={...b,page:pi};
     if(roleW<b.w*.45){paragraph(line,{bold:true,keep:true});first=false;continue;}
     const rr=wrap(job[1],roleW,roleSize,f.sansBold),lh=roleSize*1.32;
     const inlineCompany=executive&&rr.length===1&&f.sansBold.widthOfTextAtSize(job[1],roleSize)+f.sans.widthOfTextAtSize(' / '+job[2],10.5)<roleW;
     if(modern)rect(page,b.x-10,cy-1,2,rr.length*lh+20,'#a7bcad');
     for(let k=0;k<rr.length;k++){text(page,rr[k],b.x,cy,roleSize,true,ink,'sans',b.region,{lineHeight:lh,maxWidth:roleW,keepNext:true});
      if(k===0){if(inlineCompany)text(page,' / '+job[2],b.x+f.sansBold.widthOfTextAtSize(job[1],roleSize)+4,cy+(roleSize-10.5)*.83,10.5,false,muted,'sans',b.region);if(modern)rect(page,b.x+b.w-dw-6,cy-2,dw+11,16,'#edf2ed');text(page,job[3],b.x+b.w-dw,cy+(roleSize-ds)*.83,ds,false,muted,'sans',b.region,{alignedDate:true,alignWithY:cy});}cy+=lh;
     }
     if(inlineCompany)cy+=6;
     else{cy+=3;text(page,job[2],b.x,cy,10.5,modern,muted,'sans',b.region,{lineHeight:14,maxWidth:b.w,keepNext:true});cy+=18;}first=false;continue;
    }
    const bullet=line.match(/^\s*([•*\-])\s+(.+)$/);
    if(bullet){
     let b=box(),rr=wrap(bullet[2],b.w-11,body,f.sans),firstBullet=true;const need=rr.length*leading+4;
     if(need<150&&cy+need>B){next();heading(key,true);b=box();rr=wrap(bullet[2],b.w-11,body,f.sans);}
     for(let k=0;k<rr.length;k++){
      if(cy+leading>B){const tail=rr.slice(k).join('');next();heading(key,true);b=box();rr=wrap(tail,b.w-11,body,f.sans);k=0;}
      text(page,(firstBullet?bullet[1]+' ':'')+rr[k],b.x+(firstBullet?0:11),cy,body,false,ink,'sans',b.region,{lineHeight:leading,maxWidth:b.w-(firstBullet?0:11),hanging:firstBullet?11:0});firstBullet=false;cy+=leading;
     }
     cy+=4;first=false;continue;
    }
    if(key==='education'&&certificates&&first&&source[j+1]?.trim()){
     const b=box(),titleW=f.sansBold.widthOfTextAtSize(line,11),issuer=' / '+source[j+1];
     if(titleW+10+f.sans.widthOfTextAtSize(issuer,10)<b.w){
      if(cy+35>B){next();heading(key,true);}
      text(page,line,b.x,cy,11,true,ink,'sans',b.region);text(page,issuer,b.x+titleW+6,cy+.83,10,false,muted,'sans',b.region);cy+=23;j++;first=false;continue;
     }
    }
    const isTitle=first&&key!=='summary'&&key!=='skills';
    // A location line is secondary to the role and employer, never promoted to a heading.
    const isLocation=key==='experience'&&j>0&&source[j-1].includes(' | ');
    paragraph(line,{bold:isTitle,size:isLocation?10.5:body,fill:isLocation?muted:ink,keep:isTitle});if(key==='education'&&line==='Certifications'){certificates=true;first=true;}else first=false;
   }
   cy+=executive?10:12;
  }
  return {index:pi,y:cy};
 }

 function otherHeader(p){
  const name=d.name||'Your name',headline=d.headline||'',contact=d.contact||'',photoW=photo?76:0;
  const paintPhoto=(x,y,w=64)=>{if(photo)p.push({kind:'image',x,y,w,h:w,src:photo,round:false,region:'portrait'});};
  let hy=35;
  if(style==='tech'){
   rect(p,0,0,W,128,'#102f43');rect(p,43,112,509,2,'#62bdad');
   hy=write(p,name,43,28,509-photoW,29,true,'#ffffff','mono','header')+5;
   hy=write(p,headline,43,hy,509-photoW,10,true,'#8bd3c4','mono','header')+8;
   hy=write(p,contact,43,hy,509-photoW,9.5,false,'#ffffff','sans','header');paintPhoto(488,29);return Math.max(153,hy+25);
  }
  if(style==='modern'){
   rect(p,0,0,18,137,a);rect(p,18,0,577,137,'#e7f0ed');rect(p,480,0,115,9,'#dcaa8e');
   hy=write(p,name,43,30,509-photoW,32,true,a,'sans','header')+5;
   hy=write(p,headline,43,hy,509-photoW,10.5,true,a,'sans','header')+9;
   hy=write(p,contact,43,hy,509-photoW,9.5,false,muted,'sans','header');paintPhoto(488,30);return Math.max(161,hy+25);
  }
  if(style==='minimalist'){
   const ns=36,rr=wrap(name,509-photoW,ns,f.serif);for(const row of rr){const w=f.serif.widthOfTextAtSize(row,ns);text(p,row,43+(509-photoW-w)/2,hy,ns,false,a,'serif','header');hy+=ns*1.23;}
   for(const [v,size,bold]of [[headline,10,true],[contact,9.5,false]]){for(const row of wrap(v,509-photoW,size,f[bold?'sansBold':'sans'])){const w=f[bold?'sansBold':'sans'].widthOfTextAtSize(row,size);text(p,row,43+(509-photoW-w)/2,hy,size,bold,muted,'sans','header');hy+=size*1.4;}hy+=8;}
   rect(p,235,hy,125,.55,'#b7ad98');paintPhoto(488,30);return hy+27;
  }
  if(style==='corporate'){
   rect(p,0,0,W,9,a);rect(p,43,32,3,67,'#ba9c5e');
   const nx=photo?130:59;hy=write(p,name,nx,31,552-nx,31,true,a,'sans','header')+6;
   hy=write(p,contact,nx,hy,552-nx,9.5,false,muted,'sans','header')+14;
   const rr=wrap(headline,493,10.5,f.sansBold),height=rr.length*14+15;rect(p,43,hy-5,509,height,a);
   for(const row of rr){text(p,row,51,hy,10.5,true,'#ffffff','sans','header');hy+=14;}paintPhoto(52,34);return hy+28;
  }
  if(style==='bold'){
   const ns=name.length>28?39:48;hy=write(p,name,43,28,509-photoW,ns,true,'#252927','sans','header')+7;
   rect(p,43,hy,60,5,'#e2b851');hy+=22;hy=write(p,headline,43,hy,509-photoW,12,true,a,'sans','header')+8;
   hy=write(p,contact,43,hy,509,9.5,false,muted,'sans','header');paintPhoto(480,35,72);return hy+27;
  }
  if(style==='signature'){
   rect(p,43,28,461,2.5,a);rect(p,504,28,48,2.5,'#b79a61');
   hy=write(p,name,43,46,509-photoW,29,true,a,'serif','header')+8;
   hy=write(p,headline,43,hy,509-photoW,10.5,true,a,'sans','header')+10;
   hy=write(p,contact,43,hy,509,9.5,false,muted,'sans','header')+13;
   rect(p,43,hy,509,.5,'#cbd1d8');paintPhoto(488,45);return hy+27;
  }
  if(style==='fresh'){
   rect(p,0,0,W,7,'#a9d3b3');hy=write(p,name,43,33,509-photoW,32,true,a,'sans','header')+8;
   hy=write(p,headline,43,hy,509-photoW,11,true,a,'sans','header')+10;hy=write(p,contact,43,hy,509,9.5,false,muted,'sans','header')+12;
   rect(p,43,hy,509,2,'#b8d9bb');paintPhoto(488,32);return hy+26;
  }
  if(style==='creative'){
   rect(p,23,32,4,72,a);hy=write(p,name,43,30,509-photoW,37,false,a,'serif','header')+7;
   hy=write(p,headline,43,hy,509-photoW,10.5,true,a,'sans','header')+9;hy=write(p,contact,43,hy,509,9.5,false,muted,'sans','header')+13;
   rect(p,43,hy,509,.6,'#d1b8d2');paintPhoto(488,31);return hy+27;
  }
  hy=write(p,name,43,32,509-photoW,34,false,a,'serif','header')+8;hy=write(p,headline,43,hy,509-photoW,10.5,true,a,'sans','header')+8;
  hy=write(p,contact,43,hy,509,9.5,false,muted,'sans','header')+12;rect(p,43,hy,509,.7,'#c8cfb6');paintPhoto(488,31);return hy+29;
 }
 function otherHeading(page,key,title,b,cy){
  const label=title;
  const emit=(x,y,size,bold,family='sans')=>{for(const row of wrap(label,b.w-14,size,f[family+(bold?'Bold':'')])){text(page,row,x,y,size,bold,a,family,b.region);y+=size*1.3;}};
  if(labelsLayout){
   let ly=cy;for(const row of wrap(label,83,9,f.sansBold)){text(page,row,43,ly,9,true,a,'sans','section-label');ly+=12;}rect(page,133,cy,1,20,'#ccd4c0');return;
  }
  if(style==='tech'){emit(b.x,cy,11,true,'mono');rect(page,b.x,cy+19,b.w,.5,'#b7d4cd');return;}
  if(style==='bold'){emit(b.x,cy,14,true);return;}
  if(style==='corporate'){rect(page,b.x,cy-5,3,19,'#b99d62');emit(b.x+10,cy,10,true);rect(page,b.x,cy+19,b.w,.45,'#cad5df');return;}
  if(style==='fresh'){rect(page,b.x-5,cy-5,b.w+10,23,'#edf5eb');emit(b.x+2,cy,10,true);return;}
  if(style==='modern'){rect(page,b.x,cy+18+(wrap(label,b.w-14,10,f.sansBold).length-1)*13,29,3,'#dbaa8d');emit(b.x,cy,10,true);return;}
  if(style==='creative'){emit(b.x,cy,12,true,'serif');rect(page,b.x,cy+20,34,1.5,'#b897bc');return;}
  if(style==='signature'){emit(b.x,cy,10,true);rect(page,b.x,cy+18,36,1.5,'#b79a61');return;}
  emit(b.x,cy,11,false,'serif');rect(page,b.x,cy+20,b.w,.4,style==='signature'?'#d6c6c8':'#d0c9bb');
 }
 function pair(leftKeys,rightKeys,start,index,kind,leftW=302,rightW=183){
  const lx=43,rx=552-rightW;
  const l=flow(leftKeys,start,index,{x:lx,w:leftW,region:kind+'-left'}),r=flow(rightKeys,start,index,{x:rx,w:rightW,region:kind+'-right'}),pi=Math.max(l.index,r.index),bottom=Math.max(l.index===pi?l.y:72,r.index===pi?r.y:72);
  bands.push({kind,startPage:index,endPage:pi,startY:start,endY:bottom,leftX:lx,leftW,rightX:rx,rightW});return {index:pi,y:bottom};
 }
 function otherBody(){
  if(style==='modern'){
   const intro=flow(['summary'],y);
   if((d.skills||'').length+(d.education||'').length>1400||!d.skills&&!d.education)return flow(['experience','projects','education','skills'],intro.y,intro.index);
   return pair(['experience','projects'],['skills','education'],intro.y,intro.index,'geometric',326,159);
  }
  if(style==='signature')return flow(['summary','experience','education','skills','projects'],y);
  if(style==='minimalist')return flow(['summary','experience','projects','skills','education'],y);
  if(style==='creative'){
   const main=flow(['summary','projects','experience'],y);return pair(['skills'],['education'],main.y,main.index,'portfolio-close',244,241);
  }
  if(style==='tech')return flow(['skills','summary','projects','experience','education'],y);
  if(style==='corporate'){
   const main=flow(['summary','experience'],y),support=pair(['education'],['skills'],main.y,main.index,'corporate-close',292,193);return flow(['projects'],support.y,support.index);
  }
  if(style==='fresh'){
   const intro=flow(['summary'],y),primary=pair(['education'],['projects'],intro.y,intro.index,'graduate',241,244);return flow(['skills','experience'],primary.y,primary.index);
  }
  if(style==='bold'){
   const main=flow(['summary','skills','experience'],y);return pair(['projects'],['education'],main.y,main.index,'statement-close',244,241);
  }
  return flow(['summary','experience','projects','education','skills'],y);
 }
 const firstPageBase=pages[0].slice();let end;
 if(other){end=otherBody();}
 else if(modern){
  // A two-column professional snapshot above a broad work-history column.
  const profile=flow(['summary'],y,0,{x:43,w:320,region:'snapshot-left'});
  const skills=flow(['skills'],y,0,{x:390,w:162,region:'snapshot-right'});
  let pi=Math.max(profile.index,skills.index),bottom=Math.max(profile.index===pi?profile.y:72,skills.index===pi?skills.y:72);
  bands.push({kind:'snapshot',startPage:0,endPage:pi,startY:y,endY:bottom,leftX:43,leftW:320,rightX:390,rightW:162});
  end=flow(['experience'],bottom+2,pi);
  const project=flow(['projects'],end.y,end.index,{x:43,w:244,region:'closing-left'});
  const education=flow(['education'],end.y,end.index,{x:311,w:241,region:'closing-right'});
  bands.push({kind:'closing',startPage:end.index,endPage:Math.max(project.index,education.index),startY:end.y,leftX:43,leftW:244,rightX:311,rightW:241});
 }else if(creative){
  const over=skillRemainder?{skills:skillRemainder}:{skills:''};
  end=flow(['summary','experience','skills','projects'],y,0,null,over);
  const eduLines=d.education?.replace(/\r\n?/g,'\n').split('\n')||[];
  const eduHeight=eduLines.reduce((h,l)=>h+(l?wrap(l,132,10.5,f.sansBold).length*14+5:8),0)+48;
  if(pages.length>1&&eduLines.length&&eduHeight<610){
   // Supporting details occupy a compact continuation panel only when it fits.
   // Short one-page concepts retain education in the normal reading column.
   pages.splice(0,pages.length,firstPageBase.slice(),[]);pageLayouts.splice(1);pageLayouts[1]={};
   const ep=pages[1];let ey=86,first=true;text(ep,'EDUCATION & TRAINING',24,ey,9,true,a,'sans','rail');ey+=27;
   for(const row of eduLines){if(!row){ey+=8;first=true;continue;}ey=write(ep,row,24,ey,132,10.5,first,ink,'sans','rail')+5;first=false;}
   pageLayouts[1].railBottom=ey+17;
   end=flow(['summary','experience','skills','projects'],y,0,null,over);
  }else end=flow(['education'],end.y,end.index);
 }else end=flow(['summary','experience','skills','projects','education'],y);
 // Decorate after the text has determined each page's natural composition.
 for(let i=0;i<pages.length;i++){
  const p=pages[i];p.unshift({kind:'rect',x:0,y:0,w:W,h:H,fill:'#ffffff'});
  if(creative&&pageLayouts[i]?.railBottom){const top=i?65:0,bottom=pageLayouts[i].railBottom;p.splice(1,0,{kind:'rect',x:0,y:top,w:178,h:bottom-top,fill:'#faeae4'},{kind:'rect',x:0,y:top,w:178,h:7,fill:'#ee967f'},{kind:'rect',x:0,y:bottom-7,w:178,h:7,fill:'#c5e4d8'});}
  if(i){
   const cn=d.name||'Your name',cs=cn.length>60?8:10;write(p,cn,43,27,400,cs,modern||creative,a,executive?'serif':'sans','continuation');
   text(p,modern?'CAREER PROFILE':'CONTINUED',470,32,8,false,muted,'sans','continuation');
   rect(p,43,53,509,.6,creative?'#d0e3da':'#cbd6ce');
   if(modern)rect(p,0,0,W,4,'#aebfb3');
  }
  text(p,String(i+1).padStart(2,'0'),540,813,8,false,muted,'sans','footer');
 }
 return {pages,width:W,height:H,style,accent:'forest',refined:true,pageLayouts,bands};
}
