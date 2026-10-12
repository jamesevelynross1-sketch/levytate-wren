#!/usr/bin/env node

/**
 * Guarded fixture preparer. It never writes unless migration 033 is present,
 * --apply is explicit, and a target organisation ID is supplied. Run only
 * after migration approval against an isolated fictional validation workspace.
 */

const apply = process.argv.includes("--apply");
const organisationId = valueAfter("--organisation-id");
if (!apply) {
  console.log(JSON.stringify({ mode: "dry-run", writesPerformed: false, required: ["migration 033 approved and applied", "isolated fictional organisation", "--apply", "--organisation-id"] }, null, 2));
  process.exit(0);
}
if (!/^[0-9a-f-]{36}$/i.test(organisationId ?? "")) throw new Error("A valid isolated fictional --organisation-id is required.");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRole) throw new Error("Approved Supabase configuration is required.");

const headers = { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, "Content-Type": "application/json" };
const capability = await read(`levytate_organisation_capabilities?select=organisation_id,off_the_job_assistant_enabled&organisation_id=eq.${organisationId}`);
if (!capability.length) throw new Error("The isolated fixture organisation capability row was not found; no writes performed.");
const learners = await read(`levytate_learner_records?select=id,employee_id,provider_id,programme_id&organisation_id=eq.${organisationId}&record_status=eq.Active&limit=1`);
if (!learners.length) throw new Error("An existing fictional active learner is required; no learner or historic evidence will be fabricated.");
const existing = await read(`levytate_otj_plans?select=id&organisation_id=eq.${organisationId}&learner_record_id=eq.${encodeURIComponent(learners[0].id)}&limit=1`);
if (existing.length) throw new Error("A Learning Time fixture already exists for this learner; duplicate fixture creation stopped.");
const response = await fetch(`${supabaseUrl}/rest/v1/levytate_organisation_capabilities?organisation_id=eq.${organisationId}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ off_the_job_assistant_enabled: true }) });
if (!response.ok) throw new Error(`Capability enablement failed (${response.status}).`);
console.log(JSON.stringify({ mode: "apply", organisationId, capabilityEnabled: true, learnerRecordId: learners[0].id, planCreated: false, activityCreated: false, note: "The fixture deliberately enables capability only. Create the agreed versioned plan through the governed product workflow." }, null, 2));

async function read(path) { const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers }); if (!response.ok) throw new Error(`Fixture preflight failed (${response.status}).`); return response.json(); }
function valueAfter(flag) { const index = process.argv.indexOf(flag); return index >= 0 ? process.argv[index + 1] : null; }
