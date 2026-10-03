  (() => {
    const list = document.querySelector('.matches-list');
    if (!list) return;
    const cards = [...list.querySelectorAll('[data-match-card]')];
    const scoreToggle = document.getElementById('match-90');
    const salary = document.getElementById('match-salary');
    const schedule = document.getElementById('match-schedule');
    const work = document.getElementById('match-work');
    const sort = document.getElementById('match-sort');
    const clear = document.getElementById('match-clear');
    const count = document.getElementById('visible-match-count');
    let strongOnly = false;
    const normalize = value => String(value || '').toLowerCase().replace(/[_-]+/g, ' ');
    const scheduleMatches = (raw, wanted) => {
      if (wanted === 'all') return true;
      const value = normalize(raw);
      if (!value) return false;
      if (wanted === 'philippines') return value.includes('philipp') || value.includes('ph daytime');
      if (wanted === 'uk') return value.includes('uk') || value.includes('europe') || value.includes('gmt') || value.includes('bst');
      if (wanted === 'australia') return value.includes('austral') || value.includes('aest') || value.includes('aedt') || value.includes('acst') || value.includes('awst');
      if (wanted === 'us') return value.includes('us') || value.includes('est') || value.includes('edt') || value.includes('cst') || value.includes('cdt') || value.includes('mst') || value.includes('mdt') || value.includes('pst') || value.includes('pdt');
      return true;
    };
    const apply = () => {
      const minSalary = Number(salary?.value || 0);
      const wantedSchedule = schedule?.value || 'all';
      const wantedWork = work?.value || 'all';
      let visible = 0;
      cards.forEach(card => {
        const score = Number(card.dataset.score || 0);
        const salaryValue = Number(card.dataset.salary || 0);
        const salaryPeriod = normalize(card.dataset.salaryPeriod);
        const workType = normalize(card.dataset.workType);
        const salaryOk = !minSalary || (salaryPeriod === 'monthly' && salaryValue >= minSalary);
        const scheduleOk = scheduleMatches(card.dataset.schedule, wantedSchedule);
        const workOk = wantedWork === 'all' || (wantedWork === 'full' ? workType.includes('full') : workType.includes('part'));
        const scoreOk = !strongOnly || score >= 90;
        const show = salaryOk && scheduleOk && workOk && scoreOk;
        card.hidden = !show;
        if (show) visible += 1;
      });
      const ordered = [...cards].sort((a,b) => Number(b.dataset.score || 0) - Number(a.dataset.score || 0) || Number(a.dataset.originalOrder) - Number(b.dataset.originalOrder));
      ordered.forEach(card => list.appendChild(card));
      if (count) count.textContent = String(visible);
      let empty = list.querySelector('.pro-filter-empty');
      if (!visible) {
        if (!empty) { empty = document.createElement('div'); empty.className = 'match-empty pro-filter-empty'; empty.innerHTML = '<h2>No matches with those filters</h2><p>Try widening one of the filters above.</p>'; list.appendChild(empty); }
      } else if (empty) empty.remove();
    };
    scoreToggle?.addEventListener('click', () => { strongOnly = !strongOnly; scoreToggle.setAttribute('aria-pressed', String(strongOnly)); scoreToggle.classList.toggle('active', strongOnly); apply(); });
    [salary, schedule, work, sort].forEach(el => el?.addEventListener('change', apply));
    clear?.addEventListener('click', () => { strongOnly = false; scoreToggle?.setAttribute('aria-pressed','false'); scoreToggle?.classList.remove('active'); if (salary) salary.value='all'; if (schedule) schedule.value='all'; if (work) work.value='all'; if (sort) sort.value='strongest'; apply(); });
  })();
