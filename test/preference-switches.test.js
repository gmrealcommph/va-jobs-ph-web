import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onboardingPage } from '../src/render.js';
import { memberEmailForm } from '../src/lifecycle-page.js';
import { alertForm } from '../src/job-alerts-page.js';

const input = (html, name) => html.match(new RegExp('<input[^>]*name="' + name + '"[^>]*>'))?.[0];
test('Review consent switches remain optional, off by default and retain saved choices', () => {
  assert.doesNotMatch(onboardingPage(), /name="member_tips"/);
  for (const tips of [false, true]) for (const pro of [false, true]) {
    const html = onboardingPage({ memberEmailChoices: { tips, pro } });
    for (const [name, checked] of [['member_tips', tips], ['member_pro', pro]]) {
      const tag = input(html, name);
      assert.match(tag, /type="checkbox" role="switch"/);
      assert.match(tag, /value="yes"/);
      assert.equal(/ checked/.test(tag), checked);
      assert.doesNotMatch(tag, /required|disabled/);
    }
    assert.match(html, /name="member_email_choices" value="v1"/);
    assert.ok(html.includes('Send me getting-started emails and practical career tips during my first two weeks.'));
    assert.ok(html.includes('Send me the optional introduction to VeeAys Pro.'));
    assert.ok(html.includes('These are separate from job digests. Unsubscribe anytime. <a href="/privacy">Privacy policy</a>.'));
    for (const name of ['target_roles', 'employment_types', 'schedule_preferences']) {
      assert.match(input(html, name), /type="checkbox"/);
      assert.doesNotMatch(input(html, name), /role="switch"/);
    }
  }
});
test('account email choices and alert switches retain existing fields, defaults and saved states', () => {
  for (const enabled of [false, true]) {
    const html = memberEmailForm({ tips: enabled, pro: enabled });
    for (const name of ['tips', 'pro']) {
      assert.match(input(html, name), /type="checkbox" role="switch"/);
      assert.equal(/ checked/.test(input(html, name)), enabled);
    }
    const alerts = alertForm({ settings: { enabled, include_unknown_salary: enabled }, categories: ['Support'], types: ['full_time'] });
    for (const name of ['enabled', 'unknown']) {
      assert.match(input(alerts, name), /type="checkbox" role="switch"/);
      assert.equal(/ checked/.test(input(alerts, name)), enabled);
    }
    for (const name of ['categories', 'types']) assert.doesNotMatch(input(alerts, name), /role="switch"/);
  }
  assert.doesNotMatch(input(memberEmailForm(), 'tips'), / checked/);
  assert.doesNotMatch(input(memberEmailForm(), 'pro'), / checked/);
  assert.doesNotMatch(input(alertForm(), 'enabled'), / checked/);
  assert.match(input(alertForm(), 'unknown'), / checked/);
});
