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
    if (step === 1) ok = checked('employment_types').length > 0 && checked('schedule_preferences').length > 0;
    if (step === 2) ok = checked('experience_level').length > 0;
    const current = steps[step];
    let message = current.querySelector('.onboard-validation');
    if (!ok) {
      if (!message) { message = document.createElement('p'); message.className = 'onboard-validation'; message.setAttribute('role', 'alert'); current.appendChild(message); }
      message.textContent = 'Choose an option in each required group to continue.';
    } else if (message) message.remove();
    return ok;
  }
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
    if (focus) steps[step].querySelector('h2').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function updatePhp() {
    const usd = Number(salary.value);
    php.textContent = usd > 0 ? `About ₱${Math.round(usd * 58).toLocaleString()} / month (rough estimate at ₱58/USD).` : `Optional. We'll use this as a matching preference.`;
  }
  next.addEventListener('click', () => {
    if (!validate()) return;
    if (step === 1 && !salary.checkValidity()) { salary.reportValidity(); return; }
    step++; show(true);
  });
  back.addEventListener('click', () => { if (step > 0) { step--; show(true); } });
  form.addEventListener('submit', e => { if (!validate() || !salary.checkValidity()) { e.preventDefault(); salary.reportValidity(); } });
  salary.addEventListener('input', updatePhp);
  updatePhp(); show();
})();
