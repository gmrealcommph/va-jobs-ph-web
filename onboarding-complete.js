(() => {
  const url = new URL(window.location.href);
  if (url.searchParams.get('onboarding') !== 'complete') return;
  url.searchParams.delete('onboarding');
  const next = url.pathname + (url.search ? url.search : '') + url.hash;
  window.history.replaceState({}, '', next || '/');
})();
