// Progressive enhancement: the native form remains usable without JavaScript.
const form = document.querySelector('.ep-form');
if (form) {
  const button = form.querySelector('button[type="submit"]');
  const success = document.querySelector('.ep-success');
  const error = document.querySelector('.ep-error');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled) return;
    const body = new URLSearchParams(new FormData(form));
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    success.hidden = true;
    error.hidden = true;
    try {
      const response = await fetch(form.action, {
        method: 'POST', credentials: 'same-origin', redirect: 'error',
        headers: {Accept: 'application/json'}, body
      });
      if (!response.ok || (await response.json()).saved !== true) throw new Error('Save failed');
      success.hidden = false;
    } catch {
      error.hidden = false;
    } finally {
      button.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });
  form.addEventListener('change', () => { success.hidden = true; error.hidden = true; });
}
