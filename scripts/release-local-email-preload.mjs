/** Explicit --import for a synthetic local app process; no production path. */
import { readFileSync } from "node:fs";
import { captureCredential, createLocalEmailCapture, deliverToLocalSmtp } from "./release-local-email-capture.mjs";

const root = process.env.RELEASE_LOCAL_RUNTIME;
if (!root?.startsWith("/private/tmp/levytate-release-runtime.") || process.env.VERCEL_ENV || process.env.NODE_ENV === "production"
  || process.env.RELEASE_CAPTURE_RESEND !== "true" || process.env.RESEND_API_KEY !== captureCredential) throw new Error("Synthetic local capture environment required");
const state = JSON.parse(readFileSync(`${root}/private-stack-state.json`, "utf8"));
if (new URL(state.env.API_URL).hostname !== "127.0.0.1" || new URL(state.env.DB_URL).hostname !== "127.0.0.1") throw new Error("Loopback backend required");
const manifest = JSON.parse(readFileSync(process.env.RELEASE_FIXTURE_MANIFEST ?? `${root}/fixture-manifest.json`, "utf8"));
if (!manifest.synthetic || manifest.environment !== "local" || !/^[a-f0-9-]{36}$/.test(manifest.run) || manifest.tenants?.length !== 2) throw new Error("Synthetic two-tenant manifest required");
const recipients = [...manifest.tenants.flatMap((tenant) => tenant.users.map((user) => user.email)),
  `release.${manifest.run}.provider.primary@example.test`, `release.${manifest.run}.provider.secondary@example.test`];
if (recipients.some((email) => !email.startsWith(`release.${manifest.run}.`))) throw new Error("Recipient does not belong to this acceptance run");
globalThis.fetch = createLocalEmailCapture({ transport: globalThis.fetch.bind(globalThis), recipients, deliver: (message) => deliverToLocalSmtp(message, state.endpoints["mail.smtp"]) });
