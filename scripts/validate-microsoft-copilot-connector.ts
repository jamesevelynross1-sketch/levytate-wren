import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { generateKeyPair, SignJWT } from "jose";
import { NextRequest } from "next/server";
import { GET as getMcpHealth } from "../app/api/mcp/health/route";
import { microsoftCopilotToolNames, type MicrosoftCopilotActor } from "../lib/levytate/microsoft-copilot";
import { buildMicrosoftCopilotOperationsPortfolio } from "../lib/levytate/microsoft-copilot-portfolio";
import { permissionsForMvpRole } from "../lib/levytate/mvp/rbac";
import { createMicrosoftCopilotMcpServer } from "../lib/server/levytate-microsoft-copilot-mcp";
import {
  getMicrosoftCopilotAppBaseUrl,
  getMicrosoftCopilotConnectorBaseUrl,
  getMicrosoftCopilotConnectorConfig,
  microsoftCopilotCanonicalUrl,
} from "../lib/server/levytate-microsoft-copilot-config";
import { verifyEntraAccessToken } from "../lib/server/levytate-microsoft-copilot-identity";
import { middleware } from "../middleware";

const root = process.cwd();
const checks: string[] = [];
const tenantId = "11111111-1111-4111-8111-111111111111";
const objectId = "22222222-2222-4222-8222-222222222222";
const audience = "77777777-7777-4777-8777-777777777777";
const allowedClientId = "88888888-8888-4888-8888-888888888888";
const requiredScope = "LevyTate.Read";
const issuerBaseUrl = new URL("https://login.microsoftonline.com");
const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
const now = Math.floor(Date.now() / 1000);
const mutableEnvironment = process.env as Record<string, string | undefined>;

