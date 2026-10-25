// Cloudflare Builds currently deploys main automatically. Keep this release review-only.
console.error('Production release is not approved. Automatic build/deploy is intentionally blocked.');
console.error('Use pnpm run build:resume-release for a local, code-only candidate. Follow docs/resume-release/RELEASE.md after explicit approval.');
process.exitCode=1;
