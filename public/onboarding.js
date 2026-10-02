(() => {
  const form = document.getElementById('onboarding-form');
  if (!form) return;
  const steps = [...form.querySelectorAll('.onboard-step')];
  const dots = [...document.querySelectorAll('.onboard-progress span')];
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
      if (!message) { message = document.createElement('p'); message.className = 'onboard-validation'; current.appendChild(message); }
      message.textContent = 'Choose at least one option to continue.';
    } else if (message) message.remove();
    return ok;
  }
  function review() {
    const groups = [
      ['Roles', checked('target_roles').map(x => x.value).join(', ')],
      ['Minimum salary', salary.value ? `$${Number(salary.value).toLocaleString()} / month` : 'No minimum set'],
      ['Employment', checked('employment_types').map(x => x.value).join(', ')],
      ['Schedule', checked('schedule_preferences').map(x => x.value).join(', ')],
      ['Experience', checked('experience_level')[0]?.value || ''],
      ['Skills', document.getElementById('skills').value.trim() || 'None added']
    ];
    document.getElementById('onboard-review').innerHTML = groups.map(([a,b]) => `<div><span>${a}</span><strong>${escapeHtml(b)}</strong></div>`).join('');
  }
  function escapeHtml(v) { const d=document.createElement('div'); d.textContent=v; return d.innerHTML; }
  function show() {
    steps.forEach((el,i) => el.classList.toggle('active', i === step));
    dots.forEach((el,i) => { el.classList.toggle('active', i === step); el.classList.toggle('done', i < step); });
    back.hidden = step === 0;
    next.hidden = step === steps.length - 1;
    finish.hidden = step !== steps.length - 1;
    if (step === steps.length - 1) review();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function updatePhp() {
    const usd = Number(salary.value);
    php.textContent = usd > 0 ? `About ₱${Math.round(usd * 58).toLocaleString()} / month (rough estimate at ₱58/USD).` : `Optional. We'll use this as a matching preference.`;
  }
  next.addEventListener('click', () => { if (validate()) { step++; show(); } });
  back.addEventListener('click', () => { if (step > 0) { step--; show(); } });
  salary.addEventListener('input', updatePhp);
  updatePhp(); show();
})();
