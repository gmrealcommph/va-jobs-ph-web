export const labels={summary:'Professional summary',experience:'Experience',education:'Education and training',skills:'Skills',projects:'Projects and other experience'};
export const checklist=['Keep headings and dates consistent.','Describe your own work using clear action verbs.','Include results only when true; numbers are optional and must be verifiable.','List only skills and qualifications you can demonstrate.','Remove unnecessary personal identifiers and proofread your contact details.'];
const keys=['name','contact','headline',...Object.keys(labels)];
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
