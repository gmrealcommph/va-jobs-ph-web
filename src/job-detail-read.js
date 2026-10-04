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
  const fields = [['Salary',formatSalary(job)],['Schedule',displayValue(job.schedule_region, 'schedule')],['Location',displayValue(job.location)],['Work setup',displayValue(job.workplace_type) || (job.remote === true ? 'Remote' : '')],['Employment type',displayValue(job.employment_type)],['Engagement',displayValue(job.engagement_type)],['Experience',displayValue(job.experience_level)]];
  const present = fields.filter(([,v])=>typeof v === 'string' && v.trim());
  return present.length ? `<section class="qr-glance" aria-labelledby="at-a-glance"><h2 id="at-a-glance">At a glance</h2><dl>${present.map(([label,value])=>`<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></section>` : '';
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
