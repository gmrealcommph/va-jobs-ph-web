import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { listing } from '../src/render.js';
const source = fs.readFileSync(new URL('../public/opportunity-count.js', import.meta.url), 'utf8');

function run(total, { reduced = false, hidden = false } = {}) {
  class Element {
    constructor() { this.children = []; this.dataset = {}; this.className = ''; this.textContent = ''; this.classList = { add() {} }; }
    append(...items) { this.children.push(...items); }
    replaceChildren(...items) { this.children = items; }
    querySelector() { return this.children.find(item => item.className.includes('count-bottom')).children[0]; }
  }
  const counter = new Element(); counter.dataset.liveOpportunityCount = String(total);
  const events = {}, pending = new Map(); let id = 0;
  const media = { matches: reduced, addEventListener: (_, fn) => { events.motion = fn; } };
  const document = { hidden, createElement: () => new Element(), querySelectorAll: () => [counter], addEventListener: (_, fn) => { events.hidden = fn; } };
  vm.runInNewContext(source, {
    document, matchMedia: () => media,
    window: { addEventListener: (_, fn) => { events.pagehide = fn; } },
    setTimeout: (fn, delay) => { pending.set(++id, { fn, delay }); return id; },
    clearTimeout: timer => pending.delete(timer)
  });
  const drain = () => { while (pending.size) { const [key, value] = pending.entries().next().value; pending.delete(key); value.fn(); } };
  const digits = () => counter.children.map(tile => tile.dataset.value).join('');
  return { counter, media, document, events, pending, drain, digits };
}

test('server fallback retains real comma-free count and accessible label; enhancement only loads beside the count', () => {
  const options = { rows: [], total: 1995, page: 1, search: '', category: '', names: [] };
  for (const browseOnly of [false, true]) {
    const html = listing({ ...options, browseOnly });
    assert.match(html, /aria-label="1,995 opportunities"/);
    assert.match(html, /data-live-opportunity-count="1995" aria-hidden="true">1995<\/strong>/);
    assert.match(html, /opportunity-count\.js/);
  }
  assert.doesNotMatch(listing({ ...options, search: 'Excel' }), /opportunity-count\.js/);
});

test('load animation settles to the supplied count across different digit lengths, without separators', () => {
  for (const total of [1, 42, 1995, 120034]) {
    const app = run(total); assert.equal(app.digits(), '0'.repeat(String(total).length));
    app.drain(); assert.equal(app.digits(), String(total)); assert.equal(app.pending.size, 0);
  }
});

test('zero, reduced motion and background loads display the real count immediately', () => {
  for (const [total, options] of [[0, {}], [1995, { reduced: true }], [42, { hidden: true }]]) {
    const app = run(total, options); assert.equal(app.digits(), String(total)); assert.equal(app.pending.size, 0);
  }
});

test('motion preference change or page exit cancels pending flips and restores final count', () => {
  for (const event of ['motion', 'hidden', 'pagehide']) {
    const app = run(1995); app.media.matches = true; app.document.hidden = true;
    app.events[event](); assert.equal(app.pending.size, 0); assert.equal(app.digits(), '1995');
  }
});

test('invalid supplied values leave server fallback untouched', () => {
  for (const total of [-1, 'invalid', 1.5]) assert.equal(run(total).counter.children.length, 0);
});
