import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  createLevyTateBetaSession,
  normaliseBetaEmail,
  type LevyTateBetaSession,
} from "@/lib/levytate/config/beta-access";
import {
  demoPerspectiveOptions,
  isDemoPerspectiveId,
  type DemoPerspectiveId,
  type DemoRoleSwitcherState,
} from "@/lib/levytate/demo-role-switcher";
import { normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import {
  getLevyTateSupabaseConfig,
  supabaseInsert,
  supabaseSelect,
} from "@/lib/server/levytate-supabase";

export const levytateDemoControllerCookie = "levytate_demo_controller";
export const levytateDemoControllerMaxAge = 60 * 30;

const authorisedPreviewBranch = "feature/operational-rbac";
const controllerPurpose = "levytate-demo-controller-v1";

const personaEmails: Record<DemoPerspectiveId, string> = {
  apprenticeship_lead: "apprenticeshiplead.demo@levytate.test",
  line_manager: "manager.demo@levytate.test",
  employee: "employee.demo@levytate.test",
};

type MembershipRow = {
  id: string;
  organisation_id: string;
  email: string;
  role: string;
  active: boolean;
};

type ControllerAuthorisation = {
  purpose: typeof controllerPurpose;
  controllerEmail: string;
  organisationId: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

type ValidatedDemoContext = {
  authorisation: ControllerAuthorisation;
  controller: MembershipRow;
  currentPerspective: DemoPerspectiveId;
  memberships: Record<DemoPerspectiveId, MembershipRow>;
};

export class LevyTateDemoRoleSwitcherError extends Error {
  constructor(
    public code: "disabled" | "unauthorised" | "invalid_request" | "configuration" | "unavailable",
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "LevyTateDemoRoleSwitcherError";
  }
}

export function isDemoRoleSwitcherRuntimeEnabled() {
  if (process.env.LEVYTATE_DEMO_ROLE_SWITCHER_ENABLED?.trim().toLowerCase() !== "true") return false;

  const vercelEnvironment = process.env.VERCEL_ENV?.trim().toLowerCase();
  if (vercelEnvironment === "production") return false;
  if (vercelEnvironment === "preview") {
    return process.env.VERCEL_GIT_COMMIT_REF?.trim() === authorisedPreviewBranch;
  }

  return (
    process.env.NODE_ENV !== "production" &&
    process.env.LEVYTATE_DEMO_ROLE_SWITCHER_LOCAL_ENABLED?.trim().toLowerCase() === "true"
  );
}

export async function createDemoControllerAuthorisation(session: LevyTateBetaSession) {
  assertRuntimeEnabled();
  if (session.authMode !== "internal_beta") {
    throw new LevyTateDemoRoleSwitcherError("unauthorised", "Demo perspectives are unavailable for this session.", 403);
  }

  const controllerEmail = configuredControllerEmail();
  if (session.email !== controllerEmail) {
    throw new LevyTateDemoRoleSwitcherError("unauthorised", "Demo perspectives are unavailable for this session.", 403);
  }

  const cluster = await loadDemoMembershipCluster(controllerEmail);
  const issuedAt = Date.now();
  const authorisation: ControllerAuthorisation = {
    purpose: controllerPurpose,
    controllerEmail,
    organisationId: cluster.organisationId,
    issuedAt,
    expiresAt: issuedAt + levytateDemoControllerMaxAge * 1000,
    nonce: randomUUID(),
  };

  await auditDemoSwitch(cluster.controller, "demo.controller_authorised", {
    outcome: "authorised",
    permittedRoles: demoPerspectiveOptions.map((option) => option.role),
  });

  return signControllerAuthorisation(authorisation);
}

export async function getDemoRoleSwitcherState(
  session: LevyTateBetaSession,
  controllerToken: string | undefined,
): Promise<DemoRoleSwitcherState> {
  const context = await validateDemoContext(session, controllerToken);
  return stateFor(context.currentPerspective, context.authorisation.expiresAt);
}

export async function switchDemoPerspective(
  session: LevyTateBetaSession,
  controllerToken: string | undefined,
  requestedPerspective: unknown,
) {
  if (!isDemoPerspectiveId(requestedPerspective)) {
    throw new LevyTateDemoRoleSwitcherError("invalid_request", "Choose an available demo perspective.", 400);
  }

  const context = await validateDemoContext(session, controllerToken);
  const target = context.memberships[requestedPerspective];
  const expected = demoPerspectiveOptions.find((option) => option.id === requestedPerspective);
  if (!expected || normaliseMvpUserRole(target.role) !== expected.role) {
    throw new LevyTateDemoRoleSwitcherError("unauthorised", "That demo perspective is unavailable.", 403);
  }

  await auditDemoSwitch(context.controller, "demo.perspective_switched", {
    outcome: "successful",
    fromRole: demoPerspectiveOptions.find((option) => option.id === context.currentPerspective)?.role,
    targetRole: expected.role,
    targetMembershipId: target.id,
  });

  const sessionToken = await createLevyTateBetaSession(target.email, "beta_user", {
    authMode: "internal_beta",
  });

  return {
    sessionToken,
    state: stateFor(requestedPerspective, context.authorisation.expiresAt),
  };
}

async function validateDemoContext(
  session: LevyTateBetaSession,
  controllerToken: string | undefined,
): Promise<ValidatedDemoContext> {
  assertRuntimeEnabled();
  if (session.authMode !== "internal_beta") {
    throw new LevyTateDemoRoleSwitcherError("unauthorised", "Demo perspectives are unavailable for this session.", 403);
  }

  const authorisation = readControllerAuthorisation(controllerToken);
  if (!authorisation || authorisation.controllerEmail !== configuredControllerEmail()) {
    throw new LevyTateDemoRoleSwitcherError("unauthorised", "Your demo perspective authorisation has expired. Sign in again.", 401);
  }

  const currentPerspective = perspectiveForEmail(session.email);
  if (!currentPerspective) {
    throw new LevyTateDemoRoleSwitcherError("unauthorised", "Demo perspectives are unavailable for this session.", 403);
  }

  const cluster = await loadDemoMembershipCluster(authorisation.controllerEmail);
  if (cluster.organisationId !== authorisation.organisationId) {
    throw new LevyTateDemoRoleSwitcherError("unauthorised", "Demo perspectives are unavailable for this session.", 403);
  }

  const currentMembership = cluster.memberships[currentPerspective];
  if (normaliseBetaEmail(currentMembership.email) !== session.email) {
    throw new LevyTateDemoRoleSwitcherError("unauthorised", "Demo perspectives are unavailable for this session.", 403);
  }

  return {
    authorisation,
    controller: cluster.controller,
    currentPerspective,
    memberships: cluster.memberships,
  };
}

async function loadDemoMembershipCluster(controllerEmail: string) {
  const uniqueEmails = [...new Set([...Object.values(personaEmails), controllerEmail])];
  const rows = await Promise.all(uniqueEmails.map(loadSingleActiveMembership));
  const byEmail = new Map(rows.map((row) => [normaliseBetaEmail(row.email), row]));
  const organisationIds = new Set(rows.map((row) => row.organisation_id));
  if (organisationIds.size !== 1) {
    throw new LevyTateDemoRoleSwitcherError("unauthorised", "The demo perspectives do not share one authorised workspace.", 403);
  }

  const memberships = Object.fromEntries(
    demoPerspectiveOptions.map((option) => {
      const membership = byEmail.get(personaEmails[option.id]);
      if (!membership || normaliseMvpUserRole(membership.role) !== option.role) {
        throw new LevyTateDemoRoleSwitcherError("unauthorised", `The ${option.label} demo perspective is unavailable.`, 403);
      }
      return [option.id, membership];
    }),
  ) as Record<DemoPerspectiveId, MembershipRow>;

  const controller = byEmail.get(controllerEmail);
  if (!controller) {
    throw new LevyTateDemoRoleSwitcherError("unauthorised", "The demo controller is unavailable.", 403);
  }

  return {
    controller,
    memberships,
    organisationId: rows[0].organisation_id,
  };
}

async function loadSingleActiveMembership(email: string) {
  const config = requireSupabase();
  const rows = await supabaseSelect<MembershipRow>(
    config,
    "levytate_users",
    new URLSearchParams({
      select: "id,organisation_id,email,role,active",
      email: `eq.${normaliseBetaEmail(email)}`,
      limit: "2",
    }),
  );
  if (rows.length !== 1 || !rows[0].active) {
    throw new LevyTateDemoRoleSwitcherError("unauthorised", "A required demo identity is unavailable.", 403);
  }
  return rows[0];
}

async function auditDemoSwitch(
  controller: MembershipRow,
  action: string,
  metadata: Record<string, unknown>,
) {
  await supabaseInsert(
    requireSupabase(),
    "levytate_audit_events",
    [{
      id: randomUUID(),
      organisation_id: controller.organisation_id,
      actor_email: controller.email,
      actor_role: controller.role,
      entity_type: "demo_role_switch",
      entity_id: controller.id,
      action,
      summary: action === "demo.controller_authorised"
        ? "Preview demo controller authorised."
        : "Preview demo perspective switched.",
      metadata,
      created_at: new Date().toISOString(),
    }],
    { prefer: "return=minimal" },
  );
}

function stateFor(currentPerspective: DemoPerspectiveId, expiresAt: number): DemoRoleSwitcherState {
  const current = demoPerspectiveOptions.find((option) => option.id === currentPerspective);
  if (!current) {
    throw new LevyTateDemoRoleSwitcherError("unavailable", "Demo perspectives are temporarily unavailable.", 503);
  }
  return {
    enabled: true,
    currentPerspective,
    currentRole: current.role,
    expiresAt,
    options: demoPerspectiveOptions,
  };
}

function perspectiveForEmail(email: string) {
  const normalised = normaliseBetaEmail(email);
  return demoPerspectiveOptions.find((option) => personaEmails[option.id] === normalised)?.id ?? null;
}

function configuredControllerEmail() {
  const email = normaliseBetaEmail(process.env.LEVYTATE_DEMO_CONTROLLER_EMAIL ?? "");
  if (!email.endsWith(".test") || !perspectiveForEmail(email)) {
    throw new LevyTateDemoRoleSwitcherError("configuration", "Demo perspectives are temporarily unavailable.", 503);
  }
  return email;
}

function assertRuntimeEnabled() {
  if (!isDemoRoleSwitcherRuntimeEnabled()) {
    throw new LevyTateDemoRoleSwitcherError("disabled", "Not found.", 404);
  }
}

function requireSupabase() {
  const config = getLevyTateSupabaseConfig();
  if (!config) {
    throw new LevyTateDemoRoleSwitcherError("configuration", "Demo perspectives are temporarily unavailable.", 503);
  }
  return config;
}

function controllerSecret() {
  const secret = process.env.LEVYTATE_DEMO_ROLE_SWITCHER_SECRET?.trim() ?? "";
  if (secret.length < 32) {
    throw new LevyTateDemoRoleSwitcherError("configuration", "Demo perspectives are temporarily unavailable.", 503);
  }
  return secret;
}

function signControllerAuthorisation(authorisation: ControllerAuthorisation) {
  const payload = Buffer.from(JSON.stringify(authorisation)).toString("base64url");
  const signature = createHmac("sha256", controllerSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readControllerAuthorisation(token: string | undefined) {
  try {
    if (!token) return null;
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return null;
    const expected = createHmac("sha256", controllerSecret()).update(payload).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<ControllerAuthorisation>;
    if (
      value.purpose !== controllerPurpose ||
      typeof value.controllerEmail !== "string" ||
      typeof value.organisationId !== "string" ||
      typeof value.issuedAt !== "number" ||
      typeof value.expiresAt !== "number" ||
      typeof value.nonce !== "string" ||
      value.expiresAt <= Date.now() ||
      value.issuedAt > Date.now() + 60_000 ||
      value.expiresAt - value.issuedAt > levytateDemoControllerMaxAge * 1000
    ) return null;
    return value as ControllerAuthorisation;
  } catch {
    return null;
  }
}
