import { formatQuickRead } from './quick-read.js';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels = {about_role:'About the role', responsibilities:"What you'll do", requirements:"What they're looking for", nice_to_have:'Nice to have', important_requirements:'Important requirements', benefits:'Benefits', company_overview:'About the company', application_notes:'Application notes', other_details:'Other source details'};
export function renderJobRead(description) {
  const quick = formatQuickRead(description);
  const original = `<div class="qr-original">${escape(description)}</div>`;
  if (!quick) return `<section class="qr"><h2>Original description</h2><p>Quick Read is unavailable for this listing. Read the employer's original description below.</p>${original}</section>`;
  return `<section class="qr"><h2>✨ VeeAys Quick Read</h2><p class="qr-disclosure">We've organized this employer's listing to make it easier to scan. Important requirements and details come from the original job posting.</p><p class="qr-disclosure">Structured details above and employer wording below are shown separately; any differences are left visible.</p><div class="qr-content">${Object.entries(labels).filter(([key])=>quick[key].length).map(([key,label])=>`<section class="qr-section"><h3>${label}</h3><ul>${quick[key].map(text=>`<li>${escape(text)}</li>`).join('')}</ul></section>`).join('')}</div><details class="qr-source"><summary>Original description · View untouched source</summary>${original}</details></section>`;
}
export function renderAtAGlance(job) {
  const fields = [['Location',job.location],['Work setup',job.workplace_type || (job.remote === true ? 'Remote' : '')]];
  const present = fields.filter(([,v])=>typeof v === 'string' && v.trim());
  return present.length ? `<section class="qr-glance" aria-labelledby="at-a-glance"><h2 id="at-a-glance">At a glance</h2><dl>${present.map(([label,value])=>`<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></section>` : '';
}
