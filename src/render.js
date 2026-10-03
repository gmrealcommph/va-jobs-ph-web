export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const jobPath = job => `/jobs/${encodeURIComponent(job.id)}`;
export const categoryPath = name => `/categories/${encodeURIComponent(name)}`;
export function safeUrl(value) { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; } }
export function date(value) { const d = new Date(value); return value && !Number.isNaN(+d) ? d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }) : ''; }

export function layout({ title, description, canonical, body, noindex = false, user = null, profile = null, showPreferencesPrompt = false }) {
  const firstName = String(profile?.full_name || '').trim().split(/\s+/)[0] || '';
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

  <meta name="theme-color" content="#123e30">

  <link
    rel="icon"
    href="/favicon.svg"
    type="image/svg+xml"
  >

  <link rel="stylesheet" href="/styles.css?v=20261002-mobilecategories">
</head>

<body>

<a class="skip" href="#main">
  Skip to content
</a>

<header class="site-header">

  <div class="wrap header">

    <a
      class="veeays-brand"
      href="/"
      aria-label="VeeAys home"
    >
      <img
        class="veeays-logo-img"
        src="/veeays-logo.png"
        alt="VeeAys"
        width="1200"
        height="400"
      >
    </a>

    <nav aria-label="Main navigation">

      <a href="/">
        Find a job
      </a>

      <a href="/categories">
        Categories
      </a>

      <a href="/employers">
        For Employers
      </a>

    </nav>

    <div class="header-actions">

      ${user ? `
        <span class="auth-user">${firstName ? `Hi, ${esc(firstName)}! 👋` : 'Hi! 👋'}</span>
        <a class="auth-link" href="/matches">My matches</a>
        <a class="auth-link" href="/onboarding">My account</a>
        <a class="auth-link" href="/logout">Log out</a>
      ` : `
        <a class="auth-link" href="/login">Log in</a>
        <a class="post-job-cta" href="/signup">Sign up</a>
      `}

    </div>

  </div>

</header>



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

        <a href="/">
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
          Post a job
          <span aria-hidden="true">↗</span>
        </a>

      </div>


      <div class="footer-column">

        <h2>VeeAys</h2>

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

    </div>


    

  </div>

</footer>

</body>
</html>`;
}

export function card(job) {
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

export function searchForm(search = '', category = '', action = '/') {
  return `<form class="search" role="search" action="${esc(action)}" method="get"><label for="q">Job title, company, or keyword</label><div class="search-row"><span aria-hidden="true">⌕</span><input id="q" name="q" type="search" maxlength="120" placeholder="e.g. virtual assistant, customer support" value="${esc(search)}">${category && action === '/' ? `<input type="hidden" name="category" value="${esc(category)}">` : ''}<button type="submit">Search jobs <span aria-hidden="true">↗</span></button></div></form>`;
}

export function listing({ rows, total, page, search, category, names, showPreferencesPrompt = false, onboardingComplete = false }) {
  const action = category ? categoryPath(category) : '/';
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

  const hero = category
    ? `<section class="hero"><div class="wrap"><div class="kicker"><span></span> BUILT FOR FILIPINO TALENT</div><h1>${category ? `${esc(category)}<br><em>opportunities.</em>` : 'Great work.<br><em>Closer than you think.</em>'}</h1><p>Find your next opportunity in virtual assistance and beyond.<br>Explore roles open to talent in the Philippines.</p>${searchForm(search, category, action)}<div class="hero-foot"><span>Find your fit. Make your move.</span><span>PH <span aria-hidden="true">✳</span> WORLDWIDE POSSIBILITIES</span></div></div></section>`
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

            <div class="premium-collage" aria-hidden="true">

              <div class="collage-glow"></div>

              <img
                src="/veeays-hero-collage.png"
                alt=""
                width="1728"
                height="864"
                loading="eager"
                fetchpriority="high"
              >

              <span class="float-note note-one">
                Different time zones.<br>
                <strong>Same drive.</strong>
              </span>

              <span class="float-badge">
                PH <b>↗</b> WORLD
              </span>

              <span class="hero-spark spark-one">✳</span>
              <span class="hero-spark spark-two">✦</span>

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

  const filters = names.map(name => `
    <a
      class="filter ${category === name ? 'selected' : ''}"
      ${category === name ? 'aria-current="page"' : ''}
      href="${categoryPath(name)}${search ? '?' + new URLSearchParams({ q: search }) : ''}"
    >
      <span class="filter-icon" aria-hidden="true">${categoryIcon(name)}</span>
      <span class="filter-name">${esc(name)}</span>
      <span class="filter-chevron" aria-hidden="true">›</span>
    </a>
  `).join('');

  const resultsTitle = search
    ? `Results for “${esc(search)}”`
    : category
      ? `${esc(category)} opportunities`
      : 'Fresh opportunities<br><em>for Filipino talent.</em>';

  return `${category ? '' : '<div class="home-page">'}${hero}

  <section class="wrap listings" id="opportunities">

    <aside class="opportunity-map">

      <div class="category-doodle" aria-hidden="true">
        Find a role<br>
        that fits you
        <b>↘</b>
      </div>

      <div class="category-panel">

        <h2>Explore categories</h2>

        <a
          class="filter all-filter ${category ? '' : 'selected'}"
          href="/${search ? '?' + new URLSearchParams({ q: search }) : ''}"
        >
          <span class="filter-icon" aria-hidden="true">⊞</span>
          <span class="filter-name">All opportunities</span>
          <span class="all-count">${total.toLocaleString('en-US')}</span>
          <span class="filter-chevron" aria-hidden="true">›</span>
        </a>

        ${filters}

      </div>

      <div class="aside-note">
        <span aria-hidden="true">✳</span>

        <h3>
          Your skills.<br>
          New possibilities.
        </h3>

        <p>
          Discover a role that fits where you want to go next.
        </p>

        <b aria-hidden="true">↗</b>
      </div>

    </aside>

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

          
        </div>

        ${!search && !category ? `
          <div
            class="opportunity-count"
            aria-label="${total.toLocaleString('en-US')} opportunities"
          >
            <strong>${total.toLocaleString('en-US')}</strong>

            <span>
              opportunities<br>
              and counting
            </span>
          </div>
        ` : ''}

      </div>

      ${
  rows.length
    ? `<div class="opportunity-grid">
        ${rows.map(card).join('')}
      </div>`
    : `<div class="empty">
        <h2>No matching opportunities yet</h2>
        <p>Try another keyword or explore all categories.</p>
        <a class="button" href="/">Browse all jobs</a>
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


    <div class="final-cta-art" aria-hidden="true">

      <span class="final-art-star star-one">✳</span>
      <span class="final-art-star star-two">✦</span>

      <div class="final-map-stamp">
        <span>PH</span>
        <b>↗</b>
        <span>WORLD</span>
      </div>

      <div class="final-paper-card">
        <span class="final-paper-pin">✦</span>

        <strong>
          Ready when<br>
          you are.
        </strong>

        <small>
          Your skills can travel.
        </small>
      </div>

      <div class="final-flight-path">
        <span class="final-path-dot dot-one"></span>
        <span class="final-path-dot dot-two"></span>
        <span class="final-path-dot dot-three"></span>
        <span class="final-path-dot dot-four"></span>
        <span class="final-path-dot dot-five"></span>
        <span class="final-path-dot dot-six"></span>
      </div>

      <span class="final-paper-plane">➤</span>

      <div class="final-postcard">
        <span>WORK</span>

        <strong>
          WITHOUT<br>
          BORDERS
        </strong>

        <small>
          VEEAYS · PH → WORLD
        </small>
      </div>

    </div>

  </div>

  <div class="final-cta-tear" aria-hidden="true"></div>
</section>
      </div>`
  }`;
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

export function detail(job) {
  const apply = safeUrl(job.job_url);

  const logo =
    safeUrl(job.company_logo_url);

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


          <div class="job-detail-hero-card">

            <div class="job-detail-hero-top">

              <div class="job-detail-company">
                ${esc(company)}
              </div>

              ${
                posted
                  ? `<div class="job-detail-posted">
                      Posted ${posted}
                    </div>`
                  : ''
              }

            </div>


            <h1>
              ${esc(title)}
            </h1>


            <div class="job-detail-meta">

              <span class="job-detail-location">
                <i aria-hidden="true">●</i>
                ${esc(location)}
              </span>

              ${
                workplace
                  ? `<span class="job-detail-remote">
                      <i aria-hidden="true">⌁</i>
                      ${esc(workplace)}
                    </span>`
                  : ''
              }

            </div>


            <div class="job-detail-hero-bottom">

              ${
                job.category
                  ? `<a
                      class="job-detail-category"
                      href="${categoryPath(job.category)}"
                    >
                      ${esc(job.category)}
                    </a>`
                  : '<span></span>'
              }

              <div
                class="job-detail-route"
                aria-hidden="true"
              >
                <span>PH</span>
                <b>· · · · · ·</b>
                <span>WORLD</span>
                <strong>↗</strong>
              </div>

            </div>


            <span
              class="job-detail-corner"
              aria-hidden="true"
            ></span>

          </div>

        </div>

      </section>


      <section class="wrap job-detail-layout">

        <article class="job-detail-content">

          <div class="job-detail-section-heading">

            <span aria-hidden="true">✦</span>

            <div>
              <div class="eyebrow">
                THE OPPORTUNITY
              </div>

              <h2>
                About this opportunity
              </h2>
            </div>

          </div>


          <div class="description job-detail-description">
            ${formatJobDescription(description)}
          </div>

        </article>


        <aside class="job-detail-sidebar">

          <div class="job-detail-snapshot">

            <div class="job-detail-snapshot-kicker">
              <span aria-hidden="true">✦</span>
              OPPORTUNITY SNAPSHOT
            </div>


            ${
  logo
    ? `<div class="job-detail-logo-wrap${
        company.toLowerCase() === 'assist world'
          ? ' job-detail-logo-wrap--assist-world'
          : ''
      }">
        <img
          class="job-detail-logo"
          src="/company-logo/${encodeURIComponent(String(job.id))}"
          alt="${esc(company)} logo"
          loading="lazy"
          referrerpolicy="no-referrer"
        >
      </div>`
    : ''
}


            <h2>
              Sound like your<br>
              kind of work?
            </h2>


            <dl>

              <div>
                <dt>Company</dt>
                <dd>${esc(company)}</dd>
              </div>


              <div>
                <dt>Location</dt>
                <dd>${esc(location)}</dd>
              </div>


              ${
                workplace
                  ? `<div>
                      <dt>Workplace</dt>
                      <dd>${esc(workplace)}</dd>
                    </div>`
                  : ''
              }


              ${
                job.category
                  ? `<div>
                      <dt>Category</dt>
                      <dd>
                        <a href="${categoryPath(job.category)}">
                          ${esc(job.category)}
                        </a>
                      </dd>
                    </div>`
                  : ''
              }


              ${
                posted
                  ? `<div>
                      <dt>Posted</dt>
                      <dd>${posted}</dd>
                    </div>`
                  : ''
              }

            </dl>


            ${
              apply
                ? `<a
                    class="job-detail-apply"
                    href="/apply/${encodeURIComponent(job.id)}"
                    rel="nofollow"
                  >
                    <span>Apply for this role</span>
                    <b>↗</b>
                  </a>

                  <p class="job-detail-external">
  Opens the original listing
  in a new tab.
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


            <div
              class="job-detail-flight"
              aria-hidden="true"
            >
              <span>· · · · · · ·</span>
              <b>➤</b>
            </div>

          </div>

        </aside>

      </section>

    </div>
  `;
}


export function authPage({ mode = 'login', error = '', message = '', email = '', returnTo = '' } = {}) {
  const signup = mode === 'signup';
  const applyIntent = returnTo.startsWith('/apply/');
  return `
    <section class="auth-shell">
      <div class="auth-intro">
        <div class="kicker">${signup ? 'JOIN VEEAYS' : 'WELCOME BACK'}</div>
        <h1>${signup ? 'Your next remote role,<br><em>without the guesswork.</em>' : 'Pick up where<br><em>you left off.</em>'}</h1>
        <p>${applyIntent ? 'Create or log in to your free VeeAys account, then we’ll take you straight back to this application.' : (signup ? 'Create your free VeeAys account. We focus on remote opportunities that are open to Filipino talent.' : 'Log in to continue building your VeeAys profile and, soon, get job matches tailored to you.')}</p>
      </div>
      <div class="auth-card">
        <h2>${signup ? 'Create your account' : 'Log in'}</h2>
        <p>${applyIntent ? 'Your application is waiting. You won’t have to complete your profile first.' : (signup ? 'Free to join. You can set your job preferences after verifying your email.' : 'Use the email and password you signed up with.')}</p>
        ${error ? `<div class="auth-alert error" role="alert">${esc(error)}</div>` : ''}
        ${message ? `<div class="auth-alert success">${esc(message)}</div>` : ''}
        <form class="auth-form" method="post" action="${signup ? '/signup' : '/login'}">
          ${returnTo ? `<input type="hidden" name="return" value="${esc(returnTo)}">` : ''}
          ${signup ? `<div class="auth-field"><label for="full_name">Full name</label><input id="full_name" name="full_name" type="text" autocomplete="name" maxlength="100" required></div>` : ''}
          <div class="auth-field"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" maxlength="254" value="${esc(email)}" required></div>
          <div class="auth-field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="8" maxlength="128" required></div>
          <button type="submit">${signup ? 'Create account' : 'Log in'}</button>
        </form>
        <p class="auth-switch">${signup ? `Already have an account? <a href="/login${returnTo ? `?return=${encodeURIComponent(returnTo)}` : ''}">Log in</a>` : `New to VeeAys? <a href="/signup${returnTo ? `?return=${encodeURIComponent(returnTo)}` : ''}">Create an account</a>`}</p>
      </div>
    </section>`;
}

export function checkEmailPage(email = '', returnTo = '') {
  const loginHref = '/login' + (returnTo ? `?return=${encodeURIComponent(returnTo)}` : '');
  return `<section class="auth-shell"><div class="auth-intro"><div class="kicker">ONE MORE STEP</div><h1>Check your<br><em>inbox.</em></h1><p>We sent a confirmation link${email ? ` to <strong>${esc(email)}</strong>` : ''}. Click it to verify your email and continue setting up your VeeAys account.</p></div><div class="auth-card"><h2>Verify your email</h2><p>The link will take you back to VeeAys. If you don't see the message, check your spam or junk folder.</p><a class="button" href="${esc(loginHref)}">Back to log in</a></div></section>`;
}

