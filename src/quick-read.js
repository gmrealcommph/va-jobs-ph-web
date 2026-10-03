// V1 contract: source-only strings; null means use the original. No model/network calls.
// A future persisted formatter must bind its result to the source revision and validate
// preservation of eligibility, preferences and application conditions before rendering.
const headings = new Map(Object.entries({
  'about the role':'about_role', 'about the job':'about_role', 'job summary':'about_role',
  'responsibilities':'responsibilities', 'key responsibilities':'responsibilities',
  'duties':'responsibilities', 'key duties':'responsibilities', "what you'll do":'responsibilities',
  'what you will do':'responsibilities', 'responsibilities include':'responsibilities',
  'requirements':'requirements', 'qualifications':'requirements',
  'skills and experience':'requirements', "what they're looking for":'requirements',
  "what we're looking for":'requirements', 'required qualifications':'requirements',
  'nice to have':'nice_to_have', 'preferred qualifications':'nice_to_have',
  'preferred experience':'nice_to_have', 'benefits':'benefits', 'what we offer':'benefits',
  'about the company':'company_overview', 'about us':'company_overview',
  'important requirements':'important_requirements', 'application notes':'application_notes',
  'how to apply':'application_notes'
}));
const preference = /\b(preferred|highly preferred|nice[- ]to[- ]have|a plus|an advantage|a bonus|desirable)\b/i;
const application = /(?:AI[- ]generated|incomplete).*(?:application|answers)|(?:application|answers).*(?:reject|screen)|\b(?:auto[- ]rejected|how to apply)\b/i;
const condition = /\b(?:work authori[sz]ation|authori[sz]ed to work|sponsorship|work permit|pre[- ]employment|screening|background check|laptop|equipment|internet|backup connection)\b/i;

export function formatQuickRead(description) {
  if (typeof description !== 'string' || description.trim().length < 100 || description.length > 100000 || /<\/?[a-z][^>]*>/i.test(description)) return null;
  const result = { version:1, formatter:'deterministic-v1', about_role:[], responsibilities:[],
    requirements:[], nice_to_have:[], important_requirements:[], benefits:[],
    company_overview:[], application_notes:[], other_details:[] };
  let section = 'other_details', recognized = 0;
  const seen = new Set();
  // Only explicit headings establish meaning. Unknown material is retained verbatim.
  for (const raw of description.replace(/\r\n?/g,'\n').replace(/[●•▪◦]/g,'\n• ').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const heading = headings.get(line.replace(/:$/,'').replace(/’/g,"'").toLowerCase());
    if (heading) { section = heading; recognized++; continue; }
    const text = line.replace(/^(?:[-*•]\s+|\d+[.)]\s+)/,'');
    // Deduplicate exact text only; retain punctuation, numbers and qualifiers.
    if (seen.has(text)) continue;
    seen.add(text);
    // Never split mixed mandatory/preferred clauses or upgrade a preferred condition.
    if (/^[^.!?]{1,80}:$/.test(text)) section = 'other_details';
    let target = section;
    if (application.test(text)) target = 'application_notes';
    else if (condition.test(text) && !preference.test(text)) target = 'important_requirements';
    else if (section === 'requirements' && preference.test(text) && !/\b(?:required|must|mandatory)\b/i.test(text)) target = 'nice_to_have';
    result[target].push(text);
  }
  const count = Object.values(result).filter(Array.isArray).reduce((n,a)=>n+a.length,0);
  return recognized >= 2 && count >= 3 ? result : null;
}
