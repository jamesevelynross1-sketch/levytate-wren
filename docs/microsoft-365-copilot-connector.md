# LevyTate Microsoft 365 Copilot connector

## Status and boundary

This is the read-only foundation for a Microsoft 365 Copilot custom federated connector. It is disabled by default and is not a Microsoft Graph content sync, public API, provider connector, write assistant or autonomous decision service.

No Microsoft tenant is connected by this change. Production must remain disabled until an Entra application, a Microsoft 365 connector registration, legal metadata, operational ownership and a controlled pilot tenant have all been approved.

## Architecture

```text
Microsoft 365 Copilot
  -> Microsoft custom federated connector
  -> POST /api/mcp/levytate (Streamable HTTP MCP)
  -> Microsoft Entra bearer token validation
  -> external tenant + external identity resolution
  -> active LevyTate employer membership and canonical role
  -> existing role-scoped LevyTate read services
  -> metadata-only connector audit event
```

The endpoint uses the official `@modelcontextprotocol/server` SDK and supports the MCP initialization, tool discovery and tool-call flow. The server is stateless. It accepts `POST` only, uses a 64 KiB body limit, returns `Cache-Control: no-store`, never creates a browser session and strips `Set-Cookie` from responses.

## Runtime configuration

All values are server-only except the existing public Supabase URL. Do not put values in source control.

| Variable | Purpose |
| --- | --- |
| `LEVYTATE_MICROSOFT_COPILOT_ENABLED` | Global kill switch. Only the exact value `true` enables requests. Default is off. |
| `LEVYTATE_ENTRA_CLIENT_ID` | LevyTate API app registration's client ID GUID. |
| `LEVYTATE_ENTRA_AUDIENCE` | Exact v2 access-token audience. Set to the same client ID GUID as `LEVYTATE_ENTRA_CLIENT_ID`, not the Application ID URI. |
| `LEVYTATE_ENTRA_REQUIRED_SCOPE` | Delegated scope value required in the v2 token's space-delimited `scp` claim. Use `LevyTate.Read`. |
| `LEVYTATE_ENTRA_ALLOWED_CLIENT_ID` | Optional exact v2 `azp` allowlist for the calling Microsoft client. Leave unset until the pilot client is confirmed; when set, missing or different `azp` values fail closed. |
| `LEVYTATE_MCP_BASE_URL` | Fixed HTTPS public MCP service origin used only for request host validation. |
| `LEVYTATE_APP_BASE_URL` | Fixed HTTPS LevyTate application origin used only for links returned by tools. For the pilot, use the stable protected feature Preview origin. |
| `LEVYTATE_ENTRA_ISSUER_BASE_URL` | Optional issuer base for an approved sovereign cloud. Defaults to `https://login.microsoftonline.com`. |
| `LEVYTATE_AUTH_RATE_LIMIT_SECRET` | Existing secret used to HMAC rate-limit dimensions. |
| `NEXT_PUBLIC_SUPABASE_URL` | Existing Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Existing server-only persistence credential. |

The connector also requires:

1. an active `microsoft_entra` row in `levytate_external_tenant_connections`;
2. `microsoft_copilot_enabled = true` for the same organisation in `levytate_organisation_capabilities`;
3. an active external identity binding, or a safe one-time JIT match.

Missing configuration, an absent connection or either disabled gate fails closed.

## Entra application and SSO registration

1. Create or select the LevyTate web API app registration. For the first pilot, use a single-tenant registration. Multi-tenant onboarding requires a later, separately approved tenancy design.
2. Under **Expose an API**, set the Application ID URI to `api://<LEVYTATE_ENTRA_CLIENT_ID>` and expose the delegated scope `LevyTate.Read`.
3. Configure the app to issue v2 access tokens (`requestedAccessTokenVersion: 2`). A v2 token's `aud` is the API app client ID GUID, so set both `LEVYTATE_ENTRA_CLIENT_ID` and `LEVYTATE_ENTRA_AUDIENCE` to that GUID. The scope request remains `api://<client-id>/LevyTate.Read`; the Application ID URI is not the accepted `aud` value.
4. Authorise or preauthorise the Microsoft Enterprise token store client application under **Expose an API** for `LevyTate.Read`. Its documented client ID is `ab3be6b7-f5df-413d-ac2d-abf1e3fd9c0b`. Configure this value in `LEVYTATE_ENTRA_ALLOWED_CLIENT_ID` only after the actual pilot token has confirmed that it is the intended `azp`.
5. Add `https://teams.microsoft.com/api/platform/v1.0/oAuthConsentRedirect` as the Entra Web redirect URI used by the Microsoft SSO consent flow.
6. Register the SSO client in the Teams Developer Portal using the exact MCP base URL and record the generated SSO registration ID. Do not place secrets or access tokens in the app package.
7. Configure the custom federated connector in the Microsoft 365 admin centre with the exact MCP endpoint and the SSO registration ID. Roll it out only to the named pilot test user.
8. Configure access-token optional claims only where needed for the first JIT email hint. Email, UPN and `preferred_username` are mutable and must never be the durable identity key.
9. Record the external tenant ID against exactly one LevyTate organisation. Do not encode tenant IDs in application code or environment variables.

