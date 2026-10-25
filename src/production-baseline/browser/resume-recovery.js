import {validateDraft} from './resume-tools.js';
import {validateDesignDraft,imageDimensions} from './resume-photo.js';
import {styles} from './resume-layouts.js';
export const RECOVERY_KEY='veeays-resume-tab-recovery-v1';
const MAX=4000000;
const blank=()=>({sections:{},style:'classic',accent:'forest',photo:null,source:'',improve:false});
export function decodeRecovery(text,now=Date.now()){
 if(typeof text!=='string'||text.length>MAX)throw Error('Invalid recovery copy.');
 const value=JSON.parse(text);
 if(value?.version!==1||!Number.isFinite(value.saved)||value.saved>now+60000||now-value.saved>86400000||!Array.isArray(value.drafts)||!value.drafts.length||value.drafts.length>10||!Number.isInteger(value.active)||value.active<0||value.active>=value.drafts.length)throw Error('Invalid recovery copy.');
 const drafts=value.drafts.map((draft,i)=>{
   const d=draft?.data||blank();const sections=validateDraft({version:1,sections:d.sections});
   validateDesignDraft({version:2,style:d.style,accent:d.accent,photo:d.photo},styles);
   if(typeof d.source!=='string'||d.source.length>6000||typeof d.improve!=='boolean')throw Error('Invalid recovery source.');
   if(d.photo){const bytes=Uint8Array.from(atob(d.photo.src.split(',')[1]),c=>c.charCodeAt(0));imageDimensions(bytes);}
   return {label:'Draft '+(i+1),data:{sections,style:d.style,accent:d.accent,photo:d.photo,source:d.source,improve:d.improve}};
 });
 return {drafts,active:value.active,saved:value.saved};
}
export function encodeRecovery(drafts,active,now=Date.now()){
 const text=JSON.stringify({version:1,saved:now,active,drafts});decodeRecovery(text,now);return text;
}
