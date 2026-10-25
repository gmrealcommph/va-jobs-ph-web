# Review-only release and rollback runbook

## Current state

The PR is a **draft**. The approved-for-review staging design and frozen review ZIP are unchanged. Production is still `713c64bc-c3a6-41d5-91fc-b3f111d36268`. Do not merge or deploy until the user separately approves the release.

## Safe local preparation (no upload)

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build:resume-release
pnpm run test:resume-release
```

For the full regression comparison, preload `test/helpers/deny-network.mjs`; provider/network access is blocked and tests must use explicit mocks. The raw baseline and release logs are committed. There are 36 matching pre-existing failures, not a fully green suite.

`dist/resume-release/` contains nine JavaScript modules, `metadata.json` and the build manifest. It contains **no staging fixture provider**, production credentials, database migration or account data. Keep the generated metadata with the modules. Do not run `wrangler deploy` against the old root configuration. The ordinary build and npm-deploy commands intentionally fail closed while review is pending.

## After explicit production approval only

1. Confirm design approval, reviewed PR commit and scope; verify no newer live source or settings have appeared. Rebuild and repeat the release-specific checks from that commit.
2. With a locally supplied Cloudflare token/account, run `node scripts/check-resume-release-live.mjs`. It only performs GET requests, prints no credentials and aborts on any baseline drift. A failure requires reconciliation, never bypassing the check.
3. Retain the old version ID, current settings/schedules fingerprint, module hashes and rollback request. Confirm the current main-only Cloudflare Builds trigger and keep the review build gate in place when merging. Merging is not production approval and should not trigger a successful automatic deployment.
4. Use the generated multipart modules and metadata in the **Update Worker Script** API (`PUT /accounts/{account_id}/workers/scripts/va-jobs-ph-web`) as a separately authorized action. `keep_assets` is supported by this endpoint. It is an **immediate production deployment**, not an inactive-version upload. Do not substitute the Versions upload endpoint: its current metadata schema does not expose `keep_assets`.
5. Make one controlled 100% transition. A percentage canary is unsuitable here without additional version-affinity work: HTML and its new inline-served asset paths must come from the same version. No asset-store upload, route change, secret update, binding replacement, schedule update or migration is required.
6. Immediately re-read deployed version/settings/bindings/schedules and compare the intended change. Smoke-test public pages, login/signup rendering and empty invalid same-origin forms, `/pro`, the guide redirect, résumé page/new assets and PDF/Word downloads. Check existing signed-in access manually with an authorized test account; do not create accounts, send email, charge payments or call paid AI as a smoke test.
7. Monitor errors and the agreed release window. If critical checks fail, roll back immediately. Record the resulting version and checks before declaring release success.

## Rollback (requires release authorization)

The previous known-good version is `713c64bc-c3a6-41d5-91fc-b3f111d36268`. Use the deployment API:

`POST /accounts/{account_id}/workers/scripts/va-jobs-ph-web/deployments`

```json
{"strategy":"percentage","versions":[{"version_id":"713c64bc-c3a6-41d5-91fc-b3f111d36268","percentage":100}],"annotations":{"workers/message":"Rollback reviewed resume release to prior known-good version"}}
```

Verify 100% traffic is restored, public/auth pages and original résumé assets load, and configuration/schedules remain unchanged. There are no schema changes or new Durable Object namespaces to undo. Existing saved drafts retain their identifiers; downloaded documents remain the member's files.

This task did not execute the upload or rollback requests. A future automated pipeline/source de-bundling migration is separate work and must not silently remove the review gate or deploy the older `src/worker.js`.

## Reference schemas consulted

- https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/
- https://developers.cloudflare.com/workers/versions-and-deployments/
- Cloudflare OpenAPI: Update Worker Script, Upload Version, Get Script/Version Settings, script schedules and deployments.
