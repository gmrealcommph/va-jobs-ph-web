# Saved production source baseline

Recovered from the saved source of the authentication branding release, version `081b6577-3502-401c-9b7b-1785772e0014` (100% traffic recorded 2026-10-16 00:06 UTC). GitHub main `4b832c3` was behind this direct Worker deployment. No production configuration or code was changed during recovery.

This branch provides a review base for the scoped member-dashboard changes. It is not a deployment authorization. Source provenance is the prior release record; the currently deployed version still needs read-only confirmation before any rollout. Preserve the live asset manifest, secrets, bindings, flags and schedules; the main-branch wrangler configuration alone is not a complete production manifest.

Saved source SHA-256 hashes:

- `account-deletion.js`: `5cc88e2c2eeea0293aaa106511d3bdc5762fb1554e472b558d5f232ba41bdc60`
- `admin-balances.js`: `49d3a62d5221d6ac3fe4f8be26d81810ee4234a09113050fef7d1170471fa73f`
- `admin-health.js`: `cce2e44d927277313bffd3ae72290e3337fa6ce57480a31d906cf80077d91d62`
- `admin-monitor.js`: `9883a7f65e8367d25b558714f0ac62e79e07dd98103198fd60252558c52634dc`
- `admin-visitors.js`: `481f2542da3d58c8f8e872c3471dc7f7ac38a64f894a1b39e63fcfedc02eb370`
- `admin.js`: `69d1f1d47393fcb607de7ae7dc78859178249d51cd067d2c4a524106d8649cc9`
- `auth-support.js`: `c1a60a9d34d37d3eb8b1f4ab3cea4b8633289257171acedfd0c8c064ac0ef6f8`
- `auth.js`: `94bfe8256961a018028044b4761c08aec528aba0726d5338b59e3afa3789baea`
- `category-context.js`: `49b96b07a697f98a47ffbfae629f87df3fcb6c9b63fdb41b8e39e63709c181fb`
- `category-page.js`: `925d37fdd7024bb19fc574788c2502e951ce7617a96b04cf072a1c916d9f0d92`
- `company-pages.js`: `f3ec87f9a40452d7d5fb81f562947f3081234a3d5fc56456d84afc1ed51533cc`
- `daily-digest.js`: `326ac9535f4ebb38e8d07042454c164cc0239451bb2e85976e81e90e7df0186b`
- `data.js`: `fd3b901f9bc0941672b81726e4a02f964ef3582024d8fce48a1b187cb3300672`
- `email-preferences.js`: `e0125da18f1c4041e03cd4d52704ffe8a428c954999367ef37d058a0da56fdb0`
- `job-alerts-page.js`: `7c250fd63eb10752cbd80d842eb18600ccf5550e16799370a09a23a574328062`
- `job-alerts-webhook.js`: `d8956dcb5a1a4f4c8a43ceb8a7864fcedc4474dd943db70e74fe6eb5c06e3e23`
- `job-alerts.js`: `ff8b2879551dbc4eec3a42d2d14965ee3a4e3c7fd6ba95a96ad5eb22dd92bb6b`
- `job-detail-header.js`: `fa1bbad5a22a8b644645c7655a435a9b2c47b13d7fe08cd3a4106981fc1ccec0`
- `job-detail-read.js`: `1fb47f237ba2d182793fedba945f7b0c39b42735e7a6e3cae044249936381073`
- `job-health-scheduled.js`: `a7ff0f35da92e64067215ff4b802fd639869e6c19e54ad7d8166651a170dc3d7`
- `job-health.js`: `b370750899bfe89acd22f9cdf22051b4d50eb6ee945db897cbb514c06ff602f3`
- `job-location.js`: `2809b8f4a608bebf44c4363fa4e179b01fa4cf62a48acc87b493360a491ed64b`
- `job-section-heading.js`: `84ab46d8ddd894a1f3da6209b7c1f0476a9eaa9af3f9eca880fb34467e864992`
- `job-verification.js`: `c7937c5ff555f64a9a1a413a40e95c01de6f4531fe3e0496f1672b92cb425e33`
- `legal-pages.js`: `80df782566c246a52356b4f4c5492eaa0a873049296355f08c481b12c2b7cf70`
- `lifecycle-config.js`: `33b2019ce533fd49700e6ce4d2687d57d91b6ff3c06c04f0ee6cac5cb562066a`
- `lifecycle-coordination.js`: `b8536682bff583269de0b6f3b54eefd968635da118c27a8e0d4f3afb35c5b01c`
- `lifecycle-email.js`: `b9b894f3d360008c0f9bd54d9339d942c72dc25700128d0bca698413a2fe476f`
- `lifecycle-page.js`: `d669a185e706153e24c506140082461b78cc17103de1610ae7241623b5ba5274`
- `lifecycle-policy.js`: `5a645cc635ea10cef3fecb32cb1dd3556944f100b77a7896a63afa90203d8b2a`
- `lifecycle-templates.js`: `bf0cdde0031c058d56d45d8742366242729de54cd402b4bfa38ff65fbfbf2ad7`
- `notifications.js`: `296af917089fe909bf03ca0201d0d22c7e3c7d13732cc538c7f88f675488bbcf`
- `pro-checkout.js`: `9240c1b365dae1018711d730b7c6d539b6a8da23127346705594c3baf9ae19af`
- `quick-read-availability.js`: `230deb347f37f5d8ed2f286d0bfa1220a61c17ae4c9b96097873dc1d68cbba91`
- `quick-read-diagnostics.js`: `cfdb48412ce0afcf1d19ef2e7b9de80f9d4de44a38c457a27cbdddff32345cd9`
- `quick-read-generation.js`: `8bbacec4b34fcb954c2e5a0adfe47e41e82d4e2815df8a052406cc98f9cee5a6`
- `quick-read-input-bound.js`: `1b93e25ae07cb2f4e9098c6b339c03b1a1e4287a3bead4f9f3c6e60986664ffb`
- `quick-read-presentation.js`: `dd808352d43ef9833cba344af5dba22b20abd5853215be1b1d33c883615e1133`
- `quick-read-provider-diagnostics.js`: `f973a20d5cf39df32e08e8e324a4739cc117d0adba3f825fe1ca477f4b9a9705`
- `quick-read-scheduled.js`: `834da7e43e6d070bc1bc3150718b1377d901717d8e7255f2184a325984b4ff08`
- `quick-read-service.js`: `9387003d32663606734b6ef50eda8f99e61bacc7f7978b09d1e39d5acf4f50e0`
- `quick-read.js`: `ff8479ae277c3bc51455132f306479997642d070ab3dcbf65dabd8c53d96b106`
- `recovery.js`: `360865d20d6d022c21c4ceb23e633d73039eaed15bb618eeb4fb492def6cbdfd`
- `render.js`: `7dfd0dea0e115c278e96aea50d5daba17dc8990b5d82a933d52d330c32a84d50`
- `signup-protection.js`: `7b3d996e06606207c7359eba9dd207abe4a9eeeeda38a50606b984e73db4d647`
- `strong-matches.js`: `2c3f0efe9b326d81f9079592b7a1b046f3ae6cc40b7212fab718ddd8eaf7ee02`
- `traffic.js`: `5803ae0344c432e5e48ac319c546c9cf51c59ec1254818e6d3bb16a49e51b307`
- `worker.js`: `61cc9047261bd310d24644f2dfad86aff4544bbbe238935c3b6db53904f8a6eb`
