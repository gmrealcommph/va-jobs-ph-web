export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const jobPath = job => `/jobs/${encodeURIComponent(job.id)}`;
export const categoryPath = name => `/categories/${encodeURIComponent(name)}`;
export function safeUrl(value) { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; } }
export function date(value) { const d = new Date(value); return value && !Number.isNaN(+d) ? d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }) : ''; }

export function layout({ title, description, canonical, body, noindex = false }) {
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

  <link rel="stylesheet" href="/styles.css?v=6">
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

      <span class="header-note">
        Filipino talent. Global possibilities.
      </span>

      <a
        class="post-job-cta"
        href="/employers"
      >
        Post a job
        <span aria-hidden="true">↗</span>
      </a>

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

export function listing({ rows, total, page, search, category, names }) {
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

  const lines = String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  let html = '';
  let paragraph = [];
  let inList = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;

    html += `<p>${paragraph.map(esc).join(' ')}</p>`;
    paragraph = [];
  };

  const closeList = () => {
    if (!inList) return;

    html += '</ul>';
    inList = false;
  };

  const isHeading = (line) => {
    const clean = line.trim();

    if (!clean) return false;
    if (clean.length > 90) return false;

    /*
      Typical imported job-description headings:
      WHAT YOU'LL DO
      REQUIREMENTS:
      About You
      Who You Are
      AS A CSM YOU WILL BE:
    */
    const letters = clean.replace(/[^A-Za-z]/g, '');

    const uppercase =
      letters.length >= 4 &&
      letters === letters.toUpperCase();

    const headingPhrase =
      /^(about|what|who|why|your|you'll|you will|requirements?|qualifications?|responsibilities|responsibilities include|skills|experience|benefits|nice to have|preferred|the role|the opportunity|what we offer|what you'll do|what you will do|who you are|about you)\b/i.test(
        clean
      );

    return uppercase || headingPhrase;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    const bulletMatch = line.match(
      /^(?:[-–—•*▪◦]|\d+[.)])\s*(.+)$/
    );

    if (bulletMatch) {
      flushParagraph();

      if (!inList) {
        html += '<ul>';
        inList = true;
      }

      html += `<li>${esc(bulletMatch[1])}</li>`;
      continue;
    }

    if (isHeading(line)) {
      flushParagraph();
      closeList();

      const heading = line.replace(/:\s*$/, '');

      html += `<h3>${esc(heading)}</h3>`;
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

  return `
    <div class="job-detail-page">

      <section class="job-detail-hero">

        <div class="wrap">

          <a
            class="job-detail-back"
            href="${job.category ? categoryPath(job.category) : '/'}"
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
                ? `<div class="job-detail-logo-wrap">
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
                    href="${esc(apply)}"
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    <span>Apply for this role</span>
                    <b>↗</b>
                  </a>

                  <p class="job-detail-external">
                    Opens the employer's original listing
                    in a new tab.
                  </p>`
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
