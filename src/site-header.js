// Shared public-site header. Identity and route state are supplied by layout.
export function siteHeader({ discoveryLinks, navLink, isPro, user, firstName, accountLinks, esc }) {
  const crown = '<svg class="nav-crown" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false"><path d="m3 6 5 4 4-6 4 6 5-4-2 12H5L3 6Zm3 15h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const proLabel = crown + (isPro ? 'Your Pro' : 'VeeAys Pro');
  return `<header class="site-header veeays-navigation">
  <div class="wrap header">
    <a class="veeays-brand" href="/" aria-label="VeeAys home"><img class="veeays-logo-img" src="/veeays-logo.png" alt="VeeAys" width="1200" height="400"></a>
    <nav class="discovery-nav" aria-label="Explore">${discoveryLinks}${navLink('/pro', proLabel, 'nav-pro')}</nav>
    <div class="header-actions">
      ${user ? `<nav class="workspace-nav" aria-label="Your workspace">${navLink('/matches', 'My matches')}${navLink('/my-jobs', 'My jobs')}</nav>
      <details class="member-menu nav-disclosure">
        <summary aria-controls="member-panel"><span class="member-avatar" aria-hidden="true">${esc(firstName.slice(0,1).toUpperCase())}</span><span class="member-name">${esc(firstName)}</span>${isPro ? '<span class="member-pro">PRO</span>' : ''}<span class="nav-chevron" aria-hidden="true"></span></summary>
        <div class="member-panel" id="member-panel"><div class="member-panel-heading"><span>Your VeeAys</span><small>${isPro ? 'Pro member' : 'Free member'}</small></div>${accountLinks}</div>
      </details>` : `${navLink('/login', 'Log in', 'auth-link')}${navLink('/signup', 'Sign up', 'post-job-cta')}`}
    </div>
    ${navLink('/pro', proLabel, 'mobile-pro-link nav-pro')}
    <details class="mobile-menu nav-disclosure">
      <summary aria-controls="mobile-panel"><span class="menu-lines" aria-hidden="true"></span><span>Menu</span></summary>
      <div class="mobile-panel" id="mobile-panel"><nav aria-label="Mobile explore"><p class="nav-section-label">Explore</p>${discoveryLinks}${navLink('/pro', proLabel, 'nav-pro')}</nav>
      <nav aria-label="Mobile account"><p class="nav-section-label">${user ? 'Your VeeAys' : 'Make your next move'}</p>${user ? `<div class="mobile-member"><span class="member-avatar" aria-hidden="true">${esc(firstName.slice(0,1).toUpperCase())}</span><strong>${esc(firstName)}</strong><span class="${isPro ? 'member-pro' : 'member-free'}">${isPro ? 'PRO' : 'Free member'}</span></div>${navLink('/matches', 'My matches')}${navLink('/my-jobs', 'My jobs')}${accountLinks}` : `${navLink('/login', 'Log in')}${navLink('/signup', 'Sign up', 'mobile-signup')}`}</nav></div>
    </details>
  </div>
</header>`;
}
