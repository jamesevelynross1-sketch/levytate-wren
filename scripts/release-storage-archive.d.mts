import type { Buffer } from "node:buffer";
export type StorageSnapshot = {
  formatVersion: 1;
  files: Array<{ path: string; bytes: number; sha256: string; data: string }>;
  bytes: number;
};
export function snapshotStorageFiles(source: string): StorageSnapshot;
export function storageSnapshotDigest(snapshot: StorageSnapshot): string;
export function encryptStorageSnapshot(snapshot: StorageSnapshot, key?: Buffer): { key: Buffer; encrypted: Buffer };
export function decryptStorageSnapshot(encrypted: Buffer, key: Buffer): StorageSnapshot;
export function restoreStorageSnapshot(snapshot: StorageSnapshot, target: string): void;
