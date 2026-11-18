import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {STEPS, dueLifecycleEmail} from './schedule.mjs';

const DAY = 86_400_000;
const createdAt = '2026-11-17T00:00:00Z';
const start = Date.parse(createdAt);
const member = {
  createdAt, confirmedAt: createdAt, plan: 'free', suppressed: false, banned: false,
  unsubscribeToken: 'test-token', legacyWelcomeState: 'clear', completed: [],
  consent: {tips: {enabled: true, at: createdAt}, pro: {enabled: true, at: createdAt}}
};
const due = (days, overrides = {}, enrollment = createdAt) =>
  dueLifecycleEmail({...member, ...overrides}, start + days * DAY, enrollment);

test('only the ten requested registration ages are eligible, with exact 24-hour windows', () => {
  const expected = [0, 2, 3, 5, 7, 10, 14, 19, 24, 30];
  assert.deepEqual(STEPS.map(step => step.day), expected);
  for (let day = -1; day <= 60; day++) {
    assert.equal(Boolean(due(day)), expected.includes(day), 'day ' + day);
    assert.equal(Boolean(due(day + 0.99999)), expected.includes(day), 'end of day ' + day);
  }
  assert.equal(due(5, {}, '2026-11-18T00:00:00Z'), null);
});

test('requires confirmed, eligible, unsuppressed members with timely consent', () => {
  for (const patch of [
    {suppressed: true}, {suppressed: undefined}, {banned: true},
    {confirmedAt: null}, {confirmedAt: '2026-12-01T00:00:00Z'},
    {unsubscribeToken: ''}, {plan: 'unknown'}, {consent: {}},
    {consent: {tips: {enabled: false, at: createdAt}}},
    {consent: {tips: {enabled: true, at: '2026-11-20T12:00:00Z'}}}
  ]) assert.equal(due(3.75, patch), null);
});

test('keeps stable delivery keys through tier changes and blocks legacy duplicate welcome', () => {
  assert.equal(due(2).step, 'getting-started');
  assert.equal(due(2, {completed: ['getting-started'], plan: 'pro'}), null);
  assert.equal(due(0, {legacyWelcomeState: 'accepted'}), null);
  assert.equal(due(0, {legacyWelcomeState: 'pending'}), null);
  assert.equal(due(0, {legacyWelcomeState: undefined}), null);
  assert.equal(due(7).variant, 'free');
  assert.equal(due(7, {plan: 'pro'}).variant, 'pro');
  assert.equal(due(7, {consent: {tips: member.consent.tips}}).variant, 'pro');
});

test('all HTML and text variants have the approved responsive header and unsubscribe slot', async () => {
  const aliases = new Set();
  for (const step of STEPS) {
    for (const [variant, template] of Object.entries(step.variants)) {
      assert.ok(!aliases.has(template.alias));
      aliases.add(template.alias);
      assert.match(template.resendDraftId, /^[a-f0-9-]{36}$/);
      const read = extension => readFile(new URL(step.stem + '.' + variant + '.' + extension, import.meta.url), 'utf8');
      const [html, text] = await Promise.all([read('html'), read('txt')]);
      assert.match(html, /bgcolor="#ffffff" class="pad" style="background-color:#ffffff;padding:16px 28px/);
      assert.match(html, /src="https:\/\/veeays\.com\/veeays-logo\.png" width="160"/);
      assert.match(html, /max-width:480px[^]*?\.logo\{width:155px!important}/);
      for (const body of [html, text]) {
        assert.equal(body.includes('https://veeays.com/pro'), variant === 'free');
        assert.equal(body.split('{{{UNSUBSCRIBE_URL}}}').length, 2);
        assert.doesNotMatch(body, /DESIGN TEST|MOBILE FORMAT TEST/);
      }
    }
  }
  assert.equal(aliases.size, 20);
});
