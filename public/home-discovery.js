// Keep homepage saving independent of the stretched job link.
(() => {
  document.querySelectorAll('.home-page .discovery-actions').forEach(actions => {
    actions.addEventListener('click', event => event.stopPropagation());
    actions.addEventListener('keydown', event => event.stopPropagation());
  });
  document.querySelectorAll('.home-page form[data-home-save]').forEach(form => {
    const button = form.querySelector('button');
    const status = form.querySelector('[data-save-status]');
    const title = button.getAttribute('aria-label').replace(/^(Unsave|Save) /, '');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      status.textContent = 'Updating saved job…';
      try {
        const response = await fetch(form.action, {
          method: 'POST', body: new FormData(form),
          headers: { Accept: 'application/json' }, credentials: 'same-origin'
        });
        const result = await response.json();
        if (response.status === 401) {
          // Reuse the existing auth return and job-detail save-intent flow.
          const id = form.elements.job_id.value;
          window.location.assign('/login?return=' + encodeURIComponent('/jobs/' + id + '?save=1'));
          return;
        }
        if (!response.ok || typeof result.saved !== 'boolean') throw new Error(result.error || 'We could not update that job. Please try again.');
        form.setAttribute('action', result.saved ? '/unsave-job' : '/save-job');
        button.classList.toggle('is-saved', result.saved);
        button.setAttribute('aria-pressed', String(result.saved));
        button.setAttribute('aria-label', (result.saved ? 'Unsave ' : 'Save ') + title);
        button.replaceChildren();
        const heart = document.createElement('span');
        heart.className = 'discovery-heart';
        heart.setAttribute('aria-hidden', 'true');
        heart.textContent = result.saved ? '♥' : '♡';
        button.append(heart, result.saved ? ' Saved' : ' Save');
        status.textContent = result.saved ? 'Saved to My Jobs.' : 'Removed from My Jobs.';
      } catch (error) {
        status.textContent = error.message || 'We could not update that job. Please try again.';
      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    });
  });
})();
