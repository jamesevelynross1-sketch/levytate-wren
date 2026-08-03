# LevyTate authentication email delivery

## Production configuration

- Supabase project: `mpr-consulting` (`lzwcahdgchrkeulmlfqv`)
- Transactional provider: Resend custom SMTP
- Sending region: Ireland (`eu-west-1`)
- Sender and reply address: `LevyTate <hello@levytate.co.uk>`
- SMTP settings required in Supabase: host, port, username, password, sender name and sender address
- SMTP credentials are stored only in Supabase and must never be added to source control or copied into operational logs.

The Resend credential is limited to sending access. Rotate it by creating a replacement sending key, updating the Supabase SMTP password, completing a controlled delivery test, and then revoking the old key.

## Domain authentication

`levytate.co.uk` uses separate records for the existing Microsoft 365 mailbox service and Resend authentication delivery. Do not remove or replace the root Microsoft 365 MX or SPF records.

The authentication sender requires these DNS record categories:

- Resend DKIM TXT record on the provider-supplied selector
- Resend custom return-path MX record on the `send` subdomain
- Resend SPF TXT record on the `send` subdomain
- DMARC TXT record on `_dmarc`, initially in monitoring mode

Use the exact values shown by Resend when rebuilding or rotating this configuration. Never create a second SPF TXT record at the root domain.

## Redirect configuration

The Supabase Site URL remains `http://localhost:3000` until the production application domain is activated in Sprint 2C. The redirect allowlist contains only exact callback URLs for:

- local development: `http://localhost:3000/levytate/auth/callback`
- the protected feature Preview alias
- the current protected validation deployment
- eventual production: `https://www.levytate.co.uk/levytate/auth/callback`

Do not add wildcard Vercel redirects. The production callback being allowlisted does not activate the production domain.

## Email content and security

The magic-link subject is `Your secure LevyTate sign-in link`. The template identifies LevyTate, explains expiry and single use, provides the secure action and fallback URL, and directs support replies to `hello@levytate.co.uk`. It contains no role, organisation, learner, application, beta-code or workspace information.

Supabase verifies the token before LevyTate binds or accepts an identity. LevyTate then resolves the membership, organisation, role, prospect access and active state server-side. A link cannot select a different organisation. Reuse and expired links return to the generic invalid-link state.

## Limits and operational signals

- Supabase project email limit: 10 emails per hour for Early Access validation
- Supabase minimum interval: 60 seconds per user
- Application request limit: 5 requests per 15 minutes per process/IP key
- Application callback limit: 10 attempts per 15 minutes per process/IP key
- Supabase verification limit: 30 attempts per 5 minutes per IP

The application-level limiter is process-local and is not the final production control. Sprint 2B.3 must provide a shared limiter across application instances.

Safe application audit events cover request receipt, provider acceptance, provider failure, verified email identity, first binding and successful sign-in. Resend exposes accepted, delivered, delayed, bounced, complained and failed delivery events in its dashboard/logs. Supabase Auth logs expose request and verification failures. Public login responses must remain generic; raw SMTP or provider errors must never be returned to a user.

During an outage, check Resend domain status and logs, Supabase Auth logs and rate limits, DNS resolution for DKIM/return-path SPF/DMARC, then perform a single controlled test. Do not repeatedly resend or weaken enumeration resistance.

## Controlled delivery test

Use isolated fictional memberships bound to controlled inboxes, never a prospect. For one Microsoft-hosted and one Google-hosted inbox, record delivery delay, inbox/junk placement, sender display, SPF, DKIM, DMARC, callback result, binding, destination, reuse denial and logout. Remove temporary Auth users and validation membership data after testing where safe.

The protected Preview also requires Vercel Authentication. That protection is separate from LevyTate identity and means an external employer cannot use the Preview without Vercel permission.
