import {sourceFingerprint, validateStored} from './quick-read-generation.js';

// Only already-selected public jobs enter this server-side, bounded lookup.
export async function attachQuickReadAvailability(env, jobs) {
  for (const job of jobs) job.quick_read_ready = false;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !/^(sb_secret_|eyJ)/.test(key)) {
    console.info(JSON.stringify({event:'quick_read_availability',status:'server_key_unavailable'}));
    return jobs;
  }
  let stage='configuration';
  try {
    const base = new URL(env.SUPABASE_URL);
    if (base.protocol !== 'https:' || base.username || base.password) return jobs;
    const candidates = jobs.filter(job => /^\d{1,19}$/.test(String(job.id)) && typeof job.description === 'string');
    for (let offset = 0; offset < candidates.length; offset += 100) {
      const batch = candidates.slice(offset, offset + 100);
      const url = new URL('/rest/v1/job_quick_reads', base);
      url.searchParams.set('select', 'job_id,source_hash,payload');
      url.searchParams.set('status', 'eq.ready');
      url.searchParams.set('job_id', `in.(${batch.map(job => String(job.id)).join(',')})`);
      stage='cache_request';
      const response = await fetch(url, {
        headers: {apikey: key, ...(key.startsWith('sb_secret_') ? {} : {Authorization: 'Bearer ' + key})},
        redirect: 'manual', signal: AbortSignal.timeout(3000)
      });
      if (!response.ok) {
        console.info(JSON.stringify({event:'quick_read_availability',status:'cache_unavailable',http_status:response.status}));
        continue;
      }
      stage='cache_validation';
      const rows = await response.json();
      if (!Array.isArray(rows)) continue;
      const cached = new Map(rows.map(row => [String(row.job_id), row]));
      await Promise.all(batch.map(async job => {
        const read = cached.get(String(job.id));
        try {
          job.quick_read_ready = !!(read && read.source_hash === await sourceFingerprint(job.description) && validateStored(read.payload, job.description));
        } catch { /* Invalid or outdated output never earns a marker. */ }
      }));
    }
  } catch {
    console.info(JSON.stringify({event:'quick_read_availability',status:'unavailable',stage}));
  }
  console.info(JSON.stringify({event:'quick_read_availability',status:'checked',jobs:jobs.length,ready:jobs.filter(job=>job.quick_read_ready).length}));
  return jobs;
}

export function quickReadMarker(job) {
  return job.quick_read_ready === true || job.quick_read
    ? ' <span class="quick-read-marker" role="img" aria-label="Quick Read available" title="Quick Read available">✨</span>'
    : '';
}
