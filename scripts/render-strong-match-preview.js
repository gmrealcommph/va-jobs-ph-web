// Local synthetic preview only: no network, no recipient reads, no sends.
import {writeFile,readFile} from 'node:fs/promises';
import {batchMessage} from '../src/strong-matches.js';
const job={id:535,title:'Digital Marketing & Social Media Manager',company:'Example Company',location:'Philippines',employment_type:'full_time',salary_min_usd:1500,salary_max_usd:2000,salary_period:'monthly'};
const config={site:'https://veeays.com'};
const message=batchMessage(config,[{notification:{match_score:100},job},{notification:{match_score:94},job:{id:536,title:'Marketing Coordinator',company:'Example Company',location:'Remote',employment_type:'part_time'}}],{profile:{full_name:'Alex'},email:'preview@example.invalid'});
const logo=await readFile(new URL('../public/veeays-logo.png',import.meta.url));
const html=message.html.replace('https://veeays.com/veeays-logo.png',`data:image/png;base64,${logo.toString('base64')}`);
await writeFile(process.argv[2] || 'strong-match-preview.html',html);
