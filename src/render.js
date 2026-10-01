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

  <link
    rel="stylesheet"
    href="/styles.css"
  >
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


    <div class="footer-note">

      <span
        class="footer-note-star"
        aria-hidden="true"
      >
        ✦
      </span>

      <p>
        Work without<br>
        borders.
      </p>

      <span
        class="footer-note-arrow"
        aria-hidden="true"
      >
        ↘
      </span>

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


    <div class="footer-safety">

      <span aria-hidden="true">✳</span>

      <strong>
        Never pay to apply.
      </strong>

      <span>
        Legitimate employers won't charge you for a job application.
      </span>

    </div>

  </div>

</footer>

</body>
</html>`;
}

export function detail(job) {
  const apply = safeUrl(job.job_url);

  return `<div class="wrap detail"><a class="back" href="${job.category ? categoryPath(job.category) : '/'}">← Back to opportunities</a><div class="detail-grid"><article><div class="eyebrow">${esc(job.company || 'Company not specified')}</div><h1>${esc(job.title || 'Job opportunity')}</h1><div class="job-meta"><span>${esc(job.location || 'Location not specified')}</span>${job.remote && !/remote/i.test((job.location || '') + ' ' + (job.workplace_type || '')) ? '<span>Remote</span>' : ''}${job.workplace_type ? `<span>${esc(job.workplace_type)}</span>` : ''}</div>${job.category ? `<a class="tag" href="${categoryPath(job.category)}">${esc(job.category)}</a>` : ''}<hr><h2>About this opportunity</h2><div class="description">${esc(job.description || 'Visit the original listing for the full job description.')}</div></article><aside class="apply-panel"><div class="eyebrow">TAKE THE NEXT STEP</div><h2>Sound like your kind of work?</h2><p>Read the original listing and apply directly through the source.</p>${apply ? `<a class="button" href="${esc(apply)}" target="_blank" rel="noopener noreferrer nofollow">View original & apply ↗</a><p class="fine">Opens an external website in a new tab.</p>` : '<p>The application link is currently unavailable.</p>'}<dl>${job.source ? `<dt>Source</dt><dd>${esc(job.source)}</dd>` : ''}${date(job.posted_at) ? `<dt>Posted</dt><dd>${date(job.posted_at)}</dd>` : ''}${date(job.collected_at) ? `<dt>Added to VeeAys</dt><dd>${date(job.collected_at)}</dd>` : ''}</dl></aside></div></div>`;
}
