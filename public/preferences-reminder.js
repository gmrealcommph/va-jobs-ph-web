(() => {
  const reminder = document.querySelector('[data-preferences-reminder]');
  if (!reminder) return;
  const key = 'veeays_preferences_reminder_dismissed';
  try { if (sessionStorage.getItem(key)) reminder.hidden = true; } catch {}
  reminder.querySelector('.preferences-card-dismiss').addEventListener('click', event => {
    event.preventDefault();
    reminder.hidden = true;
    try { sessionStorage.setItem(key, '1'); } catch {}
    // Keep the existing seven-day dismissal without leaving the current page.
    document.cookie = 'veeays_preferences_prompt_dismissed=1; Path=/; Max-Age=604800; Secure; SameSite=Lax';
    fetch('/dismiss-preferences-prompt', { credentials: 'same-origin' }).catch(() => {});
  });
})();
