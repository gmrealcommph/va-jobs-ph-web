import { categoryDescriptor } from './category-context.js';
import { recovery } from './recovery.js';
import { sectionHeadingMarks } from './job-section-heading.js';
import { renderJobHeader } from './job-detail-header.js';
import { renderJobRead, renderAtAGlance } from './job-detail-read.js';
export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const jobPath = job => `/jobs/${encodeURIComponent(job.id)}`;
export const categoryPath = name => `/categories/${encodeURIComponent(name)}`;
export function safeUrl(value) { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; } }
export function date(value) { const d = new Date(value); return value && !Number.isNaN(+d) ? d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }) : ''; }

export function layout({ title, description, canonical, body, noindex = false, user = null, profile = null, showPreferencesPrompt = false }) {
  const firstName = String(profile?.full_name || '').trim().split(/\s+/)[0] || 'Your account';
  const isPro = profile?.plan === 'pro' && profile?.plan_status === 'active';
  let currentPath = '/';
  try { currentPath = new URL(canonical).pathname; } catch {}
  const navLink = (href, label, cls = '') => '<a class="' + cls + '" href="' + href + '"' + ((href === '/' ? currentPath === '/' || currentPath.startsWith('/jobs') : currentPath === href || currentPath.startsWith(href + '/')) ? ' aria-current="page"' : '') + '>' + label + '</a>';
  const accountLinks = navLink('/onboarding', 'My account') + navLink('/email-preferences', 'Email preferences') + navLink('/pro', isPro ? 'Your Pro membership' : 'Explore VeeAys Pro', 'member-plan-link') + '<a class="member-logout" href="/logout">Log out <span aria-hidden="true">↗</span></a>';
  const discoveryLinks = navLink('/', 'Find a job') + navLink('/categories', 'Categories') + navLink('/employers', 'For Employers');
  return `<!doctype html>
<html lang="en-PH">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">

  <title>${esc(title)} | VeeAys</title>

  <meta
    name="description"
    content="${esc(description)}"
  >

  <meta
    name="robots"
    content="${noindex ? 'noindex,follow' : 'index,follow'}"
  >

  <link
    rel="canonical"
    href="${esc(canonical)}"
  >

  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:site_name" content="VeeAys">
  <meta property="og:image" content="https://veeays.com/images/veeays-social-v1.png">
  <meta property="og:image:secure_url" content="https://veeays.com/images/veeays-social-v1.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:alt" content="VeeAys — Remote jobs for Filipino talent. Filipino talent. Global possibilities.">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="https://veeays.com/images/veeays-social-v1.png">
  <meta name="twitter:image:alt" content="VeeAys — Remote jobs for Filipino talent. Filipino talent. Global possibilities.">

  <meta name="theme-color" content="#123e30">

  <link
    rel="icon"
    href="/favicon.svg"
    type="image/svg+xml"
  >

  <link rel="stylesheet" href="/styles.css?v=20261007-category-polish">
</head>

<body>

<a class="skip" href="#main">
  Skip to content
</a>

<header class="site-header veeays-navigation">
  <div class="wrap header">
    <a class="veeays-brand" href="/" aria-label="VeeAys home"><img class="veeays-logo-img" src="/veeays-logo.png" alt="VeeAys" width="1200" height="400"></a>
    <nav class="discovery-nav" aria-label="Explore">${discoveryLinks}${!user ? navLink('/pro', 'VeeAys Pro', 'nav-pro') : ''}</nav>
    <div class="header-actions">
      ${user ? `<nav class="workspace-nav" aria-label="Your workspace">${navLink('/matches', 'My matches')}${navLink('/my-jobs', 'My jobs')}</nav>
      <details class="member-menu nav-disclosure">
        <summary aria-controls="member-panel"><span class="member-avatar" aria-hidden="true">${esc(firstName.slice(0,1).toUpperCase())}</span><span class="member-name">${esc(firstName)}</span>${isPro ? '<span class="member-pro">PRO</span>' : ''}<span class="nav-chevron" aria-hidden="true"></span></summary>
        <div class="member-panel" id="member-panel"><div class="member-panel-heading"><span>Your VeeAys</span><small>${isPro ? 'Pro member' : 'Free member'}</small></div>${accountLinks}</div>
      </details>` : `${navLink('/login', 'Log in', 'auth-link')}${navLink('/signup', 'Sign up', 'post-job-cta')}`}
    </div>
    <details class="mobile-menu nav-disclosure">
      <summary aria-controls="mobile-panel"><span class="menu-lines" aria-hidden="true"></span><span>Menu</span></summary>
      <div class="mobile-panel" id="mobile-panel"><nav aria-label="Mobile explore"><p class="nav-section-label">Explore</p>${discoveryLinks}${!user ? navLink('/pro', 'VeeAys Pro', 'nav-pro') : ''}</nav>
      <nav aria-label="Mobile account"><p class="nav-section-label">${user ? 'Your VeeAys' : 'Make your next move'}</p>${user ? `<div class="mobile-member"><span class="member-avatar" aria-hidden="true">${esc(firstName.slice(0,1).toUpperCase())}</span><strong>${esc(firstName)}</strong><span class="${isPro ? 'member-pro' : 'member-free'}">${isPro ? 'PRO' : 'Free member'}</span></div>${navLink('/matches', 'My matches')}${navLink('/my-jobs', 'My jobs')}${accountLinks}` : `${navLink('/login', 'Log in')}${navLink('/signup', 'Sign up', 'mobile-signup')}`}</nav></div>
    </details>
  </div>
</header>
<script src="/navigation.js?v=20261006" defer></script>



<main id="main">
  ${body}
</main>


<footer class="site-footer">

  <div class="footer-torn" aria-hidden="true"></div>

  <div class="wrap footer-main">

    <div class="footer-brand">

      <a
        class="footer-logo"
        href="/"
        aria-label="VeeAys home"
      >
        <span class="footer-logo-paper">
          <img
            src="/veeays-logo.png"
            alt="VeeAys"
            width="1200"
            height="400"
            loading="lazy"
          >
        </span>
      </a>

      <p class="footer-tagline">
        Filipino talent.<br>
        Global possibilities.
      </p>

      <div
        class="footer-flight"
        aria-hidden="true"
      >
        <span class="footer-flight-path">
          · · · · · · · ·
        </span>

        <span class="footer-plane">
          ➤
        </span>
      </div>

    </div>


    <div class="footer-links">

      <div class="footer-column">

        <h2>Jobs</h2>

        <a href="/jobs">
          Find a job
        </a>

        <a href="/categories">
          Categories
        </a>

      </div>


      <div class="footer-column">

        <h2>Employers</h2>

        <a href="/employers">
          For Employers
        </a>

        <a href="/employers">
          Employer enquiries
          <span aria-hidden="true">↗</span>
        </a>

      </div>


      <div class="footer-column">

        <h2>VeeAys</h2>
        <a href="/pro">VeeAys Pro</a>

        <a href="/about">
          About
        </a>

        <a href="/contact">
          Contact
        </a>

      </div>

    </div>


    
  </div>


  <div class="wrap footer-bottom">

    <div class="footer-legal">

      <span>
        © 2026 VeeAys
      </span>

      <a href="/privacy">
        Privacy
      </a>

      <a href="/terms">
        Terms
      </a>

      <a href="/refund-policy">Refund Policy</a>
      <a href="/contact">Contact</a>

    </div>


    

  </div>

</footer>

</body>
</html>`;
}

export function card(job, { user = null, saved = false } = {}) {
  const location =
    job.location ||
    (job.remote ? 'Remote' : 'Location not specified');

  const remoteLabel =
    job.workplace_type ||
    (job.remote ? 'Remote' : '');

  const posted = date(job.posted_at);

  return `
    <article class="job-card opportunity-card">

      <div class="opportunity-card-top">

        <div class="opportunity-company">
          ${esc(job.company || 'Company not specified')}
        </div>

        ${
          posted
            ? `<span class="opportunity-date">
                Posted ${posted}
              </span>`
            : ''
        }

      </div>


      <div class="job-save-row">
        ${user ? `<form method="post" action="${saved ? '/unsave-job' : '/save-job'}"><input type="hidden" name="job_id" value="${esc(job.id)}"><input type="hidden" name="return_to" value="${jobPath(job)}"><button class="job-save-button${saved ? ' is-saved' : ''}" type="submit">${saved ? '♥ Saved' : '♡ Save job'}</button></form>` : `<a class="job-save-button" href="/signup?return=${encodeURIComponent(jobPath(job) + '?save=1')}">♡ Save job</a>`}
      </div>

      <h2 class="opportunity-title">
        <a href="${jobPath(job)}">
          ${esc(job.title || 'Job opportunity')}
        </a>
      </h2>


      <div class="opportunity-meta">

        <span class="opportunity-location">
          <i aria-hidden="true">●</i>
          ${esc(location)}
        </span>

        ${
          remoteLabel
            ? `<span class="opportunity-remote">
                <i aria-hidden="true">⌁</i>
                ${esc(remoteLabel)}
              </span>`
            : ''
        }

      </div>


      <div class="opportunity-card-bottom">

        ${
          job.category
            ? `<a
                class="opportunity-category"
                href="${categoryPath(job.category)}"
              >
                ${esc(job.category)}
              </a>`
            : '<span></span>'
        }


        <div class="opportunity-launch">

          <span
            class="opportunity-flight-path"
            aria-hidden="true"
          >
            · · · ·
          </span>

          <a
            class="opportunity-arrow"
            href="${jobPath(job)}"
            aria-label="View ${esc(job.title || 'job opportunity')}"
          >
            ↗
          </a>

        </div>

      </div>

    </article>
  `;
}

