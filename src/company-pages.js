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
      ['02', 'Applications go to you', 'Professionals follow the original listing to apply through the employer’s own application process. Hiring stays with the employer.'],
      ['03', 'Let’s talk', 'Have a question about a listing or want to discuss employer interest? Contact us with your company name, role link and a short description.']
    ],
    bottomTitle: 'Interested in reaching Filipino professionals?',
    bottom: 'Self-service job posting and paid employer listings are not live yet. We welcome enquiries, but cannot accept a listing purchase or promise publication or hiring results.',
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
  const categories = ['Customer Support', 'Operations & Admin', 'Executive Assistant', 'Virtual Assistant', 'Marketing', 'Social Media', 'Design & Creative', 'Bookkeeping & Finance', 'Sales', 'Project Management', 'Recruitment & HR'];
  return { title: page.title, description: page.description, body: `<div class="employer-page">
    <section class="ep-hero"><div class="wrap ep-hero-grid">
      <div class="ep-intro"><span class="ep-eyebrow">FOR EMPLOYERS · A WORLD OF POSSIBILITIES</span><h1>Global opportunities.<br><em>Filipino talent.</em></h1><svg class="ep-underline" viewBox="0 0 260 15" aria-hidden="true"><path d="M3 9Q125 0 257 7M25 13q107-7 210-2"/></svg><p>${page.intro}</p><a class="ep-hero-link" href="#employer-enquiry">Let’s start a conversation <span aria-hidden="true">↗</span></a></div>
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
    <section class="wrap ep-journey" aria-labelledby="ep-how"><div class="ep-section-head"><div><span class="ep-eyebrow">HOW IT WORKS TODAY</span><h2 id="ep-how">A connection begins<br>with <em>discovery.</em></h2></div><p>A clear path to opportunities.<br>Applications and hiring stay with you.</p></div>
      <ol class="ep-steps">${page.cards.map(([number, title, copy], i) => `<li><span class="ep-step-number">${number}</span><svg class="ep-step-art" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[i]}</svg><h3>${title}</h3><p>${copy}</p><span class="ep-step-caption">${['PUBLIC LISTINGS → DISCOVERY', 'ORIGINAL LISTING → YOUR PROCESS', 'EMPLOYER ENQUIRIES → A CONVERSATION'][i]}</span></li>`).join('')}</ol>
    </section>
    <section class="ep-roles" aria-labelledby="ep-roles-title"><div class="wrap ep-roles-inner"><div><span class="ep-eyebrow">ACROSS THE WORKING DAY</span><h2 id="ep-roles-title">Many roles.<br><em>More possibilities.</em></h2><p>From the everyday essentials to the creative spark, explore the kinds of remote work featured on VeeAys.</p></div><ul class="ep-role-tags">${categories.map(name => `<li>${name.replaceAll('&', '&amp;')}</li>`).join('')}</ul></div></section>
    <section class="wrap ep-enquiry-wrap" id="employer-enquiry" aria-labelledby="ep-enquiry-title"><div class="ep-enquiry"><div><span class="ep-eyebrow">EMPLOYER ENQUIRIES ARE OPEN</span><h2 id="ep-enquiry-title">Interested in reaching<br><em>Filipino professionals?</em></h2><p>Tell us about your company and the opportunity.<br>Let’s start with a conversation.</p><div class="ep-actions">${page.cta}</div><p class="ep-availability">${page.bottom}</p></div><div class="ep-letter" aria-hidden="true"><span>TO: VEEAYS</span><svg viewBox="0 0 190 135"><g fill="none" stroke="#123e30" stroke-width="2.5" stroke-linejoin="round"><path d="M12 42 94 7l84 35v79H12Z" fill="#d9ec89"/><path d="M34 77V18h122v59" fill="#fffdf3"/><path d="M51 37h61m-61 12h87m-87 12h76"/><path d="m12 42 82 52 84-52M12 121l62-42m104 42-62-42"/></g><path d="m131 20 4 9 10 1-8 7 2 10-9-5-9 5 2-10-8-7 10-1Z" fill="#e49560"/></svg><strong>A little hello.<br>A new possibility.</strong><span class="ep-letter-line"></span></div></div></section>
  </div>` };
}
