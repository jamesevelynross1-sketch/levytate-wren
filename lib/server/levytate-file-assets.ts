import { randomUUID } from "node:crypto";
import { getLevyTateSupabaseConfig, supabaseInsert, supabaseSelect } from "@/lib/server/levytate-supabase";

const fileAssetsTable = "levytate_file_assets";

export type LevyTateFileAsset = {
  id: string;
  organisationId: string;
  entityType: string;
  entityId: string;
  bucketName: string;
  objectPath: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedByEmail: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export async function registerLevyTateFileAsset(
  input: Omit<LevyTateFileAsset, "id" | "createdAt">,
) {
  const config = getLevyTateSupabaseConfig();
  if (!config) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const createdAt = new Date().toISOString();
  const row = {
    id: randomUUID(),
    organisation_id: input.organisationId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    bucket_name: input.bucketName,
    object_path: input.objectPath,
    original_name: input.originalName,
    mime_type: input.mimeType,
    file_size_bytes: input.fileSizeBytes,
    uploaded_by_email: input.uploadedByEmail,
    metadata: input.metadata,
    created_at: createdAt,
  };

  await supabaseInsert(config, fileAssetsTable, [row], {
    query: "on_conflict=id",
    prefer: "resolution=merge-duplicates,return=minimal",
  });

  return {
    id: row.id,
    organisationId: input.organisationId,
    entityType: input.entityType,
    entityId: input.entityId,
    bucketName: input.bucketName,
    objectPath: input.objectPath,
    originalName: input.originalName,
    mimeType: input.mimeType,
    fileSizeBytes: input.fileSizeBytes,
    uploadedByEmail: input.uploadedByEmail,
    metadata: input.metadata,
    createdAt,
  } satisfies LevyTateFileAsset;
}

export async function listLevyTateFileAssets(organisationId: string, entityType?: string, entityId?: string) {
  const config = getLevyTateSupabaseConfig();
  if (!config) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const query = new URLSearchParams({
    select: "id,organisation_id,entity_type,entity_id,bucket_name,object_path,original_name,mime_type,file_size_bytes,uploaded_by_email,metadata,created_at",
    organisation_id: `eq.${organisationId}`,
    order: "created_at.desc",
  });

  if (entityType) query.set("entity_type", `eq.${entityType}`);
  if (entityId) query.set("entity_id", `eq.${entityId}`);

  const rows = await supabaseSelect<{
    id: string;
    organisation_id: string;
    entity_type: string;
    entity_id: string;
    bucket_name: string;
    object_path: string;
    original_name: string;
    mime_type: string;
    file_size_bytes: number;
    uploaded_by_email: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>(config, fileAssetsTable, query);

  return rows.map((row) => ({
    id: row.id,
    organisationId: row.organisation_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    bucketName: row.bucket_name,
    objectPath: row.object_path,
    originalName: row.original_name,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    uploadedByEmail: row.uploaded_by_email,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }));
}
