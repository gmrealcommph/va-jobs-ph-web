// Synthetic local preview. No provider, credentials, or live database.
import {writeFile,readFile} from 'node:fs/promises';
import {digestMessage} from '../src/daily-digest.js';
const items=[{job_id:'535',title:'Digital Marketing & Social Media Manager',company:'Example Company',location:'Philippines',employment_type:'full_time',salary_min_usd:1500,salary_max_usd:2000,salary_period:'monthly',schedule_region:'philippines',match_score:100},
  {job_id:'536',title:'Marketing Coordinator',company:'Example Company',location:'Remote',employment_type:'part_time',match_score:75}];
const message=digestMessage({site:'https://veeays.com'},items,{profile:{full_name:'Alex'},email:'preview@example.invalid'},'2026-10-03');
const logo=await readFile(new URL('../public/veeays-logo.png',import.meta.url));
await writeFile(process.argv[2] || 'daily-digest-preview.html',message.html.replace('https://veeays.com/veeays-logo.png',`data:image/png;base64,${logo.toString('base64')}`));
