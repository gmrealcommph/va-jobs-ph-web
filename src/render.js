export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const jobPath = job => `/jobs/${encodeURIComponent(job.id)}`;
export const categoryPath = name => `/categories/${encodeURIComponent(name)}`;
export function safeUrl(value) { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; } }
export function date(value) { const d = new Date(value); return value && !Number.isNaN(+d) ? d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }) : ''; }

export function layout({ title, description, canonical, body, noindex = false }) {
  return `<!doctype html><html lang="en-PH"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | VeeAys</title><meta name="description" content="${esc(description)}"><meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow'}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:site_name" content="VeeAys"><meta name="theme-color" content="#123e30"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css"></head><body><a class="skip" href="#main">Skip to content</a><header class="site-header"><div class="wrap header">

<a class="veeays-brand" href="/" aria-label="VeeAys home">
  <img
    class="veeays-logo-img"
    src="/veeays-logo.png"
    alt="VeeAys"
    width="1200"
    height="400"
  >
</a>

<nav aria-label="Main navigation">
  <a href="/">Find a job</a>
  <a href="/categories">Categories</a>
  <a href="/employers">For Employers</a>
</nav>

<div class="header-actions">
  <span class="header-note">Filipino talent. Global possibilities.</span>
  <a class="post-job-cta" href="/employers">Post a job <span aria-hidden="true">↗</span></a>
</div>

</div></header><main id="main">${body}</main><footer><div class="wrap footer"><a class="brand" href="/">VeeAys</a><p>Opportunities for Filipino talent. A new way forward.</p><p class="fine">Listings link to external sources. Confirm details with the employer and never pay to apply.</p></div></footer></body></html>`;
}

export function card(job) {
  const location = job.location || (job.remote ? 'Remote' : 'Location not specified');
  const remoteLabel = job.workplace_type || (job.remote ? 'Remote' : '');

  return `<article class="job-card"><div class="company-icon" aria-hidden="true">${esc((job.company || 'J').slice(0, 1))}</div><div class="job-content"><div class="eyebrow">${esc(job.company || 'Company not specified')}</div><h2><a href="${jobPath(job)}">${esc(job.title || 'Job opportunity')}</a></h2><div class="job-meta"><span class="meta-location"><i aria-hidden="true">⌖</i>${esc(location)}</span>${remoteLabel ? `<span class="meta-remote"><i aria-hidden="true">⌁</i>${esc(remoteLabel)}</span>` : ''}</div>${job.category ? `<a class="tag" href="${categoryPath(job.category)}">${esc(job.category)}</a>` : ''}</div><div class="card-end">${date(job.posted_at) ? `<span>Posted ${date(job.posted_at)}</span>` : ''}<a class="arrow" href="${jobPath(job)}" aria-label="View ${esc(job.title)}">↗</a></div></article>`;
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

              <p>
                Your next chapter can start right here. Discover global and
                remote roles open to Filipino talent, from virtual assistance
                to whatever’s next.
              </p>

              <a class="home-jump" href="#opportunities">
                Find your next opportunity
                <span aria-hidden="true">↓</span>
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

          <p>
            Newest listings first${page > 1 ? ` · Page ${page}` : ''}
          </p>
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
          ? rows.map(card).join('')
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
      : `<section class="home-outro wrap">

          <span aria-hidden="true">✳</span>

          <div>
            <h2>Your next chapter looks good on you.</h2>

            <p>
              We connect Filipino talent with global opportunities.
              Looking for legitimate work? Check employer details,
              use the original listing, and never pay to apply.
            </p>
          </div>

          <a href="/categories">
            Find your direction ↗
          </a>

        </section>
      </div>`
  }`;
}

export function detail(job) {
  const apply = safeUrl(job.job_url);

  return `<div class="wrap detail"><a class="back" href="${job.category ? categoryPath(job.category) : '/'}">← Back to opportunities</a><div class="detail-grid"><article><div class="eyebrow">${esc(job.company || 'Company not specified')}</div><h1>${esc(job.title || 'Job opportunity')}</h1><div class="job-meta"><span>${esc(job.location || 'Location not specified')}</span>${job.remote && !/remote/i.test((job.location || '') + ' ' + (job.workplace_type || '')) ? '<span>Remote</span>' : ''}${job.workplace_type ? `<span>${esc(job.workplace_type)}</span>` : ''}</div>${job.category ? `<a class="tag" href="${categoryPath(job.category)}">${esc(job.category)}</a>` : ''}<hr><h2>About this opportunity</h2><div class="description">${esc(job.description || 'Visit the original listing for the full job description.')}</div></article><aside class="apply-panel"><div class="eyebrow">TAKE THE NEXT STEP</div><h2>Sound like your kind of work?</h2><p>Read the original listing and apply directly through the source.</p>${apply ? `<a class="button" href="${esc(apply)}" target="_blank" rel="noopener noreferrer nofollow">View original & apply ↗</a><p class="fine">Opens an external website in a new tab.</p>` : '<p>The application link is currently unavailable.</p>'}<dl>${job.source ? `<dt>Source</dt><dd>${esc(job.source)}</dd>` : ''}${date(job.posted_at) ? `<dt>Posted</dt><dd>${date(job.posted_at)}</dd>` : ''}${date(job.collected_at) ? `<dt>Added to VeeAys</dt><dd>${date(job.collected_at)}</dd>` : ''}</dl></aside></div></div>`;
}
