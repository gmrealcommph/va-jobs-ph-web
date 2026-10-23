// Shared public-site header. Identity and route state are supplied by layout.
export function siteHeader({ currentPath, navLink, isPro, user, firstName, accountLinks, esc }) {
  const family = path => currentPath === path || currentPath.startsWith(path + '/');
  const dropdown = (id, label, active, links) => '<details class="discovery-menu nav-disclosure"><summary aria-controls="' + id + '" class="nav-label' + (active ? ' is-active' : '') + '"><span>' + label + '</span><span class="nav-chevron" aria-hidden="true"></span></summary><div class="discovery-panel" id="' + id + '">' + links + '</div></details>';
  const discoveryLinks = suffix => dropdown('find-jobs-' + suffix, 'Find Jobs', currentPath === '/' || family('/jobs') || family('/categories'), navLink('/', 'Find a job') + navLink('/categories', 'Categories')) + dropdown('career-tools-' + suffix, 'Career Tools', family('/resume-studio') || family('/niche-finder'), navLink('/resume-studio', 'Résumé Studio') + navLink('/niche-finder', 'Niche Finder · Free')) + navLink('/resources', 'Resources') + navLink('/employers', 'For Employers');
  const crown = '<svg class="nav-crown" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false"><path d="m3 6 5 4 4-6 4 6 5-4-2 12H5L3 6Zm3 15h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const proLabel = crown + (isPro ? 'Your Pro' : 'VeeAys Pro');
  return `<header class="site-header veeays-navigation">
  <div class="wrap header">
    <a class="veeays-brand" href="/" aria-label="VeeAys home"><img class="veeays-logo-img" src="/veeays-logo.png" alt="VeeAys" width="1200" height="400"></a>
    <nav class="discovery-nav" aria-label="Explore">${discoveryLinks('desktop')}${navLink('/pro', proLabel, 'nav-pro')}</nav>
    <div class="header-actions">
      ${user ? `<nav class="workspace-nav" aria-label="Your workspace">${navLink('/matches', 'My Matches')}${navLink('/my-jobs', 'My Jobs')}</nav>
      <details class="member-menu nav-disclosure">
        <summary aria-controls="member-panel"><span class="member-avatar" aria-hidden="true">${esc(firstName.slice(0,1).toUpperCase())}</span><span class="member-name">${esc(firstName)}</span>${isPro ? '<span class="member-pro">PRO</span>' : ''}<span class="nav-chevron" aria-hidden="true"></span></summary>
        <div class="member-panel" id="member-panel"><div class="member-panel-heading"><span>Your VeeAys</span><small>${isPro ? 'Pro member' : 'Free member'}</small></div>${accountLinks}</div>
      </details>` : `${navLink('/login', 'Log in', 'auth-link')}${navLink('/signup', 'Sign up', 'post-job-cta')}`}
    </div>
    <details class="mobile-menu nav-disclosure">
      <summary aria-controls="mobile-panel"><span class="menu-lines" aria-hidden="true"></span><span>Menu</span></summary>
      <div class="mobile-panel" id="mobile-panel"><nav aria-label="Mobile explore"><p class="nav-section-label">Explore</p>${discoveryLinks('mobile')}${navLink('/pro', proLabel, 'nav-pro')}</nav>
      <nav aria-label="Mobile account"><p class="nav-section-label">${user ? 'Your VeeAys' : 'Make your next move'}</p>${user ? `<div class="mobile-member"><span class="member-avatar" aria-hidden="true">${esc(firstName.slice(0,1).toUpperCase())}</span><strong>${esc(firstName)}</strong><span class="${isPro ? 'member-pro' : 'member-free'}">${isPro ? 'PRO' : 'Free member'}</span></div>${navLink('/matches', 'My Matches')}${navLink('/my-jobs', 'My Jobs')}${accountLinks}` : `${navLink('/login', 'Log in')}${navLink('/signup', 'Sign up', 'mobile-signup')}`}</nav></div>
    </details>
  </div>
</header>`;
}
