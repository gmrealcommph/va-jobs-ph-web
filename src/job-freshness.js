// Dates here are the public view's original date when known, otherwise source date.
export function freshnessNotice(job, now=Date.now()) {
 const stamp=Date.parse(job.posted_at);
 if(!Number.isFinite(stamp))return '';
 const age=Math.floor((Number(now)-stamp)/86400000);
 return age>=31&&age<=45?'<p class="job-freshness">Older listing · Confirm availability before applying.</p>':'';
}
