export const COLUMNS = 'id,title,company,description,category,location,remote,workplace_type,source,job_url,posted_at,collected_at,company_logo_url';
export const PAGE_SIZE = 15;

export function config(env) {
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  if (!key?.startsWith('sb_publishable_') || key.includes('replace_me')) throw new Error('Configure a Supabase publishable key.');
  const url = new URL(env.SUPABASE_URL);
  if (url.protocol !== 'https:') throw new Error('Supabase URL must use HTTPS.');
  return { key, url };
}

// Quote PostgREST filter values, including commas, parentheses and quotes.
export const literal = value => '"' + String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"') + '"';
export async function query(env, params, { offset = 0, limit = PAGE_SIZE, count = false } = {}) {
  const { key, url } = config(env);
  const endpoint = new URL('/rest/v1/public_jobs', url);
  for (const [name, value] of Object.entries(params)) endpoint.searchParams.set(name, value);
  endpoint.searchParams.set('offset', String(offset));
  endpoint.searchParams.set('limit', String(limit));
  const response = await fetch(endpoint, {
    headers: { apikey: key, Accept: 'application/json', ...(count ? { Prefer: 'count=exact' } : {}) },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`Public jobs request failed (${response.status}).`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Invalid jobs response.');
  const total = response.headers.get('content-range')?.split('/')[1];
  if (count && (!total || total === '*' || !/^\d+$/.test(total))) throw new Error('Missing job count.');
  return { rows, total: count ? Number(total) : null };
}
export function listJobs(env, { page = 1, search = '', category = '' } = {}) {
  const params = { select: COLUMNS, order: 'posted_at.desc.nullslast,id.asc' };
  if (category) params.category = `eq.${literal(category)}`;
  if (search) {
    // User wildcard characters are treated as spaces, never filter syntax.
    const term = literal(`*${search.replace(/[%*_\\]/g, ' ').trim()}*`);
    params.or = `(title.ilike.${term},company.ilike.${term},description.ilike.${term})`;
  }
  return query(env, params, { offset: (page - 1) * PAGE_SIZE, count: true });
}
export async function getJob(env, id) {
  const numericId = String(id).trim();

  if (!/^\d+$/.test(numericId)) {
    return null;
  }

  const { rows } = await query(
    env,
    {
      select: COLUMNS,
      id: `eq.${numericId}`
    },
    {
      limit: 1
    }
  );

  return rows[0] || null;
}
export async function categories(env) {
  const names = new Set();
  let offset = 0;
  // Honor the server's actual row cap rather than assuming it is 1,000.
  while (true) {
    const { rows, total } = await query(env, { select: 'category', order: 'id.asc' }, { offset, limit: 1000, count: true });
    for (const row of rows) if (typeof row.category === 'string' && row.category.trim()) names.add(row.category);
    offset += rows.length;
    if (offset >= total) break;
    if (!rows.length) throw new Error('Incomplete category response.');
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}