async function main() {
  const [configSource, identitySource, routeSource, toolsSource, mcpSource, migration, envExample, middlewareSource, healthSource] = await Promise.all([
    source("lib/server/levytate-microsoft-copilot-config.ts"),
    source("lib/server/levytate-microsoft-copilot-identity.ts"),
    source("app/api/mcp/levytate/route.ts"),
    source("lib/server/levytate-microsoft-copilot-tools.ts"),
    source("lib/server/levytate-microsoft-copilot-mcp.ts"),
    source("supabase/migrations/031_create_microsoft_copilot_connector_foundation.sql"),
    source(".env.example"),
    source("middleware.ts"),
    source("app/api/mcp/health/route.ts"),
  ]);

  check("runtime feature flag defaults closed", envExample.includes("LEVYTATE_MICROSOFT_COPILOT_ENABLED=false"));
  check("Entra client ID is server configured", envExample.includes("LEVYTATE_ENTRA_CLIENT_ID="));
  check("Entra audience is server configured", envExample.includes("LEVYTATE_ENTRA_AUDIENCE="));
  check("delegated scope is server configured", envExample.includes("LEVYTATE_ENTRA_REQUIRED_SCOPE=LevyTate.Read"));
  check("optional calling client is server configured", envExample.includes("LEVYTATE_ENTRA_ALLOWED_CLIENT_ID="));
  check("MCP base URL is server configured", envExample.includes("LEVYTATE_MCP_BASE_URL="));
  check("application base URL is server configured separately", envExample.includes("LEVYTATE_APP_BASE_URL="));
  check("MCP staging-only mode defaults closed", envExample.includes("LEVYTATE_MCP_STAGING_ONLY=false"));
  check("staging-only mode is enforced at the request boundary", middlewareSource.includes("isAllowedLevyTateMcpStagingRequest"));
  check("request boundary covers API routes", middlewareSource.includes('matcher: ["/:path*"]'));
  check("health response is bounded to approved metadata", healthSource.includes('service: "levytate-mcp"') && healthSource.includes('environment: "staging"') && healthSource.includes('status: "ready"'));
  check("tenant IDs are not hard-coded in connector source", !/tenant[_-]?id\s*=\s*["'][0-9a-f]{8}-/i.test(identitySource));
  check("JWT signature uses jose jwtVerify", identitySource.includes("jwtVerify(token, jwks"));
  check("remote Microsoft JWKS is configured", identitySource.includes("/common/discovery/v2.0/keys"));
  check("only RS256 is accepted", identitySource.includes('algorithms: ["RS256"]'));
  check("exact audience validation is configured", identitySource.includes("audience: expectedAudience"));
  check("delegated scope is enforced after signature verification", identitySource.includes("scopes.includes(requiredScope)"));
  check("optional authorised party is enforced after signature verification", identitySource.includes("payload.azp.toLowerCase() !== allowedClientId.toLowerCase()"));
  check("client ID and audience must be the same GUID", configSource.includes("audience.toLowerCase() !== clientId.toLowerCase()"));
  check("tenant-specific issuer validation is configured", identitySource.includes("issuer: verifiedIssuer"));
  check("expiry and not-before claims are required", identitySource.includes('"exp"') && identitySource.includes('"nbf"'));
  check("stable tenant and object claims are required", identitySource.includes('requiredGuidClaim(payload, "tid")') && identitySource.includes('requiredGuidClaim(payload, "oid")'));
  check("subject claim is required", identitySource.includes('"sub"'));
  check("bearer tokens are not written to audit records", !/external_connector_events[\s\S]{0,1200}\btoken\b/i.test(migration));
  check("connector endpoint is POST only", routeSource.includes('Allow: "POST"'));
  check("MCP route does not use LevyTate or provider cookie authentication", !routeSource.includes("levytateBetaSessionCookie") && !routeSource.includes("levytateProviderSessionCookie"));
  check("request host validation only requires the MCP base URL", routeSource.includes("getMicrosoftCopilotConnectorBaseUrl"));
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
  check("Operations Brief retains its existing attention summary", toolsSource.includes("brief: workspace.brief") && toolsSource.includes("topAttention") && toolsSource.includes("openSignalCount"));
  check("Operations Brief now includes the deterministic portfolio summary", toolsSource.includes("portfolio: buildMicrosoftCopilotOperationsPortfolio"));
  check("Microsoft Operations reads use the durable actor path", toolsSource.includes("getAutopilotWorkspaceForMicrosoftCopilotActor(actor)") && !toolsSource.includes("getAutopilotWorkspace(session)"));
  check("Operations Brief description covers portfolio and operational attention", mcpSource.includes("apprenticeship portfolio position") && mcpSource.includes("current operational attention"));
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

  validateOperationsPortfolio();

  const originalStagingOnly = process.env.LEVYTATE_MCP_STAGING_ONLY;
  process.env.LEVYTATE_MCP_STAGING_ONLY = "true";
  try {
    await stagingDenied("staging root is hidden", "/");
    await stagingDenied("staging LevyTate login is hidden", "/levytate/login");
    await stagingDenied("staging LevyTate application is hidden", "/levytate/app");
    await stagingDenied("staging provider workspace is hidden", "/levytate/provider");
    await stagingDenied("staging ordinary employer APIs are hidden", "/api/levytate-workspace");
    await stagingAllowed("staging MCP POST is allowed through the request boundary", "/api/mcp/levytate", "POST");
    await stagingDenied("staging MCP GET is hidden", "/api/mcp/levytate");
    await stagingAllowed("staging health GET is allowed through the request boundary", "/api/mcp/health");
    const health = getMcpHealth();
    check("staging health returns only approved ready metadata", health.status === 200 && JSON.stringify(await health.json()) === JSON.stringify({ service: "levytate-mcp", environment: "staging", status: "ready" }));
  } finally {
    if (originalStagingOnly === undefined) delete process.env.LEVYTATE_MCP_STAGING_ONLY;
    else process.env.LEVYTATE_MCP_STAGING_ONLY = originalStagingOnly;
  }
  check("health endpoint is unavailable outside staging-only mode", getMcpHealth().status === 404);
  const ordinaryPreview = await middleware(new NextRequest("https://preview.example.test/levytate/login"));
  check("normal Preview routing remains unchanged when staging-only mode is off", ordinaryPreview.status === 200 && ordinaryPreview.headers.get("x-middleware-next") === "1");

  const connectorEnvironment = [
    "NODE_ENV",
    "LEVYTATE_ENTRA_CLIENT_ID",
    "LEVYTATE_ENTRA_AUDIENCE",
    "LEVYTATE_ENTRA_REQUIRED_SCOPE",
    "LEVYTATE_ENTRA_ALLOWED_CLIENT_ID",
    "LEVYTATE_MCP_BASE_URL",
    "LEVYTATE_APP_BASE_URL",
  ] as const;
  const originalEnvironment = Object.fromEntries(connectorEnvironment.map((name) => [name, process.env[name]]));
  try {
    mutableEnvironment.NODE_ENV = "production";
    process.env.LEVYTATE_ENTRA_CLIENT_ID = audience;
    process.env.LEVYTATE_ENTRA_AUDIENCE = audience;
    process.env.LEVYTATE_ENTRA_REQUIRED_SCOPE = requiredScope;
    process.env.LEVYTATE_ENTRA_ALLOWED_CLIENT_ID = allowedClientId;
    process.env.LEVYTATE_MCP_BASE_URL = "https://mcp.example.test";
    process.env.LEVYTATE_APP_BASE_URL = "https://app.example.test";
    const config = getMicrosoftCopilotConnectorConfig();
    check("v2 audience accepts the API application client ID GUID", config.audience === audience && config.clientId === audience);
    check("MCP and application origins remain separate", config.mcpBaseUrl.hostname === "mcp.example.test" && config.appBaseUrl.hostname === "app.example.test");
    check("required delegated scope resolves from server configuration", config.requiredScope === requiredScope);
    check("configured authorised party resolves from server configuration", config.allowedClientId === allowedClientId);
    check("Operations link uses only the application origin", microsoftCopilotCanonicalUrl("/levytate/app", { module: "Operations" }) === "https://app.example.test/levytate/app?module=Operations");
    for (const moduleName of ["Applications", "Learners", "Finance", "My Providers", "My Programmes"]) {
      check(`${moduleName} link uses the protected application origin`, new URL(microsoftCopilotCanonicalUrl("/levytate/app", { module: moduleName })).origin === "https://app.example.test");
    }
    check("an absolute user-supplied host cannot replace the application origin", microsoftCopilotCanonicalUrl("https://attacker.example/levytate/app") === "https://app.example.test/levytate/app");
    check("a protocol-relative user-supplied host cannot replace the application origin", microsoftCopilotCanonicalUrl("//attacker.example/levytate/app") === "https://app.example.test/levytate/app");
    check("a javascript URL cannot replace the application origin", microsoftCopilotCanonicalUrl("javascript:alert(1)") === "https://app.example.test/levytate/app");

    process.env.LEVYTATE_ENTRA_AUDIENCE = `api://${audience}`;
    throws("Application ID URI is rejected as a v2 token audience", getMicrosoftCopilotConnectorConfig);
    process.env.LEVYTATE_ENTRA_AUDIENCE = "99999999-9999-4999-8999-999999999999";
    throws("a different audience GUID is rejected", getMicrosoftCopilotConnectorConfig);
    process.env.LEVYTATE_ENTRA_AUDIENCE = audience;
    process.env.LEVYTATE_APP_BASE_URL = "javascript:alert(1)";
    throws("javascript application base URL is rejected", getMicrosoftCopilotAppBaseUrl);
    process.env.LEVYTATE_APP_BASE_URL = "not-a-url";
    throws("malformed application base URL is rejected", getMicrosoftCopilotAppBaseUrl);
    process.env.LEVYTATE_APP_BASE_URL = "http://app.example.test";
    throws("HTTP application base URL is rejected in production", getMicrosoftCopilotAppBaseUrl);
    process.env.LEVYTATE_APP_BASE_URL = "https://app.example.test";
    process.env.LEVYTATE_MCP_BASE_URL = "http://mcp.example.test";
    throws("HTTP MCP base URL is rejected in production", getMicrosoftCopilotConnectorBaseUrl);
  } finally {
    for (const name of connectorEnvironment) {
      const value = originalEnvironment[name];
      if (value === undefined) delete mutableEnvironment[name];
      else mutableEnvironment[name] = value;
    }
  }

  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const validToken = await sign(privateKey);
  const verified = await verifyEntraAccessToken(validToken, { audience, issuerBaseUrl, key: publicKey, requiredScope });
  check("valid signed Entra token is accepted", verified.tenantId === tenantId);
  check("verified identity uses oid", verified.objectId === objectId);
  check("email is only returned as a binding hint", verified.emailHint === "connector.user@example.test");
  await rejects("Application ID URI audience is rejected", () => sign(privateKey, { aud: `api://${audience}` }).then(verify(publicKey)));
  await rejects("wrong audience token is rejected", () => sign(privateKey, { aud: "api://wrong" }).then(verify(publicKey)));
  await rejects("wrong issuer token is rejected", () => sign(privateKey, { iss: "https://issuer.invalid/v2.0" }).then(verify(publicKey)));
  await rejects("expired token is rejected", () => sign(privateKey, { exp: now - 120 }).then(verify(publicKey)));
  await rejects("future not-before token is rejected", () => sign(privateKey, { nbf: now + 300 }).then(verify(publicKey)));
  const otherKeys = await generateKeyPair("RS256");
  await rejects("wrong signing key is rejected", () => verifyEntraAccessToken(validToken, { audience, issuerBaseUrl, key: otherKeys.publicKey, requiredScope }));
  await rejects("missing oid is rejected", () => sign(privateKey, { oid: undefined }).then(verify(publicKey)));
  await rejects("missing delegated scope claim is rejected", () => sign(privateKey, { scp: undefined }).then(verify(publicKey)));
  await rejects("unrelated delegated scope is rejected", () => sign(privateKey, { scp: "User.Read" }).then(verify(publicKey)));
  const multipleScopes = await sign(privateKey, { scp: `User.Read ${requiredScope} offline_access` });
  check("multiple delegated scopes including the required scope are accepted", (await verify(publicKey)(multipleScopes)).scopes.includes(requiredScope));
  await rejects("app-only token without delegated scope is rejected", () => sign(privateKey, { scp: undefined, roles: [requiredScope], idtyp: "app" }).then(verify(publicKey)));
  const allowedCallerToken = await sign(privateKey, { azp: allowedClientId });
  check("configured authorised party is accepted", (await verify(publicKey, allowedClientId)(allowedCallerToken)).objectId === objectId);
  await rejects("missing authorised party is rejected when configured", () => verify(publicKey, allowedClientId)(validToken));
  await rejects("wrong authorised party is rejected when configured", () => sign(privateKey, { azp: "99999999-9999-4999-8999-999999999999" }).then(verify(publicKey, allowedClientId)));
  await rejects("non-v2 access token is rejected", () => sign(privateKey, { ver: "1.0" }).then(verify(publicKey)));

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

  console.log(`Microsoft 365 Copilot connector validation passed (${checks.length}/${checks.length}).`);
}

async function sign(privateKey: CryptoKey, overrides: Record<string, unknown> = {}) {
  const payload: Record<string, unknown> = {
    tid: tenantId,
    oid: objectId,
    sub: "stable-subject",
    email: "connector.user@example.test",
    scp: requiredScope,
    ver: "2.0",
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

function verify(publicKey: CryptoKey, configuredAllowedClientId?: string) {
  return (token: string) => verifyEntraAccessToken(token, {
    audience,
    allowedClientId: configuredAllowedClientId,
    issuerBaseUrl,
    key: publicKey,
    requiredScope,
  });
}

async function rejects(name: string, action: () => Promise<unknown>) {
  let rejected = false;
  try { await action(); } catch { rejected = true; }
  check(name, rejected);
}

function throws(name: string, action: () => unknown) {
  let rejected = false;
  try { action(); } catch { rejected = true; }
  check(name, rejected);
}

function check(name: string, condition: unknown) {
  assert.ok(condition, name);
  checks.push(name);
}

async function stagingDenied(name: string, pathname: string, method = "GET") {
  const response = await middleware(new NextRequest(`https://mcp.example.test${pathname}`, { method }));
  check(name, response.status === 404 && response.headers.get("cache-control")?.includes("no-store"));
}

async function stagingAllowed(name: string, pathname: string, method = "GET") {
  const response = await middleware(new NextRequest(`https://mcp.example.test${pathname}`, { method }));
  check(name, response.status === 200 && response.headers.get("x-middleware-next") === "1");
}

function sameMembers(left: string[], right: string[]) {
  return left.length === right.length && [...left].sort().every((item, index) => item === [...right].sort()[index]);
}

function occurrences(value: string, search: string) {
  return value.split(search).length - 1;
}

function validateOperationsPortfolio() {
  const today = "2026-10-08";
  const input = {
    learnerRecords: [
      learner("learner-1", "application-live", "programme-1", "enrolled"),
      learner("learner-2", "application-complete-2", "programme-1", "break_in_learning"),
      learner("learner-3", "application-complete-3", "programme-2", "assessment_preparation"),
      learner("learner-4", "application-complete-4", "programme-3", "in_assessment"),
      learner("learner-5", "application-pre", "programme-3", "pre_enrolment"),
      learner("learner-6", "application-achieved", "programme-3", "achieved"),
      { ...learner("learner-7", "application-archived", "programme-3", "enrolled"), recordStatus: "Archived" },
    ],
    applications: [
      application("application-live", "Approved for Enrolment"),
      application("application-pipeline-1", "Awaiting Manager Review"),
      application("application-pipeline-2", "Approved for Enrolment"),
      application("application-terminal", "Completed"),
    ],
    learnerReviews: [
      review("review-1-old", "learner-1", "2026-08-01", "2026-10-10"),
      review("review-1-latest", "learner-1", "2026-09-01", "2026-10-30"),
      review("review-2-old", "learner-2", "2026-08-15", "2026-10-11"),
      review("review-2-latest", "learner-2", "2026-09-15", "2026-10-12"),
      review("review-3", "learner-3", "2026-09-20", "2026-10-22"),
      review("review-4", "learner-4", "2026-09-20", "2026-10-23"),
      { ...review("review-cancelled", "learner-4", "2026-09-21", "2026-10-09"), status: "cancelled" },
    ],
    organisationProviders: [
      { providerId: "provider-1", status: "Active" },
      { providerId: "provider-2", status: "Active" },
      { providerId: "provider-3", status: "Inactive" },
    ],
    organisationProgrammes: [
      { programmeId: "programme-1", providerId: "provider-1", status: "Active" },
      { programmeId: "programme-2", providerId: "provider-1", status: "Active" },
      { programmeId: "programme-3", providerId: "provider-2", status: "Active" },
      { programmeId: "programme-hidden", providerId: "provider-3", status: "Inactive" },
    ],
    providerProgrammes: [
      { id: "programme-1", programmeName: "AI & Automation Practitioner" },
      { id: "programme-2", programmeName: "Data Analyst" },
      { id: "programme-3", programmeName: "Team Leader" },
    ],
  } as unknown as Parameters<typeof buildMicrosoftCopilotOperationsPortfolio>[0];
  const portfolio = buildMicrosoftCopilotOperationsPortfolio(input, today);
  check("portfolio counts active learner lifecycle states only", portfolio.activeLearners === 4);
  check("portfolio counts non-terminal applications without live learner records", portfolio.preEnrolmentApplications === 2);
  check("portfolio counts each active learner's latest due provider review once", portfolio.providerReviewsDueNext14Days === 2);
  check("portfolio counts active organisation provider selections", portfolio.selectedProviderCount === 2);
  check("portfolio counts active organisation programme selections", portfolio.selectedProgrammeCount === 3);
  check("portfolio aggregates programme mix without learner detail", JSON.stringify(portfolio.programmeMix) === JSON.stringify([
    { programmeName: "AI & Automation Practitioner", activeLearnerCount: 2 },
    { programmeName: "Data Analyst", activeLearnerCount: 1 },
    { programmeName: "Team Leader", activeLearnerCount: 1 },
  ]));
  check("portfolio contains no learner PII fields", !/employee|email|learnerName|manager/i.test(JSON.stringify(portfolio)));
  const empty = buildMicrosoftCopilotOperationsPortfolio({ applications: [], learnerRecords: [], learnerReviews: [], organisationProviders: [], organisationProgrammes: [], providerProgrammes: [] }, today);
  check("portfolio zero-data behaviour is stable", Object.values({ ...empty, programmeMix: undefined }).every((value) => value === 0 || value === undefined) && empty.programmeMix.length === 0);

  const manyProgrammes = Array.from({ length: 25 }, (_, index) => ({ id: `bounded-${index}`, programmeName: `Programme ${String(index).padStart(2, "0")}` }));
  const bounded = buildMicrosoftCopilotOperationsPortfolio({
    applications: [], learnerReviews: [], organisationProviders: [], organisationProgrammes: [],
    providerProgrammes: manyProgrammes,
    learnerRecords: manyProgrammes.map((programme, index) => learner(`bounded-learner-${index}`, `bounded-application-${index}`, programme.id, "enrolled")),
  } as unknown as Parameters<typeof buildMicrosoftCopilotOperationsPortfolio>[0], today);
  check("programme mix is bounded", bounded.programmeMix.length === 20);
}

function learner(id: string, applicationId: string, programmeId: string, lifecycleStatus: string) {
  return { id, applicationId, programmeId, lifecycleStatus, recordStatus: "Active" };
}

function application(id: string, status: string) {
  return { id, status };
}

function review(id: string, learnerRecordId: string, reviewDate: string, nextReviewDate: string) {
  return { id, learnerRecordId, reviewType: "provider_review", reviewDate, nextReviewDate, status: "completed", updatedAt: `${reviewDate}T09:00:00.000Z` };
}

function source(path: string) {
  return readFile(`${root}/${path}`, "utf8");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
