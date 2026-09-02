import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { hasMvpPermission, normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { getLearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";
import { getLevyTateSupabaseConfig, supabaseSelect } from "@/lib/server/levytate-supabase";

type WorkspaceUserRow = {
  id: string;
  organisation_id: string;
  email: string;
  display_name: string;
  role: string;
  active: boolean;
  auth_binding_status: string | null;
};

export type WorkspaceAccessUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  accessState: "Active" | "Inactive";
  authenticationState: "Ready" | "Pending first sign-in";
};

export class WorkspaceAccessError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "WorkspaceAccessError";
  }
}

export async function listWorkspaceAccessUsers(session: LevyTateBetaSession): Promise<WorkspaceAccessUser[]> {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new WorkspaceAccessError("Workspace access information is unavailable.", 503);
  const context = await getLearnerLifecycleServerContext(session);
  if (!hasMvpPermission(context.user.role, "settings:read")) {
    throw new WorkspaceAccessError("You do not have permission to view workspace access.", 403);
  }
  const rows = await supabaseSelect<WorkspaceUserRow>(
    config,
    "levytate_users",
    new URLSearchParams({
      select: "id,organisation_id,email,display_name,role,active,auth_binding_status",
      organisation_id: `eq.${context.organisation.id}`,
      order: "display_name.asc,email.asc",
    }),
  );
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name || row.email,
    role: normaliseMvpUserRole(row.role),
    accessState: row.active ? "Active" : "Inactive",
    authenticationState: row.auth_binding_status === "bound" ? "Ready" : "Pending first sign-in",
  }));
}
