const forms=[...document.querySelectorAll('.learn-search')],cards=[...document.querySelectorAll('[data-resource-card]')];
const status=document.querySelector('#resource-results'),empty=document.querySelector('#resource-empty');
const fold=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const allowed=[...document.querySelector('#resource-category').options].map(o=>o.value);
function apply(query='',category='',update=true){
 query=query.slice(0,120);if(!allowed.includes(category))category='';const terms=fold(query).split(' ').filter(Boolean);let count=0;
 for(const card of cards){card.hidden=Boolean(category&&card.dataset.category!==category)||!terms.every(t=>card.dataset.search.includes(t));if(!card.hidden)count++;}
 for(const form of forms){form.elements.q.value=query;if(form.elements.category)form.elements.category.value=category;}
 status.textContent=count+' '+(count===1?'guide':'guides')+(query||category?' found':' to explore');empty.hidden=count>0;
 if(update){const url=new URL(location.href);url.search='';if(query.trim())url.searchParams.set('q',query.trim());if(category)url.searchParams.set('category',category);url.hash='browse';history.pushState(null,'',url);}
}
for(const form of forms){form.addEventListener('submit',e=>{e.preventDefault();apply(form.elements.q.value,form.elements.category?.value||'');document.querySelector('#browse').scrollIntoView({block:'start'});});form.elements.category?.addEventListener('change',()=>apply(form.elements.q.value,form.elements.category.value));}
for(const link of document.querySelectorAll('[data-topic-query],[data-topic-category]'))link.addEventListener('click',e=>{if(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();apply(link.dataset.topicQuery||'',link.dataset.topicCategory||'');document.querySelector('#browse').scrollIntoView({block:'start'});document.querySelector('#resource-browse-query').focus({preventScroll:true});});
for(const reset of document.querySelectorAll('#resource-reset,[data-reset-resources]'))reset.addEventListener('click',e=>{if(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();apply();document.querySelector('#resource-browse-query').focus();});
addEventListener('popstate',()=>{const p=new URLSearchParams(location.search);apply(p.get('q')||'',p.get('category')||'',false);});
