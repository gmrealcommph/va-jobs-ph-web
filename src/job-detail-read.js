import { sectionHeadingMarks } from './job-section-heading.js';
import { formatQuickRead } from './quick-read.js';
import { validateStored } from './quick-read-generation.js';
import { presentQuickRead, displayValue } from './quick-read-presentation.js';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels = {salary:'Salary', about_role:'About the role', responsibilities:"What you'll do", requirements:"What they're looking for", nice_to_have:'Nice to have', important_requirements:'Important requirements', benefits:'Benefits', company_overview:'About the company', application_notes:'Application notes', source_metadata:'Source metadata', conflicting_source_details:'Conflicting source details', other_details:'Other source details'};
export function renderJobRead(description, stored = undefined, job = {}) {
  // Explicit null means persisted generation is unavailable/invalid: original only.
  const validated = stored === undefined ? formatQuickRead(description) : validateStored(stored, description);
  const quick = validated && presentQuickRead(validated, description, job);
  const original = `<div class="qr-original">${escape(originalDescriptionDisplay(description))}</div>`;
  if (!quick) return `<section class="qr"><h2>Original description</h2><p>This listing is shown from the employer's original description.</p>${original}</section>`;
  return `<section class="qr"><h2>✨ VeeAys Quick Read</h2><p class="qr-disclosure">We've organized this employer's listing to make it easier to scan. Important requirements and details come from the original job posting.</p><p class="qr-disclosure">Structured details above and employer wording below are shown separately; any differences are left visible.</p><div class="qr-content">${Object.entries(labels).filter(([key])=>quick[key].length).map(([key,label])=>`<section class="qr-section"><h3>${label}</h3><ul>${quick[key].map(text=>`<li>${escape(text)}</li>`).join('')}</ul></section>`).join('')}</div><details class="qr-source"><summary>Original description · View source</summary>${original}</details></section>`;
}
export function renderAtAGlance(job) {
  // Local display projection only; keep shared Quick Read/matching semantics intact.
  const show = (value, field) => {
    if (typeof value !== 'string') return '';
    const key = value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    const mappings = field === 'schedule'
      ? {us:'US hours',uk:'UK/Europe hours','uk europe':'UK / Europe',australia:'Australia hours',flexible:'Flexible/Any',any:'Flexible/Any','flexible/any':'Flexible/Any'}
      : field === 'setup' ? {remote:'Remote',hybrid:'Hybrid',onsite:'On-site','on site':'On-site'}
      : field === 'experience' ? {senior:'Senior',junior:'Junior',mid:'Mid', 'mid level':'Mid-level',lead:'Lead',executive:'Executive','entry level':'Entry Level'}
      : field === 'employment' || field === 'engagement' ? {contract:'Contract',freelance:'Freelance',internship:'Internship',employee:'Employee',temporary:'Temporary','full time':'Full-time','part time':'Part-time'} : {};
    return mappings[key] || displayValue(value, field);
  };
  const icons = {
    Experience:'<path class="qr-icon-paper" d="m12 3 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8Z"/><path class="qr-icon-orange" d="m12 3 2.5 5 5.5.8M4 3l2 2M20 3l-2 2"/>',
    Salary:'<rect class="qr-icon-paper" x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path class="qr-icon-orange" d="M5 8h3M16 16h3M12 9v6"/>',
    Engagement:'<rect class="qr-icon-paper" x="5" y="4" width="14" height="17" rx="2"/><path d="M9 10h6M9 14h6M9 18h4"/><path class="qr-icon-orange" d="M9 4V2h6v4H9zM2 7l2 1M21 6l1-2"/>',
    Schedule:'<circle class="qr-icon-paper" cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/><path class="qr-icon-orange" d="M5 6a8 8 0 0 1 6-2M20 11v2M3 2l2 2"/>',
    Location:'<path class="qr-icon-pin" d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle class="qr-icon-paper" cx="12" cy="10" r="2.5"/><path class="qr-icon-orange" d="M3 6 1 5M21 5l2-2M20 17l2 1"/>',
    'Work setup':'<path class="qr-icon-paper" d="M5 10 12 4l7 6v11H5Z"/><path class="qr-icon-orange" d="m2 10 10-8 10 8M7 6V3h3"/><path d="M9 21v-7h6v7M16 10h1"/><path class="qr-icon-orange" d="M2 16H0M22 14l1-1"/>',
    'Employment type':'<rect class="qr-icon-paper" x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12c5 3 13 3 18 0"/><path class="qr-icon-orange" d="M11 12h2v4h-2zM5 7h5M18 3l2-2"/>'
  };
  const fields = [['Schedule',show(job.schedule_region, 'schedule')],['Location',show(job.location)],['Work setup',show(job.workplace_type, 'setup') || (job.remote === true ? 'Remote' : '')],['Employment type',show(job.employment_type, 'employment')],['Experience',show(job.experience_level, 'experience')],['Salary',formatSalary(job)],['Engagement',show(job.engagement_type, 'engagement')]];
  const present = fields.filter(([,v])=>typeof v === 'string' && v.trim());
  if (!present.length) return '';
  return `<section class="qr-glance" aria-labelledby="at-a-glance"><header class="qr-glance-header"><div class="qr-glance-heading"><h2 id="at-a-glance">${sectionHeadingMarks('At a glance')}</h2></div><svg class="qr-glance-flight" viewBox="0 0 180 42" aria-hidden="true" focusable="false"><path class="qr-glance-trail" d="M2 30c20-30 54 20 74-5s-11-27-6-7 44 4 67-9"/><path class="qr-glance-plane" d="m144 8 30 9-27 14 4-12 23-2-23 2Z"/><path class="qr-glance-flight-sparks" d="m177 6 2-2m-1 8 3-1m-3 7 2 1"/></svg></header>${present.length ? `<dl class="qr-glance-tiles" style="--glance-count:${present.length}">${present.map(([label,value])=>`<div class="qr-glance-tile"><svg class="qr-glance-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons[label]}</svg><div><dt>${label}</dt><dd>${escape(value)}</dd></div></div>`).join('')}</dl>` : ''}</section>`;
}
export function formatSalary(job) {
  const number=v=>(typeof v==='number' || typeof v==='string' && /^\d+(?:\.\d+)?$/.test(v)) && Number.isFinite(Number(v)) && Number(v)>=0 ? Number(v):null;
  const min=number(job.salary_min),max=number(job.salary_max);
  // Never substitute USD conversions or assume currency/period.
  if((min===null && max===null) || !/^[A-Z]{3}$/.test(job.salary_currency || '') || (min!==null && max!==null && min>max)) return '';
  let format;
  try {format=new Intl.NumberFormat('en-PH',{style:'currency',currency:job.salary_currency,maximumFractionDigits:2});} catch{return '';}
  const value=min!==null && max!==null?(min===max?format.format(min):`${format.format(min)}–${format.format(max)}`):min!==null?`From ${format.format(min)}`:`Up to ${format.format(max)}`;
  return value+(typeof job.salary_period==='string' && job.salary_period.trim()?` / ${job.salary_period}`:'');
}

// Display only. Blank lines establish paragraph boundaries; ambiguous headings and
// lists are retained. Case and punctuation remain significant for exact equality.
export function originalDescriptionDisplay(description) {
  const seen = new Set();
  const blocks = String(description).split(/(\r?\n[ \t]*\r?\n(?:[ \t]*\r?\n)*)/);
  for (let index = 0; index < blocks.length; index += 2) {
    const block = blocks[index];
    const key = block.trim().replace(/\s+/g, ' ');
    const lines = block.trim().split(/\r?\n/);
    const prose = key.length >= 80 && /[.!?]["'’”)]?$/.test(key) && /[a-z]/.test(key)
      && !lines.some(line => /^(?:\s*(?:[-*•▪●]|\d+[.)])\s|\s*#{1,6}\s)|:\s*$/.test(line))
      && !lines.some(line => line.trim() && line.trim() === line.trim().toUpperCase());
    if (!prose) continue;
    if (seen.has(key)) { blocks[index] = ''; if (index > 0) blocks[index - 1] = ''; }
    else seen.add(key);
  }
  return blocks.join('');
}