export function discoveryCard(job, { user = null, saved = false, categoryListing = false } = {}) {
  const human = value => String(value || '').replaceAll('_', ' ');
  const metadata = categoryListing
    ? [job.location, human(job.workplace_type) || (job.remote === true ? 'Remote' : '')].filter(Boolean)
    : [job.location, human(job.employment_type), human(job.engagement_type)].filter(Boolean);
  if (!metadata.length && job.workplace_type && !/^remote$/i.test(job.workplace_type)) metadata.push(job.workplace_type);
  const periods = {monthly:'mo',annual:'yr',yearly:'yr',hourly:'hr',weekly:'wk'};
  const min = job.salary_min_usd, max = job.salary_max_usd;
  const validAmount = value => Number.isSafeInteger(value) && value > 0;
  const money = value => '$' + value.toLocaleString('en-US');
  let salary = '';
  if (periods[job.salary_period] && (validAmount(min) || validAmount(max)) &&
      (min == null || validAmount(min)) && (max == null || validAmount(max)) &&
      !(validAmount(min) && validAmount(max) && min > max)) {
    salary = (validAmount(min) && validAmount(max) ? (min === max ? money(min) : `${money(min)}–${money(max)}`) : validAmount(min) ? `From ${money(min)}` : `Up to ${money(max)}`) + '/' + periods[job.salary_period];
  }
  const posted = job.posted_at && Number.isFinite(Date.parse(job.posted_at)) ? date(job.posted_at) : '';
  const heart = `<span class="discovery-heart" aria-hidden="true">${saved ? '♥' : '♡'}</span>`;
  const save = user ? `<form data-home-save method="post" action="${saved ? '/unsave-job' : '/save-job'}"><input type="hidden" name="job_id" value="${esc(job.id)}"><input type="hidden" name="return_to" value="${categoryListing ? jobPath(job) : '/#opportunities'}"><button class="job-save-button${saved ? ' is-saved' : ''}" type="submit" aria-pressed="${saved}" aria-label="${saved ? 'Unsave' : 'Save'} ${esc(job.title || 'job opportunity')}">${heart} ${saved ? 'Saved' : 'Save'}</button><span class="ep-sr-only" role="status" aria-live="polite" data-save-status></span></form>` : `<a class="job-save-button" href="/signup?return=${encodeURIComponent(jobPath(job) + '?save=1')}">${heart} Save</a>`;
  return `<article class="job-card opportunity-card discovery-card"><div class="opportunity-card-top"><span class="opportunity-company">${esc(job.company || 'Company not specified')}</span>${posted ? `<span class="opportunity-date">Posted ${esc(posted)}</span>` : ''}</div><h2 class="opportunity-title"><a href="${jobPath(job)}">${esc(job.title || 'Job opportunity')}</a></h2>${metadata.length ? `<div class="opportunity-meta">${metadata.map(value=>`<span>${esc(value)}</span>`).join('')}</div>` : ''}${salary ? `<p class="discovery-salary">${esc(salary)}</p>` : ''}<div class="opportunity-card-bottom">${job.category ? `<a class="opportunity-category" href="${categoryPath(job.category)}">${esc(job.category)}</a>` : ''}<div class="discovery-actions">${save}${categoryListing ? `<a class="opportunity-arrow" href="${jobPath(job)}" aria-label="View ${esc(job.title || 'job opportunity')}"><span aria-hidden="true">↗</span></a>` : `<a class="discovery-view-job" href="${jobPath(job)}">View job <span aria-hidden="true">→</span></a>`}</div></div></article>`;
}

export function searchForm(search = '', category = '', action = '/') {
  return `<form class="search" role="search" action="${esc(action)}" method="get"><label for="q">Job title, company, or keyword</label><div class="search-row"><span aria-hidden="true">⌕</span><input id="q" name="q" type="search" maxlength="120" placeholder="${category ? esc(`Search ${category} jobs…`) : 'e.g. virtual assistant, customer support'}" value="${esc(search)}">${category && action === '/' ? `<input type="hidden" name="category" value="${esc(category)}">` : ''}<button type="submit">Search jobs <span aria-hidden="true">↗</span></button></div></form>`;
}

