// Editable Word alternative intentionally uses a single reading column.
import {designs} from './resume-export.js';
import {labels} from './resume-tools.js';
import {refinedWordBlob} from './resume-refined-word-v3.js';
export async function wordBlob(data,style,accent,portrait){
 if(Object.hasOwn(designs,style))return refinedWordBlob(data,style,accent,portrait);
 const {Document,Packer,Paragraph,TextRun,ImageRun,BorderStyle}=await import('./vendor/docx.mjs');
 const color=accent==='forest'?(designs[style]?.color||'#0F3D2E').slice(1):{forest:'0F3D2E',ink:'202d26',slate:'334d70',plum:'653e62'}[accent]||'0F3D2E';
 const font=['executive','editorial','minimalist','signature'].includes(style)?'Times New Roman':style==='tech'?'Courier New':'Arial';
 const children=[];
 if(portrait)children.push(new Paragraph({children:[new ImageRun({type:'jpg',data:Uint8Array.from(atob(portrait.split(',')[1]),c=>c.charCodeAt(0)),transformation:{width:90,height:90},altText:{title:'Portrait',description:'Optional résumé portrait',name:'Portrait'}})]}));
 for(const [key,size,bold]of [['name',48,true],['headline',24,true],['contact',20,false]])if(data[key])for(const line of data[key].split('\n'))children.push(new Paragraph({spacing:{after:100},children:[new TextRun({text:line,font,size,bold,color:key==='name'?color:'202D26'})]}));
 const order=style==='fresh'?['summary','education','projects','experience','skills']:style==='tech'?['summary','skills','experience','projects','education']:Object.keys(labels);
 for(const key of order)if(data[key]?.trim()){
  children.push(new Paragraph({keepNext:true,spacing:{before:260,after:120},border:{bottom:{style:BorderStyle.SINGLE,size:6,color}},children:[new TextRun({text:labels[key],font,size:23,bold:true,color})]}));
  for(const line of data[key].replace(/\r\n?/g,'\n').split('\n'))children.push(new Paragraph({widowControl:true,spacing:{after:80},children:[new TextRun({text:line,font,size:22})]}));
 }
 return Packer.toBlob(new Document({creator:'Résumé document',title:'Résumé',sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:850,bottom:850,left:850,right:850}}},children}]}));
}
