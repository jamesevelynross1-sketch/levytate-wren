import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { generateKeyPair, SignJWT } from "jose";
import { microsoftCopilotToolNames, type MicrosoftCopilotActor } from "../lib/levytate/microsoft-copilot";
import { permissionsForMvpRole } from "../lib/levytate/mvp/rbac";
import { createMicrosoftCopilotMcpServer } from "../lib/server/levytate-microsoft-copilot-mcp";
import { verifyEntraAccessToken } from "../lib/server/levytate-microsoft-copilot-identity";

const root = process.cwd();
const checks: string[] = [];
const tenantId = "11111111-1111-4111-8111-111111111111";
const objectId = "22222222-2222-4222-8222-222222222222";
const audience = "api://levytate-mcp-test";
const issuerBaseUrl = new URL("https://login.microsoftonline.com");
const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
const now = Math.floor(Date.now() / 1000);

async function main() {
  const [identitySource, routeSource, toolsSource, mcpSource, migration, envExample] = await Promise.all([
    source("lib/server/levytate-microsoft-copilot-identity.ts"),
    source("app/api/mcp/levytate/route.ts"),
    source("lib/server/levytate-microsoft-copilot-tools.ts"),
    source("lib/server/levytate-microsoft-copilot-mcp.ts"),
    source("supabase/migrations/031_create_microsoft_copilot_connector_foundation.sql"),
    source(".env.example"),
  ]);

  check("runtime feature flag defaults closed", envExample.includes("LEVYTATE_MICROSOFT_COPILOT_ENABLED=false"));
  check("Entra client ID is server configured", envExample.includes("LEVYTATE_ENTRA_CLIENT_ID="));
  check("Entra audience is server configured", envExample.includes("LEVYTATE_ENTRA_AUDIENCE="));
  check("MCP base URL is server configured", envExample.includes("LEVYTATE_MCP_BASE_URL="));
  check("tenant IDs are not hard-coded in connector source", !/tenant[_-]?id\s*=\s*["'][0-9a-f]{8}-/i.test(identitySource));
  check("JWT signature uses jose jwtVerify", identitySource.includes("jwtVerify(token, jwks"));
  check("remote Microsoft JWKS is configured", identitySource.includes("/common/discovery/v2.0/keys"));
  check("only RS256 is accepted", identitySource.includes('algorithms: ["RS256"]'));
  check("exact audience validation is configured", identitySource.includes("audience: expectedAudience"));
  check("tenant-specific issuer validation is configured", identitySource.includes("issuer: verifiedIssuer"));
  check("expiry and not-before claims are required", identitySource.includes('"exp"') && identitySource.includes('"nbf"'));
  check("stable tenant and object claims are required", identitySource.includes('requiredGuidClaim(payload, "tid")') && identitySource.includes('requiredGuidClaim(payload, "oid")'));
  check("subject claim is required", identitySource.includes('"sub"'));
  check("bearer tokens are not written to audit records", !/external_connector_events[\s\S]{0,1200}\btoken\b/i.test(migration));
  check("connector endpoint is POST only", routeSource.includes('Allow: "POST"'));
  check("connector response removes cookies", routeSource.includes('headers.delete("set-cookie")'));
  check("connector responses disable caching", routeSource.includes('"Cache-Control", "no-store, max-age=0"'));
  check("connector body is bounded to 64 KiB", mcpSource.includes("maxRequestBodySize: 64 * 1024"));
  check("distributed identity rate limiting is used", routeSource.includes("checkMicrosoftCopilotRequestLimits"));
  check("correlation IDs are returned", routeSource.includes("X-LevyTate-Correlation-Id"));
  check("all ten approved tools are declared", microsoftCopilotToolNames.length === 10);
  check("MCP surface contains no mutation tool names", microsoftCopilotToolNames.every((name) => !/create|update|delete|approve|decline|complete|write|send/.test(name)));
  check("tools advertise read-only annotations", mcpSource.includes("readOnlyHint: true"));
  check("tools advertise non-destructive annotations", mcpSource.includes("destructiveHint: false"));
  check("tool result lists are capped at 50", toolsSource.includes("boundedLimit(args.limit, 20, 50)"));
  check("Line Manager actions use read-only direct-report service", toolsSource.includes("listManagerDirectReportOperationalActionsReadOnly"));
  check("learner detail reuses lifecycle service", toolsSource.includes("getOrganisationLearnerLifecycleRecordDetail"));
  check("Finance reuses existing Finance service", toolsSource.includes("getOrganisationFinanceState"));
  check("Employer Admin retains finance read", permissionsForMvpRole("Employer Admin").includes("finance:read"));
  check("Apprenticeship Lead retains finance read", permissionsForMvpRole("Apprenticeship Lead").includes("finance:read"));
  check("Line Manager has no organisation finance read", !permissionsForMvpRole("Line Manager").includes("finance:read"));
  check("Employee has no organisation finance read", !permissionsForMvpRole("Employee").includes("finance:read"));
  check("Platform Admin has no employer Finance access", !permissionsForMvpRole("Platform Admin").includes("finance:read"));
  check("migration is additive", !/\b(drop\s+table|truncate|delete\s+from)\b/i.test(migration));
  check("migration adds organisation capability default off", /microsoft_copilot_enabled boolean not null default false/i.test(migration));
  check("migration creates tenant connections", migration.includes("create table if not exists public.levytate_external_tenant_connections"));
  check("tenant to organisation mapping is unique and immutable", migration.includes("levytate_external_tenant_connections_provider_tenant_unique") && migration.includes("levytate_external_tenant_connections_identity_immutable"));
  check("migration creates durable external identities", migration.includes("create table if not exists public.levytate_external_identities"));
  check("external identity uses immutable tenant and object key", migration.includes("levytate_external_identities_subject_unique") && migration.includes("levytate_external_identities_key_immutable"));
  check("migration creates fixed-column metadata-only audit", migration.includes("create table if not exists public.levytate_external_connector_events") && !migration.includes("metadata jsonb"));
  check("connector tables force RLS", occurrences(migration, "force row level security") === 3);
  check("anon and authenticated roles are revoked from all connector tables", [
    "levytate_external_tenant_connections",
    "levytate_external_identities",
    "levytate_external_connector_events",
  ].every((table) => migration.includes(`revoke all on table public.${table} from public, anon, authenticated`)));
  check("audit table is explicitly append-only for service role", migration.includes("revoke all privileges on table public.levytate_external_connector_events from service_role") && migration.includes("grant select, insert on table public.levytate_external_connector_events to service_role"));

  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const validToken = await sign(privateKey);
  const verified = await verifyEntraAccessToken(validToken, { audience, issuerBaseUrl, key: publicKey });
  check("valid signed Entra token is accepted", verified.tenantId === tenantId);
  check("verified identity uses oid", verified.objectId === objectId);
  check("email is only returned as a binding hint", verified.emailHint === "connector.user@example.test");
  await rejects("wrong audience token is rejected", () => sign(privateKey, { aud: "api://wrong" }).then(verify(publicKey)));
  await rejects("wrong issuer token is rejected", () => sign(privateKey, { iss: "https://issuer.invalid/v2.0" }).then(verify(publicKey)));
  await rejects("expired token is rejected", () => sign(privateKey, { exp: now - 120 }).then(verify(publicKey)));
  await rejects("future not-before token is rejected", () => sign(privateKey, { nbf: now + 300 }).then(verify(publicKey)));
  const otherKeys = await generateKeyPair("RS256");
  await rejects("wrong signing key is rejected", () => verifyEntraAccessToken(validToken, { audience, issuerBaseUrl, key: otherKeys.publicKey }));
  await rejects("missing oid is rejected", () => sign(privateKey, { oid: undefined }).then(verify(publicKey)));

  const actor: MicrosoftCopilotActor = {
    organisationId: "33333333-3333-4333-8333-333333333333",
    organisationName: "Connector Test Employer",
    userId: "44444444-4444-4444-8444-444444444444",
    email: "connector.user@example.test",
    role: "Apprenticeship Lead",
    tenantId,
    objectId,
    identityId: "55555555-5555-4555-8555-555555555555",
  };
  const fakeExecutor = async (input: { toolName: string }) => ({ count: 1, tool: input.toolName, link: "https://example.test/levytate/app" });
  const server = createMicrosoftCopilotMcpServer(actor, "66666666-6666-4666-8666-666666666666", fakeExecutor as never);
  const client = new Client({ name: "levytate-connector-validation", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const toolList = await client.listTools();
  check("official MCP initialize handshake completes", client.getServerVersion()?.name === "LevyTate");
  check("official MCP tools/list returns ten tools", toolList.tools.length === 10);
  check("official MCP tools/list returns exact approved names", sameMembers(toolList.tools.map((tool) => tool.name), [...microsoftCopilotToolNames]));
  check("official MCP tools/call returns structured content", Boolean((await client.callTool({ name: "get_operations_brief", arguments: {} })).structuredContent));
  await client.close();
  await server.close();

  assert.equal(checks.length, 56, `Expected exactly 56 connector checks, received ${checks.length}.`);
  console.log(`Microsoft 365 Copilot connector validation passed (${checks.length}/${checks.length}).`);
}

async function sign(privateKey: CryptoKey, overrides: Record<string, unknown> = {}) {
  const payload: Record<string, unknown> = {
    tid: tenantId,
    oid: objectId,
    sub: "stable-subject",
    email: "connector.user@example.test",
    scp: "access_as_user",
    ...overrides,
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: "validation-key", typ: "JWT" })
    .setIssuer(String(overrides.iss ?? issuer))
    .setAudience(String(overrides.aud ?? audience))
    .setIssuedAt(now)
    .setNotBefore(Number(overrides.nbf ?? now - 5))
    .setExpirationTime(Number(overrides.exp ?? now + 300))
    .sign(privateKey);
}

function verify(publicKey: CryptoKey) {
  return (token: string) => verifyEntraAccessToken(token, { audience, issuerBaseUrl, key: publicKey });
}

async function rejects(name: string, action: () => Promise<unknown>) {
  let rejected = false;
  try { await action(); } catch { rejected = true; }
  check(name, rejected);
}

function check(name: string, condition: unknown) {
  assert.ok(condition, name);
  checks.push(name);
}

function sameMembers(left: string[], right: string[]) {
  return left.length === right.length && [...left].sort().every((item, index) => item === [...right].sort()[index]);
}

function occurrences(value: string, search: string) {
  return value.split(search).length - 1;
}

function source(path: string) {
  return readFile(`${root}/${path}`, "utf8");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
