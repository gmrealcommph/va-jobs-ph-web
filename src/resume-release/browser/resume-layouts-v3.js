export const styles = {
 "classic": {
  "name": "Modern Professional",
  "description": "Charcoal masthead, a profile-and-skills snapshot and clear contemporary work history."
 },
 "editorial": {
  "name": "Creative",
  "description": "Coral and mint supporting panels, generous reading space and adaptable continuation pages."
 },
 "executive": {
  "name": "Executive",
  "description": "Elegant serif masthead, balanced single-column content and aligned professional experience."
 },
 "modern": {
  "name": "Geometric Modern",
  "description": "Sharp teal geometry, a wide work column and a compact supporting-details column."
 },
 "minimalist": {
  "name": "Luxury Minimal",
  "description": "Centered serif masthead, delicate neutral rules and an uncluttered single-column layout."
 },
 "creative": {
  "name": "Contemporary Creative",
  "description": "Plum editorial typography, project-first storytelling and a refined portfolio composition."
 },
 "tech": {
  "name": "Tech Innovator",
  "description": "Navy and teal, monospace headings, tools first and a clear technical portfolio."
 },
 "corporate": {
  "name": "Corporate Elite",
  "description": "Navy and gold, a formal identity band and a structured credentials-and-skills block."
 },
 "fresh": {
  "name": "Fresh Graduate",
  "description": "Fresh green accents, education and projects first, with optional work experience."
 },
 "bold": {
  "name": "Bold Statement",
  "description": "Strong oversized name typography, restrained ochre accents and confident section hierarchy."
 },
 "contemporary": {
  "name": "Nature Modern",
  "description": "Quiet olive typography, a section-label gutter and a spacious editorial reading column."
 },
 "signature": {
  "name": "Signature Collection",
  "description": "Refined rose and charcoal, expressive serif name typography and fine personal details."
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
