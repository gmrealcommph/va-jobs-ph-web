const pages = {
  '/employers': {
    title: 'For Employers',
    description: 'Learn how VeeAys connects Filipino professionals with remote opportunities, and get in touch about employer enquiries.',
    eyebrow: 'FOR EMPLOYERS',
    heading: 'Global opportunities.<br><em>Filipino talent.</em>',
    intro: 'Remote work opens doors in both directions. VeeAys helps Filipino professionals discover opportunities from companies around the world.',
    note: 'EMPLOYER ENQUIRIES ARE OPEN',
    aside: 'Good work starts<br>with a connection.',
    cards: [
      ['01', 'Discovery, made simpler', 'We bring public remote-job listings together so Filipino professionals can explore opportunities across roles and companies.'],
      ['02', 'Your application process', 'Professionals follow the original listing to apply through the employer’s own application process. Hiring stays with the employer.'],
      ['03', 'Let’s talk', 'Have a question about a listing or want to discuss employer interest? Contact us with your company name, role link and a short description.']
    ],
    bottomTitle: 'Interested in reaching Filipino professionals?',
    bottom: 'Self-service job posting and paid employer listings are not live yet.',
    cta: '<a class="button" href="mailto:support@veeays.com?subject=VeeAys%20employer%20enquiry">Send an employer enquiry ↗</a><a class="company-text-link" href="/contact">Contact &amp; support</a>'
  },
  '/about': {
    title: 'About VeeAys',
    description: 'VeeAys helps Filipino professionals discover remote opportunities from companies around the world. Public job browsing remains free.',
    eyebrow: 'ABOUT VEEAYS',
    heading: 'Filipino talent.<br><em>A world of possibilities.</em>',
    intro: 'Finding remote work should feel more approachable. VeeAys brings opportunities from companies around the world into one place for Filipino professionals to explore.',
    note: 'DISCOVER YOUR NEXT CHAPTER',
    aside: 'Your skills.<br>New possibilities.',
    cards: [
      ['01', 'Explore for free', 'Public job browsing remains free. Discover roles, explore categories and read the details before following the original employer listing to apply.'],
      ['02', 'Keep your search together', 'An account helps you save jobs and track your applications. Your tracker is your workspace; recording an application does not submit it to an employer.'],
      ['03', 'A little more with Pro', 'VeeAys Pro adds matching, alerts and convenience to your search. Visit the Pro page for the current features and availability.']
    ],
    bottomTitle: 'Your next opportunity could be here.',
    bottom: 'Explore the roles that fit your skills, check the original listing and take your next step. Employers manage their own applications and hiring decisions.',
    cta: '<a class="button" href="/jobs">Explore remote jobs ↗</a><a class="company-text-link" href="/pro">Explore VeeAys Pro</a><a class="company-text-link" href="/contact">Get in touch</a>'
  }
};

export function companyPage(path) {
  const page = Object.hasOwn(pages, path) ? pages[path] : null;
  if (!page) return null;
  if (path === '/employers') return employerPage(page);
  return aboutPage(page);
}