export function authCallbackPage() {
  return `<section class="auth-callback"><div class="kicker">VERIFYING</div><h1>Finishing your sign in…</h1><p>Please keep this page open for a moment.</p></section><script src="/auth-callback.js" defer></script>`;
}

export function onboardingPage({ user, preferences = null, error = '' } = {}) {
  const roles = ['Executive Assistant','General VA','Customer Support','Social Media','Marketing','Sales','E-commerce','Bookkeeping','Graphic Design','Video Editing','Operations','Web/Development','Other'];
  const employment = ['Full-time','Part-time','Contract/Freelance'];
  const schedules = ['Philippines daytime','UK/Europe hours','Australia hours','US hours','Flexible/Any'];
  const experience = ['Entry level','1–2 years','3–5 years','6+ years'];
  const selected = (items, value) => Array.isArray(items) && items.includes(value);
  const choices = (name, options, values = []) => options.map((value, i) => `<label class="onboard-choice"><input type="checkbox" name="${esc(name)}" value="${esc(value)}" ${selected(values,value)?'checked':''}><span>${esc(value)}</span></label>`).join('');
  const radios = (name, options, value = '') => options.map((item, i) => `<label class="onboard-choice"><input type="radio" name="${esc(name)}" value="${esc(item)}" ${item===value?'checked':''}><span>${esc(item)}</span></label>`).join('');
  const skills = Array.isArray(preferences?.skills) ? preferences.skills.join(', ') : '';
  return `
  <section class="onboard-shell">
    <div class="onboard-top">
      <div><div class="kicker">YOUR VEEAYS PROFILE</div><h1>Tell us what you're <em>looking for.</em></h1><p>We'll use these preferences to make VeeAys more relevant to you. You can change them later.</p></div>
      <div class="onboard-progress" aria-label="Onboarding progress"><span class="active">1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
    </div>
    ${error ? `<div class="auth-alert error onboard-error" role="alert">${esc(error)}</div>` : ''}
    <form class="onboard-card" method="post" action="/onboarding" id="onboarding-form">
      <section class="onboard-step active" data-step="1">
        <div class="onboard-step-label">STEP 1 OF 5</div><h2>What kind of roles are you looking for?</h2><p>Choose as many as you like.</p>
        <div class="onboard-grid">${choices('target_roles', roles, preferences?.target_roles)}</div>
      </section>
      <section class="onboard-step" data-step="2">
        <div class="onboard-step-label">STEP 2 OF 5</div><h2>What are you looking for?</h2><p>Set a salary floor and the types of work you're open to.</p>
        <div class="salary-box"><label for="minimum_salary_usd">Minimum monthly salary</label><div class="salary-input"><span>$</span><input id="minimum_salary_usd" name="minimum_salary_usd" type="number" min="0" max="50000" step="50" inputmode="numeric" value="${esc(preferences?.minimum_salary_usd ?? '')}" placeholder="1000"></div><small id="salary-php">Optional. We'll use this as a matching preference.</small></div>
        <h3>Employment type</h3><div class="onboard-grid compact">${choices('employment_types', employment, preferences?.employment_types)}</div>
      </section>
      <section class="onboard-step" data-step="3">
        <div class="onboard-step-label">STEP 3 OF 5</div><h2>When can you work?</h2><p>Select all schedules you'd consider.</p>
        <div class="onboard-grid compact">${choices('schedule_preferences', schedules, preferences?.schedule_preferences)}</div>
      </section>
      <section class="onboard-step" data-step="4">
        <div class="onboard-step-label">STEP 4 OF 5</div><h2>Tell us about your experience.</h2><p>This helps us avoid showing roles that are clearly too junior or too senior.</p>
        <h3>Experience level</h3><div class="onboard-grid compact">${radios('experience_level', experience, preferences?.experience_level)}</div>
        <div class="skills-box"><label for="skills">Skills</label><textarea id="skills" name="skills" rows="4" maxlength="1200" placeholder="e.g. Google Workspace, Canva, HubSpot, customer support, bookkeeping">${esc(skills)}</textarea><small>Separate skills with commas.</small></div>
      </section>
      <section class="onboard-step" data-step="5">
        <div class="onboard-step-label">STEP 5 OF 5</div><h2>Ready to find better-fit jobs?</h2><p>Review your choices below. You can go back to make changes before saving.</p>
        <div class="onboard-review" id="onboard-review"></div>
        <div class="onboard-ready"><strong>${esc(user?.email || 'Your account')}</strong><span>Your preferences will be saved securely to this account.</span></div>
      </section>
      <div class="onboard-actions"><button class="button secondary" type="button" id="onboard-back" hidden>Back</button><button type="button" id="onboard-next">Continue</button><button type="submit" id="onboard-finish" hidden>Save preferences &amp; find jobs</button></div>
    </form>
  </section>
  <script src="/onboarding.js?v=20261002-reviewfix" defer></script>`;
}


