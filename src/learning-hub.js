import {esc} from './render.js';
import {learningCategories as categories, learningGuides as guides} from './learning-guides.js';
export const resourcePaths = ['/resources', ...guides.map(g => '/resources/' + g.slug)];
const path = g => '/resources/' + g.slug;
const minutes = g => Math.max(3, Math.ceil((g.intro + g.sections.map(s=>s.join(' ')).join(' ')).replace(/<[^>]*>/g,' ').split(/\s+/).length / 180));
const category = g => categories.find(c=>c.id===g.category);
const arrow = '<span aria-hidden="true">↗</span>';
const art = `<div class="learn-art" aria-hidden="true"><span class="learn-spark">✦</span><div class="learn-note"><span>YOUR NEXT CHAPTER</span><strong>Small steps.<br>Real progress.</strong><i>One guide at a time.</i><div class="learn-note-line"></div><div class="learn-note-line short"></div></div><div class="learn-book book-one">SHOW UP. KEEP LEARNING. <b>01</b></div><div class="learn-book book-two">A LITTLE MORE READY. <b>02</b></div><span class="learn-art-seal">KAYA<br>MO ’TO.</span></div>`;
const card = (g,i) => `<article class="learn-card"><div class="learn-card-top"><span class="learn-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><span class="learn-time">${minutes(g)} min read</span></div><h3><a href="${path(g)}">${esc(g.title)} ${arrow}</a></h3><p>${esc(g.description)}</p><span class="learn-card-foot">A practical guide + one small action</span></article>`;
const styles = '<link rel="stylesheet" href="/learning-hub.css?v=20261021">';
export function learningPage(pathname) {
  if(pathname === '/resources') return {
    title:'Learning Hub — Free remote work guides for Filipinos',
    description:'Start your remote job search with six free VeeAys guides on career direction, résumés, applications, interviews, and job safety. No signup needed.',
    body:styles + `<section class="learn-hero"><div class="wrap learn-hero-grid"><div><p class="learn-eyebrow">VEEAYS RESOURCES · THE LEARNING HUB</p><h1>Your next chapter<br>starts with <em>one step.</em></h1><p class="learn-hero-copy">New to remote work? May starting point ka na.<br>Practical guides to help you find your direction, prepare with confidence, and search more safely.</p><a class="learn-button" href="${path(guides[0])}">Start with the basics <span aria-hidden="true">↗</span></a><p class="learn-free">6 free guides · No signup needed · At your own pace</p></div>${art}</div></section>
    <div class="wrap learn-main"><div class="learn-welcome"><span class="learn-sun" aria-hidden="true">✦</span><p><strong>A little learning. A little more ready.</strong><br>No shortcuts or job guarantees. Just useful steps you can put into practice.</p><span class="learn-tagline">Better Jobs. From Home.</span></div>
    <nav class="learn-category-nav" aria-label="Guide categories">${categories.map(c=>`<a href="#${c.id}">${esc(c.title)} <span aria-hidden="true">↓</span></a>`).join('')}</nav>
    ${categories.map((c,i)=>`<section class="learn-category" id="${c.id}" aria-labelledby="${c.id}-title"><header class="learn-section-heading"><div><p class="learn-eyebrow">${['FIND YOUR FOOTING','MAKE A GOOD CONNECTION','PAUSE. CHECK. PROTECT.'][i]}</p><h2 id="${c.id}-title">${esc(c.title)}</h2><p>${esc(c.description)}</p></div><span class="learn-count">${guides.filter(g=>g.category===c.id).length} ${i===0?'guides':'guide'}</span></header><div class="learn-grid">${guides.filter(g=>g.category===c.id).map(g=>card(g,guides.indexOf(g))).join('')}</div></section>`).join('')}
    <aside class="learn-next"><div><p class="learn-eyebrow">PUT IT INTO PRACTICE</p><h2>One small step today.</h2><p>Pick a guide, try the exercise, and come back when you’re ready for the next one.</p></div><a class="learn-button" href="/jobs">Explore current jobs ${arrow}</a></aside></div>`
  };
  const guide=guides.find(g=>path(g)===pathname);
  if(!guide) return null;
  const index=guides.indexOf(guide), next=guides.find(g=>g.slug===guide.next);
  return {title:guide.title+' — Learning Hub',description:guide.description,
    body:styles+`<div class="wrap learn-article-page"><nav class="learn-breadcrumb" aria-label="Breadcrumb"><a href="/resources">Learning Hub</a><span aria-hidden="true">/</span><a href="/resources#${guide.category}">${esc(category(guide).title)}</a></nav>
    <header class="learn-article-header"><p class="learn-eyebrow">${esc(category(guide).title)} · GUIDE ${String(index+1).padStart(2,'0')}</p><h1>${esc(guide.title)}</h1><p class="learn-article-intro">${esc(guide.intro)}</p><p class="learn-article-meta">By VeeAys · ${minutes(guide)} min read · Published 21 October 2026 · Free for everyone</p></header>
    <div class="learn-article-layout"><aside class="learn-toc"><nav aria-label="In this guide"><p class="learn-eyebrow">IN THIS GUIDE</p><ol>${guide.sections.map(([heading],i)=>`<li><a href="#step-${i+1}">${esc(heading)}</a></li>`).join('')}</ol><a href="#try-today">Try this today <span aria-hidden="true">↓</span></a></nav><p class="learn-toc-note">Small steps count.<br>Balikan mo anytime.</p></aside>
    <article class="learn-copy"><div class="learn-takeaway"><strong>YOUR TAKEAWAY</strong><p>${esc(guide.takeaway)}</p></div>${guide.sections.map(([heading,html],i)=>`<section id="step-${i+1}"><h2><span aria-hidden="true">${String(i+1).padStart(2,'0')}</span>${esc(heading)}</h2>${html}</section>`).join('')}
    <section class="learn-exercise" id="try-today"><p class="learn-eyebrow">LESS SCROLLING, MORE DOING</p><h2>Try this today <span aria-hidden="true">✦</span></h2><p>${esc(guide.exercise)}</p><p class="learn-exercise-note">Use your own notes. Nothing to submit. No perfect score needed.</p></section>
    ${guide.slug==='honest-beginner-resume'?'<p class="learn-tool-link"><a href="/resume-studio">Open Résumé Studio →</a> · Check every detail before sharing your draft.</p>':''}
    ${guide.category==='job-safety'?'<p class="learn-tool-link">Found a suspicious VeeAys listing? <a href="/contact">Contact VeeAys support →</a></p>':''}
    <nav class="learn-article-footer" aria-label="Continue learning"><a href="/resources">← All guides</a><a href="${path(next)}"><small>READ NEXT</small>${esc(next.title)} →</a></nav></article></div></div>`};
}
