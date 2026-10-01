# VA Jobs PH

A complete, server-rendered jobs frontend for `va-jobs-ph-web`, deployed directly to **Cloudflare Workers with Static Assets**. No Next.js adapter, browser JavaScript, or frontend build framework is required. Search, category links, job details, and pagination work as ordinary HTML pages.

## 1. Put the project in GitHub

Extract the supplied ZIP, then copy **the contents of `va-jobs-ph-web`** into the root of the existing `va-jobs-ph-web` repository. Replace the starter README. Include dotfiles, `pnpm-lock.yaml`, `src`, `public`, and `test`; do not nest the project inside another folder. The separate `va-jobs-ph` backend is untouched.

## 2. Configure Supabase

The only key this application accepts is a modern **publishable key** beginning `sb_publishable_`. It is sent through the `apikey` header. No secret/service-role key or privileged database access is used. Legacy JWT anon keys are deliberately not accepted.

Required runtime variables:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | `https://nwqmhqiymtqkdihjadrp.supabase.co` (already in `wrangler.jsonc`) |
| `SUPABASE_PUBLISHABLE_KEY` | Your project's `sb_publishable_...` key |
| `SITE_URL` | Your final public origin, e.g. `https://your-domain.example` |

Set `SITE_URL` to the actual Workers URL or custom domain you launch with. Until it is configured, HTML pages are marked `noindex` and robots.txt disallows crawling. Requests on a different origin (such as a preview URL) are also marked noindex. A production domain should use HTTPS.

The existing `public.public_jobs` view must be readable through Supabase REST by the publishable key's anonymous role. Retain the existing database permissions and security policies; if access fails, review those rather than granting privileged access to this frontend.

Exact data contract:

```
id, title, company, description, category, location, remote,
workplace_type, source, job_url, posted_at, collected_at
```

`id` must be unique, stable, and convertible to a URL path segment. Title, company, description, category, location, workplace_type, source, and job_url are text or null. `remote` is boolean or null; dates are ISO timestamp strings or null. The view already restricts results to active, Philippines-eligible jobs; the frontend does not duplicate those filters. Descriptions are rendered as escaped plain text with preserved line breaks. HTML in a source description is intentionally displayed literally rather than executed.

## 3. Local development

Install Node.js 22 or newer, then from the project directory:

```sh
npm install
```

Copy `.dev.vars.example` to `.dev.vars` and replace the placeholder with the publishable key. `.dev.vars` is ignored by Git. For local development, keep `SITE_URL="http://localhost:8787"`.

```sh
npm run dev
```

Open `http://localhost:8787`. An unconfigured key or unavailable database produces a friendly HTTP 503 page, never fabricated job listings. No real key is included in this project.

The project also includes a pnpm lockfile. For a fully locked dependency install with pnpm 11, use `pnpm install --frozen-lockfile`; the included workspace file allows the official esbuild/workerd installation scripts. npm users can use the commands above and commit the generated `package-lock.json` instead of the pnpm lockfile. Wrangler itself is pinned to the version verified for this delivery.

## 4. Cloudflare deployment

In Cloudflare's Git-connected **Workers** flow, select `va-jobs-ph-web`:

| Setting | Value |
| --- | --- |
| Root directory | Repository root |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Dependency installation | Cloudflare automatic installation (detects the included pnpm lockfile), or `npm install` |
| Static asset directory | `public` (already in Wrangler configuration) |

This is a Workers project, not a Pages static export. It needs the Worker to render job pages at request time. No `out`/`.next` directory or Pages framework preset is used.

Add `SITE_URL` under `vars` in `wrangler.jsonc` before committing your production configuration so future Git deployments keep it. Store the publishable key as a Worker runtime secret using the Cloudflare dashboard or:

```sh
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
```

Despite Cloudflare calling this a “secret” binding, enter **only the Supabase publishable key**, never a Supabase secret key. Cloudflare preserves secret bindings across deployments. Build-time environment variables alone are not runtime bindings. If the Worker does not yet exist, deploy once, add the binding, and reload; it will return a safe 503 until configured.

For a manual deployment:

```sh
npm install
npm test
npm run build
npm run deploy
```

Cloudflare account authentication is required only for deployment. The build performs a local Wrangler dry run and writes its bundle to ignored `dist/`. For a custom domain, add it in the Worker's Domains & Routes settings and set `SITE_URL` to that origin.

## Pages and behavior

- `/`: keyword search across title, company, and description; 15 jobs per page, ordered by posted date and stable ID.
- `/?q=assistant&page=2`: shareable search and pagination.
- `/categories`: all category values found in the public view.
- `/categories/{encoded-category}`: exact category filtering with search and pagination.
- `/jobs/{encoded-id}`: full description, company, location, remote/workplace labels, source, dates, and original application link.
- `/robots.txt`, `/sitemap.xml`, `/sitemaps/pages.xml`, `/sitemaps/jobs-{n}.xml`: crawl controls and segmented sitemaps.

Unknown jobs/categories and invalid/out-of-range pages return HTTP 404. Unavailable Supabase responses return HTTP 503 with Retry-After. Null fields have explicit fallbacks. Unsafe application URL protocols are rejected. Arbitrary listing text is HTML-escaped. The site makes no database writes.

## SEO and Google

Pages include server-rendered content, titles, descriptions, canonical links, Open Graph tags, and semantic headings. Category pages and pagination are crawlable; keyword search results are noindex to avoid a large search-results index. Sitemaps include active-view job URLs and category pages. Removed jobs return 404 after the short response cache expires.

After launch, verify the final domain in Google Search Console and submit `https://YOUR_DOMAIN/sitemap.xml`. Indexing is Google's decision and is not guaranteed. Google Jobs `JobPosting` structured data is intentionally omitted: the view does not reliably provide all details needed to distinguish remote eligibility, physical job locations, and complete hiring-organization requirements. Do not invent these details for rich results.

## Validation and operating notes

```sh
npm test
npm run build
```

Automated tests mock Supabase and cover server rendering, search quoting, pagination, schema filters, missing pages, XSS/URL safety, key rejection, upstream failures, sitemap routes, and preview indexing. A real database connection still needs to be smoke-tested after adding your publishable key; no live access is claimed by these tests.

The category list is derived from public view rows, scanning in batches that respect the API row limit. Job results are paginated in Supabase, not downloaded in full. For very large datasets, add a separately authorized distinct-category endpoint/materialized view and database search indexes as a backend enhancement. Exact counts and substring description searches may be costly at scale. Sitemap job files contain at most 1,000 URLs; concurrent ingestion can shift offset-based sitemap boundaries until the next crawl. HTML responses use a short 60-second public cache; sitemap responses use 300 seconds. No analytics, cookies, external fonts, or tracking scripts are included.

Official references: [Workers static assets](https://developers.cloudflare.com/workers/static-assets/), [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Supabase REST API](https://supabase.com/docs/guides/api).
