// GPT-5-mini uses byte-based BPE: text tokens cannot exceed UTF-8 bytes.
// Count the ENTIRE serialized request (including schema), which overcounts JSON
// syntax, plus a fixed allowance for the single input/instructions/schema envelope.
// This is a conservative upper bound, not an estimate or an extra provider call.
export const MAX_INPUT_TOKENS = 100000;
export const INPUT_ENVELOPE_ALLOWANCE = 4096;
export function boundedProviderBody(request) {
  if(request.model!=='gpt-5-mini') throw new Error('provider_model_not_allowed');
  const body=JSON.stringify(request);
  const upperBound=new TextEncoder().encode(body).byteLength+INPUT_ENVELOPE_ALLOWANCE;
  if(upperBound>MAX_INPUT_TOKENS) throw new Error('input_limit_exceeded');
  return body;
}
