import { categories, getJob, listJobs, query } from './data.js';
import { layout, listing, detail, esc, jobPath, categoryPath, authPage, checkEmailPage, authCallbackPage, onboardingPage } from './render.js';
import { signUp, signIn, getUser, sessionForRequest, setSessionCookies, clearSessionCookies, authError, getJobPreferences, saveJobPreferences, completeOnboarding, getMyProfile } from './auth.js';

const headers = { 'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'content-security-policy': "default-src 'none'; style-src 'self'; img-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", 'permissions-policy': 'camera=(), microphone=(), geolocation=()' };
function origin(env, url) {
  if (!env.SITE_URL) return url.origin;
  const value = new URL(env.SITE_URL);
  if (!['http:', 'https:'].includes(value.protocol)) throw new Error('Invalid SITE_URL');
  return value.origin;
}

function safeReturnPath(value) {
  const v = String(value || '');
  if (/^\/apply\/[A-Za-z0-9%._~-]{1,240}$/.test(v)) return v;
  if (v === '/onboarding' || v === '/') return v;
  return '';
}
async function defaultPostAuthPath(env, state) {
  if (!state?.user || !state?.accessToken) return '/onboarding';
  try {
    const profile = await getMyProfile(env, state.accessToken, state.user.id);
    return profile?.onboarding_completed ? '/' : '/onboarding';
  } catch { return '/onboarding'; }
}

function xml(body) { return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=300' } }); }
export async function handle(request, env) {
  const url = new URL(request.url);

  const siteOrigin = origin(env, url);

  const sameOriginPost = () => {
    const requestOrigin = request.headers.get('origin');
    return !requestOrigin || requestOrigin === url.origin;
  };

  if (request.method === 'POST' && ['/signup', '/login', '/auth/session', '/onboarding'].includes(url.pathname)) {
    if (!sameOriginPost()) return new Response('Forbidden', { status: 403 });

    if (url.pathname === '/auth/session') {
      let payload;
      try { payload = await request.json(); } catch { return new Response('Invalid request', { status: 400 }); }
      const accessToken = String(payload?.access_token || '');
      const refreshToken = String(payload?.refresh_token || '');
      const returnTo = safeReturnPath(payload?.return);
      if (!accessToken || !refreshToken || accessToken.length > 10000 || refreshToken.length > 10000) return new Response('Invalid session', { status: 400 });
      const user = await getUser(env, accessToken);
      if (!user) return new Response('Invalid session', { status: 401 });
      const state = { user, accessToken };
      const target = returnTo || await defaultPostAuthPath(env, state);
      const responseHeaders = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      setSessionCookies(responseHeaders, { access_token: accessToken, refresh_token: refreshToken, expires_in: Number(payload?.expires_in) || 3600 });
      return new Response(JSON.stringify({ redirect: target }), { status: 200, headers: responseHeaders });
    }

    let form;
    try { form = await request.formData(); } catch { return new Response('Invalid form', { status: 400 }); }

    if (url.pathname === '/onboarding') {
      const state = await sessionForRequest(request, env);
      if (!state.user || !state.accessToken) return Response.redirect(`${url.origin}/login?message=${encodeURIComponent('Log in to continue setting up your account.')}`, 303);
      const values = name => form.getAll(name).map(v => String(v).trim()).filter(Boolean);
      const allowedRoles = new Set(['Executive Assistant','General VA','Customer Support','Social Media','Marketing','Sales','E-commerce','Bookkeeping','Graphic Design','Video Editing','Operations','Web/Development','Other']);
      const allowedEmployment = new Set(['Full-time','Part-time','Contract/Freelance']);
      const allowedSchedules = new Set(['Philippines daytime','UK/Europe hours','Australia hours','US hours','Flexible/Any']);
      const allowedExperience = new Set(['Entry level','1–2 years','3–5 years','6+ years']);
      const targetRoles = values('target_roles').filter(v => allowedRoles.has(v));
      const employmentTypes = values('employment_types').filter(v => allowedEmployment.has(v));
      const schedulePreferences = values('schedule_preferences').filter(v => allowedSchedules.has(v));
      const experienceLevel = String(form.get('experience_level') || '');
      const salaryRaw = String(form.get('minimum_salary_usd') || '').trim();
      const minimumSalary = salaryRaw === '' ? null : Number.parseInt(salaryRaw, 10);
      const skills = String(form.get('skills') || '').split(',').map(v => v.trim()).filter(Boolean).slice(0, 30).map(v => v.slice(0, 60));
      const invalid = !targetRoles.length || !employmentTypes.length || !schedulePreferences.length || !allowedExperience.has(experienceLevel) || (minimumSalary !== null && (!Number.isInteger(minimumSalary) || minimumSalary < 0 || minimumSalary > 50000));
      if (invalid) return Response.redirect(`${url.origin}/onboarding?error=${encodeURIComponent('Please complete each step before finishing your profile.')}`, 303);
      try {
        await saveJobPreferences(env, state.accessToken, { user_id: state.user.id, target_roles: targetRoles, minimum_salary_usd: minimumSalary, employment_types: employmentTypes, schedule_preferences: schedulePreferences, experience_level: experienceLevel, skills });
        await completeOnboarding(env, state.accessToken);
      } catch (error) {
        console.error('Onboarding save failed:', error);
        return Response.redirect(`${url.origin}/onboarding?error=${encodeURIComponent('We could not save your preferences. Please try again.')}`, 303);
      }
      const h = new Headers({ location: '/?onboarding=complete', 'cache-control': 'no-store' });
      if (state.refreshed && typeof state.refreshed === 'object') setSessionCookies(h, state.refreshed);
      return new Response(null, { status: 303, headers: h });
    }

    const email = String(form.get('email') || '').trim().toLowerCase().slice(0, 254);
    const password = String(form.get('password') || '');
    const fullName = String(form.get('full_name') || '').trim().slice(0, 100);
    const returnTo = safeReturnPath(form.get('return'));
    if (!email || !email.includes('@') || password.length < 8 || password.length > 128) {
      const target = url.pathname === '/signup' ? '/signup' : '/login';
      return Response.redirect(`${url.origin}${target}?error=${encodeURIComponent('Enter a valid email and a password of at least 8 characters.')}&email=${encodeURIComponent(email)}${returnTo ? `&return=${encodeURIComponent(returnTo)}` : ''}`, 303);
    }

    if (url.pathname === '/signup') {
      if (!fullName) return Response.redirect(`${url.origin}/signup?error=${encodeURIComponent('Enter your full name.')}&email=${encodeURIComponent(email)}${returnTo ? `&return=${encodeURIComponent(returnTo)}` : ''}`, 303);
      const { response, data } = await signUp(env, { email, password, fullName, redirectTo: `${siteOrigin}/auth/callback${returnTo ? `?return=${encodeURIComponent(returnTo)}` : ''}` });
      if (!response.ok) return Response.redirect(`${url.origin}/signup?error=${encodeURIComponent(authError(data, 'We could not create your account.'))}&email=${encodeURIComponent(email)}${returnTo ? `&return=${encodeURIComponent(returnTo)}` : ''}`, 303);
      if (data?.access_token && data?.refresh_token) {
        const target = returnTo || '/onboarding';
        const h = new Headers({ location: target, 'cache-control': 'no-store' });
        setSessionCookies(h, data);
        return new Response(null, { status: 303, headers: h });
      }
      return Response.redirect(`${url.origin}/check-email?email=${encodeURIComponent(email)}${returnTo ? `&return=${encodeURIComponent(returnTo)}` : ''}`, 303);
    }

    const { response, data } = await signIn(env, { email, password });
    if (!response.ok || !data?.access_token) return Response.redirect(`${url.origin}/login?error=${encodeURIComponent(authError(data, 'Email or password is incorrect.'))}&email=${encodeURIComponent(email)}${returnTo ? `&return=${encodeURIComponent(returnTo)}` : ''}`, 303);
    const state = { user: data.user || await getUser(env, data.access_token), accessToken: data.access_token };
    const target = returnTo || await defaultPostAuthPath(env, state);
    const h = new Headers({ location: target, 'cache-control': 'no-store' });
    setSessionCookies(h, data);
    return new Response(null, { status: 303, headers: h });
  }

  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD, POST' } });
  }

  if (request.method === 'HEAD') {
    const result = await handle(
      new Request(request.url),
      env
    );

    return new Response(null, {
      status: result.status,
      headers: result.headers
    });
  }

  let base;
  let authState = { user: null, refreshed: null };

  const render = (
    title,
    body,
    {
      status = 200,
      description =
        'Explore virtual assistant and other jobs open to Filipino talent. Search opportunities by keyword and category.',
      canonical = base + url.pathname,
      noindex = false
    } = {}
  ) =>
    new Response(
      layout({
        title,
        body,
        description,
        canonical,
        noindex:
          noindex ||
          !env.SITE_URL ||
          base !== url.origin,
        user: authState.user
      }),
      {
        status,
        headers: (() => {
          const h = new Headers(headers);
          h.set('cache-control', status === 200 && !authState.user ? 'public, max-age=60' : 'no-store');
          if (authState.refreshed && typeof authState.refreshed === 'object') setSessionCookies(h, authState.refreshed);
          else if (authState.refreshed === false) clearSessionCookies(h);
          return h;
        })()
      }
    );

  const missing = () =>
    render(
      'Page not found',
      `
        <section class="wrap message">
          <h1>This opportunity has moved on.</h1>
          <p>
            The page does not exist or the listing
            is no longer available.
          </p>
          <a class="button" href="/">
            Explore current jobs
          </a>
        </section>
      `,
      {
        status: 404,
        noindex: true
      }
    );

  try {
    base = origin(env, url);

    /*
     * =====================================================
     * COMPANY LOGO PROXY
     * =====================================================
     *
     * The public page requests:
     *
     *   /company-logo/JOB_ID
     *
     * We then look up that public job and fetch only the
     * company_logo_url already stored for it.
     *
     * This prevents VeeAys from becoming an arbitrary URL
     * proxy.
     */

    const logoMatch =
      url.pathname.match(
        /^\/company-logo\/([1-9]\d*)$/
      );

    if (logoMatch) {
      const jobId = logoMatch[1];

      const job = await getJob(
        env,
        jobId
      );

      if (!job?.company_logo_url) {
        return new Response(
          'Logo not available',
          {
            status: 404,
            headers: {
              'cache-control':
                'public, max-age=300'
            }
          }
        );
      }

      let logoUrl;

      try {
        logoUrl = new URL(
          job.company_logo_url
        );
      } catch {
        return new Response(
          'Invalid logo URL',
          {
            status: 404,
            headers: {
              'cache-control':
                'public, max-age=300'
            }
          }
        );
      }

      /*
       * Only allow logo hosts that VeeAys explicitly
       * collects from supported job platforms.
       *
       * Ashby:
       *   https://app.ashbyhq.com/api/images/...
       *
       * Greenhouse:
       *   https://recruiting.cdn.greenhouse.io/...
       */

      const isAshbyLogo =
  logoUrl.protocol === 'https:' &&
  logoUrl.hostname ===
    'app.ashbyhq.com' &&
  logoUrl.pathname.startsWith(
    '/api/images/'
  );

const isGreenhouseLogo =
  logoUrl.protocol === 'https:' &&
  logoUrl.hostname ===
    'recruiting.cdn.greenhouse.io' &&
  logoUrl.pathname.startsWith(
    '/external_greenhouse_job_boards/'
  );

const isLeverLogo =
  logoUrl.protocol === 'https:' &&
  logoUrl.hostname ===
    'lever-client-logos.s3.us-west-2.amazonaws.com';

if (
  !isAshbyLogo &&
  !isGreenhouseLogo &&
  !isLeverLogo
) {
        console.error(
          'Company logo source not allowed:',
          logoUrl.hostname,
          logoUrl.pathname
        );

       return new Response(
  'Logo source not allowed',
  {
    status: 403,
            headers: {
              'cache-control':
                'public, max-age=300'
            }
          }
        );
      }

      let logoResponse;

      try {
        logoResponse = await fetch(
          logoUrl.toString(),
          {
            headers: {
              'User-Agent':
                'VeeAys/1.0',
              Accept:
                'image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*'
            },
            signal:
              AbortSignal.timeout(
                10000
              )
          }
        );
      } catch (error) {
        console.error(
          'Company logo fetch:',
          error.message
        );

        return new Response(
          'Logo unavailable',
          {
            status: 502,
            headers: {
              'cache-control':
                'public, max-age=60'
            }
          }
        );
      }

      if (!logoResponse.ok) {
        console.error(
          'Company logo fetch:',
          logoResponse.status
        );

        return new Response(
          'Logo unavailable',
          {
            status: 502,
            headers: {
              'cache-control':
                'public, max-age=60'
            }
          }
        );
      }

      const upstreamContentType =
  (
    logoResponse.headers.get(
      'content-type'
    ) || ''
  )
    .split(';')[0]
    .trim()
    .toLowerCase();

const allowedTypes =
  new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/svg+xml'
  ]);

let contentType =
  upstreamContentType;

/*
 * Lever's logo S3 bucket can return company images as
 * application/octet-stream instead of their actual image
 * MIME type.
 *
 * Only permit this fallback for the already allowlisted
 * Lever logo host.
 */

if (
  isLeverLogo &&
  upstreamContentType ===
    'application/octet-stream'
) {
  const pathname =
    logoUrl.pathname.toLowerCase();

  if (
    pathname.endsWith('.png')
  ) {
    contentType = 'image/png';
  } else if (
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg')
  ) {
    contentType = 'image/jpeg';
  } else if (
    pathname.endsWith('.webp')
  ) {
    contentType = 'image/webp';
  } else if (
    pathname.endsWith('.gif')
  ) {
    contentType = 'image/gif';
  } else if (
    pathname.endsWith('.svg')
  ) {
    contentType = 'image/svg+xml';
  }
}

if (
  !allowedTypes.has(
    contentType
  )
) {
  console.error(
    'Unexpected company logo type:',
    upstreamContentType
  );

  return new Response(
    'Invalid logo response',
    {
      status: 502,
      headers: {
        'cache-control':
          'public, max-age=60'
      }
    }
  );
}

      
      return new Response(
        logoResponse.body,
        {
          status: 200,
          headers: {
            'content-type':
              contentType,

            /*
             * Logos rarely change, so cache aggressively.
             */

            'cache-control':
              'public, max-age=86400',

            'x-content-type-options':
              'nosniff',

            'content-security-policy':
              "default-src 'none'",

            'referrer-policy':
              'no-referrer'
          }
        }
      );
    }

    /*
     * =====================================================
     * NORMAL SITE ROUTES
     * =====================================================
     */

    authState = await sessionForRequest(request, env);

    if (url.pathname === '/logout') {
      const h = new Headers({ location: '/', 'cache-control': 'no-store' });
      clearSessionCookies(h);
      return new Response(null, { status: 303, headers: h });
    }

    if (url.pathname === '/signup' || url.pathname === '/login') {
      if (authState.user) {
        const target = safeReturnPath(url.searchParams.get('return')) || await defaultPostAuthPath(env, authState);
        return Response.redirect(url.origin + target, 303);
      }
      const mode = url.pathname === '/signup' ? 'signup' : 'login';
      return render(mode === 'signup' ? 'Create your account' : 'Log in', authPage({
        mode,
        error: (url.searchParams.get('error') || '').slice(0, 240),
        message: (url.searchParams.get('message') || '').slice(0, 240),
        email: (url.searchParams.get('email') || '').slice(0, 254),
        returnTo: safeReturnPath(url.searchParams.get('return'))
      }), { noindex: true });
    }

    if (url.pathname === '/check-email') {
      if (authState.user) return Response.redirect(url.origin + (safeReturnPath(url.searchParams.get('return')) || await defaultPostAuthPath(env, authState)), 303);
      return render('Check your email', checkEmailPage((url.searchParams.get('email') || '').slice(0, 254), safeReturnPath(url.searchParams.get('return'))), { noindex: true });
    }

    if (url.pathname === '/auth/callback') {
      if (authState.user) return Response.redirect(url.origin + (safeReturnPath(url.searchParams.get('return')) || await defaultPostAuthPath(env, authState)), 303);
      return render('Verifying your email', authCallbackPage(), { noindex: true });
    }

    if (url.pathname === '/onboarding') {
      if (!authState.user || !authState.accessToken) return Response.redirect(url.origin + '/login?message=' + encodeURIComponent('Log in to continue setting up your account.'), 303);
      let preferences = null;
      try { preferences = await getJobPreferences(env, authState.accessToken, authState.user.id); }
      catch (error) { console.error('Preferences load failed:', error); }
      return render('Set up your account', onboardingPage({ user: authState.user, preferences, error: (url.searchParams.get('error') || '').slice(0, 240) }), { noindex: true });
    }

    const applyMatch = url.pathname.match(/^\/apply\/([^/]+)$/);
    if (applyMatch) {
      let id;
      try { id = decodeURIComponent(applyMatch[1]); } catch { return missing(); }
      if (!id || id.length > 200) return missing();
      const job = await getJob(env, id);
      if (!job) return missing();
      if (!authState.user) {
        const returnTo = `/apply/${encodeURIComponent(id)}`;
        return Response.redirect(url.origin + `/signup?return=${encodeURIComponent(returnTo)}`, 303);
      }
      const destination = String(job.job_url || '');
      let external;
      try { external = new URL(destination); } catch { return missing(); }
      if (!['https:', 'http:'].includes(external.protocol)) return missing();
      return Response.redirect(external.href, 302);
    }

    if (
      url.pathname.endsWith('/') &&
      url.pathname !== '/'
    ) {
      return Response.redirect(
        url.origin +
          url.pathname.slice(0, -1) +
          url.search,
        308
      );
    }

    if (
      url.pathname === '/robots.txt'
    ) {
      return new Response(
        env.SITE_URL &&
        base === url.origin
          ? `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`
          : 'User-agent: *\nDisallow: /\n',
        {
          headers: {
            'content-type':
              'text/plain; charset=utf-8'
          }
        }
      );
    }

    if (
      url.pathname === '/sitemap.xml'
    ) {
      const { total } =
        await query(
          env,
          { select: 'id' },
          {
            limit: 1,
            count: true
          }
        );

      return xml(
        `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${esc(
          base
        )}/sitemaps/pages.xml</loc></sitemap>${Array.from(
          {
            length:
              Math.ceil(
                total / 1000
              )
          },
          (_, i) =>
            `<sitemap><loc>${esc(
              base
            )}/sitemaps/jobs-${
              i + 1
            }.xml</loc></sitemap>`
        ).join(
          ''
        )}</sitemapindex>`
      );
    }

    if (
      url.pathname ===
      '/sitemaps/pages.xml'
    ) {
      const names =
        await categories(env);

      return xml(
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[
          '/',
          '/categories',
          ...names.map(
            categoryPath
          )
        ]
          .map(
            path =>
              `<url><loc>${esc(
                base + path
              )}</loc></url>`
          )
          .join('')}</urlset>`
      );
    }

    const sitemap =
      url.pathname.match(
        /^\/sitemaps\/jobs-([1-9]\d*)\.xml$/
      );

    if (sitemap) {
      const page =
        Number(sitemap[1]);

      if (
        !Number.isSafeInteger(
          page
        ) ||
        page > 1000000
      ) {
        return missing();
      }

      let rows = [];
      let offset =
        (page - 1) * 1000;

      while (
        rows.length < 1000
      ) {
        const result =
          await query(
            env,
            {
              select: 'id',
              order: 'id.asc'
            },
            {
              offset:
                offset +
                rows.length,
              limit:
                1000 -
                rows.length
            }
          );

        if (
          !result.rows.length
        ) {
          break;
        }

        rows.push(
          ...result.rows
        );
      }

      if (!rows.length) {
        return missing();
      }

      return xml(
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows
          .map(
            job =>
              `<url><loc>${esc(
                base +
                  jobPath(job)
              )}</loc></url>`
          )
          .join('')}</urlset>`
      );
    }

    if (
      url.pathname ===
      '/categories'
    ) {
      const names =
        await categories(env);

      return render(
        'Explore job categories',
        `<section class="wrap category-page"><div class="kicker">FIND YOUR DIRECTION</div><h1>Work that fits<br><em>your strengths.</em></h1><p>Explore opportunities by category.</p><div class="category-grid">${
          names
            .map(
              name =>
                `<a href="${categoryPath(
                  name
                )}"><h2>${esc(
                  name
                )}</h2><span>Explore jobs ↗</span></a>`
            )
            .join('') ||
          '<p>No categories are available yet. Check back soon.</p>'
        }</div></section>`
      );
    }

    const jobMatch =
      url.pathname.match(
        /^\/jobs\/([^/]+)$/
      );

    if (jobMatch) {
      let id;

      try {
        id =
          decodeURIComponent(
            jobMatch[1]
          );
      } catch {
        return missing();
      }

      if (
        id.length > 200
      ) {
        return missing();
      }

      const job =
        await getJob(
          env,
          id
        );

      return job
        ? render(
            `${
              job.title ||
              'Job opportunity'
            }${
              job.company
                ? ' at ' +
                  job.company
                : ''
            }`,
            detail(job),
            {
              canonical:
                base +
                jobPath(job),

              description:
                String(
                  job.description ||
                    `Explore this opportunity at ${
                      job.company ||
                      'VeeAys'
                    }.`
                )
                  .replace(
                    /\s+/g,
                    ' '
                  )
                  .slice(
                    0,
                    155
                  )
            }
          )
        : missing();
    }

    const categoryMatch =
      url.pathname.match(
        /^\/categories\/([^/]+)$/
      );

    if (
      url.pathname !== '/' &&
      !categoryMatch
    ) {
      return missing();
    }

    let category = '';

    try {
      category =
        categoryMatch
          ? decodeURIComponent(
              categoryMatch[1]
            )
          : '';
    } catch {
      return missing();
    }

    const names =
      await categories(env);

    if (
      category &&
      !names.includes(category)
    ) {
      return missing();
    }

    const pageInput =
      url.searchParams.get(
        'page'
      ) || '1';

    if (
      !/^[1-9]\d{0,5}$/.test(
        pageInput
      )
    ) {
      return missing();
    }

    const page =
      Number(pageInput);

    const search =
      (
        url.searchParams.get(
          'q'
        ) || ''
      )
        .trim()
        .slice(
          0,
          120
        );

    const {
      rows,
      total
    } = await listJobs(
      env,
      {
        category,
        search,
        page
      }
    );

    if (
      page > 1 &&
      (page - 1) * 15 >=
        total
    ) {
      return missing();
    }

    return render(
      `${
        category ||
        'Find your next opportunity'
      }${
        page > 1
          ? ` — Page ${page}`
          : ''
      }`,
      listing({
        rows,
        total,
        page,
        search,
        category,
        names
      }),
      {
        canonical:
          base +
          (
            category
              ? categoryPath(
                  category
                )
              : '/'
          ) +
          (
            page > 1
              ? `?page=${page}`
              : ''
          ),

        noindex:
          !!search
      }
    );
  } catch (error) {
    console.error(
      'Jobs frontend:',
      error.message
    );

    base ||= url.origin;

    const response =
      render(
        'Temporarily unavailable',
        '<section class="wrap message"><div class="kicker">BACK SOON</div><h1>A little pause<br>in your job search.</h1><p>We couldn’t load opportunities right now. Please try again shortly.</p><a class="button" href="/">Try again</a></section>',
        {
          status: 503,
          noindex: true
        }
      );

    response.headers.set(
      'Retry-After',
      '60'
    );

    return response;
  }
}
export default { fetch: handle };
