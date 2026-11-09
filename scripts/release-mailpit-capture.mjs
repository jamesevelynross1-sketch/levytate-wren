import { localUrl } from "./release-local-fixtures.mjs";

// Read-only list pagination: https://mailpit.axllent.org/docs/api-v1/
// GET /api/v1/messages documents start (offset) and limit (default 50).
// Never fetch message contents, change read status, delete, release or send mail.
export async function readLocalMailpitCapture(value, transport = fetch) {
  const origin = localUrl(value, "email capture");
  if (!/^https?:/.test(origin)) throw new Error("HTTP loopback email capture required");
  const unavailable = () => new Error("Local email capture changed or could not be completely enumerated");
  async function scan() {
    const messages = [], ids = new Set(); let total;
    do {
      let response, page;
      try {
        response = await transport(`${origin}/api/v1/messages?start=${messages.length}&limit=50`, { method: "GET", redirect: "error", signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw unavailable();
        const raw = await response.text(); if (raw.length > 2 * 1024 * 1024) throw unavailable();
        page = JSON.parse(raw);
      } catch { throw unavailable(); }
      if (!Number.isSafeInteger(page.total) || page.total < 0 || page.total > 2000 || !Array.isArray(page.messages) || page.messages.length > 50 || (page.start !== undefined && page.start !== messages.length)) throw unavailable();
      total ??= page.total;
      if (page.total !== total || (messages.length < total && page.messages.length === 0) || messages.length + page.messages.length > total) throw unavailable();
      for (const message of page.messages) {
        if (typeof message.ID !== "string" || !message.ID || ids.has(message.ID) || !Array.isArray(message.To) || message.To.some((to) => typeof to.Address !== "string")) throw unavailable();
        ids.add(message.ID);
        messages.push({ ID: message.ID, To: message.To.map(({ Address }) => ({ Address })) });
      }
    } while (messages.length < total);
    return { total, messages };
  }
  const first = await scan(), second = await scan();
  // A second complete scan catches concurrent arrivals/removals even when their
  // count is unchanged. The runtime owner keeps fixture writers paused.
  if (JSON.stringify(first) !== JSON.stringify(second)) throw unavailable();
  return second;
}
