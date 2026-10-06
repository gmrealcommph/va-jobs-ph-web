// Static, local category artwork: no remote assets or request-time generation.
import { displayValue } from './quick-read-presentation.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  category:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M8 5V3h8v2M3 10h18M10 10v3h4v-3"/>',
  location:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  setup:'<path d="m3 10 9-7 9 7M5 9v11h5M19 9v4M12 14h8v6h-8zM10 21h12"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
// Explicit category aliases avoid assigning support art to unrelated IT support.
// Add future artwork and its aliases here without changing the header renderer.
const categoryArtworks = [
  {
    src: '/images/job-header-customer-support.png', width: 1678, height: 937,
    aliases: ['customer support', 'customer service', 'customer support service',
      'customer service support', 'customer support customer service',
      'customer service customer support', 'customer care', 'customer success']
  }
];
const categoryKey = value => String(value ?? '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
export function categoryArtwork(category) {
  const key = categoryKey(category);
  return categoryArtworks.find(art => art.aliases.includes(key)) ?? null;
}
// This chooses decorative artwork only; it never normalizes displayed/stored data.
export function categoryVisual(category) {
  const key = String(category || '').toLowerCase();
  for (const [family, pattern] of Object.entries({finance:/financ|account|bookkeep/,marketing:/market|social|content/,support:/support|customer/,design:/design|video|creative/,operations:/operation|assistant|project|admin/,sales:/sales|business development/,commerce:/commerce|retail/,tech:/tech|software|develop|engineer|\bit\b/})) {
    if (pattern.test(key)) return family;
  }
  return 'generic';
}
function workspace(family, remote) {
  const screen = {
    finance:'<path d="M107 104h119M107 116h119M107 128h119M130 94v48M160 94v48M192 94v48" stroke="#a8b5a3"/><path d="M165 128h24" stroke="#7b956a" stroke-width="5"/>',
    marketing:'<rect x="106" y="95" width="34" height="40" fill="#d4c1aa"/><path d="M152 99h67M152 113h53M152 128h60" stroke="#a1b097" stroke-width="6"/>',
    support:'<rect x="106" y="96" width="74" height="19" rx="7" fill="#b8c7b1"/><rect x="149" y="122" width="75" height="16" rx="7" fill="#d9c6ae"/>',
    design:'<rect x="109" y="96" width="111" height="24" fill="#c4b0a0"/><path d="M110 132h25m5 0h43m5 0h32" stroke="#8ea38a" stroke-width="7"/>',
    operations:'<path d="M109 98h111M109 114h111M109 130h111" stroke="#acb5a0" stroke-width="4"/><path d="m110 97 3 3 5-6m-8 19 3 3 5-6" stroke="#637d62"/>',
    sales:'<path d="M112 136v-20m25 20v-32m25 32v-23m25 23V96m25 40v-49" stroke="#9aad8e" stroke-width="12"/>',
    commerce:'<rect x="108" y="97" width="31" height="36" fill="#cbbb9f"/><rect x="150" y="97" width="31" height="36" fill="#b7c5ae"/><rect x="192" y="97" width="31" height="36" fill="#d5c7b5"/>',
    tech:'<path d="m124 100-12 10 12 10m78-20 12 10-12 10m-32-18-10 26M132 137h64" stroke="#82957c" stroke-width="3"/>',
    generic:'<path d="M110 101h108M110 116h84M110 131h97" stroke="#a5b29b" stroke-width="6"/>'
  }[family];
  return `<div class="jh-workspace" data-visual="${family}" aria-hidden="true"><svg viewBox="0 0 360 250" focusable="false">
    <ellipse cx="184" cy="216" rx="151" ry="13" fill="#3f4934" opacity=".08"/>
    <path d="M37 196 317 180 341 211 63 232Z" fill="#ded1b9"/>
    <g transform="rotate(-8 275 130)"><rect x="248" y="103" width="60" height="69" fill="#e2e8bf"/>${remote ? '<text x="256" y="123" font-family="Georgia,serif" font-size="9" fill="#677358">Remote</text><text x="256" y="136" font-family="Georgia,serif" font-size="9" fill="#677358">opportunity</text>' : '<path d="M256 120h40m-40 12h30" stroke="#a5ae8a"/>'}</g>
    <g transform="rotate(-5 160 140)"><rect x="91" y="77" width="151" height="91" rx="6" fill="#777c72"/><rect x="99" y="85" width="135" height="72" rx="2" fill="#e7e9df"/>${screen}<path d="m91 168-33 35h193l-9-35Z" fill="#b9bcb2"/><path d="m103 175-13 16h134l-3-16Z" fill="#8c9287"/><path d="M137 193h43l4 7h-50Z" fill="#cdd0c5"/></g>
    <g transform="rotate(12 266 201)"><rect x="235" y="178" width="56" height="38" rx="2" fill="#f5efdf"/><path d="M244 186h36m-36 8h36m-36 8h28" stroke="#c0bfaf"/><path d="M281 173v39" stroke="#777b6c" stroke-width="3"/></g>
    ${family === 'finance' ? '<g transform="rotate(-12 60 183)"><rect x="40" y="154" width="35" height="53" rx="4" fill="#a0a798"/><rect x="46" y="160" width="23" height="10" fill="#dce3cf"/><path d="M47 180h22m-22 9h22m-22 9h22" stroke="#e4e5db" stroke-width="4"/></g>' : ''}
    <ellipse cx="308" cy="173" rx="16" ry="7" fill="#e9e3d4"/><path d="M292 173v22q16 12 32 0v-22" fill="#c7c3b3"/><path d="M324 176q19-3 12 14h-12" fill="none" stroke="#bbb5a4" stroke-width="4"/><ellipse cx="308" cy="173" rx="11" ry="4" fill="#887967"/>
    <path d="M45 134q-22-38-9-57 23 11 17 49M45 129q3-50 26-53 6 29-23 55M44 121q-32-14-24-32 24 0 24 32" fill="#899c7b"/><path d="M31 129h30l-5 32H36Z" fill="#b5b19e"/>
  </svg></div>`;
}
export function renderJobHeader(job, {company, title, location, workplace, posted}) {
  const artwork = categoryArtwork(job.category);
  const visual = artwork
    ? `<div class="jh-artwork" aria-hidden="true"><img src="${artwork.src}" width="${artwork.width}" height="${artwork.height}" alt="" decoding="async"></div>`
    : workspace(categoryVisual(job.category), job.remote === true || /^remote$/i.test(String(workplace).trim()));
  const pill = (name, value, href) => `<${href ? 'a' : 'span'} class="jh-pill"${href ? ` href="${href}"` : ''}>${icon(name)}<span>${esc(value)}</span></${href ? 'a' : 'span'}>`;
  return `<div class="job-detail-hero-card jh-card">
    ${artwork ? '' : '<svg class="jh-globe" viewBox="0 0 240 240" aria-hidden="true" focusable="false"><circle cx="120" cy="120" r="110"/><ellipse cx="120" cy="120" rx="55" ry="110"/><path d="M10 120h220M120 10v220M25 65h190M25 175h190"/></svg>'}
    <div class="jh-top"><div class="jh-company"><div class="jh-eyebrow"><span aria-hidden="true">✳</span> THE COMPANY</div><div>${esc(company)}</div></div>${posted ? `<div class="jh-posted">${icon('calendar')}<span>Posted ${esc(posted)}</span></div>` : ''}</div>
    <div class="jh-body"><div class="jh-copy"><h1><span>${esc(title)}</span><i aria-hidden="true">✦</i></h1><div class="jh-pills">${job.category ? pill('category', job.category, `/categories/${encodeURIComponent(job.category)}`) : ''}${pill('location', displayValue(location, 'location'))}${workplace ? pill('setup', displayValue(workplace, 'setup')) : ''}</div></div>${visual}</div>
    <div class="jh-footer">FILIPINO TALENT · GLOBAL OPPORTUNITIES</div><span class="job-detail-corner" aria-hidden="true"></span>
  </div>`;
}