export function listing({ rows, total, page, search, category, names, categoryEntries = [], publicJobTotal = total, showPreferencesPrompt = false, onboardingComplete = false, user = null, savedJobIds = [], browseOnly = false }) {
  const action = category ? categoryPath(category) : (browseOnly ? '/jobs' : '/');
  const pages = Math.ceil(total / 15);

  const pageUrl = n => `${action}?${new URLSearchParams({
    ...(search ? { q: search } : {}),
    page: String(n)
  })}`;

  const categoryIcon = name => ({
    'Account Management': '◎',
    'Bookkeeping & Finance': '₱',
    'Customer Support': '◉',
    'Design & Creative': '✎',
    'E-commerce': '▣',
    'Executive Assistant': '◇',
    'Marketing': '◌',
    'Operations & Admin': '⌘',
    'Project Management': '▦',
    'Recruitment & HR': '♙',
    'Sales': '➤',
    'Social Media': '♧',
    'Virtual Assistant': '✦',
    'Writing & Content': '✐'
  }[name] || '•');

  const hero = browseOnly
    ? `<section class="jobs-browse-hero"><div class="wrap"><div class="kicker"><span></span> REMOTE JOBS FOR FILIPINO TALENT</div><h1>Find your next<br><em>opportunity.</em></h1><p>Search and explore roles open to talent in the Philippines.</p>${searchForm(search, '', '/jobs')}</div></section>`
    : category
    ? `<section class="category-jobs-hero"><div class="wrap category-jobs-hero-grid"><div><div class="kicker"><span></span> BUILT FOR FILIPINO TALENT</div><h1>${esc(category)}<br><em>jobs for Filipino talent.</em></h1><p class="category-jobs-descriptor">${esc(categoryDescriptor(category))}</p><p class="category-jobs-context"><strong>${(categoryEntries.find(entry => entry.name === category)?.count ?? total).toLocaleString('en-US')} opportunities</strong></p>${searchForm(search, category, action)}</div><div class="category-jobs-art" aria-hidden="true"><img src="/images/employer-enquiry-desk.svg" width="190" height="135" alt=""><span>Find your fit.<br><em>Make your move.</em></span></div></div></section>`
    : `<section class="home-hero">
        <div class="wrap">

          <div class="premium-hero-grid">

            <div class="premium-copy">
              <div class="home-kicker">
                <span></span>
                FILIPINO TALENT, MEET THE WORLD
              </div>

              <h1>
                Same skills.<br>
                <span>Bigger opportunities.</span>
              </h1>

              <div class="hero-scribble" aria-hidden="true"></div>

              <div class="hero-message">
                <strong>
                  Your skills can take you
                  <span>further.</span>
                </strong>

                <p>
                  Discover remote opportunities from companies around the
                  world, open to Filipino talent.
                </p>
              </div>

              <a class="home-jump hero-cta" href="#opportunities">
                <span class="hero-cta-label">Explore opportunities</span>

                <span class="hero-cta-arrow" aria-hidden="true">
                  ↓
                </span>

                <span class="hero-cta-rays" aria-hidden="true">
                  <i></i>
                  <i></i>
                  <i></i>
                </span>
              </a>
            </div>

            <div class="premium-collage approved-hero-art">
              <img
                src="/veeays-hero-approved.png"
                alt="Remote work possibilities: earn in USD, work with global companies, build skills and grow your career, skip the commute, work from anywhere, and enjoy better work-life balance."
                width="1591"
                height="989"
                loading="eager"
                fetchpriority="high"
                decoding="async"
              >
            </div>

          </div>

          <div class="torn-search">

            <div class="search-intro">
              <span>Where could your skills take you?</span>
              <small>
                Search thousands of possibilities. Start with one.
              </small>
            </div>

            <div class="home-search">

              ${searchForm(search, category, action)}

              <div class="search-caption">
                <span>Small search. Big possibilities.</span>

                <a href="/categories">
                  Explore all categories
                  <span aria-hidden="true">↗</span>
                </a>
              </div>

            </div>

          </div>

        </div>
      </section>

      <div class="home-values">
        <div class="wrap">
          <span>Made for Filipino talent</span>
          <i aria-hidden="true">✦</i>
          <span>Global &amp; remote opportunities</span>
          <i aria-hidden="true">✦</i>
          <span>Apply directly to employers</span>
        </div>
      </div>`;

  const categoryCounts = new Map(categoryEntries.map(({ name, count }) => [name, count]));
  const countBadge = name => Number.isSafeInteger(categoryCounts.get(name))
    ? `<span class="category-live-count" aria-label="${categoryCounts.get(name).toLocaleString('en-US')} public jobs">${categoryCounts.get(name).toLocaleString('en-US')}</span>` : '';
  const allHref = `${browseOnly ? '/jobs' : '/'}${search ? '?' + new URLSearchParams({ q: search }) : ''}`;
  const filters = names.map(name => `
    <a
      class="filter ${category === name ? 'selected' : ''}"
      ${category === name ? 'aria-current="page"' : ''}
      href="${categoryPath(name)}${search ? '?' + new URLSearchParams({ q: search }) : ''}"
    >
      <span class="filter-icon" aria-hidden="true">${categoryIcon(name)}</span>
      <span class="filter-name">${esc(name)}</span>
      ${countBadge(name)}
      <span class="filter-chevron" aria-hidden="true">›</span>
    </a>
  `).join('');

  const resultsTitle = category
    ? `${total.toLocaleString('en-US')} ${esc(category)} ${total === 1 ? 'job' : 'jobs'}`
    : search
    ? `Results for “${esc(search)}”`
    : category
      ? 'Explore available jobs'
      : 'Fresh opportunities<br><em>for Filipino talent.</em>';

  return `${category ? '<div class="category-jobs-page">' : browseOnly ? '' : '<div class="home-page">'}${hero}

  <section class="wrap listings" id="opportunities">

    <aside class="opportunity-map category-discovery" aria-label="Explore work categories">

      <div class="category-panel">

        <div class="category-panel-heading">
          <span class="category-eyebrow">EXPLORE WORK</span>
          <h2>Explore categories</h2>
          <p>Browse by what you do best.</p>
          
        </div>
        <nav class="category-links" aria-label="Job categories">

        <a
          class="filter all-filter ${category ? '' : 'selected'}"
          ${category ? '' : 'aria-current="page"'}
          href="${allHref}"
        >
          <span class="filter-icon" aria-hidden="true">⊞</span>
          <span class="filter-name">All opportunities</span>
          <span class="all-count" aria-label="${publicJobTotal.toLocaleString('en-US')} public jobs">${publicJobTotal.toLocaleString('en-US')}</span>
          <span class="filter-chevron" aria-hidden="true">›</span>
        </a>

        ${filters}
        </nav>
      </div>

      <div class="aside-note category-promo">
        <span class="category-eyebrow">YOUR NEXT MOVE <i aria-hidden="true">✦</i></span>
        <h3>Your skills.<br>New possibilities.</h3>
        <p>See where your skills could take you next.</p>
        <a href="${allHref}">Browse everything <span aria-hidden="true">→</span></a>
      </div>

    </aside>
    <script src="/category-sidebar.js?v=20261006" defer></script>

    <div class="results">

      ${onboardingComplete && !category ? `
        <div class="onboarding-success" role="status">
          <div class="onboarding-success-icon" aria-hidden="true">✓</div>
          <div>
            <strong>Preferences saved</strong>
            <span>We'll use these to make your VeeAys recommendations more relevant.</span>
          </div>
        </div>
        <script src="/onboarding-complete.js?v=20261002" defer></script>
      ` : ''}

      ${showPreferencesPrompt && !category ? `
        <aside class="preferences-card" aria-label="Personalize your job recommendations">
          <div class="preferences-card-icon" aria-hidden="true">✈</div>
          <div class="preferences-card-copy">
            <strong>Get jobs matched to you</strong>
            <span>Tell us your role, salary and preferred working hours. It takes about 2 minutes.</span>
          </div>
          <div class="preferences-card-actions">
            <a class="preferences-card-primary" href="/onboarding">Set my preferences</a>
            <a class="preferences-card-dismiss" href="/dismiss-preferences-prompt">Not now</a>
          </div>
        </aside>
      ` : ''}

      <div class="results-heading opportunity-heading">

        <div>
          <div class="eyebrow">
            YOUR NEXT OPPORTUNITY
          </div>

          <h2>${resultsTitle}</h2>
          ${category ? `<p class="category-results-description">${search ? `Matching “${esc(search)}”.` : 'Browse current opportunities in this category.'}</p>${rows.length ? `<p class="category-results-count">Showing ${(page - 1) * 15 + 1}–${(page - 1) * 15 + rows.length}</p>` : ''}` : ''}

          
        </div>

        
        ${!search && !category ? `
          <div
            class="opportunity-count"
            role="img"
            aria-label="${total.toLocaleString('en-US')} opportunities"
          >
            <strong data-live-opportunity-count="${total}" aria-hidden="true">${total}</strong>

            <span>
              opportunities<br>
              and counting
            </span>
          </div>
          <script src="/opportunity-count.js?v=20261006-flip" defer></script>
        ` : ''}

      </div>

      ${!category && !browseOnly ? `<form class="discovery-search" role="search" action="/#opportunities" method="get"><label for="discovery-q">Search opportunities</label><div class="discovery-search-row"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><input id="discovery-q" name="q" type="search" maxlength="120" placeholder="Search by job title, skill or company" value="${esc(search)}"><button type="submit">Search <span aria-hidden="true">→</span></button></div></form>` : ''}

      ${
  rows.length
    ? `<div class="opportunity-grid">
        ${rows.map(job => (browseOnly ? card : discoveryCard)(job, { user, saved: savedJobIds.includes(String(job.id)), categoryListing: !!category })).join('')}
      </div>`
    : `<div class="empty">
        <h2>No matching opportunities yet</h2>
        <p>Try another keyword or explore all categories.</p>
        <a class="button" href="/jobs">Browse all jobs</a>
      </div>`
}

      ${
        pages > 1
          ? `<nav class="pagination" aria-label="Pagination">

              ${
                page > 1
                  ? `<a rel="prev" href="${esc(pageUrl(page - 1))}">
                      ← Previous
                    </a>`
                  : '<span></span>'
              }

              <span>
                Page ${page} of ${pages}
              </span>

              ${
                page < pages
                  ? `<a rel="next" href="${esc(pageUrl(page + 1))}">
                      Next →
                    </a>`
                  : '<span></span>'
              }

            </nav>`
          : ''
      }

    </div>

  </section>

  ${!category && !browseOnly ? proDiscovery() : ''}

  ${
    category
      ? ''
      : `<section class="final-cta">
  <div class="wrap final-cta-grid">

    <div class="final-cta-copy">

      <h2>
        Ready for your<br>
        <em>next opportunity?</em>
      </h2>

      <p>
        Find remote opportunities from companies around the world,
        open to Filipino talent.
      </p>

      <div class="final-cta-actions">

        <a class="final-cta-primary" href="#opportunities">
          <span>Back to opportunities</span>
          <b>↑</b>
        </a>

        <a class="final-cta-secondary" href="/categories">
          Browse categories <span>↗</span>
        </a>

      </div>

    </div>


    <div class="final-cta-art final-journey" aria-hidden="true">
      <svg class="journey-route" viewBox="0 0 520 430" fill="none">
        <path d="M35 105C100 25 320 25 438 100S490 255 397 239" stroke="#79ad45" stroke-width="2" stroke-dasharray="2 7" stroke-linecap="round"/>
      </svg>
      <div class="journey-destination"><span>FROM <b>PH</b></span><i>→</i><span>TO <b>GLOBAL</b></span></div>
      <svg class="journey-plane" viewBox="0 0 64 54" fill="none"><path d="M3 21 60 4 41 49 29 31Z" fill="#f69b38" stroke="#dc7d22" stroke-width="1.2" stroke-linejoin="round"/><path d="m29 31 31-27-39 20Z" fill="#ffbd69"/><path d="m29 31 2 12 10 6" fill="#e78528"/><path d="m29 31 31-27" stroke="#b86822" stroke-width="1.2"/></svg>
      <div class="journey-job journey-job-back"><span class="journey-company">STUDIO NORTH · DEMO</span><strong>Social Media<br>Manager</strong><span class="journey-meta">Remote · Full-time</span><span class="journey-tag">Marketing</span></div>
      <div class="journey-job journey-job-middle"><span class="journey-company">BRIGHT DESK · DEMO</span><strong>Customer Support</strong><span class="journey-meta">Remote · Philippines eligible</span></div>
      <div class="journey-job journey-job-front">
        <span class="journey-tape"></span><span class="journey-company"><i class="journey-monogram">✳</i> OPEN HORIZON · DEMO</span>
        <strong>Executive<br>Assistant</strong><span class="journey-meta">Remote · Philippines eligible</span>
        <div class="journey-card-footer"><span class="journey-tag">Full-time</span><span class="journey-card-arrow">↗</span></div>
      </div>
      <div class="journey-match"><b>94<span>%</span></b><span>MATCH</span><svg viewBox="0 0 32 18"><path d="m3 9 8 6L28 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div>
      <div class="journey-borders"><span>WORK</span><strong>WITHOUT<br>BORDERS</strong><small>VEEAYS · PH → GLOBAL</small></div>
      <div class="journey-annotation"><svg viewBox="0 0 75 40"><path d="M70 34C22 37 12 23 13 5m-9 9 9-9 9 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span>opportunities that<br>fit your skills</span></div>
      <span class="journey-spark">✦</span>
    </div>

  </div>

  <div class="final-cta-tear" aria-hidden="true"></div>
</section>
      </div>`
  }${category ? '</div>' : ''}${!category && !browseOnly ? '<script src="/home-discovery.js" defer></script>' : ''}`;
}

