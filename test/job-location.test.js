import test from 'node:test';
import assert from 'node:assert/strict';
import {jobLocation} from '../src/job-location.js';
import {card, discoveryCard, detail} from '../src/render.js';

const job = {id:123, title:'Assistant', company:'Example', source:'himalayas', location:'Philippines', remote:true, workplace_type:'remote', quick_read_ready:true};

test('known source job geography is eligibility, never employer headquarters', () => {
  for (const source of ['himalayas','ashby','lever','workable','greenhouse']) {
    for (const location of ['Philippines','Remote Philippines','Remote (Philippines)','The Philippines (Remote)']) {
      assert.equal(jobLocation({...job,source,location}).summary,'Remote · Hiring in Philippines');
    }
  }
  assert.equal(jobLocation({...job,company:'US Company',employer_country:'US'}).summary,'Remote · Hiring in Philippines');
});

test('ambiguous, missing, city-specific and multi-country geography is not broadened', () => {
  for (const location of ['Worldwide','Global','Manila, Philippines','Philippines | South Africa','APAC','Philippines excluded']) {
    assert.equal(jobLocation({...job,location}).hiring,`Listed location: ${location}`);
  }
  for (const location of ['',null,'Unknown','Remote','Work from home']) {
    assert.equal(jobLocation({...job,location}).summary,'Remote · Hiring location not specified');
  }
  assert.equal(jobLocation({...job,source:'unknown'}).hiring,'Listed location: Philippines');
  assert.equal(jobLocation({...job,location:'Remote',description:'Our headquarters are in the Philippines.'}).hiring,'Hiring location not specified');
});

test('hybrid and onsite override contradictory legacy remote flags; remote is not presumed', () => {
  for (const [workplace_type,setup] of [['Hybrid','Hybrid'],['on_site','On-site']]) {
    const result=jobLocation({...job,workplace_type});
    assert.equal(result.setup,setup);
    assert.equal(result.hiring,'Listed location: Philippines');
  }
  assert.equal(jobLocation({location:'Philippines',source:'lever'}).summary,'Listed location: Philippines');
});

test('cards and details share evidence-aware labels, preserve sparkles and escape source text', () => {
  for (const render of [card,discoveryCard,j=>discoveryCard(j,{categoryListing:true}),detail]) {
    const before=structuredClone(job), html=render(job);
    assert.match(html,/Hiring in Philippines/);
    assert.match(html,/Remote/);
    assert.match(html,/quick-read/);
    assert.deepEqual(job,before);
    const unsafe=render({...job,location:'<script>alert(1)</script>'});
    assert.doesNotMatch(unsafe,/<script>alert\(1\)<\/script>/);
    assert.match(unsafe,/&lt;script&gt;/);
  }
  assert.match(detail(job),/Employer location has not been verified/);
  assert.doesNotMatch(detail(job),/Employer country: Philippines/);
});
