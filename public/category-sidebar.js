// Let a tall sidebar scroll naturally before holding its bottom in view.
// The listings container bounds sticky positioning above the footer.
(() => {
  const sidebar = document.querySelector('.category-discovery');
  if (!sidebar) return;
  const update = () => {
    const top = Math.min(22, window.innerHeight - sidebar.offsetHeight - 22);
    sidebar.style.setProperty('--category-stick-top', `${top}px`);
  };
  new ResizeObserver(update).observe(sidebar);
  window.addEventListener('resize', update, { passive: true });
  update();
})();