function formatJobDescription(text = '') {
  if (!text) {
    return '<p>Visit the original listing for the full job description.</p>';
  }

  /*
    Some ATS feeds put bullets in the middle of a line:

    Key Responsibilities ● First item ● Second item

    Put those bullets onto their own lines before parsing.
  */
  const normalized = String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s*[●•▪◦]\s*/g, '\n● ');

  const lines = normalized.split('\n');

  let html = '';
  let paragraph = [];
  let inList = false;

  const flushParagraph = () => {
    if (!paragraph.length) {
      return;
    }

    html += `<p>${paragraph
      .map(esc)
      .join(' ')}</p>`;

    paragraph = [];
  };

  const closeList = () => {
    if (!inList) {
      return;
    }

    html += '</ul>';
    inList = false;
  };

  const isKnownHeading = (line) => {
    const clean = line
      .trim()
      .replace(/:\s*$/, '');

    const lower = clean.toLowerCase();

    const headings = [
      'about the role',
      'about role',
      'about the job',
      'about the position',
      'about the company',
      'about the team',
      'about the opportunity',
      'about you',

      'key responsibilities',
      'responsibilities',
      'responsibilities include',
      'duties',
      'key duties',

      "what you'll do",
      'what you’ll do',
      'what you will do',
      "what you'll be doing",
      'what you’ll be doing',
      'what you will be doing',

      "what we're looking for",
      'what we’re looking for',
      'what we are looking for',

      'who you are',
      "who we're looking for",
      'who we’re looking for',
      'who we are looking for',

      'requirement',
      'requirements',

      'qualification',
      'qualifications',

      'skills',
      'skills and experience',

      'experience',

      'preferred qualification',
      'preferred qualifications',
      'preferred experience',

      'nice to have',

      'working style',

      'compensation',
      'salary',

      'benefits',
      'perks',
      'perks and benefits',

      'what we offer',

      'the role',
      'the opportunity',

      'your role',
      'your responsibilities'
    ];

    if (headings.includes(lower)) {
      return true;
    }

    /*
      Company-specific headings such as:

      Why Join Assist World?
      Why Join Us?
      Why Work With Acme?
    */
    if (
      lower === 'why join us' ||
      lower.startsWith('why join ') ||
      lower.startsWith('why work with ')
    ) {
      return true;
    }

    return false;
  };

  const isUppercaseHeading = (line) => {
    const clean = line
      .trim()
      .replace(/:\s*$/, '');

    if (!clean) {
      return false;
    }

    if (clean.length > 70) {
      return false;
    }

    /*
      These are usually promotional statements or benefits,
      not section headings.

      Examples:
      100% REMOTE
      $600 PER MONTH
      NO TRACKER. NO PROBLEM
    */
    if (/\d/.test(clean)) {
      return false;
    }

    if (clean.includes('.')) {
      return false;
    }

    const words = clean
      .split(/\s+/)
      .filter(Boolean);

    if (words.length > 8) {
      return false;
    }

    const letters = clean.replace(
      /[^A-Za-z]/g,
      ''
    );

    if (letters.length < 4) {
      return false;
    }

    return (
      letters === letters.toUpperCase()
    );
  };

  const isHeading = (line) => {
    return (
      isKnownHeading(line) ||
      isUppercaseHeading(line)
    );
  };

  const addListItem = (value) => {
    flushParagraph();

    if (!inList) {
      html += '<ul>';
      inList = true;
    }

    html += `<li>${esc(
      value.trim()
    )}</li>`;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    /*
      Standard bullets from different ATS platforms.
    */
    const bulletMatch = line.match(
      /^(?:[-–—•●*▪◦]|\d+[.)])\s*(.+)$/
    );

    if (bulletMatch) {
      addListItem(
        bulletMatch[1]
      );

      continue;
    }

    /*
      Recognised section heading.
    */
    if (isHeading(line)) {
      flushParagraph();
      closeList();

      const heading = line.replace(
        /:\s*$/,
        ''
      );

      html += `<h3>${esc(
        heading
      )}</h3>`;

      continue;
    }

    closeList();
    paragraph.push(line);
  }

  flushParagraph();
  closeList();

  return html;
}

function renderApplicationProgress({ user, saved, application }) {
  if (!user) return '<section class="job-application-progress"><h3>Track your progress</h3><p>Create a free VeeAys account to save jobs and track your progress.</p></section>';
  const status = application?.status;
  const labels = { applied: 'Applied', interview: 'Interview', offer: 'Offer', hired: 'Hired', rejected: 'Rejected', withdrawn: 'Withdrawn' };
  const rank = { applied: 1, interview: 2, offer: 3, hired: 4 }[status] || 0;
  const closed = status === 'rejected' || status === 'withdrawn';
  const steps = [['saved', 'Saved'], ['applied', 'Applied'], ['interview', 'Interview'], ['offer', 'Offer']];
  if (status === 'hired') steps.push(['hired', 'Hired']);
  return `<section class="job-application-progress" aria-label="Application progress">
    <h3>Track your progress</h3>
    <ol>${steps.map(([key, label], index) => {
      // Saved is independent of application status; closed outcomes imply no later stage.
      const done = index === 0 ? saved : (closed ? index === 1 : rank >= index);
      const current = key === status || (!status && key === 'saved' && saved);
      return `<li class="${done ? 'is-complete' : ''}${current ? ' is-current' : ''}"${current ? ' aria-current="step"' : ''}><span class="job-progress-dot" aria-hidden="true">${done ? '✓' : ''}</span><span>${label}</span><span class="ep-sr-only">${current ? ': current status' : (done ? ': reached' : ': not recorded')}</span></li>`;
    }).join('')}</ol>
    <p>${status ? `Current status: <strong>${esc(labels[status] || status)}</strong>. <a href="/my-jobs">Manage in My Jobs →</a>` : (saved ? 'Saved for later. Mark as applied when you have submitted your application.' : 'Save this role or mark it applied to start your journey.')}</p>
  </section>`;
}

export function detail(job, { user = null, saved = false, application = null, saveIntent = false } = {}) {
  const apply = safeUrl(job.job_url);

  const company =
    job.company ||
    'Company not specified';

  const title =
    job.title ||
    'Job opportunity';

  const location =
    job.location ||
    'Location not specified';

  const workplace =
    job.workplace_type ||
    (job.remote ? 'Remote' : '');

  const posted =
    date(job.posted_at);

  const description =
    job.description ||
    'Visit the original listing for the full job description.';
  const isHimalayas =
  String(job.source || '').toLowerCase() === 'himalayas';
  
  return `
    <div class="job-detail-page">

      <section class="job-detail-hero">

        <div class="wrap">

          <a
            class="job-detail-back"
            href="/#opportunities"
          >
            ← Back to opportunities
          </a>


          ${renderJobHeader(job, {company, title, location, workplace, posted})}

        </div>

      </section>


      <section class="wrap job-detail-layout">

        <article class="job-detail-content">${renderAtAGlance(job)}

          <div class="job-detail-section-heading">

            <span aria-hidden="true">✦</span>

            <div>
              <div class="eyebrow">
                THE OPPORTUNITY
              </div>

              <h2>
                The employer listing
              </h2>
            </div>

          </div>


          <div class="description job-detail-description">
            ${renderJobRead(description, job.quick_read ?? null, job)}
          </div>

        </article>


        <aside class="job-detail-sidebar">

          <div class="job-detail-snapshot">

            <div class="job-detail-snapshot-kicker job-polish-heading">${sectionHeadingMarks('YOUR APPLICATION')}</div>


            <div class="job-application-initials" aria-hidden="true">${esc(company.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase())}</div>
            <h2>Ready to make<br>your move?</h2>
            <p class="job-application-intro">Apply directly on the employer's site and keep track of your application right here on VeeAys.</p>
            <div class="job-application-identity"><strong>${esc(title)}</strong><span>${esc(company)}</span></div>

            <div class="job-detail-user-actions">
              ${saveIntent && user && !saved ? '<p class="save-intent-note">You’re signed in. Save this job so you can come back to it anytime.</p>' : ''}
              ${user ? `<form method="post" action="${saved ? '/unsave-job' : '/save-job'}"><input type="hidden" name="job_id" value="${esc(job.id)}"><input type="hidden" name="return_to" value="${jobPath(job)}"><button class="job-detail-save${saved ? ' is-saved' : ''}" type="submit">${saved ? '♥ Unsave job' : '♡ Save for later'}</button></form>` : `<a class="job-detail-save" href="/signup?return=${encodeURIComponent(jobPath(job) + '?save=1')}">♡ Save for later</a>`}
              ${user && !application ? `<form method="post" action="/mark-applied"><input type="hidden" name="job_id" value="${esc(job.id)}"><input type="hidden" name="return_to" value="${jobPath(job)}"><button class="job-detail-track" type="submit">✓ Mark as applied</button></form>` : ''}
              ${user && application ? `<a class="job-detail-track is-tracked" href="/my-jobs">Update application</a>` : ''}
            </div>

            ${
              apply
                ? `<a
                    class="job-detail-apply"
                    href="/apply/${encodeURIComponent(job.id)}"
                    target="_blank"
                    rel="nofollow noopener"
                  >
                    <span>Apply for this role</span>
                    <b>↗</b>
                  </a>

                  <p class="job-detail-external">
  Opens the employer's listing in a new tab.
</p>

${
  isHimalayas
    ? `<p class="job-detail-source">
        Job data sourced from
        <a
          href="https://himalayas.app/"
          target="_blank"
          rel="noopener noreferrer"
        >Himalayas</a>.
      </p>`
    : ''
}`
                : `<p class="job-detail-unavailable">
                    The application link is currently unavailable.
                  </p>`
            }


            ${renderApplicationProgress({ user, saved, application })}

          </div>

        </aside>

      </section>

    </div><script type="module" src="/job-detail-logo.js"></script>
  `;
}


export function authPage({ mode = 'login', error = '', message = '', email = '', returnTo = '' } = {}) {
  const signup = mode === 'signup';
  const applyIntent = returnTo.startsWith('/apply/');
  return `
    <link rel="stylesheet" href="/auth.css?v=20261006">
    <section class="auth-shell auth-polish">
      <div class="auth-intro">
        <div class="kicker">${signup ? 'JOIN VEEAYS' : 'WELCOME BACK'}</div>
        <h1>${signup ? 'Your next remote role,<br><em>without the guesswork.</em>' : 'Pick up where<br><em>you left off.</em>'}</h1>
        <p>${applyIntent ? 'Create or log in to your free VeeAys account, then we’ll take you straight back to this application.' : (signup ? 'Create your free VeeAys account. Explore remote opportunities open to Filipino talent, with your preferences in mind.' : 'Your saved jobs, preferences, and next possibilities are waiting. Log in to continue your search.')}</p>
        ${authPostcard(signup ? 'Your next chapter' : 'Welcome back')}
      </div>
      <div class="auth-card">
        <h2>${signup ? 'Create your account' : 'Log in'}</h2>
        <p>${applyIntent ? 'Your application is waiting. You won’t have to complete your profile first.' : (signup ? 'Free to join. You can set your job preferences after verifying your email.' : 'Use the email and password you signed up with.')}</p>
        ${error ? `<div class="auth-alert error" role="alert">${esc(error)}</div>` : ''}
        ${message ? `<div class="auth-alert success" role="status">${esc(message)}</div>` : ''}
        <form class="auth-form" method="post" action="${signup ? '/signup' : '/login'}">
          ${returnTo ? `<input type="hidden" name="return" value="${esc(returnTo)}">` : ''}
          ${signup ? `<div class="auth-field"><label for="full_name">Full name</label><input id="full_name" name="full_name" type="text" autocomplete="name" maxlength="100" required></div>` : ''}
          <div class="auth-field"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" maxlength="254" value="${esc(email)}" required></div>
          <div class="auth-field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="8" maxlength="128" ${signup ? 'aria-describedby="auth-password-help" ' : ''}required>${signup ? '<small id="auth-password-help">Use 8–128 characters for your password.</small>' : ''}</div>
          <button type="submit">${signup ? 'Create account' : 'Log in'}</button>
        </form>
        <p class="auth-switch">${signup ? `Already have an account? <a href="/login${returnTo ? `?return=${encodeURIComponent(returnTo)}` : ''}">Log in</a>` : `New to VeeAys? <a href="/signup${returnTo ? `?return=${encodeURIComponent(returnTo)}` : ''}">Create an account</a>`}</p>
      </div>
    </section>`;
}

