// Offline contract preview. No credentials, live database or network fetches.
import {readFile} from 'node:fs/promises';
import {generateWithProvider,sourceUnits} from '../src/quick-read-generation.js';
import {INPUT_ENVELOPE_ALLOWANCE,MAX_INPUT_TOKENS} from '../src/quick-read-input-bound.js';
import {SUMMARY_SECTIONS} from '../src/quick-read-summary.js';
const source=await readFile(new URL('../test/fixtures/executive-assistant-25943.txt',import.meta.url),'utf8');
const sample=JSON.parse(await readFile(new URL('../test/fixtures/executive-assistant-25943-summary.json',import.meta.url),'utf8'));
let request;
const payload=await generateWithProvider({QUICK_READ_GENERATION_ENABLED:'true',OPENAI_API_KEY:'offline-placeholder',QUICK_READ_MODEL:'gpt-5-mini'},source,async(url,init)=>{
  request=JSON.parse(init.body);
  return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(sample)}]}]});
});
const bytes=new TextEncoder().encode(JSON.stringify(request)).length;
const output=JSON.stringify(sample);
const prose=Object.keys(SUMMARY_SECTIONS).map(k=>sample[k].text).join(' ');
console.log(JSON.stringify({mode:'offline-hand-authored-acceptance-fixture',paid_calls:0,actual_cost_usd:0,source_units:sourceUnits(source).length,summary_words:prose.split(/\s+/).length,request_bytes:bytes,input_token_upper_bound:bytes+INPUT_ENVELOPE_ALLOWANCE,rough_input_tokens_at_4_bytes_per_token:Math.ceil(bytes/4),rough_visible_output_tokens_at_4_bytes_per_token:Math.ceil(new TextEncoder().encode(output).length/4),max_output_tokens:request.max_output_tokens,benchmark_cost_upper_bound_usd:((bytes+INPUT_ENVELOPE_ALLOWANCE)*0.25+request.max_output_tokens*2)/1e6,global_request_cost_upper_bound_usd:(MAX_INPUT_TOKENS*0.25+request.max_output_tokens*2)/1e6},null,2));
for(const [key,label] of Object.entries(SUMMARY_SECTIONS)) console.log('\n'+label+'\n\n'+payload.summary[key].text);
