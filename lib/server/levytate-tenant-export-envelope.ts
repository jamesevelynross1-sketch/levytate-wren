import { constants, createCipheriv, createHash, createPublicKey, publicEncrypt, randomBytes } from "node:crypto";
import { ClientRequestError } from "@/lib/server/levytate-request-boundary";
import { tenantInventoryVersion, tenantTableInventory } from "@/lib/server/levytate-tenant-data-policy";

type Row = Record<string, unknown>;
export type TenantExportSnapshot = { organisationId: string; snapshotId: string; generatedAt: string; organisation: Row; tables: Record<string, Row[]>; storageObjects: Array<{ bucket: string; path: string; size: number }> };
export type TenantExportObject = { bucket: string; path: string; bytes: Uint8Array };
export type EncryptedTenantExport = { version: "levytate-encrypted-export-v1"; algorithm: "RSA-OAEP-SHA256/AES-256-GCM"; recipientKeyFingerprint: string; expiresAt: string; nonce: string; wrappedKey: string; authenticationTag: string; ciphertext: string; ciphertextSha256: string; manifestSha256: string };
const maxExportBytes = 16 * 1024 * 1024;
const prohibitedKeys = new Set(["auth_subject", "token_hash", "access_token", "refresh_token", "password", "password_hash", "encrypted_password", "secret", "service_role_key"]);
function digest(value: string | Uint8Array) { return createHash("sha256").update(value).digest("hex"); }
export function canonicalExportJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalExportJson).join(",")}]`;
  return `{${Object.entries(value as Row).sort(([a],[b]) => a.localeCompare(b)).map(([key,item]) => `${JSON.stringify(key)}:${canonicalExportJson(item)}`).join(",")}}`;
}
function removeCredentials(row: Row): Row {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !prohibitedKeys.has(key)).map(([key,value]) => [key, value && typeof value === "object" ? Array.isArray(value) ? value.map((item) => item && typeof item === "object" ? removeCredentials(item as Row) : item) : removeCredentials(value as Row) : value]));
}
export function buildTenantExport(snapshot: TenantExportSnapshot, objects: TenantExportObject[]) {
  if (snapshot.organisation.id !== snapshot.organisationId || !snapshot.organisationId || !Number.isFinite(Date.parse(snapshot.generatedAt))) throw new ClientRequestError("The tenant snapshot could not be reconciled.", 409);
  const tables: Record<string, Row[]> = {}, tableManifest: Row[] = [];
  for (const name of Object.keys(snapshot.tables).sort()) {
    if (!Object.hasOwn(tenantTableInventory, name)) throw new ClientRequestError("An unreviewed table was returned by the export snapshot.", 409);
    const rows = snapshot.tables[name];
    if (rows.some((row) => row.organisation_id !== snapshot.organisationId)) throw new ClientRequestError("Tenant export isolation failed.", 409);
    const clean = rows.map(removeCredentials).sort((a,b) => canonicalExportJson(a).localeCompare(canonicalExportJson(b)));
    tables[name] = clean; tableManifest.push({ table: name, dataClass: tenantTableInventory[name], count: clean.length, sha256: digest(canonicalExportJson(clean)) });
  }
  const expected = new Map(snapshot.storageObjects.map((item) => [`${item.bucket}/${item.path}`, item]));
  if (expected.size !== snapshot.storageObjects.length || objects.length !== expected.size) throw new ClientRequestError("Storage export inventory is incomplete or ambiguous.", 409);
  const seen = new Set<string>();
  const storage = objects.map((item) => {
    const key = `${item.bucket}/${item.path}`, required = expected.get(key);
    if (!required || seen.has(key) || item.bytes.byteLength !== required.size) throw new ClientRequestError("Storage object bytes do not reconcile to the authorised inventory.", 409);
    seen.add(key); return { bucket: item.bucket, path: item.path, size: item.bytes.byteLength, sha256: digest(item.bytes), base64: Buffer.from(item.bytes).toString("base64") };
  }).sort((a,b) => `${a.bucket}/${a.path}`.localeCompare(`${b.bucket}/${b.path}`));
  const manifest = { version: tenantInventoryVersion, organisationId: snapshot.organisationId, snapshotId: snapshot.snapshotId, generatedAt: snapshot.generatedAt,
    organisationSha256: digest(canonicalExportJson(snapshot.organisation)), tables: tableManifest, storage: storage.map((item) => ({bucket:item.bucket,path:item.path,size:item.size,sha256:item.sha256})) };
  const payload = canonicalExportJson({ manifest, organisation: snapshot.organisation, tables, storage });
  if (Buffer.byteLength(payload) > maxExportBytes) throw new ClientRequestError("This export exceeds the bounded package size. An approved offline export is required.", 413);
  return { payload, manifestSha256: digest(canonicalExportJson(manifest)), manifest };
}
export function encryptTenantExport(payload: string, manifestSha256: string, recipientPublicKeyPem: string, expiresAt: string, now = new Date()): EncryptedTenantExport {
  // Expiry is enforced again by the authenticated delivery endpoint. It cannot
  // erase a recipient's downloaded copy; the client notice must state that limit.
  if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= now.getTime() || Buffer.byteLength(payload) > maxExportBytes) throw new ClientRequestError("An unexpired, bounded export is required.", 422);
  let publicKey;
  try { publicKey = createPublicKey(recipientPublicKeyPem); } catch { throw new ClientRequestError("Provide the approved recipient's RSA public key.", 422); }
  if (publicKey.asymmetricKeyType !== "rsa" || (publicKey.asymmetricKeyDetails?.modulusLength ?? 0) < 3072) throw new ClientRequestError("The recipient key must be RSA with at least 3072 bits.", 422);
  const secret = randomBytes(32), nonce = randomBytes(12);
  try {
    const cipher = createCipheriv("aes-256-gcm", secret, nonce);
    cipher.setAAD(Buffer.from(`${manifestSha256}\n${expiresAt}`));
    const ciphertext = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
    return { version: "levytate-encrypted-export-v1", algorithm: "RSA-OAEP-SHA256/AES-256-GCM", expiresAt, manifestSha256,
      recipientKeyFingerprint: digest(publicKey.export({type:"spki",format:"der"})), nonce: nonce.toString("base64"),
      wrappedKey: publicEncrypt({key:publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:"sha256"},secret).toString("base64"),
      authenticationTag:cipher.getAuthTag().toString("base64"),ciphertext:ciphertext.toString("base64"),ciphertextSha256:digest(ciphertext) };
  } finally { secret.fill(0); }
}
