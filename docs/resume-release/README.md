# Reviewed twelve-template release candidate

**Draft PR only. No merge or production deployment is authorized.**

Latest design revision: [Signature Professional validation](SIGNATURE-PROFESSIONAL.md) and [separate staging gallery](https://veeays-signature-preview-20261025.gm-realcommph.workers.dev/template-review/#signature). Signature Collection now follows the replacement corporate reference. The other eleven designs and their PDF/Word samples are unchanged. The links below preserve the original v4 freeze; use the versioned Signature Professional review package for the current candidate.

- [Complete cross-device review ZIP](../../review/resume-templates-20261025/veeays-12-resume-review.zip?raw=1)
- [Design validation report](../../review/resume-templates-20261025/validation-report.md)
- [All twelve designs](../../review/resume-templates-20261025/all-12-gallery.jpg)
- [Interactive staging gallery](https://veeays-ai-guidance-preview-20261024.gm-realcommph.workers.dev/template-review/)
- [Source-to-production reconciliation](RECONCILIATION.md)
- [Deployment and rollback plan](RELEASE.md)
- [Full regression comparison](regression-comparison.json)

The ZIP is the frozen design-review package: 12 PDFs, 12 editable Word documents, every page preview, mobile screenshots and the completed design/export checks. Its SHA-256 and the approved staging version are recorded in `review-artifacts.json`. Its report describes provenance at the design-review freeze; this directory describes the subsequent verified GitHub release preparation.

No résumé design or approved browser-asset bytes changed during release preparation. Current live behavior was recovered and fingerprinted instead of promoting the older Git main Worker/configuration. The original GitHub Desktop checkout and its unrelated Quick Reads changes were left untouched.

The normal build and npm-deploy commands intentionally fail closed because Cloudflare currently auto-deploys main. Use `pnpm run build:resume-release` for the local candidate and `pnpm run test:resume-release` for focused checks. Existing full-suite failures are documented, not hidden or fixed outside this scope. No secrets or production data are included.
