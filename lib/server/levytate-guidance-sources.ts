import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import {
  approvedGuidanceItemSeeds,
  buildGuidanceAuthorityBreakdown,
  buildGuidanceCategoryBreakdown,
  guidanceSourceAppliesTo,
  isGuidanceSourceCopilotSafe,
  normaliseGuidanceCategories,
  trustedGuidanceSources,
  type GuidanceAuthorityLevel,
  type GuidanceCategory,
  type GuidanceItem,
  type GuidanceItemBody,
  type GuidanceItemReviewStatus,
  type GuidanceItemWithSources,
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
  supabaseDelete,
} from "@/lib/server/levytate-supabase";

const table = "levytate_guidance_sources";
const itemsTable = "levytate_guidance_items";
const itemSourcesTable = "levytate_guidance_item_sources";

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

type GuidanceItemRow = {
  id: string;
  title: string;
  summary: string;
  guidance_category: GuidanceCategory;
  body: string | GuidanceItemBody;
  review_status: GuidanceItemReviewStatus;
  copilot_approved: boolean;
  created_at: string;
  updated_at: string;
};

type GuidanceItemSourceRow = {
  id: string;
  guidance_item_id: string;
  guidance_source_id: string;
  source_role: "Primary" | "Supporting" | "Interpretation";
  created_at: string;
};

export type GuidanceSourcesPayload = {
  sources: GuidanceSource[];
  source: "supabase" | "seed_fallback";
  warnings: string[];
  authorityBreakdown: ReturnType<typeof buildGuidanceAuthorityBreakdown>;
  categoryBreakdown: ReturnType<typeof buildGuidanceCategoryBreakdown>;
};

