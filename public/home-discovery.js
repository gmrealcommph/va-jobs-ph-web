// Progressive enhancement only: the actual server count is already displayed.
(() => {
  const counter = document.querySelector('.home-page [data-live-opportunity-count]');
  if (!counter) return;
  const total = Number(counter.dataset.liveOpportunityCount);
  if (!Number.isSafeInteger(total) || total < 0) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = null, observer;
  const finish = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    observer?.disconnect();
    counter.textContent = total.toLocaleString('en-US');
  };
  if (reduced.matches || total < 10 || !('IntersectionObserver' in window)) { finish(); return; }
  const animate = () => {
    observer.disconnect();
    if (reduced.matches || document.hidden) { finish(); return; }
    const start = total - Math.min(24, Math.ceil(total * .015));
    counter.textContent = start.toLocaleString('en-US');
    const began = performance.now();
    const tick = now => {
      if (reduced.matches || document.hidden) { finish(); return; }
      const progress = Math.min(1, (now - began) / 480);
      const value = Math.round(start + (total - start) * (1 - (1 - progress) ** 3));
      counter.textContent = value.toLocaleString('en-US');
      if (progress < 1) frame = requestAnimationFrame(tick);
      else finish();
    };
    frame = requestAnimationFrame(tick);
  };
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) animate();
  }, {threshold: .25});
  observer.observe(counter);
  reduced.addEventListener('change', () => { if (reduced.matches) finish(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  window.addEventListener('pagehide', finish);
})();
