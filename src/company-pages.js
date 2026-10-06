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
  return { title: page.title, description: page.description, body: `<div class="company-page">
    <section class="company-hero"><div class="wrap company-hero-grid">
      <div><span class="company-eyebrow">${page.eyebrow}</span><h1>${page.heading}</h1><p>${page.intro}</p></div>
      <div class="company-note" aria-hidden="true"><span class="company-spark">✳</span><span class="company-note-label">${page.note}</span><strong>${page.aside}</strong><span class="company-note-line"></span></div>
    </div></section>
    <section class="wrap company-details" aria-label="${page.title}"><div class="company-cards">${page.cards.map(([number, title, copy]) => `<article><span class="company-number">${number}</span><h2>${title}</h2><p>${copy}</p></article>`).join('')}</div>
      <div class="company-next"><div><span class="company-eyebrow">THE NEXT STEP</span><h2>${page.bottomTitle}</h2><p>${page.bottom}</p></div><div class="company-actions">${page.cta}</div></div>
    </section>
  </div>` };
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
      <div class="ep-collage" role="img" aria-label="Illustration of a global team’s desk connected to Filipino professionals, with example role notes for support, creative work and operations.">
        <svg class="ep-connection" viewBox="0 0 520 480" aria-hidden="true"><path d="M94 330C-15 210 195 120 332 204S555 370 396 426"/><path d="m386 415 10 11 15-7"/></svg>
        <div class="ep-world-stamp">WORLD <span>↔</span> PH<span class="ep-stamp-small">OPPORTUNITY HAS NO BORDERS</span></div>
        <div class="ep-desk"><span class="ep-paper-label">ON THE OTHER SIDE OF THE WORLD</span><strong>Your team.<br>A wider horizon.</strong>
          <svg viewBox="0 0 320 170" aria-hidden="true"><g fill="none" stroke="#123e30" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 143h288M45 143v17m235-17v17"/><rect x="65" y="38" width="155" height="95" rx="7" fill="#e8edcf"/><path d="M57 143h172l-9-10H65z" fill="#fffdf3"/><rect x="79" y="50" width="127" height="68" rx="3" fill="#fffdf3"/><path d="M79 65h127"/><circle cx="91" cy="58" r="1"/><circle cx="99" cy="58" r="1"/><circle cx="112" cy="82" r="7" fill="#e8ad7d"/><path d="M99 108v-7q13-17 26 0v7" fill="#bed985"/><circle cx="171" cy="82" r="7" fill="#bd835e"/><path d="M158 108v-7q13-17 26 0v7" fill="#d9ec89"/><path d="M240 114h24v29h-24zM264 120q20-2 10 15h-10M31 143v-28m0 8q-21-7-15-20 17 1 15 20m0 5q20-5 19-20-18 0-19 20"/><circle cx="266" cy="42" r="25" fill="#f5ead0"/><ellipse cx="266" cy="42" rx="10" ry="25"/><path d="M241 42h50m-44-14h38m-38 28h38"/></g></svg>
        </div>
        <div class="ep-talent"><span class="ep-paper-label">FILIPINO PROFESSIONALS</span><div class="ep-talent-title"><svg viewBox="0 0 64 72" aria-hidden="true"><path d="M5 69V53q26-27 54 0v16" fill="#123e30"/><path d="M19 36V22q0-20 26-16 14 2 11 26l-7 13H23Z" fill="#123e30"/><ellipse cx="34" cy="29" rx="15" ry="20" fill="#c58d65"/><path d="M17 23q10-1 18-13 3 10 18 15V11L24 4Z" fill="#123e30"/><path d="M27 43v9l8 7 9-7v-9" fill="#c58d65"/></svg><strong>Local roots.<br><em>Global outlook.</em></strong></div><div class="ep-role-notes"><span>Support</span><span>Creative</span><span>Operations</span></div><small>Illustrative roles, a world of possibilities.</small></div>
        <div class="ep-collage-note">Good work starts<br>with a connection.<svg viewBox="0 0 120 14" aria-hidden="true"><path d="M3 10q58-12 113-5"/></svg></div><span class="ep-spark" aria-hidden="true">✳</span>
      </div>
    </div></section>
    <section class="wrap ep-journey" aria-labelledby="ep-how"><div class="ep-section-head"><div><span class="ep-eyebrow">HOW IT WORKS TODAY</span><h2 id="ep-how">A connection begins<br>with <em>discovery.</em></h2></div><p>A clear path to opportunities.<br>Candidates apply through your existing process.</p></div>
      <ol class="ep-steps">${page.cards.map(([number, title, copy], i) => `<li><span class="ep-step-number">${number}</span><svg class="ep-step-art" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[i]}</svg><h3>${title}</h3><p>${copy}</p><span class="ep-step-caption">${['PUBLIC LISTINGS → DISCOVERY', 'ORIGINAL LISTING → YOUR PROCESS', 'EMPLOYER ENQUIRIES → A CONVERSATION'][i]}</span></li>`).join('')}</ol>
    </section>
    <section class="ep-roles" aria-labelledby="ep-roles-title"><div class="wrap ep-roles-inner"><div><span class="ep-eyebrow">ACROSS THE WORKING DAY</span><h2 id="ep-roles-title">Many roles.<br><em>More possibilities.</em></h2><p>From the everyday essentials to the creative spark, explore the kinds of remote work featured on VeeAys.</p></div><div class="ep-talent-board"><ul class="ep-role-tags">${categories.map(name => `<li><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${roleDrawings[name]}</svg><span>${name.replaceAll('&', '&amp;')}</span></li>`).join('')}</ul><p class="ep-board-note">Different skills. One global workforce.</p></div></div></section>
    <section class="wrap ep-enquiry-wrap" id="employer-enquiry" aria-labelledby="ep-enquiry-title"><div class="ep-enquiry"><div><span class="ep-eyebrow">EMPLOYER ENQUIRIES ARE OPEN</span><h2 id="ep-enquiry-title">Interested in reaching<br><em>Filipino professionals?</em></h2><p>Employer listings are coming soon. For now, send us an enquiry and tell us about your company and opportunity.</p><div class="ep-actions">${page.cta}</div><p class="ep-availability">${page.bottom}</p></div><div class="ep-letter" aria-hidden="true"><span>TO: VEEAYS</span><svg viewBox="0 0 190 135"><g fill="none" stroke="#123e30" stroke-width="2.5" stroke-linejoin="round"><path d="M12 42 94 7l84 35v79H12Z" fill="#d9ec89"/><path d="M34 77V18h122v59" fill="#fffdf3"/><path d="M51 37h61m-61 12h87m-87 12h76"/><path d="m12 42 82 52 84-52M12 121l62-42m104 42-62-42"/></g><path d="m131 20 4 9 10 1-8 7 2 10-9-5-9 5 2-10-8-7 10-1Z" fill="#e49560"/></svg><strong>A little hello.<br>A new possibility.</strong><span class="ep-letter-line"></span></div></div></section>
  </div>` };
}
