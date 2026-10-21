(() => {
  const header = document.querySelector('.veeays-navigation');
  if (!header) return;
  const disclosures = [...header.querySelectorAll('.nav-disclosure')];
  const close = (item, restoreFocus = false) => {
    item.open = false;
    if (restoreFocus) item.querySelector('summary').focus();
  };
  disclosures.forEach(item => {
    const summary = item.querySelector('summary');
    summary.setAttribute('aria-expanded', String(item.open));
    item.addEventListener('toggle', () => {
      summary.setAttribute('aria-expanded', String(item.open));
      if (item.open) disclosures.filter(other => other !== item && !other.contains(item) && !item.contains(other)).forEach(other => close(other));
    });
  });
  document.addEventListener('click', event => disclosures.forEach(item => {
    if (item.open && !item.contains(event.target)) close(item);
  }));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const item = disclosures.filter(item => item.open && item.contains(event.target)).at(-1) || disclosures.find(item => item.open);
    if (item) { close(item, true); event.preventDefault(); }
  });
  header.addEventListener('focusout', () => setTimeout(() => {
    disclosures.forEach(item => { if (item.open && !item.contains(document.activeElement)) close(item); });
  }, 0));
  const mobile = matchMedia('(max-width: 1150px)');
  mobile.addEventListener('change', () => disclosures.forEach(item => close(item)));
})();