function authPostcard(label) {
  return `<div class="auth-postcard" aria-hidden="true"><span>FILIPINO TALENT. GLOBAL POSSIBILITIES.</span><svg viewBox="0 0 180 86" fill="none"><path d="M14 65c35-45 66 29 92-13" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 5"/><path d="m100 30 65-18-22 54-14-22-29-14Z" fill="#d8ed93" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m129 44 36-32-26 38-2 13" stroke="currentColor" stroke-width="1.5"/></svg><strong>${label}</strong><i>One small step. New possibilities.</i></div>`;
}

export function checkEmailPage(email = '', returnTo = '') {
  const loginHref = '/login' + (returnTo ? `?return=${encodeURIComponent(returnTo)}` : '');
  return `<link rel="stylesheet" href="/auth.css?v=20261006"><section class="auth-shell auth-polish"><div class="auth-intro"><div class="kicker">ONE MORE STEP</div><h1>Check your<br><em>inbox.</em></h1><p>We sent a confirmation link${email ? ` to <strong>${esc(email)}</strong>` : ''}. Click it to verify your email and continue setting up your VeeAys account.</p>${authPostcard('A little inbox delivery')}</div><div class="auth-card"><div class="auth-card-label">YOUR EMAIL CONFIRMATION</div><h2>Verify your email</h2><p>Open the email from VeeAys and follow the confirmation link. It will take you back here.</p><div class="auth-inbox-note"><strong>Still looking for it?</strong><p>Check your spam or junk folder, and make sure you’re checking the email address you signed up with.</p></div><a class="button" href="${esc(loginHref)}">Back to log in</a></div></section>`;
}

export function authCallbackPage() {
  return `<link rel="stylesheet" href="/auth.css?v=20261006"><section class="auth-callback auth-polish">${authPostcard('Almost there')}<div role="status" aria-live="polite"><div class="kicker">VERIFYING</div><h1>Finishing your sign in…</h1><p>Please keep this page open for a moment.</p></div><noscript><p>JavaScript is needed to finish email verification. Enable it, then reopen the confirmation link from your email.</p><a href="/login">Back to log in</a></noscript></section><script src="/auth-callback.js" defer></script>`;
}

