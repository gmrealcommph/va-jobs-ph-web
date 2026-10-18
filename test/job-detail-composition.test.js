import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detail} from '../src/render.js';
import {renderJobRead,renderAtAGlance} from '../src/job-detail-read.js';
import {formatQuickRead} from '../src/quick-read.js';
import {presentQuickRead} from '../src/quick-read-presentation.js';

const description='About the role\nManage client operations and coordinate delivery.\nResponsibilities\nCoordinate stakeholders and budgets.\nRequirements\nThree years of experience required.';
const job={id:42,title:'Executive Assistant',company:'D2B',description,location:'Philippines',workplace_type:'remote',employment_type:'full_time',experience_level:'senior',engagement_type:'contractor'};

test('hero and compact facts stay in the reading column before the separate employer listing',()=>{
  const before=structuredClone(job),html=detail(job);
  assert.deepEqual(job,before);
  assert.ok(html.indexOf('job-detail-content')<html.indexOf('job-detail-hero'));
  assert.ok(html.indexOf('job-detail-chips')<html.indexOf('employer-listing'));
  assert.doesNotMatch(html,/class="qr-glance"/);
  assert.match(html,/Better Jobs\. From Home\./);
  for(const text of ['Listed location: Philippines','Remote','Full-time','Senior','contractor','Employer location has not been verified']) assert.ok(html.includes(text));
  const missing=renderAtAGlance({}, {compact:true});
  assert.doesNotMatch(missing,/Full-time|Senior|contractor/);
});

test('Quick Read values are unchanged and source remains separately visible with keyboard disclosure',()=>{
  const quick=formatQuickRead(description),before=structuredClone(quick);
  const view=presentQuickRead(quick,description,job),html=renderJobRead(description,undefined,job);
  assert.deepEqual(quick,before);
  for(const values of Object.values(view)) if(Array.isArray(values)) for(const value of values) assert.ok(html.includes(value));
  assert.ok(html.indexOf('quick-read-title')<html.indexOf('employer-listing-title'));
  assert.match(html,/<details class="qr-source" open><summary>Original description · View source<\/summary>/);
  assert.equal((html.match(/class="qr-original"/g)||[]).length,1);
  const unavailable=renderJobRead(description,null,job);
  assert.doesNotMatch(unavailable,/quick-read-title|Quick Read above/);
  assert.match(unavailable,/employer-listing-title/);
});

