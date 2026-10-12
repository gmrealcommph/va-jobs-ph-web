import {readFile,writeFile} from 'node:fs/promises';
import {sourceReader,verifyListing} from '../src/job-verification.js';
// Offline snapshot input; no database credentials, no database writes.
const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node scripts/verify-job-health.mjs input.json output.json');
const jobs=JSON.parse(await readFile(input,'utf8'));if(!Array.isArray(jobs)||jobs.length>1000)throw Error('Expected at most 1000 jobs');
const read=sourceReader(fetch,3000);
const checked_at=new Date().toISOString(),rows=[];let index=0;
await Promise.all(Array.from({length:2},async()=>{while(index<jobs.length){const job=jobs[index++];
 rows.push(await verifyListing(job,read,new Date(checked_at)));
 if(rows.length%50===0)console.log('Checked '+rows.length+'/'+jobs.length);
}}));
rows.sort((a,b)=>a.id-b.id);const counts=rows.reduce((a,r)=>{const k=r.evidence.status+':'+r.evidence.reason;a[k]=(a[k]||0)+1;return a;},{});
await writeFile(output,JSON.stringify({checked_at,dry_run:true,visibility_changes:0,counts,rows},null,2));console.log(JSON.stringify({total:rows.length,counts,visibility_changes:0}));
