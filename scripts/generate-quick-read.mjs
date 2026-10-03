// Operator tool; never import into browser assets. No keys are printed or saved.
const args=process.argv.slice(2);
const get=flag=>args[args.indexOf(flag)+1];
const site=new URL(get('--site') || 'https://veeays.com');
const job=get('--job');
if(site.protocol!=='https:' || site.username || site.password || !/^[1-9]\d{0,18}$/.test(job || '') || !process.env.QUICK_READ_ADMIN_TOKEN) {
  console.error('Usage: set QUICK_READ_ADMIN_TOKEN in your operator environment, then node scripts/generate-quick-read.mjs --site https://veeays.com --job 37688');
  process.exit(1);
}
try {
  const response=await fetch(new URL(`/internal/quick-read/${job}`,site.origin),{
    method:'POST',headers:{Authorization:`Bearer ${process.env.QUICK_READ_ADMIN_TOKEN}`},signal:AbortSignal.timeout(120000)
  });
  const result=await response.json();
  console.log(JSON.stringify(result,null,2));
  if(!response.ok || !['ready','unchanged'].includes(result.status)) process.exitCode=1;
} catch {console.error('Generation request did not complete. Inspect the private cache status in Supabase before retrying.');process.exitCode=1;}
