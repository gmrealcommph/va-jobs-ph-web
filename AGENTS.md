# Signup and login are release requirements

For every website change, including styling, headers, analytics and unrelated features:

- Reconcile with the latest production deployment and preserve production hotfixes. Never promote an older staging workspace over a signup fix.
- Run `npm run test:auth` before release. Test the default Worker export, native form Origin behavior, CAPTCHA/validation, verification return path, session refresh and existing-member login.
- Verify on staging that signup and login render and native same-origin forms work. Keep email verification, CAPTCHA, CSRF/origin checks, cookies, pricing, payments and deletion rules unchanged unless explicitly authorized.
- Keep optional browser analytics disabled. Do not reintroduce no-referrer on native authentication form pages.
- Production probes must not create accounts, send emails, charge payments or use personal credentials. Empty invalid signup form checks are safe but do not prove real signup or email delivery.
- After approved deployment, check live signup/login headers, invalid-form validation and public resources. Require explicit approval for production deployment.
