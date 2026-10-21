const MAX=5*1024*1024;
export function imageDimensions(bytes){
 const b=new Uint8Array(bytes),v=new DataView(b.buffer,b.byteOffset,b.byteLength);let width,height;
 if(b.length>=24&&[137,80,78,71,13,10,26,10].every((x,i)=>b[i]===x)){width=v.getUint32(16);height=v.getUint32(20);}
 else if(b[0]===255&&b[1]===216){let i=2;while(i+8<b.length){if(b[i]!==255)throw Error('Invalid JPEG.');const marker=b[i+1];if(marker===218||marker===217)break;const length=v.getUint16(i+2);if(length<2||i+2+length>b.length)throw Error('Invalid JPEG.');if([192,193,194].includes(marker)){height=v.getUint16(i+5);width=v.getUint16(i+7);break;}i+=length+2;}}
 if(!width||!height||width>8192||height>8192||width*height>16000000)throw Error('Choose a valid JPEG or PNG no larger than 16 megapixels or 8192 pixels per side.');
 return {width,height};
}
export async function readPhoto(file){
 if(file.size>MAX||!['image/jpeg','image/png'].includes(file.type))throw Error('Choose a JPEG or PNG under 5 MB.');
 const bytes=await file.arrayBuffer();imageDimensions(bytes);
 const bitmap=await createImageBitmap(new Blob([bytes],{type:file.type}));
 try{const canvas=document.createElement('canvas'),scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);const src=canvas.toDataURL('image/jpeg',.86);if(src.length>1500000)throw Error('This photo is too detailed. Choose a smaller image.');return src;}finally{bitmap.close();}
}
export async function cropPhoto(src,x=50,y=50,zoom=1){
 if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(src)||src.length>1500000)throw Error('Invalid draft photo.');
 const raw=atob(src.split(',')[1]),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));imageDimensions(bytes);
 const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/jpeg'}));
 try{const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const context=canvas.getContext('2d'),side=Math.min(bitmap.width,bitmap.height)/zoom;
 context.fillStyle='#ffffff';context.fillRect(0,0,512,512);context.drawImage(bitmap,(bitmap.width-side)*x/100,(bitmap.height-side)*y/100,side,side,0,0,512,512);return canvas.toDataURL('image/jpeg',.9);}finally{bitmap.close();}
}
export function validateDesignDraft(input,styles){
 if(input.version!==2||!Object.hasOwn(styles,input.style)||!['forest','ink','slate','plum'].includes(input.accent))throw Error('Invalid design draft.');
 const p=input.photo;if(p!==null&&(!p||typeof p.src!=='string'||p.src.length>1500000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(p.src)||![p.x,p.y,p.zoom].every(Number.isFinite)||p.x<0||p.x>100||p.y<0||p.y>100||p.zoom<1||p.zoom>3))throw Error('Invalid draft photo.');return input;
}
