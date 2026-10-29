/** Test-only signed GoTrue hook; sends generated tokens only to local Mailpit. */
import { createServer } from "node:http";
import { connect } from "node:net";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

const root = process.env.RELEASE_LOCAL_RUNTIME;
if (!root?.startsWith("/private/tmp/levytate-release-runtime.")) throw new Error("Dedicated local runtime required");
const secret = JSON.parse(readFileSync(`${root}/private-app-secrets.json`, "utf8")).hookSecret;
const state = JSON.parse(readFileSync(`${root}/private-stack-state.json`, "utf8"));
const smtp = state.endpoints["mail.smtp"];
if (smtp.address !== "127.0.0.1") throw new Error("SMTP must remain loopback capture only");
const callback = "http://localhost:3107/levytate/auth/callback";

async function deliver(to, token, type) {
  const socket = connect(smtp.port, "127.0.0.1");
  socket.setTimeout(4000, () => socket.destroy(new Error("Local SMTP timeout")));
  const lines = createInterface({ input: socket, crlfDelay: Infinity })[Symbol.asyncIterator]();
  const reply = async (expected) => {
    let line;
    do { const next = await lines.next(); if (next.done) throw new Error("Local SMTP unavailable"); line = next.value; } while (line[3] === "-");
    if (!line.startsWith(String(expected))) throw new Error("Local SMTP rejected delivery");
  };
  try {
    await reply(220);
    socket.write("EHLO localhost\r\n"); await reply(250);
    socket.write("MAIL FROM:<levytate-local@example.test>\r\n"); await reply(250);
    socket.write(`RCPT TO:<${to}>\r\n`); await reply(250);
    socket.write("DATA\r\n"); await reply(354);
    const url = new URL(callback); url.searchParams.set("token_hash", token); url.searchParams.set("type", type);
    socket.write(`From: LevyTate Local <levytate-local@example.test>\r\nTo: <${to}>\r\nSubject: LevyTate local acceptance sign-in\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Local synthetic acceptance only.</p><a href="${url.href}">Sign in to LevyTate</a>\r\n.\r\n`);
    await reply(250); socket.write("QUIT\r\n"); await reply(221);
  } finally { socket.destroy(); }
}

createServer(async (request, response) => {
  try {
    if (request.method !== "POST" || request.url !== "/email") { response.writeHead(404).end(); return; }
    const chunks = []; let size = 0;
    for await (const chunk of request) { size += chunk.length; if (size > 65536) throw new Error("Oversized hook"); chunks.push(chunk); }
    const raw = Buffer.concat(chunks).toString("utf8");
    const id = request.headers["webhook-id"], timestamp = request.headers["webhook-timestamp"], signature = request.headers["webhook-signature"];
    if (typeof id !== "string" || typeof timestamp !== "string" || typeof signature !== "string" || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new Error("Invalid hook authentication");
    const expected = createHmac("sha256", Buffer.from(secret, "base64")).update(`${id}.${timestamp}.${raw}`).digest();
    const valid = signature.split(" ").some((part) => { const actual = Buffer.from(part.replace(/^v1,/, ""), "base64"); return actual.length === expected.length && timingSafeEqual(actual, expected); });
    if (!valid) throw new Error("Invalid hook signature");
    const payload = JSON.parse(raw), email = payload.user?.email, data = payload.email_data;
    if (typeof email !== "string" || !/^release\.[a-f0-9-]+\.[ab]\.(lead|manager|employee)@example\.test$/.test(email) || data?.redirect_to !== callback || !["magiclink", "signup", "invite"].includes(data.email_action_type) || !/^[a-f0-9]+$/.test(data.token_hash ?? "")) throw new Error("Only approved local synthetic sign-in delivery is allowed");
    await deliver(email, data.token_hash, data.email_action_type);
    response.writeHead(200, { "Content-Type": "application/json" }).end("{}");
    console.log("PASS signed local Auth email captured by loopback SMTP");
  } catch {
    response.writeHead(400, { "Content-Type": "application/json" }).end('{"error":{"http_code":400,"message":"Local acceptance email delivery failed"}}');
    console.error("FAIL local Auth capture; no token or recipient logged");
  }
}).listen(3117, "127.0.0.1", () => console.log("Local signed email hook listening on loopback port 3117"));
