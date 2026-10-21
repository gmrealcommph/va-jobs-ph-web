export const styles = {
 "classic": {
  "name": "Modern Portfolio",
  "description": "Emerald photo sidebar, expressive serif name and layered organic fields."
 },
 "editorial": {
  "name": "Editorial Creative",
  "description": "Warm coral brushwork, large portrait and asymmetric magazine composition."
 },
 "executive": {
  "name": "Executive Profile",
  "description": "Deep green photo sidebar, gold details and refined executive typography."
 },
 "modern": {
  "name": "Geometric Modern",
  "description": "Teal and coral angular portrait composition with a clear reading column."
 },
 "minimalist": {
  "name": "Luxury Minimal",
  "description": "Cream editorial layout with an optional framed circular portrait; botanical artwork appears when no photo is added."
 },
 "creative": {
  "name": "Contemporary Creative",
  "description": "Pastel flowing forms, circular portrait and violet editorial typography."
 },
 "tech": {
  "name": "Tech Innovator",
  "description": "Navy technical artwork, architectural photo frame and a dark skills rail."
 },
 "corporate": {
  "name": "Corporate Elite",
  "description": "Navy and gold geometry, circular portrait and a refined skills sidebar."
 },
 "fresh": {
  "name": "Fresh Graduate",
  "description": "Lively green organic forms, portrait and education-first content."
 },
 "bold": {
  "name": "Bold Statement",
  "description": "Dramatic black and cream typography with an oversized name and photo."
 },
 "contemporary": {
  "name": "Nature Modern",
  "description": "Olive botanical artwork, cream paper and an organic portrait composition."
 },
 "signature": {
  "name": "Signature Collection",
  "description": "Cream, green and gold curves with a refined portrait and serif typography."
 }
};
export function renderResume(root,d,style='classic',accent='forest'){
 const doc=root.ownerDocument,add=(tag,text,parent=root)=>{const el=doc.createElement(tag);el.textContent=text;parent.append(el);return el;};
 root.replaceChildren();root.dataset.style=Object.hasOwn(styles,style)?style:'classic';root.dataset.accent=accent;
 const head=add('header','');add('h1',d.name||'Your name',head);
 if(d.headline)add('p',d.headline,head).className='resume-headline';
 if(d.contact)add('p',d.contact,head).className='resume-contact';
 const body=add('div','');body.className='resume-body';
 const order=style==='tech'?['summary','skills','experience','projects','education']:['summary','experience','education','skills','projects'];
 const labels={summary:'Professional summary',experience:'Experience',education:'Education and training',skills:'Skills',projects:'Projects and other experience'};
 for(const key of order)if(d[key]?.trim()){const section=add('section','',body);section.dataset.section=key;add('h2',labels[key],section);add('p',d[key],section);}
}
