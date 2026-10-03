import {esc, categoryPath} from './render.js';

// Decorative, local illustrations. Category names and routing come from live data.
const illustrations = {
  'Account Management': '<circle cx="20" cy="15" r="5"/><circle cx="44" cy="15" r="5"/><path d="M10 34v-7q10-9 20 0m4 0q10-9 20 0v7M17 36l10-10 10 4 9 9-8 8-11-2-10-9Z"/><path d="m29 35 8 8m-14-4 8 8"/>',
  'Bookkeeping & Finance': '<rect x="10" y="10" width="29" height="44" rx="5"/><path d="M17 18h15v9H17zM17 35h2m10 0h2m-14 9h2m10 0h2M44 17h10v34l-5-3-5 3M47 25h4m-4 7h4"/>',
  'Customer Support': '<path d="M13 35v-6a19 19 0 0 1 38 0v14q0 10-14 10"/><rect x="9" y="28" width="9" height="17" rx="4"/><rect x="46" y="28" width="9" height="17" rx="4"/><path d="M24 23h16v13H30l-6 5V23Z"/><circle cx="34" cy="53" r="3"/>',
  'Data Entry': '<path d="M22 8h22l8 8v19M22 8v21m22-21v10h8M29 19h7m-7 7h15"/><rect x="8" y="34" width="48" height="21" rx="5"/><path d="M15 41h2m7 0h2m7 0h2m7 0h2m-29 7h2m7 0h17"/>',
  'Design & Creative': '<path d="M34 11q-24 0-24 22t22 21q7 0 5-7t8-8q12 0 9-12T34 11Z"/><circle cx="20" cy="29" r="3"/><circle cx="28" cy="20" r="3"/><circle cx="41" cy="22" r="3"/><path d="m19 48 4-12 22-22 7 7-22 22-11 5Zm4-12 7 7"/>',
  'E-commerce': '<path d="M14 23h36l4 31H10l4-31Z"/><path d="M24 26V16a8 8 0 0 1 16 0v10M24 38q8 9 16 0"/>',
  'Executive Assistant': '<rect x="10" y="15" width="44" height="39" rx="6"/><path d="M10 27h44M21 10v11m22-11v11m-22 20 7 7 15-15"/>',
  'Marketing': '<path d="m10 27 17-3 26-13v36L27 34l-17-3v-4Zm17-3v10m-9 0 5 20h10l-6-20M57 22l4-2m-4 17 4 2"/>',
  'Operations & Admin': '<rect x="12" y="14" width="31" height="40" rx="5"/><rect x="20" y="9" width="15" height="10" rx="3"/><path d="M20 28h15m-15 8h9m-9 8h9M44 34l3-4 4 3 5 1v5l3 4-3 4v5h-5l-4 3-3-4-5-1v-5l-3-4 3-4v-5h5Z"/><circle cx="47" cy="43" r="5"/>',
  'Other Remote': '<rect x="8" y="22" width="35" height="25" rx="3"/><path d="M5 53h43M16 53l2-6m14 0 2 6"/><circle cx="45" cy="20" r="13"/><ellipse cx="45" cy="20" rx="5" ry="13"/><path d="M32 20h26"/>',
  'Project Management': '<rect x="9" y="11" width="46" height="42" rx="5"/><path d="M9 23h46m-30 0v30m15-30v30M14 31h6m9 0h6m9 0h6M14 40l2 2 4-5m9 4h6m9 5h6"/>',
  'Recruitment & HR': '<circle cx="27" cy="20" r="9"/><path d="M11 52v-7a16 16 0 0 1 32 0v7M42 14a7 7 0 0 1 0 14m4 9q9 1 9 10v5M47 7v8m-4-4h8"/>',
  'Sales': '<path d="M11 12v42h43M20 46V35h7v11m6 0V26h7v20m6 0V17h7v29M17 28l14-13 9 4 15-12m-10 0h10v10"/>',
  'Social Media': '<rect x="16" y="7" width="32" height="50" rx="7"/><path d="M26 13h12m-10 38h8M32 41l-12-11q-5-10 5-10 5 0 7 5 2-5 7-5 10 0 5 10L32 41Z"/>',
  'Virtual Assistant': '<rect x="10" y="16" width="40" height="30" rx="4"/><path d="M6 53h48l-4-7H10l-4 7Zm19-7h10M23 32l5 5 10-11M51 4l2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7Z"/>',
  'Writing & Content': '<path d="M13 9h25l10 10v34H13V9Zm25 0v12h10M21 28h14m-14 8h8m-8 8h6M33 48l3-10 17-17 6 6-17 17-9 4Zm3-10 6 6"/>'
};
export const categoryIllustrationNames = Object.keys(illustrations);
export function categoryPage(entries) {
  const cards = entries.map(({name,count},index) => `<a class="category-card category-accent-${index % 4}" href="${categoryPath(name)}"><span class="category-icon" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${illustrations[name] || illustrations['Other Remote']}</svg></span><div class="category-card-copy"><h2>${esc(name)}</h2><p class="category-count">${count} ${count === 1 ? 'job' : 'jobs'} available</p></div><span class="category-explore">Explore jobs <span class="category-arrow" aria-hidden="true">→</span></span></a>`).join('');
  return `<section class="wrap category-page category-directory"><div class="category-intro"><div class="kicker">FIND YOUR DIRECTION</div><h1>Work that fits<br><em>your strengths.</em></h1><svg class="category-flight" viewBox="0 0 180 100" aria-hidden="true"><path d="M4 79c30-65 65 22 112-34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 6" stroke-linecap="round"/><path d="m115 27 51-17-17 49-11-21-23-11Z" fill="#e8eeac" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="m138 38 28-28" stroke="currentColor" stroke-width="1.5"/></svg><p class="category-curation"><strong>${entries.length} ways to find your next opportunity</strong><span>Browse by the kind of work you do best.</span></p></div><div class="category-grid">${cards || '<p>No categories are available yet. Check back soon.</p>'}</div></section>`;
}
