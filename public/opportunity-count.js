// Display-only enhancement. The server renders the real count without JavaScript.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-live-opportunity-count]').forEach(counter => {
    const total = Number(counter.dataset.liveOpportunityCount);
    if (!Number.isSafeInteger(total) || total < 0) return;
    const values = String(total).split('');
    let stopped = false;
    const timers = new Set();
    const later = (fn, delay) => {
      const timer = setTimeout(() => { timers.delete(timer); fn(); }, delay);
      timers.add(timer);
    };
    const half = (value, position, flap = '') => {
      const element = document.createElement('span');
      element.className = `count-half count-${position}${flap ? ' ' + flap : ''}`;
      const digit = document.createElement('span');
      digit.className = 'count-numeral';
      digit.textContent = value;
      element.append(digit);
      return element;
    };
    const settle = (tile, value) => {
      tile.replaceChildren(half(value, 'top'), half(value, 'bottom'));
      for (const side of ['left', 'right']) {
        const hinge = document.createElement('span');
        hinge.className = `count-hinge count-hinge-${side}`;
        tile.append(hinge);
      }
      tile.dataset.value = value;
    };
    const tiles = values.map(value => {
      const tile = document.createElement('span');
      tile.className = 'count-digit';
      settle(tile, value);
      return tile;
    });
    counter.replaceChildren(...tiles);
    counter.classList.add('is-flip-count');
    const finish = () => {
      stopped = true;
      timers.forEach(clearTimeout);
      timers.clear();
      tiles.forEach((tile, i) => settle(tile, values[i]));
    };
    const flip = (tile, value, done) => {
      if (stopped) return;
      const old = tile.dataset.value;
      settle(tile, value);
      tile.querySelector('.count-bottom .count-numeral').textContent = old;
      tile.append(half(old, 'top', 'count-flap-top'), half(value, 'bottom', 'count-flap-bottom'));
      later(() => { settle(tile, value); done(); }, 310);
    };
    if (reduced.matches || document.hidden || total === 0) { finish(); return; }
    tiles.forEach(tile => settle(tile, '0'));
    tiles.forEach((tile, i) => {
      const sequence = ['3', '7', values[i]];
      const next = () => {
        if (stopped || !sequence.length) return;
        flip(tile, sequence.shift(), next);
      };
      later(next, 250 + i * 95);
    });
    reduced.addEventListener('change', () => { if (reduced.matches) finish(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
    window.addEventListener('pagehide', finish, { once: true });
  });
})();
