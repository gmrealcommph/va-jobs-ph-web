// Display-only projection. Call only AFTER complete payload validation; never persist it.
import { sourceUnits } from './quick-read-generation.js';
const headings = /^(?:the opportunity|about the role|about the job|job summary|what you'll do|what you will do|responsibilities|key responsibilities|duties|key duties|responsibilities include|who you are|requirements|qualifications|skills and experience|what they're looking for|what we're looking for|required qualifications|nice to have|preferred qualifications|preferred experience|what we offer you|what we offer|benefits|about us|about the company|work authorization|important requirements|application notes|how to apply|salary range|monthly pay range|eoe statement)$/i;
const normalize = text => text.trim().replace(/[_–—-]+/g,' ').replace(/\s+/g,' ').toLowerCase();
export function displayValue(value, field) {
  if (typeof value !== 'string') return '';
  const key = normalize(value);
  if (field === 'schedule' && key === 'philippines') return 'Philippines hours';
  return ({'full time':'Full-time','part time':'Part-time','entry level':'Entry Level','philippines':'Philippines'})[key] || value;
}
export function presentQuickRead(validated, description, job) {
  const result = {...validated, salary:[]};
  // Positions identify aggregator-owned tails; no broad category/prose deletion.
  // Legacy deterministic text can exceed organizer limits: retain it safely.
  let units;
  try { units = sourceUnits(description); } catch { units = []; }
  const marker = units.findIndex(u => /^Originally posted on Himalayas\.?$/i.test(u.text));
  const index = new Map(units.map((u,i) => [u.text,i]));
  const metadata = {'location':'location','employment type':'employment_type','employment level':'experience_level','seniority':'experience_level'};
  for (const [key, lines] of Object.entries(validated)) {
    if (!Array.isArray(lines)) continue;
    result[key] = lines.filter(text => {
      const label = text.trim().replace(/:$/,'').replace(/’/g,"'");
      if (/^skills & experience$/i.test(label)) return false;
      if (headings.test(label)) return false;
      if (/^Originally posted on Himalayas\.?$/i.test(text) || /^Timezone restrictions:\s*\d+\s*$/i.test(text)) return false;
      if (marker >= 0 && index.get(text) > marker && /^(?:Categories|Job functions):/i.test(text)) return false;
      const match = text.match(/^(Location|Employment Type|Employment Level|Seniority):\s*(.+)$/i);
      if (match) {
        const value = job[metadata[match[1].toLowerCase()]];
        // Only whole, identical metadata values disappear. Contradictions remain visible.
        if (typeof value === 'string' && value.trim() && normalize(value) === normalize(match[2])) return false;
      }
      // Move explicit monetary source units intact. A monthly heading supplies an
      // explicit period only to its immediately following unit, never by inference.
      if (['other_details','about_role'].includes(key) && /^(?:(?:Salary|Compensation):?\s*)?(?:₱|PHP\s*|USD\s*|\$|EUR\s*|€)\s*[\d,]+/i.test(text)) {
        const previous = units[(index.get(text) ?? -1)-1]?.text;
        result.salary.push(/^Monthly Pay Range:?$/i.test(previous || '') ? `Monthly Pay Range: ${text}` : text);
        return false;
      }
      return true;
    });
  }
  return result;
}
