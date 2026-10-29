import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { buildEmployerEvidenceExport } from "@/lib/levytate/intelligence/evidence-export";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { AuthenticationDependencyError } from "@/lib/server/levytate-auth-provider-request";
import { getEmployerIntelligenceForSession } from "@/lib/server/levytate-employer-intelligence";
import { getLearnerLifecycleServerContext, LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
import { normaliseMvpUserRole } from "@/lib/levytate/mvp/rbac";
import { ClientRequestError, readAuthenticatedJson, requireActionKeys } from "@/lib/server/levytate-request-boundary";
import { getLevyTateSupabaseConfig, supabaseInsert } from "@/lib/server/levytate-supabase";

const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" };

export async function POST(request: Request) {
  try {
    const store = await cookies();
    const token = store.get(levytateBetaSessionCookie)?.value;
    const session = await readAuthorisedLevyTateBetaSession(token);
    if (!session) return failure("Unauthorised.", 401);
    const input = await readAuthenticatedJson(request, session.email, 1024);
    requireActionKeys(input, []); // Tenant and fields are always derived on the server.
    const intelligence = await getEmployerIntelligenceForSession(session);
    const serialised = JSON.stringify(buildEmployerEvidenceExport(intelligence), null, 2);
    // Recheck revocation after loading the sources; never deliver a report after
    // observing a suspension, expired session or changed account.
    const current = await readAuthorisedLevyTateBetaSession(token);
    if (!current || current.email !== session.email) return failure("Unauthorised.", 401);
    const context = await getLearnerLifecycleServerContext(current);
    const currentRole = normaliseMvpUserRole(context.user.role);
    if (context.organisation.id !== intelligence.organisation.id || !["Apprenticeship Lead", "Employer Admin"].includes(currentRole)) return failure("You do not have access to employer evidence exports.", 403);
    const config = getLevyTateSupabaseConfig();
    if (!config) return failure("Evidence export is temporarily unavailable.", 503);
    const exportId = randomUUID();
    const digest = createHash("sha256").update(serialised).digest("hex");
    const rows = await supabaseInsert<{ id: string }>(config, "levytate_audit_events", [{
      id: exportId, organisation_id: intelligence.organisation.id, actor_email: session.email, actor_role: currentRole,
      entity_type: "employer_evidence_export", entity_id: exportId, action: "employer_evidence.prepared",
      summary: "Authorised aggregate evidence prepared for download; delivery is not independently confirmed.",
      metadata: { version: 1, sha256: digest, bytes: Buffer.byteLength(serialised), generatedAt: intelligence.generatedAt }, created_at: new Date().toISOString(),
    }]);
    if (rows.length !== 1 || rows[0].id !== exportId) return failure("Export audit could not be confirmed. No file was delivered.", 503);
    return new Response(serialised, { headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="levytate-employer-evidence-v1.json"', "X-LevyTate-Evidence-SHA256": digest } });
  } catch (error) {
    if (error instanceof ClientRequestError) return failure(error.message, error.status);
    if (error instanceof LevyTateLearnerLifecyclePermissionError) return failure("You do not have access to employer evidence exports.", 403);
    return failure("Evidence export is temporarily unavailable. Please try again.", error instanceof AuthenticationDependencyError ? error.status : 503);
  }
}

function failure(message: string, status: number) { return NextResponse.json({ message }, { status, headers }); }
