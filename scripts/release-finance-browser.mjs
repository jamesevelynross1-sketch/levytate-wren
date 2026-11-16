/** Genuine LOCAL Finance UI acceptance. Uses the caller's existing four-role
 * contexts; no new identities, sign-ins, fixture SQL or capability changes.
 * Every CSV row is fictional. Only pass/fail labels leave this helper.
 */
import { createHash } from "node:crypto";
import { localUrl } from "./release-local-fixtures.mjs";

export async function verifyFinance({ app: origin, manifest, contexts, backend, check }) {
  const app = localUrl(origin, "Finance app");
  const lead = contexts.get("a:lead"), employee = contexts.get("a:employee"), manager = contexts.get("a:manager"), other = contexts.get("b:employee");
  if (!manifest.synthetic || manifest.environment !== "local" || !/^[a-f0-9-]{36}$/.test(manifest.run) || lead?.user.role !== "Apprenticeship Lead" || !employee || !manager || !other || lead.tenant.id === other.tenant.id) throw new Error("Reviewed local four-role Finance contexts required");
  const report = (label, condition) => { check(`Finance: ${label}`, Boolean(condition)); if (!condition) throw new Error(`Finance check failed: ${label}`); };
  const page = lead.page, path = `${app}/api/levytate-finance`, month = new Date().toISOString().slice(0, 7);
  const fileName = `synthetic-finance-${manifest.run}.csv`, provider = `Fictional provider ${manifest.run}`, programme = `Fictional programme ${manifest.run}`;
  const descriptions = ["Levy contribution", "Training payment", "Funds expired", "Unclassified fictional entry"].map(label => `${label} ${manifest.run}`);
  const content = ["When,Details,Pounds,Balance,Provider,Programme",
    `${month}-01,${descriptions[0]},1000.00,1000.00,,`,
    `${month}-02,${descriptions[1]},-250.00,750.00,${provider},${programme}`,
    `${month}-03,${descriptions[2]},-50.00,700.00,,`,
    `${month}-04,${descriptions[3]},15.00,715.00,,`].join("\n");
  const transactionRows = (tenant) => backend(`rest/v1/levytate_finance_transactions?organisation_id=eq.${tenant}&select=fingerprint,transaction_date,description,category,amount_pence,reported_balance_pence,provider_name,programme_name&order=fingerprint`);
  const snapshot = async () => {
    const [transactions, imports, receipts, versions, audit] = await Promise.all([
      transactionRows(lead.tenant.id),
      backend(`rest/v1/levytate_finance_imports?organisation_id=eq.${lead.tenant.id}&select=id,file_name,source_rows,new_transactions,duplicate_rows,review_rows&order=id`),
      backend(`rest/v1/levytate_finance_command_receipts?organisation_id=eq.${lead.tenant.id}&select=request_id&order=request_id`),
      backend(`rest/v1/levytate_finance_versions?organisation_id=eq.${lead.tenant.id}&select=revision`),
      backend(`rest/v1/levytate_audit_events?organisation_id=eq.${lead.tenant.id}&entity_type=eq.finance&select=id&order=id`),
    ]);
    return { transactions, imports, receipts, revision: Number(versions[0]?.revision ?? 0), audit };
  };
  const before = await snapshot(), beforeOther = await transactionRows(other.tenant.id);
  report("reviewed Finance scenario starts without prior employer imports", before.transactions.length === 0 && before.imports.length === 0);
  for (const actor of [employee, manager, other]) report(`${actor.tenant.key}:${actor.user.role} cannot read employer Finance`, (await actor.context.request.get(path)).status() === 403);
  const initial = await lead.context.request.get(path);
  const initialBody = await initial.json();
  report("Lead reads actual empty persistent Finance without fixture totals", initial.status() === 200 && initialBody.state?.mode === "persistent" && initialBody.state.transactions.length === 0);
  await page.goto(`${app}/levytate/app?module=Finance`);
  await page.getByRole("heading", { name: "Bring your DAS finance data into LevyTate", exact: true }).waitFor();

  // Client preview must reject partial imports before any network mutation.
  let validationPosts = 0;
  const countPosts = request => { if (new URL(request.url()).pathname === "/api/levytate-finance" && request.method() === "POST") validationPosts++; };
  page.on("request", countPosts);
  try {
    const invalid = `Date,Description,Amount\n${month}-01,Levy contribution fictional validation,100.00\n${month}-02,Training payment fictional validation,not-money`;
    await page.locator('input[type="file"]').setInputFiles({ name: `invalid-${fileName}`, mimeType: "text/csv", buffer: Buffer.from(invalid) });
    await page.getByRole("heading", { name: "Import preview", exact: true }).waitFor();
    await page.getByRole("alert").filter({ hasText: "No partial import will be saved" }).waitFor();
    report("malformed CSV shows source errors and disables import", await page.getByRole("button", { name: "Import transactions", exact: true }).isDisabled());
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    report("invalid preview performs no write or partial persistence", validationPosts === 0 && JSON.stringify(await snapshot()) === JSON.stringify(before));
  } finally { page.off("request", countPosts); }

  async function uploadAndMap() {
    await page.locator('input[type="file"]').setInputFiles({ name: fileName, mimeType: "text/csv", buffer: Buffer.from(content) });
    await page.getByRole("heading", { name: "We need to confirm your file", exact: true }).waitFor();
    await page.getByRole("combobox", { name: /^Date \*/ }).selectOption("When");
    await page.getByRole("combobox", { name: /^Transaction description\/type \*/ }).selectOption("Details");
    await page.getByRole("combobox", { name: /^Amount \*/ }).selectOption("Pounds");
    await page.getByRole("button", { name: "Confirm mapping", exact: true }).click();
    await page.getByRole("heading", { name: "Import preview", exact: true }).waitFor();
  }
  await uploadAndMap();
  const fact = async (label, expected) => (await page.getByText(label, { exact: true }).locator("..").textContent())?.includes(expected);
  report("mapped preview reconciles all rows, received funding, spend and expiry", await fact("Transactions recognised", "4") && await fact("Levy funding received", "£1,000") && await fact("Apprenticeship spend", "£250") && await fact("Expired", "£50") && await fact("Rows need review", "1"));
  report("preview has not yet persisted financial rows", JSON.stringify(await snapshot()) === JSON.stringify(before));
  let command, dropped = false, upstreamFailed = false;
  const loseResponse = async route => {
    if (!dropped && route.request().method() === "POST" && route.request().postDataJSON()?.action === "import") {
      dropped = true; command = route.request().postData();
      try {
        const response = await route.fetch(), body = await response.json();
        if (response.status() !== 200 || body.ok !== true || body.state?.mode !== "persistent") throw new Error("Import not confirmed upstream");
        await route.abort("connectionreset");
      } catch { upstreamFailed = true; await route.abort(); }
    } else await route.continue();
  };
  await page.route("**/api/levytate-finance", loseResponse);
  try { await page.getByRole("button", { name: "Import transactions", exact: true }).click(); await page.getByRole("dialog", { name: "Update awaiting confirmation", exact: true }).waitFor(); }
  finally { await page.unroute("**/api/levytate-finance", loseResponse); }
  const persisted = await snapshot();
  report("lost response follows real atomic import, receipt and audit", dropped && !upstreamFailed && persisted.transactions.length === 4 && persisted.imports.length === 1 && persisted.receipts.length === before.receipts.length + 1 && persisted.audit.length === before.audit.length + 1 && persisted.revision === before.revision + 1);
  const expectedRows = [["levy_in", 100000, 100000], ["apprenticeship_spend", -25000, 75000], ["levy_expiry", -5000, 70000], ["other", 1500, 71500]];
  report("persisted pence, categories and reported balances match the fictional source exactly", expectedRows.every(([category, amount, balance], index) => persisted.transactions.some(row => row.description === descriptions[index] && row.transaction_date === `${month}-0${index + 1}` && row.category === category && row.amount_pence === amount && row.reported_balance_pence === balance)));
  report("import metadata retains all source rows and one review row", persisted.imports[0].file_name === fileName && persisted.imports[0].source_rows === 4 && persisted.imports[0].new_transactions === 4 && persisted.imports[0].duplicate_rows === 0 && persisted.imports[0].review_rows === 1);
  report("uncertain import retains preview and freezes both import and cancel", await page.getByRole("button", { name: "Import transactions", exact: true }).isDisabled() && await page.getByRole("button", { name: "Cancel", exact: true }).isDisabled());
  const retried = page.waitForResponse(response => new URL(response.url()).pathname === "/api/levytate-finance" && response.request().method() === "POST");
  await page.getByRole("dialog", { name: "Update awaiting confirmation", exact: true }).getByRole("button", { name: "Retry original update", exact: true }).click();
  const retry = await retried;
  report("explicit retry preserves the exact import body", retry.status() === 200 && retry.request().postData() === command);
  await page.getByTestId("levy-finance-module").waitFor();
  report("retry returns original import without duplicate rows, receipt, audit or revision", JSON.stringify(await snapshot()) === JSON.stringify(persisted));
  for (const actor of [employee, manager, other]) report(`${actor.tenant.key}:${actor.user.role} cannot replay the Lead import`, (await actor.context.request.post(path, { headers: { Origin: app }, data: JSON.parse(command) })).status() === 403);
  await page.reload(); await page.getByTestId("levy-finance-module").waitFor();
  report("Finance values survive refresh and match stored evidence", await fact("Latest evidenced levy balance", "£715") && await page.getByText("1 imported rows could not be classified and are excluded from category totals.", { exact: true }).count() === 1 && await page.getByText(provider, { exact: true }).count() === 1 && await page.getByText(programme, { exact: true }).count() === 1);
  const monthRow = page.getByRole("heading", { name: "Monthly position", exact: true }).locator("..");
  const monthlyText = await monthRow.textContent();
  report("monthly screen shows received1000, spend250, difference750, expired50 and balance715", ["£1,000", "£250", "£750", "£50", "£715"].every(value => monthlyText.includes(value)));
  await uploadAndMap();
  const duplicateResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/levytate-finance" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Import transactions", exact: true }).click();
  report("same CSV re-upload confirms safely", (await duplicateResponse).status() === 200);
  await page.getByTestId("levy-finance-module").waitFor();
  report("repeat file after refresh remains exactly one atomic import", JSON.stringify(await snapshot()) === JSON.stringify(persisted));

  // Finance is permission-based, with no optional Finance capability flag. The
  // second Employee's403 is role/isolation evidence, not a second Lead journey.
  report("other employer financial data remains unchanged", JSON.stringify(await transactionRows(other.tenant.id)) === JSON.stringify(beforeOther));
  await page.goto(`${app}/levytate/app?module=Insights`);
  await page.getByRole("heading", { name: "Operating brief", exact: true }).waitFor();
  const exportedResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/levytate-employer-insights/export" && response.request().method() === "POST");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download aggregate evidence", exact: true }).click();
  const exported = await exportedResponse, download = await downloaded, bytes = await exported.text(), evidence = JSON.parse(bytes), finance = evidence.finance;
  report("actual UI download exports reconciled integer pence and explicit unknown rows", exported.status() === 200 && download.suggestedFilename() === "levytate-employer-evidence-v1.json" && evidence.organisationId === lead.tenant.id && finance.availability === "available" && finance.unit === "pence" && finance.currentBalancePence === 71500 && finance.contributionsPence === 100000 && finance.apprenticeshipSpendPence === 25000 && finance.expiredPence === 5000 && finance.unclassifiedCount === 1 && finance.unclassifiedPence === 1500);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const audits = await backend(`rest/v1/levytate_audit_events?organisation_id=eq.${lead.tenant.id}&entity_type=eq.employer_evidence_export&metadata->>sha256=eq.${digest}&select=metadata`);
  report("download bytes match the durable audit and exclude row/provider labels", exported.headers()["x-levytate-evidence-sha256"] === digest && audits.length === 1 && audits[0].metadata.bytes === Buffer.byteLength(bytes) && !bytes.includes(provider) && !bytes.includes(programme) && descriptions.every(value => !bytes.includes(value)));
  await download.delete();
  return { transactions: 4, imports: 1, financeRevision: persisted.revision };
}
