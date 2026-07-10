import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import {
  buildGuidanceAuthorityBreakdown,
  buildGuidanceCategoryBreakdown,
  normaliseGuidanceCategories,
  trustedGuidanceSources,
  type GuidanceAuthorityLevel,
  type GuidanceRefreshFrequency,
  type GuidanceReviewStatus,
  type GuidanceSource,
  type GuidanceSourceStatus,
  type GuidanceSourceType,
} from "@/lib/levytate/guidance/source-registry";
import {
  LevyTateSupabaseError,
  getLevyTateSupabaseConfig,
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from "@/lib/server/levytate-supabase";

const table = "levytate_guidance_sources";

type GuidanceSourceRow = {
  id: string;
  title: string;
  publisher: string;
  source_url: string;
  authority_level: GuidanceAuthorityLevel;
  source_type: GuidanceSourceType;
  guidance_categories: unknown;
  jurisdiction: "England" | "UK";
  funding_year: string | null;
  effective_from: string | null;
  effective_to: string | null;
  applicable_start_date_from: string | null;
  applicable_start_date_to: string | null;
  refresh_frequency: GuidanceRefreshFrequency;
  last_checked_at: string | null;
  last_changed_at: string | null;
  last_reviewed_at: string | null;
  reviewed_by: string | null;
  review_status: GuidanceReviewStatus;
  copilot_approved: boolean;
  source_status: GuidanceSourceStatus;
  content_hash: string | null;
  last_change_summary: string | null;
  automated_check_enabled: boolean;
  monitoring_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type GuidanceSourcesPayload = {
  sources: GuidanceSource[];
  source: "supabase" | "seed_fallback";
  warnings: string[];
  authorityBreakdown: ReturnType<typeof buildGuidanceAuthorityBreakdown>;
  categoryBreakdown: ReturnType<typeof buildGuidanceCategoryBreakdown>;
};

export class GuidanceSourcePermissionError extends Error {
  constructor(message = "Only LevyTate Platform Admin users can update the trusted source registry.") {
    super(message);
    this.name = "GuidanceSourcePermissionError";
  }
}

function rowToGuidanceSource(row: GuidanceSourceRow): GuidanceSource {
  return {
    id: row.id,
    title: row.title,
    publisher: row.publisher,
    sourceUrl: row.source_url,
    authorityLevel: row.authority_level,
    sourceType: row.source_type,
    guidanceCategories: normaliseGuidanceCategories(row.guidance_categories),
    jurisdiction: row.jurisdiction,
    fundingYear: row.funding_year ?? undefined,
    effectiveFrom: row.effective_from ?? undefined,
    effectiveTo: row.effective_to ?? undefined,
    applicableStartDateFrom: row.applicable_start_date_from ?? undefined,
    applicableStartDateTo: row.applicable_start_date_to ?? undefined,
    refreshFrequency: row.refresh_frequency,
    lastCheckedAt: row.last_checked_at ?? undefined,
    lastChangedAt: row.last_changed_at ?? undefined,
    lastReviewedAt: row.last_reviewed_at ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewStatus: row.review_status,
    copilotApproved: row.copilot_approved,
    sourceStatus: row.source_status,
    contentHash: row.content_hash ?? undefined,
    lastChangeSummary: row.last_change_summary ?? undefined,
    automatedCheckEnabled: row.automated_check_enabled,
    monitoringNotes: row.monitoring_notes ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function guidanceSourceToRow(source: GuidanceSource): GuidanceSourceRow {
  return {
    id: source.id,
    title: source.title,
    publisher: source.publisher,
    source_url: source.sourceUrl,
    authority_level: source.authorityLevel,
    source_type: source.sourceType,
    guidance_categories: source.guidanceCategories,
    jurisdiction: source.jurisdiction,
    funding_year: source.fundingYear ?? null,
    effective_from: source.effectiveFrom ?? null,
    effective_to: source.effectiveTo ?? null,
    applicable_start_date_from: source.applicableStartDateFrom ?? null,
    applicable_start_date_to: source.applicableStartDateTo ?? null,
    refresh_frequency: source.refreshFrequency,
    last_checked_at: source.lastCheckedAt ?? null,
    last_changed_at: source.lastChangedAt ?? null,
    last_reviewed_at: source.lastReviewedAt ?? null,
    reviewed_by: source.reviewedBy ?? null,
    review_status: source.reviewStatus,
    copilot_approved: source.copilotApproved,
    source_status: source.sourceStatus,
    content_hash: source.contentHash ?? null,
    last_change_summary: source.lastChangeSummary ?? null,
    automated_check_enabled: source.automatedCheckEnabled,
    monitoring_notes: source.monitoringNotes ?? null,
    notes: source.notes ?? null,
    created_at: source.createdAt,
    updated_at: source.updatedAt,
  };
}

function payload(sources: GuidanceSource[], source: GuidanceSourcesPayload["source"], warnings: string[] = []): GuidanceSourcesPayload {
  return {
    sources,
    source,
    warnings,
    authorityBreakdown: buildGuidanceAuthorityBreakdown(sources),
    categoryBreakdown: buildGuidanceCategoryBreakdown(sources),
  };
}

async function seedGuidanceSourcesIfNeeded() {
  const config = getLevyTateSupabaseConfig();
  if (!config) return;

  const query = new URLSearchParams();
  query.set("select", "id");
  const existingRows = await supabaseSelect<Pick<GuidanceSourceRow, "id">>(config, table, query);
  const existingIds = new Set(existingRows.map((row) => row.id));
  const missingSources = trustedGuidanceSources.filter((source) => !existingIds.has(source.id));
  if (!missingSources.length) return;

  await supabaseInsert<GuidanceSourceRow>(
    config,
    table,
    missingSources.map(guidanceSourceToRow),
    {
      prefer: "resolution=ignore-duplicates,return=minimal",
      query: "on_conflict=id",
    },
  );
}

export async function getGuidanceSources() {
  const config = getLevyTateSupabaseConfig();
  if (!config) {
    return payload(trustedGuidanceSources, "seed_fallback", ["Supabase is not configured. Seeded guidance sources are being used as a fallback."]);
  }

  try {
    await seedGuidanceSourcesIfNeeded();
    const query = new URLSearchParams();
    query.set("select", "*");
    query.set("order", "authority_level.asc,title.asc");
    const rows = await supabaseSelect<GuidanceSourceRow>(config, table, query);
    return payload(rows.map(rowToGuidanceSource), "supabase");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Guidance source registry is unavailable.";
    return payload(trustedGuidanceSources, "seed_fallback", [message]);
  }
}

export async function updateGuidanceSourceForSession(
  session: LevyTateBetaSession,
  id: string,
  patch: Partial<Pick<GuidanceSource, "reviewStatus" | "sourceStatus" | "copilotApproved" | "notes" | "lastChangeSummary" | "monitoringNotes">>,
) {
  if (session.accessLevel !== "beta_admin") {
    throw new GuidanceSourcePermissionError();
  }

  const config = getLevyTateSupabaseConfig();
  if (!config) {
    throw new LevyTateSupabaseError("Supabase is required to update the trusted source registry.");
  }

  const now = new Date().toISOString();
  const body: Partial<GuidanceSourceRow> = {
    updated_at: now,
  };

  if (patch.reviewStatus) {
    body.review_status = patch.reviewStatus;
    if (patch.reviewStatus === "Approved" || patch.reviewStatus === "Reviewed") {
      body.last_reviewed_at = now;
      body.reviewed_by = session.email;
    }
  }
  if (patch.sourceStatus) body.source_status = patch.sourceStatus;
  if (typeof patch.copilotApproved === "boolean") body.copilot_approved = patch.copilotApproved;
  if (typeof patch.notes === "string") body.notes = patch.notes;
  if (typeof patch.lastChangeSummary === "string") body.last_change_summary = patch.lastChangeSummary;
  if (typeof patch.monitoringNotes === "string") body.monitoring_notes = patch.monitoringNotes;

  const rows = await supabaseUpdate<GuidanceSourceRow>(
    config,
    table,
    `id=eq.${encodeURIComponent(id)}`,
    body,
  );

  if (!rows[0]) {
    throw new LevyTateSupabaseError("Trusted source could not be updated.");
  }

  return rowToGuidanceSource(rows[0]);
}