The API validates the JWT signature using Microsoft signing keys, the exact tenant-specific v2 issuer, the client-ID GUID audience, `exp`, `nbf`, `iat`, `tid`, `oid`, `sub`, `ver = 2.0` and delegated `scp`. App-only tokens do not contain `scp` and are denied. If `LEVYTATE_ENTRA_ALLOWED_CLIENT_ID` is configured, the exact v2 `azp` is also required. Only `tid + oid` is durable. Tokens are held only for request verification and are never logged, persisted or copied into audit metadata.

### Audience, scope and caller are distinct

- **Audience (`aud`)** identifies the LevyTate API receiving the v2 token. It is the API app's client ID GUID.
- **Scope (`scp`)** authorises delegated user access. It must include `LevyTate.Read`; application-role (`roles`) tokens do not satisfy this check.
- **Authorised party (`azp`)** identifies the client application that obtained the token. The optional server allowlist can bind the pilot to the confirmed Microsoft Enterprise token store client.

## External identity binding

Existing active bindings are resolved by `provider + external_tenant_id + external_object_id`.

Just-in-time binding is permitted only when all of these statements are true:

- the Microsoft tenant is explicitly connected and active;
- the organisation capability is enabled;
- the token is fully verified;
- an email-like claim exactly matches one active LevyTate user in that organisation;
- that user has no conflicting Microsoft identity binding;
- the role is an employer role supported by the connector.

The JIT event is audited. Subsequent requests use the immutable tenant/object binding and do not authorize by email. Ambiguous, inactive, cross-organisation, revoked, Platform Admin and provider-user cases are denied.

## Role and tenancy enforcement

- **Employer Admin:** organisation-wide reads allowed only where the existing role has the relevant permission.
- **Apprenticeship Lead:** organisation-wide operational reads allowed under existing permissions.
- **Line Manager:** employees, applications, learners, reviews and actions remain limited to the manager and current direct reports by the existing `employee.manager_id` scope.
- **Employee:** application, learner and programme data remains self-scoped. Organisation operations and Finance are denied.
- **Platform Admin:** denied employer connector data by default.
- **Provider users:** not resolvable through employer external identities and receive no employer workspace access.

Every service call revalidates the active LevyTate user, organisation and role. A role or access change therefore applies on the next request.

## Read-only tools

All tools advertise `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true` and `openWorldHint: false`.

| Tool | Returns | Primary scope |
| --- | --- | --- |
| `get_operations_brief` | Current deterministic Operations Autopilot brief | Employer Admin / Apprenticeship Lead |
| `list_autopilot_signals` | Bounded current signal list | Employer Admin / Apprenticeship Lead |
| `list_upcoming_reviews` | Bounded upcoming learner reviews | Existing lifecycle scope |
| `list_operational_actions` | Bounded operational action list | Organisation scope or direct reports for Line Manager |
| `get_learner_summary` | One scoped learner summary | Existing lifecycle scope |
| `list_applications` | Bounded application list | Existing application scope |
| `get_levy_summary` | Aggregate DAS/levy totals | Existing `finance:read` permission |
| `list_my_providers` | Organisation-selected providers | Existing provider scope |
| `list_my_programmes` | Organisation-selected programmes | Existing provider scope |
| `get_provider_summary` | Factual selected-provider summary | Existing provider scope |