export function matchesPage({ matches = [], preferences = null, summary = null, error = '' } = {}) {
  const schedulePrefs = Array.isArray(preferences?.schedule_preferences) ? preferences.schedule_preferences : [];
  const scheduleUnrestricted = schedulePrefs.some(value => ['flexible/any', 'flexible', 'any'].includes(String(value).trim().toLowerCase()));
  const isPro = summary?.is_pro === true;
  const lockedMatches = Math.max(0, Number(summary?.locked_matches) || 0);
  const totalMatches = Math.max(matches.length, Number(summary?.total_matches) || 0);
  const confidenceLabel = available => available >= 5 ? 'High confidence' : available >= 3 ? 'Good confidence' : 'Limited data';

  const friendlyReason = (label, matched, available, unrestricted = false) => {
    if (unrestricted) return `<span class="match-reason neutral"><b aria-hidden="true">↔</b>${esc(label)} flexible</span>`;
    if (!available) return '';
    if (matched) return `<span class="match-reason matched"><b aria-hidden="true">✓</b>${esc(label)}</span>`;
    return `<span class="match-reason neutral"><b aria-hidden="true">•</b>${esc(label)} differs</span>`;
  };

  const cards = matches.map(job => {
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
    return `
      <article class="match-card">
        <div class="match-score"><strong>${esc(job.match_score)}%</strong><span>match</span></div>
        <div class="match-card-main">
          <div class="match-company">${esc(job.company || 'Company not specified')}</div>
          <h2><a href="${jobPath(job)}">${esc(job.title || 'Job opportunity')}</a></h2>
          <div class="match-meta">${job.location ? `<span>${esc(job.location)}</span>` : ''}${job.employment_type ? `<span>${esc(job.employment_type.replaceAll('_', ' '))}</span>` : ''}${job.engagement_type ? `<span>${esc(job.engagement_type)}</span>` : ''}</div>
          ${reasons ? `<div class="match-reasons">${reasons}</div>` : ''}
          <div class="match-card-footer">
            <span>Based on ${esc(availableFactors)} matching factor${availableFactors === 1 ? '' : 's'} <strong class="match-confidence">${esc(confidence)}</strong></span>
            <a href="${jobPath(job)}">View job →</a>
          </div>
        </div>
      </article>`;
  }).join('');

  const freeUpgrade = !isPro && !error && totalMatches > 3 ? `
    <section class="pro-unlock-card">
      <div class="pro-unlock-icon" aria-hidden="true">✈</div>
      <div class="pro-unlock-copy">
        <div class="kicker">VEEAYS PRO</div>
        <h2>${lockedMatches > 0 ? `${esc(lockedMatches)} more match${lockedMatches === 1 ? '' : 'es'} waiting for you.` : 'Your full match feed is waiting.'}</h2>
        <p>Stop digging through every listing. Pro unlocks your full personalized feed and helps the strongest opportunities find you.</p>
        <div class="pro-benefits">
          <span>✓ All ranked matches</span><span>✓ Full match explanations</span><span>✓ Strong-match alerts</span><span>✓ Personalized job digest</span>
        </div>
      </div>
      <div class="pro-unlock-action">
        <div class="pro-price"><strong>₱499</strong><span>/ month</span></div>
        <a class="button pro-button" href="/pro">Unlock VeeAys Pro</a>
        <small>Cancel anytime.</small>
      </div>
    </section>` : '';

  const proBadge = isPro ? '<span class="matches-pro-badge">PRO</span>' : '';
  const intro = isPro
    ? `Your full personalized feed, ranked around the preferences you gave us. ${totalMatches ? `${esc(totalMatches)} matches in your current feed.` : ''}`
    : 'We compare your preferences with every eligible role and bring the strongest fits to the top. Your first 3 are free.';

  return `
    <section class="wrap matches-page">
      <div class="matches-heading-row"><div><div class="kicker">MY MATCHES ${proBadge}</div><h1>Your best matches,<br><em>picked for you.</em></h1></div>${!isPro ? '<a class="matches-edit-link" href="/onboarding">Edit preferences</a>' : '<a class="matches-edit-link" href="/onboarding">Edit preferences</a>'}</div>
      <p class="matches-intro">${intro}</p>
      ${error ? `<div class="match-error">${esc(error)}</div>` : ''}
      <div class="matches-list">${cards || (!error ? '<div class="match-empty"><h2>No matches yet</h2><p>Update your job preferences so VeeAys can find better-fit opportunities for you.</p><a class="button" href="/onboarding">Set my preferences</a></div>' : '')}</div>
      ${freeUpgrade}
    </section>`;
}


