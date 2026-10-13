// Display only: never treat a job's hiring geography as employer headquarters.
// These importers retain ATS job locations / Himalayas locationRestrictions.
const knownSources = new Set(['ashby', 'lever', 'greenhouse', 'workable', 'himalayas']);
const clean = value => typeof value === 'string' ? value.trim() : '';

export function jobLocation(job = {}) {
  const location = clean(job.location);
  const source = clean(job.source).toLowerCase();
  const workplace = clean(job.workplace_type).toLowerCase().replace(/[_ -]/g, '');
  // Explicit hybrid/on-site values take precedence over legacy remote flags.
  const setup = ({remote:'Remote', hybrid:'Hybrid', onsite:'On-site'})[workplace]
    || (job.remote === true ? 'Remote' : '');
  const geography = location.replace(/^(?:remote|home[ -]based)\b\s*[-,:]?\s*/i, '')
    .replace(/\s*\(?\bremote\)?$/i, '').replace(/^\((.*)\)$/, '$1').trim();
  const unknown = !location || /^(?:unknown|unspecified|not specified|n\/a|remote|fully remote|work[ -]from[ -]home|wfh)$/i.test(location);
  // Only an explicit, unambiguous Philippines job location gets this claim.
  // Keep city restrictions and multi-country lists intact in the fallback.
  const philippines = /^(?:the )?philippines$/i.test(geography);
  const hiring = setup === 'Remote' && knownSources.has(source) && philippines
    ? 'Hiring in Philippines'
    : unknown ? 'Hiring location not specified' : `Listed location: ${location}`;
  // No employer-country provenance exists in the current public schema.
  // In particular, company names, eligibility and remote flags are not evidence.
  return {setup, hiring, location, summary:[setup, hiring].filter(Boolean).join(' · ')};
}
