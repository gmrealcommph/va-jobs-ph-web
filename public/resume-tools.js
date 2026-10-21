export const labels={summary:'Professional summary',experience:'Experience',education:'Education and training',skills:'Skills',projects:'Projects and other experience'};
export const checklist=['Keep headings and dates consistent.','Describe your own work using clear action verbs.','Include results only when true; numbers are optional and must be verifiable.','List only skills and qualifications you can demonstrate.','Remove unnecessary personal identifiers and proofread your contact details.'];
const keys=['name','contact','headline',...Object.keys(labels)];
// Local, explainable prompts only. Never a hiring prediction or an ATS score.
export function readiness(sections){
  const d=Object.fromEntries(keys.map(k=>[k,String(sections[k]||'').trim()])),items=[];
  const add=(field,advice,quote='')=>items.push({field,advice,quote});
  if(!d.name)add('name','Add the name you want employers to see.');
  if(!d.contact)add('contact','Add a working email or phone number so employers can reach you.');
  else {
    const emails=d.contact.match(/\S*@\S*/g)||[];
    if(emails.some(e=>!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(e.replace(/[;,]$/,''))))add('contact','Check your email address: include a name, @ and a complete domain.');
    if(!emails.length&&!/\+?[\d][\d ()-]{5,}\d/.test(d.contact))add('contact','Include a working email or phone number; a city alone is not enough.');
    if(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/\s*$/i.test(d.contact))add('contact','Complete your LinkedIn profile link or remove it.');
    const phone=d.contact.match(/\+?\d[\d ()-]{4,}\d/g)||[];
    if(phone.some(p=>{const n=p.replace(/\D/g,'').length;return n<7||n>15;}))add('contact','Check the phone number length and country code.');
  }
  if(!d.headline)add('headline','Name the role you are seeking to help focus your résumé.');
  if(!d.skills)add('skills','Add skills or tools you can demonstrate.');
  if(!d.experience&&!d.projects)add('experience','Add relevant work, school, volunteer or personal project experience if you have it.');
  for(const field of ['experience','education','projects']){
    const text=d[field];
    if(text&&!/\b(?:19|20)\d{2}\b/.test(text))add(field,'Consider adding dates. Use the same format for each entry.');
    for(const line of text.split('\n')){
      const range=line.match(/\b((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2})\b/);
      if(range&&Number(range[1])>Number(range[2]))add(field,'Check this date range: the end year is before the start year.',line);
    }
    if(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/i.test(text)&&/\b\d{1,2}[/-]\d{4}\b/.test(text))add(field,'Date formats vary here. Choose one format, such as Jan 2024, throughout.');
  }
  for(const field of ['experience','projects']){
    const vague=d[field].split('\n').find(line=>/^\s*[-•*]?\s*(?:responsible for|helped with|worked on|duties included)\b/i.test(line));
    if(vague)add(field,'Make this more specific: action + task or tool + truthful outcome. Numbers are optional; never invent results.',vague);
  }
  return items;
}
export function validateDraft(data){
  if(data?.version!==1||!data.sections||typeof data.sections!=='object'||Array.isArray(data.sections))throw Error('This is not a supported résumé draft.');
  const result={};for(const [key,value] of Object.entries(data.sections)){if(!keys.includes(key)||typeof value!=='string'||value.length>(key==='name'?120:2500))throw Error('Invalid draft section.');result[key]=value;}return result;
}
export function parseResume(text){
  if(typeof text!=='string'||!text.trim()||text.length>6000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))throw Error('Paste plain résumé text under 6,000 characters.');
  const headings={'summary':'summary','professional summary':'summary','profile':'summary','experience':'experience','work experience':'experience','employment history':'experience','education':'education','education and training':'education','skills':'skills','projects':'projects','projects and other experience':'projects','contact':'contact','contact details':'contact'};
  const result=Object.fromEntries(keys.map(k=>[k,'']));let section='projects';
  for(const line of text.replace(/\r\n?/g,'\n').split('\n')){const heading=headings[line.trim().toLowerCase().replace(/:$/,'')];if(heading){section=heading;continue;}result[section]+=(result[section]?'\n':'')+line;}
  for(const key of keys){result[key]=result[key].trim();if(result[key].length>(key==='name'?120:2500))throw Error('One section exceeds 2,500 characters. Split it with headings before importing.');}
  // Deliberately do not guess a person's name, employers, dates or qualifications.
  return result;
}
