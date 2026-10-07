// Private, bounded source references only. Never retain provider text, reasoning,
// response IDs, headers, exception messages or duplicated employer descriptions.
import {SECTIONS, sourceUnits} from './quick-read-generation.js';
export function failureDiagnostics(selection, description, code) {
  let units;
  try { units=sourceUnits(description); } catch { return null; }
  if (!selection || typeof selection!=='object' || Array.isArray(selection)) return null;
  const result={version:1,source_unit_count:units.length,selection:{},truncated:false,
    invalid_reference_count:0,duplicate_reference_count:0,invalid_section_count:0};
  const seen=new Set(); let budget=512;
  for (const section of SECTIONS) {
    const ids=selection[section];
    if (!Array.isArray(ids)) { result.invalid_section_count++; continue; }
    result.selection[section]=[];
    for (const id of ids) {
      if (!Number.isInteger(id) || id<0 || id>=units.length) result.invalid_reference_count++;
      else if (seen.has(id)) result.duplicate_reference_count++;
      else seen.add(id);
      if (budget>0) {
        result.selection[section].push(Number.isSafeInteger(id) && Math.abs(id)<=1000000 ? id : null);
        budget--;
      } else result.truncated=true;
    }
  }
  result.missing_ids=units.filter(u=>!seen.has(u.id)).map(u=>u.id);
  result.unknown_field_count=Object.keys(selection).filter(k=>!SECTIONS.includes(k)).length;
  // Error code is stored separately; no untrusted message is copied here.
  return result;
}
export function storedSelection(payload, description) {
  let units;
  try { units=sourceUnits(description); } catch { return null; }
  const ids=new Map(units.map(u=>[u.text,u.id]));
  return Object.fromEntries(SECTIONS.map(k=>[k,Array.isArray(payload?.[k]) ? payload[k].map(t=>ids.get(t) ?? null) : null]));
}