There is no raw table query, SQL tool, search-across-tenants tool, mutation tool, Copilot write action or Platform Admin override. Returned records are explicit projections rather than raw database rows. Limits are capped at 50 records.

Links are generated on the server from `LEVYTATE_APP_BASE_URL` and known LevyTate routes. The MCP service independently validates its host against `LEVYTATE_MCP_BASE_URL`. User and tool input cannot select either host, and an absolute, protocol-relative or non-HTTP URL falls back to the safe LevyTate application route.

## Rate limiting, audit and diagnostics

Requests reuse the distributed Supabase rate-limit store with independent Microsoft identity, network and global minute buckets. If the store is unavailable, the request fails closed.

Authentication denials, JIT binding, allowed tool calls, RBAC denials and errors are written to `levytate_external_connector_events`. Events contain correlation ID, tenant/object identifiers, organisation/user references where known, tool name, outcome, safe error code, result count and duration. They never contain:

- bearer tokens or token fragments;
- request bodies or tool arguments;
- tool results or learner/application content;
- cookies, Supabase credentials or Entra secrets.

The Employer Admin Settings view exposes only a restrained connection status, display label, connected date and last successful activity. It does not expose tenant IDs, object IDs, client IDs, tokens or secrets.

## Failure behaviour

- Missing/invalid/expired/wrong-audience/wrong-issuer/wrong-scope/wrong-caller tokens: `401` or a safe MCP tool error. Responses do not reveal the expected audience, scope or caller.
- Unconnected/suspended tenant, disabled organisation or invalid binding: `403` with a generic message.
- Unsupported role or out-of-scope record: denied/not found without confirming cross-tenant existence.
- Rate limit exceeded: `429`.
- Persistence/configuration failure: `503` without provider or database detail.
- Unsupported HTTP methods: `405`.

Every response has a correlation ID. Operational logs must use that ID and safe outcome codes only.

## Legal and Microsoft listing readiness

The current LevyTate public privacy, terms and support routes provide a foundation, but launch approval must explicitly confirm that they cover Microsoft 365 Copilot federated access, identity binding, query-time data retrieval, metadata-only audit retention and subprocessors. Before a real tenant is connected, record:

- developer/company name and website;
- privacy policy URL;
- terms URL;
- support URL and escalation owner;
- security contact and incident process;
- data categories returned by each tool;
- retention period for connector audit metadata;
- Microsoft tenant admin consent and staged-rollout owner;
- removal/revocation process for tenant and identity bindings.

## Controlled rollout checklist

1. Confirm the Entra app is single-tenant for the pilot and uses access-token version 2.
2. Confirm the Application ID URI is `api://<client-id>` and expose the delegated `LevyTate.Read` scope.
3. Authorise or preauthorise the Microsoft Enterprise token store client for that delegated scope.
4. Register the Teams/Microsoft consent redirect URI exactly as documented above.
5. Create the Teams Developer Portal SSO registration against the exact public MCP base URL and record its SSO registration ID.
6. Set the non-secret client-ID GUID as both `LEVYTATE_ENTRA_CLIENT_ID` and `LEVYTATE_ENTRA_AUDIENCE`; set `LEVYTATE_ENTRA_REQUIRED_SCOPE=LevyTate.Read`.
7. Inspect one controlled pilot token before enabling `LEVYTATE_ENTRA_ALLOWED_CLIENT_ID`; then set it only to the confirmed caller client ID.
8. Configure the Microsoft 365 admin centre custom federated connector with the exact MCP endpoint and SSO registration ID.
9. Restrict staged rollout to one approved pilot test user. Do not connect a real customer organisation.
10. Insert one inactive fictional tenant connection, verify fail-closed behaviour, then activate it with explicit approval.
11. Enable the organisation capability only for that fictional pilot workspace.
12. Test signature, issuer, GUID audience, delegated scope, optional caller, expiry, tenant and identity failure cases.
13. Test all four employer roles plus Platform Admin and provider-user denial.
14. Run the MCP initialize → tools/list → tools/call contract test from a Microsoft-compatible client.
15. Confirm returned links use the protected LevyTate app origin rather than the public MCP host.
16. Confirm audit records and verify that no token, tool payload or result is persisted.
17. Complete legal/security review and only then stage the Microsoft 365 connector to the controlled group.

Production activation is a separate approved change. It must never be inferred from deployment of this foundation.
