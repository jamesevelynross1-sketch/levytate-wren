/** Local acceptance transport only. Never imported by application code. */
import { createHash, randomUUID } from "node:crypto";
import { connect } from "node:net";
import { createInterface } from "node:readline";

export const captureCredential = "levytate-local-capture-only-not-a-service-credential";

export function createLocalEmailCapture({ transport, deliver, recipients }) {
  if (!recipients.length || recipients.some((email) => typeof email !== "string" || !/^[a-z0-9.+-]+@example\.test$/.test(email))) throw new Error("Exact fictional recipient allowlist required");
  const allowed = new Set(recipients), attempts = new Map();
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && !url.username && !url.password) {
      return transport(input, { ...init, redirect: "error" });
    }
    if (url.href !== "https://api.resend.com/emails") throw new Error("External network disabled in local email acceptance");
    const request = new Request(input, init);
    if (request.method !== "POST" || request.headers.get("authorization") !== `Bearer ${captureCredential}`) throw new Error("Local capture request denied");
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 65536) throw new Error("Local capture message too large");
    const message = JSON.parse(raw);
    if (!message || typeof message !== "object" || Array.isArray(message)
      || Object.keys(message).some((key) => !["from", "to", "subject", "text", "html"].includes(key))
      || !allowed.has(message.to) || typeof message.from !== "string" || /[\r\n]/.test(message.from) || message.from.length > 200
      || typeof message.subject !== "string" || /[\r\n]/.test(message.subject) || message.subject.length > 300
      || typeof message.text !== "string" || typeof message.html !== "string") throw new Error("Local capture envelope denied");
    const key = request.headers.get("idempotency-key");
    if (key && (key.length > 256 || /[\r\n]/.test(key))) throw new Error("Local capture idempotency key denied");
    const hash = createHash("sha256").update(raw).digest("hex");
    const previous = key ? attempts.get(key) : null;
    if (previous && previous.hash !== hash) return Response.json({ message: "Idempotency key payload changed" }, { status: 409 });
    if (previous) return Response.json({ id: await previous.result });
    // Deliberate capture-provider substitute: a success means Mailpit accepted
    // actual bytes, never that an external provider or real inbox received them.
    const result = Promise.resolve().then(() => deliver(message)).then(() => `local-capture-${randomUUID()}`);
    if (key) attempts.set(key, { hash, result });
    return Response.json({ id: await result });
  };
}

export async function deliverToLocalSmtp(message, smtp) {
  if (smtp.address !== "127.0.0.1" || !Number.isInteger(smtp.port) || smtp.port < 1 || smtp.port > 65535) throw new Error("Loopback SMTP required");
  const socket = connect(smtp.port, "127.0.0.1");
  socket.setTimeout(4000, () => socket.destroy(new Error("Local capture timeout")));
  const lines = createInterface({ input: socket, crlfDelay: Infinity })[Symbol.asyncIterator]();
  const reply = async (expected) => {
    let line;
    do { const next = await lines.next(); if (next.done) throw new Error("Local capture unavailable"); line = next.value; } while (line[3] === "-");
    if (!line.startsWith(String(expected))) throw new Error("Local capture rejected message");
  };
  const boundary = `levytate-${randomUUID()}`;
  const body = [
    "From: LevyTate Acceptance <acceptance@example.test>", `To: <${message.to}>`, `Subject: ${message.subject}`, "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`, "", `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8", "", message.text, `--${boundary}`,
    "Content-Type: text/html; charset=utf-8", "", message.html, `--${boundary}--`, "",
  ].join("\n").replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
  try {
    await reply(220); socket.write("EHLO localhost\r\n"); await reply(250);
    socket.write("MAIL FROM:<levytate-local@example.test>\r\n"); await reply(250);
    socket.write(`RCPT TO:<${message.to}>\r\n`); await reply(250);
    socket.write("DATA\r\n"); await reply(354);
    socket.write(`${body}\r\n.\r\n`); await reply(250);
    socket.write("QUIT\r\n"); await reply(221);
  } finally { socket.destroy(); }
}