export type GuidanceItemsPayload = {
  items: GuidanceItemWithSources[];
  source: "supabase" | "seed_fallback";
  warnings: string[];
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

function parseGuidanceItemBody(value: GuidanceItemRow["body"]): GuidanceItemBody {
  if (typeof value === "object" && value) return value;
  try {
    return JSON.parse(value) as GuidanceItemBody;
  } catch {
    return {
      plainEnglishExplanation: typeof value === "string" ? value : "",
      whyItMatters: "",
      employerAction: "",
      practicalChecklist: [],
      commonMistake: "",
      applicableFundingYear: "",
      effectiveDate: "",
      applicableStartDateFrom: "",
      applicableStartDateTo: "",
      lastReviewedDate: "",
      reviewer: "",
      status: "Unreviewed",
    };
  }
}

function rowToGuidanceItem(row: GuidanceItemRow): GuidanceItem {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    guidanceCategory: row.guidance_category,
    body: parseGuidanceItemBody(row.body),
    reviewStatus: row.review_status,
    copilotApproved: row.copilot_approved,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function guidanceItemToRow(item: GuidanceItem): GuidanceItemRow {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    guidance_category: item.guidanceCategory,
    body: JSON.stringify({ ...item.body, status: item.reviewStatus }),
    review_status: item.reviewStatus,
    copilot_approved: item.copilotApproved,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function seedItemsWithSources(): GuidanceItemWithSources[] {
  return approvedGuidanceItemSeeds.map((item) => ({
    ...item,
    sources: item.sourceIds
      .map((sourceId) => trustedGuidanceSources.find((source) => source.id === sourceId))
      .filter((source): source is GuidanceSource => Boolean(source)),
  }));
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

async function seedGuidanceItemsIfNeeded() {
  const config = getLevyTateSupabaseConfig();
  if (!config) return;

  const itemQuery = new URLSearchParams();
  itemQuery.set("select", "id");
  const existingRows = await supabaseSelect<Pick<GuidanceItemRow, "id">>(config, itemsTable, itemQuery);
  const existingIds = new Set(existingRows.map((row) => row.id));
  const missingItems = approvedGuidanceItemSeeds.filter((item) => !existingIds.has(item.id));

  if (missingItems.length) {
    await supabaseInsert<GuidanceItemRow>(
      config,
      itemsTable,
      missingItems.map(guidanceItemToRow),
      {
        prefer: "resolution=ignore-duplicates,return=minimal",
        query: "on_conflict=id",
      },
    );
  }

  const linkQuery = new URLSearchParams();
  linkQuery.set("select", "id");
  const existingLinks = await supabaseSelect<Pick<GuidanceItemSourceRow, "id">>(config, itemSourcesTable, linkQuery);
  const existingLinkIds = new Set(existingLinks.map((row) => row.id));
  const missingLinks = approvedGuidanceItemSeeds.flatMap((item) =>
    item.sourceIds.map((sourceId) => ({
      id: `${item.id}__${sourceId}`,
      guidance_item_id: item.id,
      guidance_source_id: sourceId,
      source_role: "Primary" as const,
      created_at: item.createdAt,
    })),
  ).filter((link) => !existingLinkIds.has(link.id));

  if (!missingLinks.length) return;

  await supabaseInsert<GuidanceItemSourceRow>(
    config,
    itemSourcesTable,
    missingLinks,
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

export async function getGuidanceItemsForSession(session: LevyTateBetaSession): Promise<GuidanceItemsPayload> {
  return getGuidanceItems({ includeDrafts: session.accessLevel === "beta_admin" });
}

export async function getCopilotGuidanceItems(criteria: { fundingYear?: string; startDate?: string; asOf?: string } = {}) {
  const payload = await getGuidanceItems({ includeDrafts: false, criteria });
  return payload.items.filter((item) => isGuidanceItemCopilotSafe(item, criteria));
}

async function getGuidanceItems(options: { includeDrafts: boolean; criteria?: { fundingYear?: string; startDate?: string; asOf?: string } }): Promise<GuidanceItemsPayload> {
  const config = getLevyTateSupabaseConfig();
  if (!config) {
    const items = filterGuidanceItemsForRole(seedItemsWithSources(), options);
    return { items, source: "seed_fallback", warnings: ["Supabase is not configured. Seeded guidance items are being used as a fallback."] };
  }

  try {
    await seedGuidanceSourcesIfNeeded();
    await seedGuidanceItemsIfNeeded();

    const itemQuery = new URLSearchParams();
    itemQuery.set("select", "*");
    itemQuery.set("order", "title.asc");
    const [itemRows, linkRows, sourcePayload] = await Promise.all([
      supabaseSelect<GuidanceItemRow>(config, itemsTable, itemQuery),
      supabaseSelect<GuidanceItemSourceRow>(config, itemSourcesTable, new URLSearchParams({ select: "*" })),
      getGuidanceSources(),
    ]);

    const sourceById = new Map(sourcePayload.sources.map((source) => [source.id, source]));
    const linksByItemId = new Map<string, GuidanceItemSourceRow[]>();
    for (const link of linkRows) {
      const current = linksByItemId.get(link.guidance_item_id) ?? [];
      current.push(link);
      linksByItemId.set(link.guidance_item_id, current);
    }

    const items = itemRows.map((row) => {
      const item = rowToGuidanceItem(row);
      return {
        ...item,
        sources: (linksByItemId.get(item.id) ?? [])
          .map((link) => sourceById.get(link.guidance_source_id))
          .filter((source): source is GuidanceSource => Boolean(source)),
      };
    });

    return { items: filterGuidanceItemsForRole(items, options), source: "supabase", warnings: sourcePayload.warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Guidance items are unavailable.";
    return { items: filterGuidanceItemsForRole(seedItemsWithSources(), options), source: "seed_fallback", warnings: [message] };
  }
}

function filterGuidanceItemsForRole(items: GuidanceItemWithSources[], options: { includeDrafts: boolean; criteria?: { fundingYear?: string; startDate?: string; asOf?: string } }) {
  return items.filter((item) => {
    if (options.includeDrafts) return true;
    return isGuidanceItemPublished(item, options.criteria);
  });
}

export function isGuidanceItemPublished(item: GuidanceItemWithSources, criteria: { fundingYear?: string; startDate?: string; asOf?: string } = {}) {
  if (!item.sources.length) return false;
  return item.reviewStatus === "Approved"
    && guidanceSourceAppliesTo({
      ...item.sources[0],
      fundingYear: item.body.applicableFundingYear,
      effectiveFrom: item.body.effectiveDate,
      applicableStartDateFrom: item.body.applicableStartDateFrom,
      applicableStartDateTo: item.body.applicableStartDateTo,
    } as GuidanceSource, criteria);
}

export function isGuidanceItemCopilotSafe(item: GuidanceItemWithSources, criteria: { fundingYear?: string; startDate?: string; asOf?: string } = {}) {
  if (!item.sources.length) return false;
  return item.reviewStatus === "Approved"
    && item.copilotApproved
    && item.sources.length > 0
    && guidanceSourceAppliesTo({
      ...item.sources[0],
      fundingYear: item.body.applicableFundingYear,
      effectiveFrom: item.body.effectiveDate,
      applicableStartDateFrom: item.body.applicableStartDateFrom,
      applicableStartDateTo: item.body.applicableStartDateTo,
    } as GuidanceSource, criteria)
    && item.sources.every((source) => isGuidanceSourceCopilotSafe(source, criteria));
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

export async function saveGuidanceItemForSession(
  session: LevyTateBetaSession,
  item: GuidanceItem,
  sourceIds: string[],
) {
  if (session.accessLevel !== "beta_admin") {
    throw new GuidanceSourcePermissionError("Only LevyTate Platform Admin users can update guidance items.");
  }

  const config = getLevyTateSupabaseConfig();
  if (!config) {
    throw new LevyTateSupabaseError("Supabase is required to update guidance items.");
  }

  const now = new Date().toISOString();
  const nextItem = {
    ...item,
    updatedAt: now,
    body: { ...item.body, status: item.reviewStatus, lastReviewedDate: item.reviewStatus === "Approved" ? now.slice(0, 10) : item.body.lastReviewedDate },
  };

  await supabaseInsert<GuidanceItemRow>(
    config,
    itemsTable,
    [guidanceItemToRow(nextItem)],
    {
      prefer: "resolution=merge-duplicates,return=minimal",
      query: "on_conflict=id",
    },
  );

  await supabaseDelete(config, itemSourcesTable, `guidance_item_id=eq.${encodeURIComponent(item.id)}`);

  if (sourceIds.length) {
    await supabaseInsert<GuidanceItemSourceRow>(
      config,
      itemSourcesTable,
      sourceIds.map((sourceId) => ({
        id: `${item.id}__${sourceId}`,
        guidance_item_id: item.id,
        guidance_source_id: sourceId,
        source_role: "Primary",
        created_at: now,
      })),
      { prefer: "resolution=ignore-duplicates,return=minimal", query: "on_conflict=id" },
    );
  }

  return getGuidanceItemsForSession(session);
}

export async function updateGuidanceItemStatusForSession(
  session: LevyTateBetaSession,
  id: string,
  patch: { reviewStatus?: GuidanceItemReviewStatus; copilotApproved?: boolean },
) {
  if (session.accessLevel !== "beta_admin") {
    throw new GuidanceSourcePermissionError("Only LevyTate Platform Admin users can update guidance items.");
  }

  const current = await getGuidanceItems({ includeDrafts: true });
  const item = current.items.find((candidate) => candidate.id === id);
  if (!item) throw new LevyTateSupabaseError("Guidance item could not be found.");

  return saveGuidanceItemForSession(
    session,
    {
      ...item,
      reviewStatus: patch.reviewStatus ?? item.reviewStatus,
      copilotApproved: typeof patch.copilotApproved === "boolean" ? patch.copilotApproved : item.copilotApproved,
    },
    item.sources.map((source) => source.id),
  );
}
