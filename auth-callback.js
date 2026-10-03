(() => {
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  const expiresIn = hash.get('expires_in');
  const returnTo = query.get('return') || '';
  const error = hash.get('error_description') || hash.get('error');

  const authUrl = (path) => path + (returnTo ? '?return=' + encodeURIComponent(returnTo) : '');

  if (error) {
    location.replace('/login?error=' + encodeURIComponent(error) + (returnTo ? '&return=' + encodeURIComponent(returnTo) : ''));
    return;
  }
  if (!accessToken || !refreshToken) {
    location.replace('/login?error=' + encodeURIComponent('The verification link is invalid or has expired.') + (returnTo ? '&return=' + encodeURIComponent(returnTo) : ''));
    return;
  }

  fetch('/auth/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken, expires_in: Number(expiresIn) || 3600, return: returnTo }),
    credentials: 'same-origin'
  }).then(async response => {
    if (!response.ok) throw new Error('Could not create your session.');
    const data = await response.json();
    location.replace(data.redirect || '/');
  }).catch(() => {
    location.replace('/login?error=' + encodeURIComponent('We could not finish signing you in. Please try again.') + (returnTo ? '&return=' + encodeURIComponent(returnTo) : ''));
  });
})();