// Decorative role notes are illustrative categories, never candidate records.
function employerPage(page) {
  const drawings = [
    '<rect x="10" y="8" width="36" height="42" rx="4"/><path d="M18 19h20m-20 8h14m-14 8h17M24 50v5m-9 0h28"/>',
    '<rect x="7" y="13" width="38" height="31" rx="4"/><path d="M13 21h23m-23 8h15m7 23 18-18m-10 0h10v10M7 51h22"/>',
    '<path d="M8 17h44v31H8zM8 17l22 18 22-18M17 9h26M21 55h18"/>'
  ];
  const roleDrawings = {
  "Customer Support": "<path d=\"M13 35v-6a19 19 0 0 1 38 0v14q0 10-14 10\"/><rect x=\"9\" y=\"28\" width=\"9\" height=\"17\" rx=\"4\"/><rect x=\"46\" y=\"28\" width=\"9\" height=\"17\" rx=\"4\"/><path d=\"M24 23h16v13H30l-6 5V23Z\"/><circle cx=\"34\" cy=\"53\" r=\"3\"/>",
  "Operations & Admin": "<rect x=\"12\" y=\"14\" width=\"31\" height=\"40\" rx=\"5\"/><rect x=\"20\" y=\"9\" width=\"15\" height=\"10\" rx=\"3\"/><path d=\"M20 28h15m-15 8h9m-9 8h9M44 34l3-4 4 3 5 1v5l3 4-3 4v5h-5l-4 3-3-4-5-1v-5l-3-4 3-4v-5h5Z\"/><circle cx=\"47\" cy=\"43\" r=\"5\"/>",
  "Executive Assistant": "<rect x=\"10\" y=\"15\" width=\"44\" height=\"39\" rx=\"6\"/><path d=\"M10 27h44M21 10v11m22-11v11m-22 20 7 7 15-15\"/>",
  "Virtual Assistant": "<rect x=\"10\" y=\"16\" width=\"40\" height=\"30\" rx=\"4\"/><path d=\"M6 53h48l-4-7H10l-4 7Zm19-7h10M23 32l5 5 10-11M51 4l2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7Z\"/>",
  "Marketing": "<path d=\"m10 27 17-3 26-13v36L27 34l-17-3v-4Zm17-3v10m-9 0 5 20h10l-6-20M57 22l4-2m-4 17 4 2\"/>",
  "Social Media": "<rect x=\"16\" y=\"7\" width=\"32\" height=\"50\" rx=\"7\"/><path d=\"M26 13h12m-10 38h8M32 41l-12-11q-5-10 5-10 5 0 7 5 2-5 7-5 10 0 5 10L32 41Z\"/>",
  "Design & Creative": "<path d=\"M34 11q-24 0-24 22t22 21q7 0 5-7t8-8q12 0 9-12T34 11Z\"/><circle cx=\"20\" cy=\"29\" r=\"3\"/><circle cx=\"28\" cy=\"20\" r=\"3\"/><circle cx=\"41\" cy=\"22\" r=\"3\"/><path d=\"m19 48 4-12 22-22 7 7-22 22-11 5Zm4-12 7 7\"/>",
  "Bookkeeping & Finance": "<rect x=\"10\" y=\"10\" width=\"29\" height=\"44\" rx=\"5\"/><path d=\"M17 18h15v9H17zM17 35h2m10 0h2m-14 9h2m10 0h2M44 17h10v34l-5-3-5 3M47 25h4m-4 7h4\"/>",
  "Sales": "<path d=\"M11 12v42h43M20 46V35h7v11m6 0V26h7v20m6 0V17h7v29M17 28l14-13 9 4 15-12m-10 0h10v10\"/>",
  "Project Management": "<rect x=\"9\" y=\"11\" width=\"46\" height=\"42\" rx=\"5\"/><path d=\"M9 23h46m-30 0v30m15-30v30M14 31h6m9 0h6m9 0h6M14 40l2 2 4-5m9 4h6m9 5h6\"/>",
  "Recruitment & HR": "<circle cx=\"27\" cy=\"20\" r=\"9\"/><path d=\"M11 52v-7a16 16 0 0 1 32 0v7M42 14a7 7 0 0 1 0 14m4 9q9 1 9 10v5M47 7v8m-4-4h8\"/>"
};
  const categories = ['Customer Support', 'Operations & Admin', 'Executive Assistant', 'Virtual Assistant', 'Marketing', 'Social Media', 'Design & Creative', 'Bookkeeping & Finance', 'Sales', 'Project Management', 'Recruitment & HR'];
  return { title: page.title, description: page.description, body: `<div class="employer-page">
    <section class="ep-hero"><div class="wrap ep-hero-grid">
      <div class="ep-intro"><span class="ep-eyebrow">FOR EMPLOYERS · A WORLD OF POSSIBILITIES</span><h1>Global opportunities.<br><em>Filipino talent.</em></h1><svg class="ep-underline" viewBox="0 0 260 15" aria-hidden="true"><path d="M3 9Q125 0 257 7M25 13q107-7 210-2"/></svg><p>${page.intro}</p><a class="button ep-hero-link" href="#employer-enquiry">Talk to us <span aria-hidden="true">↗</span></a></div>
      <div class="ep-collage" role="img" aria-label="Illustrated remote workspace with a generic team call, overlapping role notes for Executive Assistant, Customer Support, Marketing/Social and Operations/Admin. Filipino talent. Global teams. These are illustrative categories."><img class="ep-workspace-art" src="/images/employer-workspace.svg" alt="" width="520" height="520"></div>
    </div></section>
    <section class="wrap ep-journey" aria-labelledby="ep-how"><div class="ep-section-head"><div><span class="ep-eyebrow">HOW IT WORKS TODAY</span><h2 id="ep-how">A connection begins<br>with <em>discovery.</em></h2></div><p>A clear path to opportunities.<br>Candidates apply through your existing process.</p></div>
      <ol class="ep-steps">${page.cards.map(([number, title, copy], i) => `<li><span class="ep-step-number">${number}</span><svg class="ep-step-art" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[i]}</svg><h3>${title}</h3><p>${copy}</p><span class="ep-step-caption">${['PUBLIC LISTINGS → DISCOVERY', 'ORIGINAL LISTING → YOUR PROCESS', 'EMPLOYER ENQUIRIES → A CONVERSATION'][i]}</span></li>`).join('')}</ol>
    </section>
    <section class="ep-roles" aria-labelledby="ep-roles-title"><div class="wrap ep-roles-inner"><div><span class="ep-eyebrow">ACROSS THE WORKING DAY</span><h2 id="ep-roles-title">Many roles.<br><em>More possibilities.</em></h2><p>From the everyday essentials to the creative spark, explore the kinds of remote work featured on VeeAys.</p></div><div class="ep-talent-board"><ul class="ep-role-tags">${categories.map(name => `<li><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${roleDrawings[name]}</svg><span>${name.replaceAll('&', '&amp;')}</span></li>`).join('')}</ul><p class="ep-board-note">Different skills. One global workforce.</p></div></div></section>
    <section class="wrap ep-enquiry-wrap" id="employer-enquiry" aria-labelledby="ep-enquiry-title"><div class="ep-enquiry"><div><span class="ep-eyebrow">EMPLOYER ENQUIRIES ARE OPEN</span><h2 id="ep-enquiry-title">Interested in reaching<br><em>Filipino professionals?</em></h2><p>Employer listings are coming soon. For now, send us an enquiry and tell us about your company and opportunity.</p><div class="ep-actions">${page.cta}</div><p class="ep-availability">${page.bottom}</p></div><div class="ep-letter" aria-hidden="true"><span>TO: VEEAYS</span><img class="ep-enquiry-art" src="/images/employer-enquiry-desk.svg" alt="" width="190" height="135"><strong>A little hello.<br>A new possibility.</strong><span class="ep-letter-line"></span></div></div></section>
  </div>` };
}


