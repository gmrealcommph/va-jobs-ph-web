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