export function proPage({ isPro = false } = {}) {
  return `
    <section class="wrap pro-page">
      <div class="kicker">VEEAYS PRO</div>
      <h1>Less searching.<br><em>Better matches.</em></h1>
      <p class="pro-page-intro">VeeAys Pro turns your preferences into a personalized job feed, so the strongest remote opportunities rise to the top.</p>
      <div class="pro-pricing-card">
        <div>
          <span class="pro-plan-label">VeeAys Pro</span>
          <div class="pro-page-price"><strong>₱499</strong><span>/ month</span></div>
          <p>Built for Filipino professionals who want to spend less time searching and more time applying to the right roles.</p>
        </div>
        <div class="pro-page-benefits">
          <span>✓ Unlock your full ranked match feed</span>
          <span>✓ See why each opportunity fits you</span>
          <span>✓ Get strong-match alerts</span>
          <span>✓ Receive a personalized job digest</span>
          <span>✓ Advanced match filters as they roll out</span>
        </div>
        <div class="pro-page-action">
          ${isPro ? '<a class="button" href="/matches">View my Pro matches</a><small>Your account already has Pro access.</small>' : '<span class="button pro-coming-soon" aria-disabled="true">Upgrade checkout coming next</span><small>₱499/month · Cancel anytime.</small>'}
        </div>
      </div>
      <p class="pro-free-note"><strong>Jobs stay free to browse.</strong> Pro is the personalized layer that finds and ranks the best opportunities for you.</p>
    </section>`;
}
