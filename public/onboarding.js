(() => {
  const form = document.getElementById('onboarding-form');
  if (!form) return;
  const steps = [...form.querySelectorAll('.onboard-step')];
  const dots = [...document.querySelectorAll('.onboard-progress li')];
  const back = document.getElementById('onboard-back');
  const next = document.getElementById('onboard-next');
  const finish = document.getElementById('onboard-finish');
  const salary = document.getElementById('minimum_salary_usd');
  const php = document.getElementById('salary-php');
  let step = 0;

  function checked(name) { return [...form.querySelectorAll(`input[name="${name}"]:checked`)]; }
  function validate() {
    let ok = true;
    if (step === 0) ok = checked('target_roles').length > 0;
    if (step === 1) ok = checked('employment_types').length > 0;
    if (step === 2) ok = checked('schedule_preferences').length > 0;
    if (step === 3) ok = checked('experience_level').length > 0;
    const current = steps[step];
    let message = current.querySelector('.onboard-validation');
    if (!ok) {
      if (!message) { message = document.createElement('p'); message.className = 'onboard-validation'; message.setAttribute('role', 'alert'); current.appendChild(message); }
      message.textContent = 'Choose at least one option to continue.';
    } else if (message) message.remove();
    return ok;
  }
  function review() {
    const groups = [
      ['Roles', checked('target_roles').map(x => x.value).join(', ')],
      ['Minimum salary', salary.value ? `$${Number(salary.value).toLocaleString()} / month · approx. ₱${Math.round(Number(salary.value) * 58).toLocaleString()} / month` : 'No minimum set'],
      ['Employment', checked('employment_types').map(x => x.value).join(', ')],
      ['Schedule', checked('schedule_preferences').map(x => x.value).join(', ')],
      ['Experience', checked('experience_level')[0]?.value || ''],
      ['Skills', document.getElementById('skills').value.trim() || 'None added']
    ];
    document.getElementById('onboard-review').innerHTML = groups.map(([a,b]) => `<div><span>${a}</span><strong>${escapeHtml(b)}</strong></div>`).join('');
  }
  function escapeHtml(v) { const d=document.createElement('div'); d.textContent=v; return d.innerHTML; }
  function show(focus = false) {
    steps.forEach((el,i) => { el.classList.toggle('active', i === step); el.hidden = i !== step; });
    dots.forEach((el,i) => {
      el.classList.toggle('active', i === step); el.classList.toggle('done', i < step);
      if (i === step) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
      el.querySelector('.onboard-progress-number').textContent = i < step ? '✓' : i + 1;
      el.querySelector('.onboard-progress-state').textContent = i < step ? ': completed' : i === step ? ': current step' : ': upcoming';
    });
    const isFirst = step === 0;
    const isLast = step === steps.length - 1;
    back.hidden = isFirst;
    next.hidden = isLast;
    finish.hidden = !isLast;
    back.style.display = isFirst ? 'none' : '';
    next.style.display = isLast ? 'none' : '';
    finish.style.display = isLast ? '' : 'none';
    if (isLast) review();
    if (focus) steps[step].querySelector('h2').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function updatePhp() {
    const usd = Number(salary.value);
    php.textContent = usd > 0 ? `About ₱${Math.round(usd * 58).toLocaleString()} / month (rough estimate at ₱58/USD).` : `Optional. We'll use this as a matching preference.`;
  }
  next.addEventListener('click', () => { if (validate()) { step++; show(true); } });
  back.addEventListener('click', () => { if (step > 0) { step--; show(true); } });
  salary.addEventListener('input', updatePhp);
  updatePhp(); show();
})();
