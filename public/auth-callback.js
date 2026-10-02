(() => {
  const hash = new URLSearchParams(location.hash.slice(1));
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  const expiresIn = hash.get('expires_in');
  const error = hash.get('error_description') || hash.get('error');

  if (error) {
    location.replace('/login?error=' + encodeURIComponent(error));
    return;
  }
  if (!accessToken || !refreshToken) {
    location.replace('/login?error=' + encodeURIComponent('The verification link is invalid or has expired.'));
    return;
  }

  fetch('/auth/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken, expires_in: Number(expiresIn) || 3600 }),
    credentials: 'same-origin'
  }).then(async response => {
    if (!response.ok) throw new Error('Could not create your session.');
    location.replace('/onboarding');
  }).catch(() => {
    location.replace('/login?error=' + encodeURIComponent('We could not finish signing you in. Please try again.'));
  });
})();
