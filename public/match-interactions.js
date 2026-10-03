// Shared tooltip surfaces: only two panels, even when the feed contains 100 jobs.
(() => {
  const buttons = [...document.querySelectorAll('[data-match-info]')];
  if (!buttons.length) return;
  let activeButton = null, panel = null, pinned = false, closeTimer;
  const close = () => {
    clearTimeout(closeTimer);
    if (activeButton) activeButton.setAttribute('aria-expanded', 'false');
    if (panel) {
      if (panel.matches(':popover-open')) panel.hidePopover();
      panel.hidden = true;
    }
    activeButton = panel = null;
    pinned = false;
  };
  const position = () => {
    if (!activeButton || !panel) return;
    if (!activeButton.getClientRects().length) { close(); return; }
    const viewport = window.visualViewport;
    panel.style.width = `${Math.min(340, (viewport?.width || innerWidth) - 24)}px`;
    panel.style.maxHeight = `${(viewport?.height || innerHeight) - 24}px`;
    const trigger = activeButton.getBoundingClientRect(), box = panel.getBoundingClientRect();
    const leftEdge = (viewport?.offsetLeft || 0) + 12;
    const topEdge = (viewport?.offsetTop || 0) + 12;
    const rightEdge = leftEdge + (viewport?.width || innerWidth) - 24;
    const bottomEdge = topEdge + (viewport?.height || innerHeight) - 24;
    const left = Math.max(leftEdge, Math.min(trigger.left, rightEdge - box.width));
    const below = trigger.bottom + 8;
    const top = Math.max(topEdge, Math.min(below + box.height <= bottomEdge ? below : trigger.top - box.height - 8, bottomEdge - box.height));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  };
  const open = (button, pin = false) => {
    clearTimeout(closeTimer);
    if (activeButton !== button) close();
    activeButton = button;
    pinned = pin || pinned;
    panel = document.getElementById(button.getAttribute('aria-describedby'));
    panel.hidden = false;
    if (typeof panel.showPopover === 'function' && !panel.matches(':popover-open')) panel.showPopover();
    button.setAttribute('aria-expanded', 'true');
    position();
  };
  const deferClose = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!pinned && document.activeElement !== activeButton && !panel?.matches(':hover')) close();
    }, 140);
  };
  for (const button of buttons) {
    button.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') open(button); });
    button.addEventListener('pointerleave', deferClose);
    button.addEventListener('focus', () => open(button));
    button.addEventListener('blur', deferClose);
    button.addEventListener('click', event => {
      event.preventDefault();
      if (activeButton === button && pinned) close();
      else open(button, true);
    });
  }
  for (const tooltip of document.querySelectorAll('.match-tooltip')) {
    tooltip.addEventListener('pointerenter', () => clearTimeout(closeTimer));
    tooltip.addEventListener('pointerleave', deferClose);
  }
  document.addEventListener('pointerdown', event => {
    if (activeButton && !activeButton.contains(event.target) && !panel.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && activeButton) { close(); event.preventDefault(); } });
  document.addEventListener('change', close);
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, {passive: true});
  window.visualViewport?.addEventListener('resize', position);
  window.visualViewport?.addEventListener('scroll', position);
})();
