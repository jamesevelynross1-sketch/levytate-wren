# LevyTate Microsoft 365 Copilot connector

## Status and boundary

This is the read-only foundation for a Microsoft 365 Copilot custom federated connector. It is disabled by default and is not a Microsoft Graph content sync, public API, provider connector, write assistant or autonomous decision service.

No Microsoft tenant is connected by this change. Migration `031_create_microsoft_copilot_connector_foundation.sql` must be reviewed and approved before any schema-dependent deployment. Production must remain disabled until an Entra application, a Microsoft 365 connector registration, legal metadata, operational ownership and a controlled pilot tenant have all been approved.

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
| `LEVYTATE_ENTRA_CLIENT_ID` | LevyTate Entra application/client identifier used in MCP auth context. |
| `LEVYTATE_ENTRA_AUDIENCE` | Exact access-token audience accepted by LevyTate. |
| `LEVYTATE_MCP_BASE_URL` | Fixed HTTPS public LevyTate origin used for host validation and canonical links. |
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

1. Create or select the approved multi-tenant Entra web API application.
2. Expose the API and configure the exact audience placed in `LEVYTATE_ENTRA_AUDIENCE`.
3. Configure delegated user access for the Microsoft 365 Copilot SSO flow; do not use a shared application key as end-user identity.
4. Configure access-token optional claims only where needed for the first JIT email hint. Email, UPN and `preferred_username` are mutable and must never be the durable identity key.
5. Add the token audience to the Microsoft federated connector SSO registration in the Teams Developer Portal.
6. Register the LevyTate MCP base URL in the Microsoft 365 admin centre and use staged rollout for a controlled test group.
7. Record the external tenant ID against exactly one LevyTate organisation. Do not encode tenant IDs in application code or environment variables.

The API validates the JWT signature using Microsoft signing keys, the exact tenant-specific v2 issuer, exact audience, `exp`, `nbf`, `iat`, `tid`, `oid` and `sub`. Only `tid + oid` is durable. Tokens are held only for request verification and are never logged, persisted or copied into audit metadata.

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

Links are generated on the server from the fixed configured base URL and known LevyTate routes. User input cannot select a host.

## Rate limiting, audit and diagnostics

Requests reuse the distributed Supabase rate-limit store with independent Microsoft identity, network and global minute buckets. If the store is unavailable, the request fails closed.

Authentication denials, JIT binding, allowed tool calls, RBAC denials and errors are written to `levytate_external_connector_events`. Events contain correlation ID, tenant/object identifiers, organisation/user references where known, tool name, outcome, safe error code, result count and duration. They never contain:

- bearer tokens or token fragments;
- request bodies or tool arguments;
- tool results or learner/application content;
- cookies, Supabase credentials or Entra secrets.

The Employer Admin Settings view exposes only a restrained connection status, display label, connected date and last successful activity. It does not expose tenant IDs, object IDs, client IDs, tokens or secrets.

## Failure behaviour

- Missing/invalid/expired/wrong-audience/wrong-issuer tokens: `401` or a safe MCP tool error.
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

1. Approve and apply migration `031` through the migration process.
2. Configure non-Production server variables and keep the global gate off.
3. Create an isolated fictional employer organisation and test users.
4. Insert one inactive connection, verify fail-closed behaviour, then activate it with explicit approval.
5. Enable the organisation capability only for that workspace.
6. Test signature, issuer, audience, expiry, tenant and identity failure cases.
7. Test all four employer roles plus Platform Admin and provider-user denial.
8. Run the MCP initialize → tools/list → tools/call contract test from a Microsoft-compatible client.
9. Confirm audit records and verify that no token, tool payload or result is persisted.
10. Complete legal/security review and only then stage the Microsoft 365 connector to a controlled group.

Production activation is a separate approved change. It must never be inferred from deployment of this foundation.
