// Private structural metadata only. Never copy free-form provider values.
const statuses=new Set(['completed','incomplete','failed','in_progress','queued','cancelled']);
const reasons=new Set(['max_output_tokens','content_filter']);
const normalize=(value,allowed)=>value==null?'missing':allowed.has(value)?value:'other';
export function providerFailureDiagnostics(data,httpStatus) {
  const outputArray=Array.isArray(data.output);
  const output=outputArray?data.output:[];
  let contentArray=false,textCount=0,textPresent=false,scanned=0;
  let truncated=output.length>256;
  for(const item of output.slice(0,256)) {
    if(!Array.isArray(item?.content)) continue;
    contentArray=true;
    for(const content of item.content) {
      if(scanned===256) { truncated=true; break; }
      scanned++;
      if(content?.type==='output_text') {
        textCount++;
        if(typeof content.text==='string' && content.text.trim().length>0) textPresent=true;
      }
    }
  }
  return {version:2,kind:'provider_structure',provider:'openai',
    code:data.status!=='completed'?'response_not_completed':'missing_output_array',
    status:normalize(data.status,statuses),reason:normalize(data.incomplete_details?.reason,reasons),
    http_status:Number.isInteger(httpStatus)&&httpStatus>=100&&httpStatus<=599?httpStatus:null,
    output_array:outputArray,output_count:Math.min(output.length,1000),
    content_array:contentArray,text_count:textCount,text_present:textPresent,scan_truncated:truncated};
}
