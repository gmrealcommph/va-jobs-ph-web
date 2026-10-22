const DAILY_LIMIT_USD = 0.50;
const REQUEST_HOLD_USD = 0.14;
const DAY_SECONDS = 86400;

function utcDay(now) {
  const date = new Date(now);
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 1000;
  return { day: new Date(start * 1000).toISOString().slice(0, 10), start, end: start + DAY_SECONDS };
}

export async function readQuickReadDailyCost(env, { fetcher = fetch, now = Date.now() } = {}) {
  const adminKey = env.OPENAI_QUICKREADS_ADMIN;
  const apiKeyId = env.OPENAI_QUICK_READS_API_KEY_ID;
  if (!adminKey || !apiKeyId) throw new Error('spend_guard_not_configured');

  const { start, end } = utcDay(now);
  let page = null;
  let total = 0;
  let pageCount = 0;
  do {
    if (++pageCount > 20) throw new Error('spend_data_unavailable');
    const params = new URLSearchParams({
      start_time: String(start),
      end_time: String(end),
      bucket_width: '1d',
      limit: '180'
    });
    params.append('group_by', 'api_key_id');
    params.append('api_key_ids', apiKeyId);
    if (page) params.set('page', page);

    const response = await fetcher(`https://api.openai.com/v1/organization/costs?${params}`, {
      headers: { authorization: `Bearer ${adminKey}`, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error('spend_data_unavailable');
    const data = await response.json();
    if (!Array.isArray(data.data) || typeof data.has_more !== 'boolean') throw new Error('spend_data_unavailable');
    for (const bucket of data.data) {
      if (!Array.isArray(bucket.results)) throw new Error('spend_data_unavailable');
      for (const row of bucket.results) {
        if (row.api_key_id !== apiKeyId) continue;
        const value = row.amount?.value;
        if (row.amount?.currency !== 'usd' || typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
          throw new Error('spend_data_unavailable');
        }
        total += value;
      }
    }
    page = data.has_more ? data.next_page : null;
    if (data.has_more && (typeof page !== 'string' || !page)) throw new Error('spend_data_unavailable');
  } while (page);

  return { day: utcDay(now).day, actualUsd: Number(total.toFixed(8)), holdUsd: REQUEST_HOLD_USD, limitUsd: DAILY_LIMIT_USD };
}

export { DAILY_LIMIT_USD, REQUEST_HOLD_USD };
