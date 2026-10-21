# LevyTate Preview credential incident — 21 October 2026

## Scope

A branch-scoped internal demonstration access code was rendered in a browser-automation accessibility diagnostic while validating the protected `feature/operational-rbac` Preview. The affected system was the `levytate-wren` Preview environment. Production configuration and customer data were not involved.

The diagnostic was retained in the private Codex task transcript. Review found the demonstration code in one accessibility-state output. No session cookie, browser authentication state, session-signing secret, demo-controller signing secret, Supabase credential, API key or customer record was present in that output. Transcript access is limited to people who can access the Codex task; the retained tool output cannot be selectively edited or removed with the available task controls.

## Containment and remediation

- Treat the exposed code as compromised and replace it only in the authorised branch-scoped Preview environment.
- Rotate the Preview beta-session and demo-controller signing secrets so credentials issued before the remediation deployment cannot validate on the replacement deployment.
- Keep Vercel Authentication enabled for every Preview deployment.
- Replace the built-in beta-code fallback with fail-closed behaviour whenever `LEVYTATE_BETA_CODE` is absent.
- Mask the access-code field and clear its React state before the asynchronous sign-in request begins.
- Retain the replacement code only in an owner-readable local handoff file outside the repository; do not place it in chat, screenshots, source files or command arguments.

## Diagnostic handling rules

- Never capture an accessibility tree, screenshot, trace, request body, browser storage export or console dump while credentials are populated.
- Never enable request tracing for authentication routes.
- Pass automated test credentials from permission-restricted files or process environment; never from command arguments.
- Store temporary cookie jars and responses with owner-only permissions, report only status and cookie names, and remove them immediately after validation.
- Report access activity using aggregate timestamps, outcomes and route names only. Do not retain IP addresses, cookies, tokens or request payloads in incident notes.

## Immutable deployment containment

The following 42 successful branch Preview deployments were created after the exposed code was configured and retain their original environment snapshot. They remain behind project-level Vercel Authentication, so the exposed code alone cannot cross the outer protection layer. They cannot be made to consume the replacement secret by redeploying or moving an alias. Deleting these immutable deployments is the remaining complete-revocation option and requires separate approval:

```text
dpl_5ck5qFHCJujFez6KFuBDetLXE55p
dpl_D7jZ46Sx1GpHwgDCk8UJ6AniUove
dpl_2FuZZfVgYtkdAdCHXdvhHiPDzLop
dpl_GjA2am2FPVcfqy1kgJrn1Sz5mb7e
dpl_62Uj3uHtAZZrpA6GJHHNn8B8nuif
dpl_8gKpcMGQGSyyefxf3vFyMoD5anZy
dpl_8zgai158S2BrdvNRFNyPqjnLaq7K
dpl_4AbTHygsXmpPmaeegoeMLf6MM3kD
dpl_6o4hkQ4dNvtuYYLab8GwWLRvBbCJ
dpl_4feSYWBnYSEWWGpHSU1y35jFpwx7
dpl_BMF2JeMggKC26gF2QEq8dkPcrfXj
dpl_3GhKx1Jt1VNe8Hs38Gs7ighcR7VN
dpl_9bwyeec6ySTtJrqs2pqxXwVdDhXk
dpl_CBD96y82tCNN92Mf2QR77mkpbsUs
dpl_FEs53ouG6DVoZekShuMUNkDMKAcx
dpl_2qM73xfgsXXMgGZgRAL8sJ1hFVwQ
dpl_EVqm3wREKLQhvdgE6GG5kYHUraTZ
dpl_96gDsjUaKL6nf23bsFqEegmPPAik
dpl_8ijetXmT9KRTLP3PCrRfmUw7MbRc
dpl_FZr32qKdZUNKAGWcyMyQeZKPwF4q
dpl_6AehAagbp7yhRiWt3E2UX2vHqKTS
dpl_8fkfBz961kEXLaEoxvGD68pLhHsY
dpl_2mEwC8CV4VyceAiTVL38HnY5sf9o
dpl_FKUGr8JRjMJp3gzoug53T94gjTe6
dpl_BE2Vvf6BV97hj76iJPPjqfS35Aiz
dpl_4AY24HNNZF8DeJVfFg3ZEfH7wcWX
dpl_7zxYQGoGxa3MV9TWKj4dUNFVjw9D
dpl_5Ysfs6WkCYqdE84zfcWz75RBwdYK
dpl_GYMk4ZXz2naYeoQsiD9HZwG2f9PV
dpl_EUtwKXaKUbAY12dxFyswi4zuoSFd
dpl_FWSrGf4vRCGXsWnzAhbwVs1fVeeK
dpl_4ybLVhfsrmBJcUVa7zTJCfaL2Xmj
dpl_9BMnScEY4BF2LTWdTv6yPTEwLx6T
dpl_9PTJyQMBvtiPdVPPYnTGN9XpdsPb
dpl_DKoXffyEwoKziTxh58UNsKAiibbs
dpl_5rA8nyVGJNuMLALgRZD7H6CUZvRU
dpl_CgBgmY2EyhDKN3m8JqWt9VeXuxX7
dpl_2GhhjaCsSALq3D64xDi8FxJ5sHo2
dpl_HWTKZjvULbS6Q6pSHk1ivcPWi5bX
dpl_4rorD3gHEnocEmtywsP8tDUmmKMP
dpl_6RRaAnfhFSqypjkud2V36MKq5CJF
dpl_2zBgkadx1wXGQSkLhAmqgmdbYULr
```

This record intentionally contains no secret value, credential fingerprint, authentication token or personal/customer data.
