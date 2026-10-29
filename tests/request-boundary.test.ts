import { describe, expect, it } from "vitest";
import { assertBrowserOrigin, readBrowserForm, readBrowserJson, requireActionKeys } from "@/lib/server/levytate-request-boundary";

const url = "https://candidate.vercel.app/api/levytate-workspace";
function request(body: string, headers: Record<string, string> = {}) {
  return new Request(url, { method: "POST", headers: { origin: "https://candidate.vercel.app", "content-type": "application/json", ...headers }, body });
}

describe("cookie-authenticated write boundary", () => {
  it.each(["https://www.levytate.co.uk", "https://sibling.candidate.vercel.app", "null", ""])('rejects origin %s before consuming body', async (origin) => {
    const value = request('{"action":"save"}', { origin });
    await expect(readBrowserJson(value)).rejects.toMatchObject({ status: 403 });
    expect(value.bodyUsed).toBe(false);
  });
  it("rejects an absent origin and contradictory fetch metadata", () => {
    expect(() => assertBrowserOrigin(new Request(url))).toThrow();
    expect(() => assertBrowserOrigin(request("{}", { "sec-fetch-site": "cross-site" }))).toThrow();
  });
  it("accepts an exact application origin with JSON parameters", async () => {
    await expect(readBrowserJson(request('{"action":"save"}', { "content-type": "application/json; charset=utf-8", "sec-fetch-site": "same-origin" }))).resolves.toEqual({ action: "save" });
  });
  it.each(["null", "[]", "true", "broken"])("rejects malformed action %s", async (value) => {
    await expect(readBrowserJson(request(value))).rejects.toMatchObject({ status: 400 });
  });
  it("rejects simple-request content types and unknown action fields", async () => {
    await expect(readBrowserJson(request("{}", { "content-type": "text/plain" }))).rejects.toMatchObject({ status: 415 });
    expect(() => requireActionKeys({ action: "save", organisationId: "forged" }, ["action"])).toThrow();
  });
  it("enforces actual UTF-8 bytes even when content-length is omitted or false", async () => {
    await expect(readBrowserJson(request('{"note":"😀😀"}', { "content-length": "1" }), 14)).rejects.toMatchObject({ status: 413 });
    await expect(readBrowserJson(request('{"note":"123456789"}'), 10)).rejects.toMatchObject({ status: 413 });
  });
  it("rejects declared oversized bodies before consuming them", async () => {
    const value = request("{}", { "content-length": "100000" });
    await expect(readBrowserJson(value, 100)).rejects.toMatchObject({ status: 413 });
    expect(value.bodyUsed).toBe(false);
  });
  it("bounds browser forms and preserves exact values", async () => {
    const headers = { "content-type": "application/x-www-form-urlencoded" };
    expect((await readBrowserForm(request("acknowledged=yes", headers))).get("acknowledged")).toBe("yes");
    await expect(readBrowserForm(request("acknowledged=yes", headers), 5)).rejects.toMatchObject({ status: 413 });
  });
});
