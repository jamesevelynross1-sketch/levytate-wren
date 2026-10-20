import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readRuntimeEnv } from "@/lib/server/levytate-supabase";

export type PastoralCiphertext = {
  ciphertext: string;
  nonce: string;
  authenticationTag: string;
  keyVersion: string;
};

export class LevyTatePastoralEncryptionError extends Error {
  constructor(message = "Pastoral support encryption is not configured.") {
    super(message);
    this.name = "LevyTatePastoralEncryptionError";
  }
}

export function isPastoralEncryptionConfigured() {
  try {
    pastoralEncryptionKey();
    return Boolean(readRuntimeEnv("LEVYTATE_PASTORAL_SUPPORT_ENCRYPTION_KEY_VERSION"));
  } catch {
    return false;
  }
}

export function encryptPastoralJson(value: unknown, associatedData: string): PastoralCiphertext {
  const key = pastoralEncryptionKey();
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(associatedData, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64url"),
    nonce: nonce.toString("base64url"),
    authenticationTag: cipher.getAuthTag().toString("base64url"),
    keyVersion: readRuntimeEnv("LEVYTATE_PASTORAL_SUPPORT_ENCRYPTION_KEY_VERSION"),
  };
}

export function decryptPastoralJson<T>(value: PastoralCiphertext, associatedData: string): T {
  const configuredVersion = readRuntimeEnv("LEVYTATE_PASTORAL_SUPPORT_ENCRYPTION_KEY_VERSION");
  if (!configuredVersion || value.keyVersion !== configuredVersion) {
    throw new LevyTatePastoralEncryptionError("The saved pastoral record uses an unavailable encryption-key version.");
  }
  const decipher = createDecipheriv("aes-256-gcm", pastoralEncryptionKey(), Buffer.from(value.nonce, "base64url"));
  decipher.setAAD(Buffer.from(associatedData, "utf8"));
  decipher.setAuthTag(Buffer.from(value.authenticationTag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as T;
}

export function digestPastoralPayload(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function pastoralEncryptionKey() {
  const raw = readRuntimeEnv("LEVYTATE_PASTORAL_SUPPORT_ENCRYPTION_KEY_V1");
  let key: Buffer;
  if (/^[a-f\d]{64}$/i.test(raw)) key = Buffer.from(raw, "hex");
  else {
    try {
      key = Buffer.from(raw, "base64");
    } catch {
      throw new LevyTatePastoralEncryptionError();
    }
  }
  if (key.byteLength !== 32) throw new LevyTatePastoralEncryptionError();
  return key;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
