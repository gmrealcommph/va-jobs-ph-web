import {compose} from './resume-export-v3.js';
// Editable text and native tables; never flattened résumé images.
export async function refinedWordBlob(data,style,accent,photo){
 const D=await import('./vendor/docx.mjs');
 const {Document,Packer,Paragraph,TextRun,Header,Footer,Table,TableRow,TableCell,WidthType,BorderStyle,LineRuleType,SectionType,ImportedXmlComponent,ImageRun}=D;
 const plan=await compose(data,style,accent,photo),creative=style==='editorial',tw=n=>Math.round(n*20),pageLeft=creative?0:43,pageWidth=creative?595.28:509.28;
 const none={style:BorderStyle.NONE,size:0,color:'FFFFFF'},borders={top:none,bottom:none,left:none,right:none,insideHorizontal:none,insideVertical:none};
 function paragraphs(commands,baseX,startY,width){
  const ordered=commands.filter(c=>c.kind==='text'&&!['footer','monogram'].includes(c.region)).sort((a,b)=>(a.y+a.size*.83)-(b.y+b.size*.83)||a.x-b.x),rows=[];
  for(const c of ordered){const baseline=c.y+c.size*.83,last=rows.at(-1);if(last&&(Math.abs(last.baseline-baseline)<1.3||Math.abs(last.commands[0].y-c.y)<.6||c.region==='continuation'&&last.commands.every(r=>r.region==='continuation')&&Math.abs(last.commands[0].y-c.y)<10))last.commands.push(c);else rows.push({baseline,commands:[c]});}
  let cy=startY;const children=[];
  for(const row of rows){const cmds=row.commands.sort((a,b)=>a.x-b.x),c=cmds[0],top=Math.min(...cmds.map(c=>c.y)),lh=Math.max(...cmds.map(c=>c.lineHeight||c.size*1.32)),hang=c.hanging||0;
   const indent=Math.max(0,c.x-baseX),right=Math.max(0,width-indent-(c.maxWidth||width-indent)),stops=[],runs=[];
   cmds.forEach((r,i)=>{if(i)stops.push({type:r.alignedDate?'right':'left',position:tw(r.x+(r.alignedDate?r.advance:0)-baseX)});runs.push(new TextRun({text:(i?'\t':'')+(r.text||' '),font:r.family==='serif'?'Times New Roman':r.family==='mono'?'Courier New':'Arial',size:Math.round(r.size*2),bold:r.bold,scale:98,color:r.fill.slice(1)}));});
   children.push(new Paragraph({widowControl:false,keepNext:cmds.some(c=>c.keepNext),tabStops:stops,spacing:{before:tw(Math.max(0,top-cy)),after:0,line:tw(lh),lineRule:LineRuleType.EXACT},indent:{left:tw(indent+hang),right:tw(right),...(hang?{hanging:tw(hang)}:{})},children:runs}));cy=top+lh;
  }
  return {children,bottom:cy};
 }
 const empty=()=>new Paragraph({spacing:{after:0,line:1,lineRule:LineRuleType.EXACT},text:''});
 function artHeader(page){
  const p=empty();
  for(const [i,c]of page.filter(c=>c.kind==='rect'&&c.fill!=='#ffffff').entries())p.addChildElement(ImportedXmlComponent.fromXmlString(`<w:r xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:v="urn:schemas-microsoft-com:vml"><w:pict><v:rect id="shape${i}" style="position:absolute;margin-left:${c.x}pt;margin-top:${c.y}pt;width:${c.w}pt;height:${c.h}pt;z-index:-251654144;mso-position-horizontal-relative:page;mso-position-vertical-relative:page" fillcolor="${c.fill}" stroked="f"/></w:pict></w:r>`).root[0]);
  for(const c of page.filter(c=>c.kind==='image'))p.addChildElement(new ImageRun({type:'jpg',data:Uint8Array.from(atob(c.src.split(',')[1]),v=>v.charCodeAt(0)),transformation:{width:c.w*96/72,height:c.h*96/72},floating:{horizontalPosition:{relative:'page',offset:Math.round(c.x*12700)},verticalPosition:{relative:'page',offset:Math.round(c.y*12700)},behindDocument:false,allowOverlap:true,wrap:{type:'none'}},altText:{title:'Optional portrait',description:'Portrait supplied by the résumé author',name:'Portrait'}}));
  const initials=page.find(c=>c.region==='monogram'),mono=initials?new Paragraph({frame:{type:'absolute',position:{x:tw(initials.x),y:tw(initials.y)},width:tw(78),height:tw(66),anchor:{horizontal:'page',vertical:'page'},wrap:'none'},children:[new TextRun({text:initials.text,font:'Times New Roman',size:Math.round(initials.size*2),color:initials.fill.slice(1)})]}):null;
  return new Header({children:mono?[p,mono]:[p]});
 }
 function pageBands(page,index){const result=[];
  for(const band of plan.bands||[])if(index>=band.startPage&&index<=band.endPage){const l=page.filter(c=>c.region===band.kind+'-left'),r=page.filter(c=>c.region===band.kind+'-right');if(l.length||r.length)result.push({start:Math.max(24,index===band.startPage?band.startY:72),end:Math.max(...[...l,...r].filter(c=>c.kind==='text').map(c=>c.y+(c.lineHeight||c.size*1.32))),left:l,right:r,lx:band.leftX,lw:band.leftW,rx:band.rightX,rw:band.rightW});}
  if(style==='contemporary'){const body=page.filter(c=>c.kind==='text'&&['main','section-label'].includes(c.region));if(body.length)result.push({start:Math.min(...body.map(c=>c.y)),end:Math.max(...body.map(c=>c.y+(c.lineHeight||c.size*1.32))),left:body.filter(c=>c.region==='section-label'),right:body.filter(c=>c.region==='main'),lx:43,lw:83,rx:143,rw:409.28});}
  if(creative){const left=page.filter(c=>c.region==='rail'),right=page.filter(c=>c.region==='top-main'||index===0&&c.region==='header');if(left.length||right.length){const all=[...left,...right].filter(c=>c.kind==='text');result.push({start:index?65:24,end:Math.max(...all.map(c=>c.y+(c.lineHeight||c.size*1.32))),left,right,lx:0,lw:178,rx:178,rw:417.28});}}
  return result.sort((a,b)=>a.start-b.start);
 }
 const sections=plan.pages.map((page,index)=>{
  let children=[],cy=24;const bands=pageBands(page,index),used=new Set(bands.flatMap(b=>[...b.left,...b.right]));
  const normal=page.filter(c=>c.kind==='text'&&!used.has(c)&&!['footer','monogram'].includes(c.region));
  for(const band of bands){
   const before=paragraphs(normal.filter(c=>c.y>=cy-.5&&c.y<band.start),pageLeft,cy,pageWidth);children.push(...before.children);cy=before.bottom;
   if(band.start>cy)children.push(new Paragraph({spacing:{before:tw(band.start-cy),after:0,line:1,lineRule:LineRuleType.EXACT},text:''}));
   const l=paragraphs(band.left,band.lx,band.start,band.lw),r=paragraphs(band.right,band.rx,band.start,band.rw),gap=band.rx-band.lx-band.lw;
   const cells=[{w:band.lw,children:l.children},...(gap>.1?[{w:gap,children:[]}]:[]),{w:band.rw,children:r.children}];
   children.push(new Table({width:{size:tw(band.rx+band.rw-band.lx),type:WidthType.DXA},indent:{size:tw(band.lx-pageLeft),type:WidthType.DXA},columnWidths:cells.map(c=>tw(c.w)),borders,rows:[new TableRow({children:cells.map(c=>new TableCell({width:{size:tw(c.w),type:WidthType.DXA},margins:{top:0,bottom:0,left:0,right:0},borders,children:c.children.length?c.children:[empty()]}))})]}));
   cy=Math.max(l.bottom,r.bottom);children.push(empty());
  }
  children.push(...paragraphs(normal.filter(c=>c.y>=cy-.5),pageLeft,cy,pageWidth).children);if(!children.length)children.push(empty());
  const footer=new Footer({children:[new Paragraph({alignment:'right',indent:{right:creative?860:0},children:[new TextRun({text:String(index+1).padStart(2,'0'),font:'Arial',size:16,color:'607069'})]})]});
  return {properties:{type:SectionType.NEXT_PAGE,titlePage:true,page:{size:{width:11906,height:16838},margin:{top:480,bottom:650,left:tw(pageLeft),right:tw(pageLeft),header:0,footer:350}}},headers:{first:artHeader(page),default:new Header({children:[empty()]})},footers:{first:footer},children};
 });
 return Packer.toBlob(new Document({creator:'Résumé document',title:'Résumé',styles:{default:{document:{run:{font:'Arial',size:22},paragraph:{spacing:{after:0}}}}},sections}));
}
