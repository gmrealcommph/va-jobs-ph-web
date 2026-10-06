import { formatQuickRead } from './quick-read.js';
import { validateStored } from './quick-read-generation.js';
import { presentQuickRead, displayValue } from './quick-read-presentation.js';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels = {salary:'Salary', about_role:'About the role', responsibilities:"What you'll do", requirements:"What they're looking for", nice_to_have:'Nice to have', important_requirements:'Important requirements', benefits:'Benefits', company_overview:'About the company', application_notes:'Application notes', source_metadata:'Source metadata', conflicting_source_details:'Conflicting source details', other_details:'Other source details'};
export function renderJobRead(description, stored = undefined, job = {}) {
  // Explicit null means persisted generation is unavailable/invalid: original only.
  const validated = stored === undefined ? formatQuickRead(description) : validateStored(stored, description);
  const quick = validated && presentQuickRead(validated, description, job);
  const original = `<div class="qr-original">${escape(description)}</div>`;
  if (!quick) return `<section class="qr"><h2>Original description</h2><p>Quick Read is unavailable for this listing. Read the employer's original description below.</p>${original}</section>`;
  return `<section class="qr"><h2>✨ VeeAys Quick Read</h2><p class="qr-disclosure">We've organized this employer's listing to make it easier to scan. Important requirements and details come from the original job posting.</p><p class="qr-disclosure">Structured details above and employer wording below are shown separately; any differences are left visible.</p><div class="qr-content">${Object.entries(labels).filter(([key])=>quick[key].length).map(([key,label])=>`<section class="qr-section"><h3>${label}</h3><ul>${quick[key].map(text=>`<li>${escape(text)}</li>`).join('')}</ul></section>`).join('')}</div><details class="qr-source"><summary>Original description · View untouched source</summary>${original}</details></section>`;
}
export function renderAtAGlance(job) {
  // Local display projection only; keep shared Quick Read/matching semantics intact.
  const show = (value, field) => {
    if (typeof value !== 'string') return '';
    const key = value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    const mappings = field === 'schedule'
      ? {us:'US hours',uk:'UK/Europe hours',australia:'Australia hours',flexible:'Flexible/Any',any:'Flexible/Any','flexible/any':'Flexible/Any'}
      : field === 'setup' ? {remote:'Remote',hybrid:'Hybrid',onsite:'On-site','on site':'On-site'}
      : field === 'experience' ? {senior:'Senior',junior:'Junior',mid:'Mid', 'mid level':'Mid-level'}
      : field === 'employment' ? {contract:'Contract',freelance:'Freelance',internship:'Internship'} : {};
    return mappings[key] || displayValue(value, field);
  };
  const icons = {
    Experience:'<path d="m12 3 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8Z"/>',
    Salary:'<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M5 12h1M18 12h1"/>',
    Engagement:'<path d="M8 4h8v17H8zM5 7H3v14h18V7h-2M10 8h4M10 12h4M10 16h4"/>',
    Schedule:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
    Location:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    'Work setup':'<path d="m3 10 9-7 9 7M5 9v11h5M19 9v4M12 14h8v6h-8zM10 21h12"/>',
    'Employment type':'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12c5 3 13 3 18 0M12 12v4"/>'
  };
  const fields = [['Location',show(job.location)],['Work setup',show(job.workplace_type, 'setup') || (job.remote === true ? 'Remote' : '')],['Employment type',show(job.employment_type, 'employment')],['Experience',show(job.experience_level, 'experience')],['Schedule',show(job.schedule_region, 'schedule')],['Salary',formatSalary(job)],['Engagement',displayValue(job.engagement_type)]];
  const present = fields.filter(([,v])=>typeof v === 'string' && v.trim());
  if (!present.length) return '';
  return `<section class="qr-glance" aria-labelledby="at-a-glance"><header class="qr-glance-header"><div class="qr-glance-heading"><p class="qr-glance-eyebrow">Opportunity snapshot</p><h2 id="at-a-glance">At a glance<svg class="qr-glance-underline" viewBox="0 0 140 8" aria-hidden="true" focusable="false"><path d="M3 5Q58 1 137 4M103 7l22-1"/></svg></h2></div><svg class="qr-glance-flight" viewBox="0 0 180 42" aria-hidden="true" focusable="false"><path class="qr-glance-trail" d="M2 30c29-25 46 15 72-2s37-15 65-9"/><path class="qr-glance-plane" d="m144 8 30 9-27 14 4-12 23-2-23 2Z"/></svg></header>${present.length ? `<dl class="qr-glance-tiles" style="--glance-count:${present.length}">${present.map(([label,value])=>`<div class="qr-glance-tile"><svg class="qr-glance-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons[label]}</svg><div><dt>${label}</dt><dd>${escape(value)}</dd></div></div>`).join('')}</dl>` : ''}</section>`;
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