// About artwork shows generic product concepts, never live jobs or match results.
function aboutPage(page) {
  const icons = [
    '<circle cx="26" cy="25" r="16"/><path d="m38 37 17 18M17 22h18m-18 7h12"/>',
    '<rect x="13" y="12" width="37" height="44" rx="4"/><path d="M23 7h17v11H23zM21 30l4 4 7-8m5 5h6M21 45l4 4 7-8m5 5h6"/>',
    '<path d="M17 42V27a15 15 0 0 1 30 0v15l5 6H12l5-6Zm10 13h10M32 4v6M7 16l5 4m40 0 5-4"/><path d="m24 30 6 6 11-13"/>'
  ];
  const steps = [
    ['DISCOVER', 'Find opportunities open to Filipino talent.', 'Public job browsing remains free. Explore roles and categories, read the details, then apply through the employer’s original application process.', 'A world to explore'],
    ['ORGANISE', 'Save jobs. Track applications. Keep your search together.', 'Your account gives you a place to save jobs and record your progress. Tracking an application in VeeAys does not submit it to an employer.', 'A little more clarity'],
    ['GET MATCHED', 'Let VeeAys surface opportunities that fit you.', 'Personalized matching connects your preferences with available job information. Pro expands your feed with match filters, Strong Match Alerts and a Daily Job Digest.', 'A search that feels like you']
  ];
  const roles = ['Executive / Virtual Assistant', 'Customer Support', 'Marketing / Social Media', 'Bookkeeping & Finance', 'Design & Creative', 'Operations & Admin', 'Project Management'];
  return { title: page.title, description: page.description, body: `<div class="company-page about-page">
    <section class="company-hero"><div class="wrap company-hero-grid">
      <div><span class="company-eyebrow">${page.eyebrow}</span><h1>${page.heading}</h1><p>${page.intro}</p></div>
      <div class="ab-hero-art"><img src="/images/about-workspace.svg" width="560" height="520" alt="Editorial illustration of a Filipino remote professional at a laptop, surrounded by notes for remote opportunities, saved jobs, application tracking and personalized matching."></div>
    </div></section>
    <section class="wrap ab-journey" aria-labelledby="ab-journey-title">
      <div class="ab-section-head"><div><span class="company-eyebrow">YOUR SEARCH, YOUR WAY</span><h2 id="ab-journey-title">From possibility<br>to <em>your next move.</em></h2></div><p>Discover what’s out there.<br>Keep what matters close.</p></div>
      <ol class="ab-steps">${steps.map(([label,title,copy,caption],i)=>`<li><div class="ab-step-top"><span class="ab-number">0${i+1}</span><span class="company-eyebrow">${label}</span><svg viewBox="0 0 64 64" aria-hidden="true">${icons[i]}</svg></div><h3>${title}</h3><p>${copy}</p><span class="ab-handnote">${caption}</span></li>`).join('')}</ol>
      <p class="ab-pro-note">Pro upgrades are coming soon. Alerts and digests require active Pro access and enabled email preferences. <a href="/pro">See current Pro features &amp; availability →</a></p>
    </section>
    <section class="ab-purpose" aria-labelledby="ab-purpose-title"><div class="wrap ab-purpose-grid">
      <div class="ab-purpose-copy"><span class="company-eyebrow">BUILT FOR FILIPINO REMOTE WORKERS</span><h2 id="ab-purpose-title">The world of remote work is big.<br><em>Finding the right opportunity shouldn’t feel that way.</em></h2><p>VeeAys brings remote opportunities from different companies and sources into one place, with a focus on roles Filipino professionals can explore.</p><p>Our aim is simple: make discovering global work easier to navigate, more organised and more useful — whether you’re looking for your first remote role or your next one.</p><span class="ab-purpose-signoff">Local roots. Wider horizons.</span></div>
      <div class="ab-role-board"><span class="company-eyebrow">THERE’S MORE THAN ONE WAY TO WORK REMOTELY</span><h3>Different skills.<br><em>Room to explore.</em></h3><ul>${roles.map((role,i)=>`<li><span aria-hidden="true">${['↗','◌','✳','＋','✎','✓','⌁'][i]}</span>${role.replaceAll('&','&amp;')}</li>`).join('')}</ul><p>Find your corner of a bigger world.</p></div>
    </div></section>
    <section class="wrap ab-finale-wrap" aria-labelledby="ab-next-title"><div class="ab-finale">
      <div><span class="company-eyebrow">YOUR NEXT MOVE</span><h2 id="ab-next-title">Your next opportunity<br><em>could be here.</em></h2><p>Explore the roles that fit your skills, check the original listing and take your next step. Employers manage their own applications and hiring decisions.</p><a class="button ab-primary" href="/jobs">Explore opportunities <span aria-hidden="true">→</span></a><div class="ab-secondary"><a href="/pro">Explore VeeAys Pro</a><a href="/contact">Get in touch</a></div></div>
      <div class="ab-search-collage" aria-hidden="true"><span class="ab-search-fragment">⌕ &nbsp; Your next remote role</span><div class="ab-job-paper"><span class="company-eyebrow">A LITTLE POSSIBILITY</span><strong>Work that fits<br><em>your skills.</em></strong><span class="ab-job-category">Remote · Explore roles</span><div class="ab-job-lines"></div><span class="ab-saved">♡ &nbsp; Saved for later</span></div><span class="ab-fit-tag">✓ &nbsp; Strong match<small>ILLUSTRATIVE</small></span><span class="ab-finale-note">Start with a little curiosity.</span></div>
    </div></section>
  </div>` };
}