export function onboardingPage({ user, preferences = null, error = '' } = {}) {
  const roles = ['Executive Assistant','General VA','Customer Support','Social Media','Marketing','Sales','E-commerce','Bookkeeping','Graphic Design','Video Editing','Operations','Web/Development','Other'];
  const employment = ['Full-time','Part-time','Contract/Freelance'];
  const schedules = ['Philippines daytime','UK/Europe hours','Australia hours','US hours','Flexible/Any'];
  const experience = ['Entry level','1–2 years','3–5 years','6+ years'];
  const selected = (items, value) => Array.isArray(items) && items.includes(value);
  const roleMarks = ['M4 7h16v13H4z M8 7V4h8v3', 'M4 5h16v15H4z M8 9h8 M8 13h5', 'M5 14H3V9a9 9 0 0 1 18 0v5h-2 M5 9v7 M19 9v7 M19 16c0 4-4 4-7 4', 'M4 4h16v12H9l-5 4z M8 8h8 M8 12h5', 'M4 10l13-5v14L4 14z M6 15v5h4l-1-4', 'M4 17l5-5 4 3 7-9 M14 6h6v6', 'M3 4h3l3 12h10l2-8H7 M9 20h1 M18 20h1', 'M5 3h14v18H5z M8 7h8 M8 11h2 M14 11h2 M8 15h2 M14 15h2', 'M4 17L16 5l3 3L7 20H4z M14 7l3 3', 'M3 5h18v14H3z M9 8l7 4-7 4z', 'M4 5h6v6H4z M14 13h6v6h-6z M10 8h7v5 M7 11v5h7', 'M8 6l-5 6 5 6 M16 6l5 6-5 6 M14 3l-4 18', 'M5 12h14 M12 5v14'];
  const icon = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${`<path d="${path}"/>`}</svg>`;
  const clock = icon('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2');
  const scheduleNotes = ['Work around local daytime', 'Open to UK & European schedules', 'Open to Australian schedules', 'Open to US schedules', 'No schedule restriction'];
  const choiceContent = (name, value, i) => `<span class="onboard-choice-face">${name === 'target_roles' ? `<i class="onboard-choice-icon">${icon(roleMarks[i])}</i>` : name === 'schedule_preferences' ? `<i class="onboard-choice-icon">${clock}</i>` : ''}<span class="onboard-choice-copy">${esc(value)}${name === 'schedule_preferences' ? `<small>${scheduleNotes[i]}</small>` : ''}</span><b class="onboard-choice-check" aria-hidden="true">✓</b></span>`;
  const choices = (name, options, values = []) => options.map((value, i) => `<label class="onboard-choice"><input type="checkbox" name="${esc(name)}" value="${esc(value)}" ${selected(values,value)?'checked':''}>${choiceContent(name,value,i)}</label>`).join('');
  const radios = (name, options, value = '') => options.map((item, i) => `<label class="onboard-choice"><input type="radio" name="${esc(name)}" value="${esc(item)}" ${item===value?'checked':''}>${choiceContent(name,item,i)}</label>`).join('');
  const skills = Array.isArray(preferences?.skills) ? preferences.skills.join(', ') : '';
  return `
  <link rel="stylesheet" href="/onboarding.css?v=20261006">
  <section class="onboard-shell">
    <div class="onboard-top">
      <div><div class="kicker">LET’S FIND YOUR FIT</div><h1>Tell VeeAys what you’re <em>looking for.</em></h1><p>A few details help us rank opportunities around what matters to you.</p></div><div class="onboard-profile-note" aria-hidden="true"><span>MADE AROUND YOU</span><strong>Your next chapter<br>starts here.</strong><svg viewBox="0 0 130 12"><path d="M3 8Q60 1 126 5M14 10Q68 5 112 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div>
      
    </div>
    <ol class="onboard-progress" aria-label="Your search profile journey">${['Roles','Pay & work','Schedule','Experience','Review'].map((label,i) => `<li${i===0 ? ' class="active" aria-current="step"' : ''}><span class="onboard-progress-number" aria-hidden="true">${i+1}</span><span class="onboard-progress-title">${label}</span><span class="onboard-sr-only onboard-progress-state">${i===0 ? ': current step' : ': upcoming'}</span></li>`).join('')}</ol>
    ${error ? `<div class="auth-alert error onboard-error" role="alert">${esc(error === 'Please complete each step before finishing your profile.' ? error : 'We could not save your preferences. Please try again.')}</div>` : ''}
    <form class="onboard-card" method="post" action="/onboarding" id="onboarding-form">
      <section class="onboard-step active" data-step="1">
        <div class="onboard-step-label">YOUR ROLES</div><h2 tabindex="-1">Where would you like to put your talents?</h2><p>Choose all the roles you’re interested in. You can select more than one.</p>
        <div class="onboard-grid">${choices('target_roles', roles, preferences?.target_roles)}</div>
      </section>
      <section class="onboard-step" data-step="2">
        <div class="onboard-step-label">PAY & WORK</div><h2 tabindex="-1">What would work look like for you?</h2><p>Set an optional pay preference and choose the types of work you’re open to.</p>
        <div class="salary-box"><label for="minimum_salary_usd">Minimum monthly salary <span class="onboard-optional">optional · USD</span></label><div class="salary-input"><span>$</span><input id="minimum_salary_usd" name="minimum_salary_usd" type="number" min="0" max="50000" step="50" inputmode="numeric" value="${esc(preferences?.minimum_salary_usd ?? '')}" placeholder="1000" aria-describedby="salary-php salary-note"></div><small id="salary-php">Optional. We'll use this as a matching preference.</small><small id="salary-note">A matching preference, not a guarantee of pay.</small></div>
        <h3>Employment type <span class="onboard-optional">select all that fit</span></h3><div class="onboard-grid compact">${choices('employment_types', employment, preferences?.employment_types)}</div>
      </section>
      <section class="onboard-step" data-step="3">
        <div class="onboard-step-label">YOUR SCHEDULE</div><h2 tabindex="-1">Which schedules fit your life?</h2><p>Choose all the schedules you’d consider from the Philippines. Flexible/Any keeps your schedule unrestricted.</p>
        <div class="onboard-grid compact">${choices('schedule_preferences', schedules, preferences?.schedule_preferences)}</div>
      </section>
      <section class="onboard-step" data-step="4">
        <div class="onboard-step-label">EXPERIENCE & SKILLS</div><h2 tabindex="-1">What do you bring to the role?</h2><p>Help us understand your experience and the skills you’d like to use.</p>
        <h3>Experience level <span class="onboard-optional">choose one</span></h3><div class="onboard-grid compact">${radios('experience_level', experience, preferences?.experience_level)}</div>
        <div class="skills-box"><label for="skills">Your skills <span class="onboard-optional">optional</span></label><textarea id="skills" name="skills" rows="4" maxlength="1200" aria-describedby="skills-help" placeholder="e.g. Google Workspace, Canva, HubSpot, customer support, bookkeeping">${esc(skills)}</textarea><small id="skills-help">Separate skills with commas. These help describe your strengths; every skill isn’t required for every match.</small></div>
      </section>
      <section class="onboard-step" data-step="5">
        <div class="onboard-step-label">YOUR SEARCH PROFILE</div><h2 tabindex="-1">Your search profile, ready to go.</h2><p>Here’s what matters to you. Go back to adjust anything, then save your profile and explore jobs.</p>
        <h3 class="onboard-recap-title">Your search profile</h3><div class="onboard-review" id="onboard-review"></div>
        <div class="onboard-ready"><strong>${esc(user?.email || 'Your account')}</strong><span>✓ Your preferences will be saved to this account. You can update them later.</span></div>
      </section>
      <div class="onboard-actions"><button class="button secondary" type="button" id="onboard-back" hidden>Back</button><button type="button" id="onboard-next">Continue</button><button type="submit" id="onboard-finish" hidden>Save profile &amp; explore jobs</button></div>
    </form>
  </section>
  <script src="/onboarding.js?v=20261006-profile" defer></script>`;
}


export function matchesPage({ matches = [], preferences = null, summary = null, error = '', savedJobIds = [] } = {}) {
  const schedulePrefs = Array.isArray(preferences?.schedule_preferences) ? preferences.schedule_preferences : [];
  const scheduleUnrestricted = schedulePrefs.some(value => ['flexible/any', 'flexible', 'any'].includes(String(value).trim().toLowerCase()));
  const isPro = summary?.is_pro === true;
  const lockedMatches = Math.max(0, Number(summary?.locked_matches) || 0);
  const totalMatches = Math.max(matches.length, Number(summary?.total_matches) || 0);
  const confidenceLabel = available => available >= 5 ? 'High confidence' : available >= 3 ? 'Good confidence' : 'Limited data';
  const infoIcon = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 7v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="4.5" r=".9" fill="currentColor"/></svg>';
  const infoButton = kind => `<button class="match-info" type="button" aria-label="About ${kind === 'score' ? 'match score' : 'confidence'}" aria-describedby="match-${kind}-tooltip" aria-expanded="false" data-match-info="${kind}">${infoIcon}</button>`;

  const friendlyReason = (label, matched, available, unrestricted = false) => {
    if (unrestricted) return `<span class="match-reason neutral"><b aria-hidden="true">~</b>${esc(label)} flexible</span>`;
    if (!available) return '';
    if (matched === true) return `<span class="match-reason matched"><b aria-hidden="true">✓</b>${esc(label)}</span>`;
    return `<span class="match-reason neutral"><b aria-hidden="true">~</b>${esc(label)}${matched === false ? ' differs' : ' not confirmed'}</span>`;
  };

  const cards = matches.map((job, index) => {
    const skillsAvailable = Array.isArray(preferences?.skills) && preferences.skills.length > 0 && Array.isArray(job.skills) && job.skills.length > 0;
    const salaryAvailable = preferences?.minimum_salary_usd != null && job.salary_period === 'monthly' && (job.salary_min_usd != null || job.salary_max_usd != null);
    const scheduleAvailable = !scheduleUnrestricted && schedulePrefs.length > 0 && !!job.schedule_region;
    const employmentAvailable = Array.isArray(preferences?.employment_types) && preferences.employment_types.length > 0 && !!job.employment_type;
    const experienceAvailable = !!preferences?.experience_level && !!job.experience_level;
    const roleAvailable = Array.isArray(preferences?.target_roles) && preferences.target_roles.length > 0 && !!(job.category || job.title);
    const availableFactors = Number(job.available_dimensions) || 0;
    const confidence = confidenceLabel(availableFactors);
    const reasons = [
      friendlyReason('Role fit', job.role_match, roleAvailable),
      friendlyReason('Skills', job.skills_match, skillsAvailable),
      friendlyReason('Salary', job.salary_match, salaryAvailable),
      friendlyReason('Schedule', job.schedule_match, scheduleAvailable, scheduleUnrestricted),
      friendlyReason('Work type', job.employment_match, employmentAvailable),
      friendlyReason('Experience', job.experience_match, experienceAvailable)
    ].filter(Boolean).join('');
    const salaryValue = job.salary_max_usd ?? job.salary_min_usd ?? '';
    return `
      <article class="match-card" data-match-card data-original-order="${index}" data-score="${esc(job.match_score)}" data-salary="${esc(salaryValue)}" data-salary-period="${esc(job.salary_period || '')}" data-schedule="${esc(job.schedule_region || '')}" data-work-type="${esc(job.employment_type || '')}">
        <div class="match-card-main">
          <div class="match-card-top"><span class="match-score"><strong>${esc(job.match_score)}%</strong> MATCH${infoButton('score')}</span><span class="match-company">${esc(job.company || 'Company not specified')}</span><span class="match-confidence">${esc(confidence)}${infoButton('confidence')}</span></div>
          <h2><a title="${esc(job.title || 'Job opportunity')}" href="${jobPath({ id: job.job_id })}">${esc(job.title || 'Job opportunity')}</a><span class="match-full-title" aria-hidden="true">${esc(job.title || 'Job opportunity')}</span></h2>
          <div class="match-meta">${job.location ? `<span>${esc(job.location)}</span>` : ''}${job.employment_type ? `<span>${esc(job.employment_type.replaceAll('_', ' '))}</span>` : ''}${job.engagement_type ? `<span>${esc(job.engagement_type)}</span>` : ''}</div>
          <div class="match-card-footer">
            ${reasons ? `<div class="match-reasons">${reasons}</div>` : ''}
            <span class="match-card-actions"><form method="post" action="${savedJobIds.includes(String(job.job_id)) ? '/unsave-job' : '/save-job'}"><input type="hidden" name="job_id" value="${esc(job.job_id)}"><input type="hidden" name="return_to" value="/matches"><button class="match-save-button${savedJobIds.includes(String(job.job_id)) ? ' is-saved' : ''}" type="submit"><span class="match-heart" aria-hidden="true">${savedJobIds.includes(String(job.job_id)) ? '♥' : '♡'}</span> ${savedJobIds.includes(String(job.job_id)) ? 'Saved' : 'Save'}</button></form><a class="match-view-job" href="${jobPath({ id: job.job_id })}">View job <span aria-hidden="true">→</span></a></span>
          </div>
        </div>
      </article>`;
  }).join('');

  const freeUpgrade = !isPro && !error && lockedMatches > 0 ? `
    <section class="pro-unlock-card">
      <div class="pro-unlock-icon" aria-hidden="true">✈</div>
      <div class="pro-unlock-copy">
        <div class="kicker">VEEAYS PRO</div>
        <h2>${lockedMatches > 0 ? `${esc(lockedMatches)} more match${lockedMatches === 1 ? '' : 'es'} found.` : 'Unlock your full match feed.'}</h2>
        <p>Stop digging through every listing. Pro unlocks your full personalized feed and helps the strongest opportunities find you.</p>
        <div class="pro-benefits">
          <span>✓ Full ranked feed</span><span>✓ Match filters</span><span>✓ Strong Match Alerts</span><span>✓ Daily Job Digest</span>
        </div>
      </div>
      <div class="pro-unlock-action">
        <div class="pro-price"><strong>₱499</strong><span>/ month</span></div>
        <a class="button pro-button" href="/pro">Explore VeeAys Pro</a>
        <small>Cancel anytime. Membership signup coming soon.<br>Browsing and applying stay free.</small>
      </div>
    </section>` : '';

  const proControls = isPro && !error && matches.length ? `
    <section class="pro-match-dashboard" aria-label="Match controls">
      <div class="pro-match-dashboard-top">
        <div>
          <h2 aria-live="polite" aria-atomic="true"><strong id="visible-match-count">${esc(matches.length)}</strong> matches for you</h2>
          <div class="pro-feed-label"><span>PRO</span></div>
        </div>
        <a class="pro-edit-preferences" href="/onboarding">Edit preferences →</a>
      </div>
      <div class="pro-match-toolbar">
        <label class="pro-filter-field"><span>Sort</span><select id="match-sort"><option value="strongest">Strongest match</option><option value="newest" disabled>Newest · coming soon</option></select></label>
        <label class="pro-filter-field"><span>Salary</span><select id="match-salary"><option value="all">Any salary</option><option value="1000">$1,000+/mo</option><option value="1500">$1,500+/mo</option><option value="2000">$2,000+/mo</option><option value="3000">$3,000+/mo</option></select></label>
        <label class="pro-filter-field"><span>Schedule</span><select id="match-schedule"><option value="all">Any schedule</option><option value="philippines">Philippines daytime</option><option value="uk">UK / Europe</option><option value="australia">Australia</option><option value="us">US hours</option></select></label>
        <label class="pro-filter-field"><span>Work type</span><select id="match-work"><option value="all">Any work type</option><option value="full">Full-time</option><option value="part">Part-time</option></select></label>
        <button class="pro-quick-filter" id="match-90" type="button" aria-pressed="false">90%+ only</button>
        <button class="pro-clear-filters" id="match-clear" type="button">Clear</button>
      </div>
      
    </section>` : '';

  const proScript = isPro && matches.length ? `<script src="/match-filters.js" defer></script>` : '';

  const intro = isPro
    ? 'Jobs ranked around what matters to you.'
    : 'We compare your preferences with every eligible role and bring the strongest fits to the top. Your first 3 are free.';

  return `
    <section class="wrap matches-page">
      <div class="matches-heading-row"><div><div class="kicker">MY MATCHES</div><h1>Your best matches,<br><em>picked for you.</em></h1></div><svg class="matches-discovery" viewBox="0 0 210 160" aria-hidden="true"><circle class="matches-target-pulse" cx="74" cy="87" r="43" fill="#edf2d8" stroke="#b4c597" stroke-width="1.5"/><circle cx="74" cy="87" r="28" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="74" cy="87" r="12" fill="#d8ed93" stroke="currentColor" stroke-width="1.7"/><path class="matches-flight-path" d="M12 142c32-10 2-48 49-47s52-30 75-40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 6" stroke-linecap="round"/><g class="matches-plane-float"><path d="m132 41 57-18-20 53-10-24-27-11Z" fill="#f2d36c" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m159 52 30-29" stroke="currentColor" stroke-width="1.7"/></g><path d="M119 15v14m-7-7h14M185 103v9m-4.5-4.5h9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>${!isPro ? '<a class="matches-edit-link" href="/onboarding">Edit preferences</a>' : ''}</div>
      <p class="matches-intro">${intro}</p>
      ${error ? recovery({compact:true,title:"Your matches need a moment.",copy:"We couldn’t load your matches. Try again shortly, or browse current opportunities while you wait.",href:"/matches"}) : ''}
      ${proControls}
      <div class="matches-list">${cards || (!error ? recovery({compact:true,eyebrow:'ROOM FOR WHAT’S NEXT',title:'No matches yet.',copy:'Review your search profile to help VeeAys find opportunities that fit. You can browse all current jobs anytime.',href:'/onboarding',label:'Review search profile'}) : '')}</div>
      ${freeUpgrade}
    </section>${matches.length ? `<div class="match-tooltip" id="match-score-tooltip" role="tooltip" popover="manual" hidden><strong>How your match score works</strong><p>We compare this job with your saved preferences using the details the employer provides. Missing job information doesn’t lower your score, so 100% means it matched all the factors we could evaluate.</p></div><div class="match-tooltip" id="match-confidence-tooltip" role="tooltip" popover="manual" hidden><strong>What does confidence mean?</strong><p>Confidence reflects how much job information was available to calculate your match. More comparable details means greater confidence in the score.</p></div><script src="/match-interactions.js" defer></script>` : ''}${proScript}`;
}


// Decorative examples, never live match data. Shared by homepage and Pro discovery.
const proPlane = `<svg class="pro-marketing-plane" viewBox="0 0 210 160" aria-hidden="true" focusable="false">
  <path class="pro-route" d="M10 140c60-10 0-65 85-55s35-40 60-45" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 7"/>
  <g class="pro-hero-flight">
  <path d="m120 40 75-25-25 70-17-30Z" fill="#f2bb52" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <path d="m153 55 42-40" stroke="currentColor" stroke-width="2"/>
  </g>
  <g transform="rotate(-6 65 123)">
  <rect x="22" y="111" width="86" height="24" rx="3" fill="#e8eeac"/>
  <text x="65" y="127" text-anchor="middle" fill="#123e30" font-size="10" font-weight="700">96% MATCH</text>
  </g>
  </svg>`;
const proBenefits = () => `<div class="pro-marketing-benefits">
  <article>
  <svg class="pro-story" viewBox="0 0 240 140" aria-hidden="true" focusable="false">
  <g class="pro-rank-back">
  <rect x="70" y="22" width="142" height="66" rx="4" fill="#fffdf3" stroke="currentColor" stroke-width="1.5"/>
  <path d="M82 40h45m-45 10h70" stroke="#b7c9a5" stroke-width="3" stroke-linecap="round"/>
  <text x="183" y="35" fill="currentColor" font-size="12" font-weight="700">72%</text>
  </g>
  <g class="pro-rank-mid">
  <rect x="52" y="39" width="142" height="66" rx="4" fill="#fffdf3" stroke="currentColor" stroke-width="1.5"/>
  <path d="M64 57h45m-45 10h70" stroke="#b7c9a5" stroke-width="3" stroke-linecap="round"/>
  <text x="165" y="52" fill="currentColor" font-size="12" font-weight="700">86%</text>
  </g>
  <g class="pro-rank-front">
  <rect x="34" y="56" width="142" height="66" rx="4" fill="#fffdf3" stroke="currentColor" stroke-width="1.5"/>
  <path d="M46 74h45m-45 10h70" stroke="#b7c9a5" stroke-width="3" stroke-linecap="round"/>
  <text x="46" y="108" fill="currentColor" font-size="12" font-weight="700">96% MATCH</text>
  </g>
  <path d="m38 50 28-8-3 13-25-5Z" fill="#f2bb52" opacity=".8"/>
  </svg>
  <h3>Your personalized job feed</h3>
  <p>See your best opportunities ranked around your preferences.</p>
  </article>
  <article>
  <svg class="pro-story" viewBox="0 0 240 140" aria-hidden="true" focusable="false">
  <path class="pro-route" d="M18 95c35 12 34-38 73-38" fill="none" stroke="currentColor" stroke-dasharray="2 6"/>
  <g class="pro-alert-plane">
  <path d="m26 41 52-19-17 46-12-17-23-10Z" fill="#f2bb52" stroke="currentColor" stroke-width="1.5"/>
  <path d="m49 51 29-29" stroke="currentColor" stroke-width="1.5"/>
  </g>
  <rect x="99" y="52" width="108" height="65" rx="4" fill="#fffdf3" stroke="currentColor" stroke-width="1.5"/>
  <path d="m100 54 53 36 53-36" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <g class="pro-alert-stamp">
  <rect x="125" y="26" width="94" height="26" rx="3" fill="#e8eeac" stroke="currentColor"/>
  <text x="172" y="43" text-anchor="middle" font-size="11" font-weight="700">NEW MATCH</text>
  </g>
  </svg>
  <h3>Strong Match Alerts</h3>
  <p>Get an email when an especially strong match appears.</p>
  </article>
  <article>
  <svg class="pro-story" viewBox="0 0 240 140" aria-hidden="true" focusable="false">
  <path d="M25 63h190" stroke="#b7c9a5" stroke-width="1.5"/>
  <g class="pro-sun">
  <circle cx="120" cy="45" r="21" fill="#f2bb52"/>
  <path d="M120 12V5m-31 18-5-5m67 5 5-5M87 44h-8m74 0h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </g>
  <g class="pro-digest-pages">
  <rect x="76" y="54" width="80" height="47" rx="3" fill="#edf2d8" stroke="currentColor" transform="rotate(-8 116 77)"/>
  <rect x="87" y="51" width="80" height="47" rx="3" fill="#fffdf3" stroke="currentColor" transform="rotate(6 127 74)"/>
  <path d="M102 64h45m-45 9h34" stroke="#b7c9a5" stroke-width="3"/>
  </g>
  <path d="M58 78h124v48H58Z" fill="#fffdf3" stroke="currentColor" stroke-width="1.5"/>
  <path d="m58 78 62 31 62-31" fill="#e8eeac" stroke="currentColor" stroke-width="1.5"/>
  </svg>
  <h3>Daily Job Digest</h3>
  <p>Your best new matches, gathered into one daily email.</p>
  </article>
  </div>`;
export function proDiscovery() {
  return '<section class="wrap pro-discovery" aria-labelledby="pro-discovery-title"><div class="kicker">VEEAYS PRO</div><h2 id="pro-discovery-title">Stop searching.<br><em>Let the right jobs find you.</em></h2>'+proBenefits()+'<div class="pro-discovery-action"><a class="button" href="/pro">Explore VeeAys Pro →</a><p><strong>₱499/month</strong> · Cancel anytime</p></div><p class="pro-discovery-promise">All the jobs are free. Pro helps you find the right ones faster.</p></section>';
}
export function proPage({ isPro = false, user = null, profile = null, testCheckout = false, liveCheckout = false } = {}) {
  const action = liveCheckout ? '<form method="post" action="/pro/checkout"><button class="button" type="submit">'+(isPro ? 'Add 30 days' : 'Get Pro for 30 days')+' — ₱499</button></form><p>One-time purchase; no automatic renewal.</p>' : testCheckout ? '<form method="post" action="/pro/checkout"><button class="button" type="submit">'+(isPro ? 'Add 30 days' : 'Try Pro for 30 days')+' — ₱499 (TEST)</button></form><p>TEST MODE · No real money is charged. One-time purchase; no automatic renewal.</p>' : isPro ? '<a class="button" href="/matches">View my Pro matches →</a><p>Your account already has Pro access.</p>' : user ? '<a class="button" href="'+(profile?.onboarding_completed ? '/matches' : '/onboarding')+'">Try your free matches →</a>' : '<a class="button" href="/signup?return=%2Fonboarding">Try your free matches →</a><p>Already a member? <a href="/login?return=%2Fpro">Log in</a></p>';
  const board = `<div class="pro-comparison-board" role="group" aria-label="Find your fit: Free and VeeAys Pro">
    <article class="pro-plan-paper" aria-labelledby="pro-free-title">
      <p class="pro-plan-label">FREE</p>
      <h3 id="pro-free-title">You search.</h3>
      <p class="pro-plan-price"><strong>₱0</strong><span>Free to use</span></p>
      <ul class="pro-plan-benefits">
        <li>Browse and apply to every public job</li>
        <li>Search and explore categories</li>
        <li>Save jobs and track applications</li>
        <li>Your top 3 personalized matches</li>
      </ul>
    </article>
    <article class="pro-plan-paper pro-plan-plus" aria-labelledby="pro-plus-title">
      <span class="pro-plan-note">FOR ACTIVE JOB SEEKERS</span>
      <svg class="pro-board-flight" viewBox="0 0 170 56" aria-hidden="true" focusable="false"><path class="pro-route" d="M4 44c30-38 43 17 78-6s30-20 49-18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 6" stroke-linecap="round"/><g class="pro-alert-plane"><path d="m128 16 32-10-12 29-6-13Z" fill="#f2bb52" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="m142 22 18-16" stroke="currentColor" stroke-width="1.5"/></g></svg>
      <p class="pro-plan-label">VEEAYS PRO</p>
      <h3 id="pro-plus-title">VeeAys searches<br>with you.</h3>
      <p class="pro-plan-price"><strong>₱499<span>/30 days</span></strong><span>One-time purchase</span></p>
      <p class="pro-plan-includes">Everything in Free, plus:</p>
      <ul class="pro-plan-benefits">
        <li>Your personalized job feed</li>
        <li>Salary, schedule and work-type match filters</li>
        <li>Strong Match Alerts</li>
        <li>Daily Job Digest</li>
      </ul>
    </article>
  </div>`;
  return '<div class="pro-marketing"><section class="pro-marketing-hero"><div class="wrap"><div class="kicker">VEEAYS PRO</div><h1>YOUR JOB SEARCH,<br><em>ON AUTOPILOT.</em></h1><p class="pro-marketing-intro">Stop searching. Let the right jobs find you.</p><p>VeeAys Pro watches new opportunities for you, ranks the ones that fit your preferences, and lets you know when a great match appears.</p>'+proPlane+'<p class="pro-marketing-price"><strong>₱499 for 30 days</strong> · No automatic renewal</p>'+action+(!isPro && !testCheckout && !liveCheckout ? '<p class="pro-launch-note">Pro membership is coming soon. Start free and we&#39;ll let you know when upgrades open.</p>' : '')+'</div></section><section class="wrap pro-marketing-details"><h2>A little less searching.<br><em>A little more possibility.</em></h2>'+proBenefits()+'<p>Pro members can sort and filter their match feed by salary, schedule, work type and 90%+ scores. Email preferences stay in your control.</p><div class="pro-flight-divider" aria-hidden="true"><span>PH → WORLD</span><svg viewBox="0 0 300 36" focusable="false"><path d="M2 25c50-36 62 26 126 0s78-20 151-9" fill="none" stroke="currentColor" stroke-dasharray="2 6"/><path d="m275 8 21 7-20 9 4-9Z" fill="#f2bb52" stroke="currentColor"/></svg><span>Your next move</span></div><h2>All the jobs are free.<br><em>Pro helps you find the right ones faster.</em></h2>'+board+'<p class="pro-availability-note">Matches depend on your preferences and available job information. Alerts and digests require active Pro access and enabled email preferences.</p><p class="pro-free-note"><strong>Every public job stays free.</strong> Pro adds matching, alerts and convenience, not access to jobs.</p></section></div>';
}


export function myJobsPage({ saved = [], applications = [], message = '', error = '', loadFailed = false } = {}) {
  if (loadFailed) return recovery({title:'Your job search is still yours.',copy:'We couldn’t load your saved jobs and applications right now. Try again to see your latest shortlist and progress.',href:'/my-jobs',label:'Reload My Jobs'});
  const statusLabel = value => ({ applied: 'Applied', interview: 'Interview', offer: 'Offer', hired: 'Hired', rejected: 'Rejected', withdrawn: 'Withdrawn' }[value] || value);
  const formatAppliedDate = value => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const jobMini = job => `<article class="my-job-card"><div><div class="my-job-company">${esc(job.company || 'Company')}</div><h3><a class="workspace-title-swipe" href="${jobPath(job)}">${esc(job.title || 'Job opportunity')}</a></h3><div class="shortlist-meta">${job.category ? `<span class="shortlist-category">${esc(job.category)}</span>` : ''}${job.location ? `<span class="shortlist-location">${esc(job.location)}</span>` : ''}</div></div><a class="my-job-view" href="${jobPath(job)}">View job →</a></article>`;
  const applicationCard = item => {
    const appliedDate = formatAppliedDate(item.applied_at);
    return `<article class="tracker-card" data-status="${esc(item.status)}">
      <div class="tracker-card-summary">
        <div class="tracker-card-main"><div class="my-job-company">${esc(item.job?.company || 'Company')}</div><h3><a class="workspace-title-swipe" href="${item.job ? jobPath(item.job) : '#'}">${esc(item.job?.title || 'Job opportunity')}</a></h3><div class="tracker-meta"><span class="tracker-status tracker-status-${esc(item.status)}">${statusLabel(item.status)}</span>${appliedDate ? `<span>Applied ${esc(appliedDate)}</span>` : ''}${item.job?.location ? `<span>${esc(item.job.location)}</span>` : ''}</div></div>
        <div class="tracker-card-links">${item.job ? `<a class="my-job-view" href="${jobPath(item.job)}">View job →</a>` : ''}<button class="tracker-edit-toggle" type="button" aria-expanded="false">Edit application</button></div>
      </div>
      <div class="tracker-edit-panel" hidden>
        <form class="tracker-form" method="post" action="/update-application">
          <input type="hidden" name="job_id" value="${esc(item.job_id)}">
          <p class="workspace-editor-heading">A little update. A clearer next step.</p><label>Status<select name="status">${['applied','interview','offer','hired','rejected','withdrawn'].map(s => `<option value="${s}"${s === item.status ? ' selected' : ''}>${statusLabel(s)}</option>`).join('')}</select></label>
          <label>Private notes<textarea name="notes" maxlength="2000" placeholder="Interview details, follow-up dates, contact names…">${esc(item.notes || '')}</textarea></label>
          <div class="tracker-actions"><button type="submit">Save changes</button><button class="tracker-remove" type="submit" formaction="/remove-application">Remove</button></div>
        </form>
      </div>
    </article>`;
  };
  const counts = {
    all: applications.length,
    applied: applications.filter(i => i.status === 'applied').length,
    interview: applications.filter(i => i.status === 'interview').length,
    offer: applications.filter(i => i.status === 'offer').length,
    hired: applications.filter(i => i.status === 'hired').length,
    closed: applications.filter(i => i.status === 'rejected' || i.status === 'withdrawn').length,
  };
  const tabs = [['all','All'],['applied','Applied'],['interview','Interview'],['offer','Offer'],['hired','Hired'],['closed','Closed']];
  const cards = applications.map(applicationCard).join('');
  return `<section class="wrap my-jobs-page">
    <header class="workspace-intro"><div><div class="kicker">YOUR JOB SEARCH</div><h1>Keep your opportunities <em>moving.</em></h1><p class="my-jobs-intro">Save roles, track applications and keep your next steps in one place.</p><a class="workspace-discover" href="/jobs">Find your next opportunity <span aria-hidden="true">↗</span></a></div><div class="workspace-sketch" aria-hidden="true"><span class="sketch-label">Your next move</span><div class="sketch-paper"><span>THE SHORTLIST</span><i>✓ &nbsp; Find a role you love</i><i>✓ &nbsp; Make your application</i><i>○ &nbsp; Keep in touch</i><b>one step at a time</b></div></div></header>
    ${message ? `<div class="my-jobs-message">${esc(message)}</div>` : ''}${error ? recovery({compact:true,title:"That update needs another try.",copy:"We couldn’t complete this change. Check your latest application details before trying again.",href:"/my-jobs",label:"Reload My Jobs"}) : ''}
    <section class="saved-jobs-section"><div class="my-jobs-section-head"><div><span class="eyebrow">SAVED</span><h2>Your shortlist</h2><p class="workspace-section-note">Bookmarked for later. Ready when you are.</p></div><strong>${saved.length}</strong></div>
      <div class="my-jobs-grid">${saved.length ? saved.map(jobMini).join('') : '<div class="my-jobs-empty"><span class="workspace-empty-mark" aria-hidden="true">✧</span><h3>Start with a possibility.</h3><p>Spot a role you like? Save it and build your shortlist here.</p><a class="button" href="/jobs">Find jobs</a></div>'}</div>
    </section>
    <p class="workspace-transition">Ready to apply? <span>Keep it moving <span aria-hidden="true">↓</span></span></p>
    <section class="application-tracker"><div class="my-jobs-section-head"><div><span class="eyebrow">APPLICATION TRACKER</span><h2>Applications in motion</h2><p class="workspace-section-note">Keep track of every application and what happens next.</p></div><strong>${applications.length}</strong></div>
      <p class="workspace-tracking-note">Tracking here does not submit an application to the employer.</p><div class="tracker-tabs" role="group" aria-label="Application status filters">${tabs.map(([key,label],idx) => `<button type="button" class="tracker-tab${idx===0?' active':''}" data-filter="${key}" aria-pressed="${idx===0?'true':'false'}">${label}<span>${counts[key]}</span></button>`).join('')}</div>
      <div class="tracker-cards">${cards || '<div class="my-jobs-empty tracker-all-empty"><span class="workspace-empty-mark" aria-hidden="true">✓</span><h3>Your next chapter starts with a role.</h3><p>Once you’ve applied to an employer, mark the job as applied to track it here.</p><a class="my-job-view" href="/jobs">Explore jobs →</a></div>'}<div class="my-jobs-empty tracker-filter-empty" hidden><span class="workspace-empty-mark" aria-hidden="true">○</span><h3>A little room for what’s next.</h3><p>No applications in this stage. Choose another status to see your progress.</p><a class="my-job-view" href="/jobs">Discover more roles →</a></div></div>
    </section>
  </section>
  <script>
  (() => {
    const root = document.querySelector('.application-tracker');
    if (!root) return;
    const tabs = [...root.querySelectorAll('.tracker-tab')];
    const cards = [...root.querySelectorAll('.tracker-card')];
    const empty = root.querySelector('.tracker-filter-empty');
    const matches = (status, filter) => filter === 'all' || status === filter || (filter === 'closed' && (status === 'rejected' || status === 'withdrawn'));
    tabs.forEach(tab => tab.addEventListener('click', () => {
      const filter = tab.dataset.filter || 'all';
      tabs.forEach(t => { const active=t===tab; t.classList.toggle('active',active); t.setAttribute('aria-pressed',String(active)); });
      let visible=0;
      cards.forEach(card => { const show=matches(card.dataset.status,filter); card.hidden=!show; if(show) visible++; });
      if (empty) empty.hidden = visible !== 0 || cards.length === 0;
    }));
    root.querySelectorAll('.tracker-edit-toggle').forEach(button => button.addEventListener('click', () => {
      const card = button.closest('.tracker-card');
      const panel = card?.querySelector('.tracker-edit-panel');
      if (!panel) return;
      const open = panel.hidden;
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      button.textContent = open ? 'Close editor' : 'Edit application';
    }));
  })();
  </script>`;
}
