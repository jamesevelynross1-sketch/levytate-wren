/** Genuine LOCAL Operations/Intelligence acceptance using existing role contexts.
 * The orchestrator must observe disabled AI, absent model keys and exact
 * loopback email interception. This is not a blanket network-isolation claim.
 * No Auth creation, source fixtures, backdating or direct writes.
 * Original commands live only in this bounded run; output contains labels only.
 */
import { randomUUID } from 'node:crypto';
import { localUrl } from './release-local-fixtures.mjs';
// Observe rejection immediately so normal cleanup cannot create an unhandled
// waitForResponse rejection when an earlier assertion has already stopped us.
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const observe = promise => promise.then(value => ({ value }), error => ({ error }));
async function observed(promise) { const result = await promise; if (result.error) throw result.error; return result.value; }

async function within(promise, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(label)), 30000); })]); }
  finally { clearTimeout(timer); }
}

/** Fetch the real upstream response, hold it while checking the visible gate,
 * then lose/corrupt only transport. An explicit visible retry must send the
 * original body and identity and leave the entire durable snapshot unchanged.
 */
export async function verifyRetainedOperationTransport({ app, page, lead, snapshot, report, verifyCommit, idle, label, path, method = 'POST', action, family, trigger, fault, malformed, validate, during, after }) {
  const before = await snapshot(), recovery = page.getByRole('dialog', { name: 'Update awaiting confirmation', exact: true });
  let intercepted = false, failed = false, command, body, input, release, signalCommitted;
  const held = new Promise(resolve => { release = resolve; }), committed = new Promise(resolve => { signalCommitted = resolve; });
  const pattern = `${app}${path}*`;
  const intercept = async route => {
    if (intercepted || route.request().method() !== method || (action && route.request().postDataJSON()?.action !== action)) { await route.continue(); return; }
    intercepted = true; command = route.request().postData(); input = route.request().postDataJSON();
    try {
      const headers = route.request().headers();
      if (headers['x-levytate-account'] !== lead.user.email || headers['x-levytate-organisation'] !== lead.tenant.id) throw Error('Original request identity missing');
      const response = await route.fetch({ maxRedirects: 0 }); body = await response.json();
      if (response.status() !== 200 || body.ok !== true || !validate(body, input)) throw Error('Real upstream command was not confirmed');
      signalCommitted(); await held;
      if (fault === 'lost') await route.abort('connectionreset');
      else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(malformed(structuredClone(body))) });
    } catch { failed = true; signalCommitted(); try { await route.abort(); } catch {} }
  };
  await page.route(pattern, intercept);
  try {
    await trigger(); await within(committed, `${label} upstream observation timed out`);
    report(`${label}: failure injection follows genuine upstream success`, intercepted && !failed);
    await recovery.waitFor();
    report(`${label}: in-flight command owns visible recovery and disables premature retry`, await recovery.getByRole('button', { name: 'Retry original update', exact: true }).isDisabled());
    if (during) await during();
    const durable = await snapshot(); verifyCommit(before, durable, input, family, body);
    release();
    await recovery.getByRole('button', { name: 'Retry original update', exact: true }).waitFor();
    const retried = observe(page.waitForResponse(response => new URL(response.url()).pathname === path && response.request().method() === method));
    await recovery.getByRole('button', { name: 'Retry original update', exact: true }).click();
    const retry = await observed(retried), headers = retry.request().headers();
    report(`${label}: visible retry preserves exact command and current original identity`, retry.status() === 200 && retry.request().postData() === command && headers['x-levytate-account'] === lead.user.email && headers['x-levytate-organisation'] === lead.tenant.id);
    await idle();
    report(`${label}: retry adds no duplicate action, signal, receipt, history or audit`, same(durable, await snapshot()));
    if (after) await after({ before, durable, body, input });
    return { body, input, command, durable };
  } finally { release(); await page.unroute(pattern, intercept); }
}

// Source identifiers are opaque; fresh core applications legitimately use the
// browser-run prefix. Equality with current tenant rows supplies provenance.
export function validApplicationReference(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 160 && value.trim() === value && !/[\x00-\x1f\x7f]/.test(value);
}
export function matchesCanonicalEnrolment(detail, learnerId, applicationRows, learnerRows, organisationId) {
  const applicationId = detail?.programme?.applicationReference;
  return validApplicationReference(applicationId) && detail?.learnerRecordId === learnerId && detail.lifecycleStatus === 'enrolled'
    && Array.isArray(applicationRows) && applicationRows.length === 1 && applicationRows[0].id === applicationId && applicationRows[0].organisation_id === organisationId && applicationRows[0].employee_id === detail.learner?.id
    && Array.isArray(learnerRows) && learnerRows.length === 1 && learnerRows[0].id === learnerId && learnerRows[0].organisation_id === organisationId && learnerRows[0].application_id === applicationId && learnerRows[0].lifecycle_status === 'enrolled';
}

export async function verifyOperationsIntelligence({ app: origin, manifest, contexts, backend, check, learnerId, noPaidModel, notRun }) {
  const app = localUrl(origin, 'Operations acceptance app');
  const lead = contexts.get('a:lead'), manager = contexts.get('a:manager'), employee = contexts.get('a:employee'), other = contexts.get('b:employee');
  if (noPaidModel !== true) throw Error('Observed local no-paid-model launch evidence required');
  if (!manifest.synthetic || manifest.environment !== 'local' || !/^[a-f0-9-]{36}$/.test(manifest.run)
    || lead?.user.role !== 'Apprenticeship Lead' || manager?.user.role !== 'Line Manager' || employee?.user.role !== 'Employee' || other?.user.role !== 'Employee'
    || lead.tenant.id !== manager.tenant.id || lead.tenant.id !== employee.tenant.id || lead.tenant.id === other.tenant.id
    || ![lead, manager, employee, other].every(actor => manifest.tenants.some(tenant => tenant.id === actor.tenant.id))) throw Error('Reviewed local genuine four-role contexts required');
  const report = (name, ok) => { check(`Operations/Intelligence: ${name}`, Boolean(ok)); if (!ok) throw Error(`Operations acceptance check failed: ${name}`); };
  const gaps = [], notRunScopes = [], page = lead.page, modes = page.getByRole('navigation', { name: 'Operations Centre views', exact: true, includeHidden: true });
  const pins = actor => ({ Origin: app, 'X-LevyTate-Account': actor.user.email, 'X-LevyTate-Organisation': actor.tenant.id });
  const paths = { operations: '/api/levytate-operations', autopilot: '/api/levytate-autopilot', intelligence: '/api/levytate-intelligence/signals' };
  const select = (tenant, table, fields, extra = '') => backend(`rest/v1/${table}?organisation_id=eq.${tenant}&select=${fields}${extra}`);
  const snapshot = async (tenant = lead.tenant.id) => {
    const [signals, states, receipts, events, actions, actionReceipts, actionEvents, audits] = await Promise.all([
      select(tenant, 'levytate_intelligence_signals', 'id,analyser_version,revision,status,linked_operational_action_id', '&order=id'),
      select(tenant, 'levytate_intelligence_workspaces', 'family,revision,reconciled_at', '&order=family'),
      select(tenant, 'levytate_intelligence_command_receipts', 'request_id,actor_user_id', '&order=request_id,actor_user_id'),
      select(tenant, 'levytate_intelligence_signal_events', 'id,signal_id,event_type', '&order=id'),
      select(tenant, 'levytate_operational_actions', 'id,version,status,source_key,action_type', '&order=id'),
      select(tenant, 'levytate_operational_action_receipts', 'action_id,expected_version,actor_user_id', '&order=action_id,expected_version,actor_user_id'),
      select(tenant, 'levytate_operational_action_events', 'id,operational_action_id,event_type', '&order=id'),
      select(tenant, 'levytate_audit_events', 'id,entity_type,entity_id,action', '&entity_type=in.(intelligence,operational_action)&order=id'),
    ]);
    return { signals, states, receipts, events, actions, actionReceipts, actionEvents, audits };
  };
  const otherBefore = await snapshot(other.tenant.id);
  const read = async (kind) => {
    const response = await lead.context.request.get(`${app}${paths[kind]}`, { headers: pins(lead) });
    report(`${kind} returns an authorised live read`, response.status() === 200);
    const body = await response.json(), value = kind === 'autopilot' ? body.workspace : body;
    report(`${kind} read has the exact current canonical scope`, body.ok === true && value?.scope?.organisationId === lead.tenant.id && value.scope.userEmail === lead.user.email && value.scope.role === lead.user.role);
    return value;
  };
  const unexercised = label => { notRunScopes.push(label); if (typeof notRun === 'function') notRun(label); };
  const missing = label => { gaps.push(label); check(`Operations/Intelligence: required existing source coverage — ${label}`, false); };
  const idle = async () => {
    await page.getByRole('dialog', { name: 'Update awaiting confirmation', exact: true }).waitFor({ state: 'hidden' });
    await page.getByRole('dialog', { name: 'Saved update confirmed', exact: true }).waitFor({ state: 'hidden' });
  };
  function verifyCommit(before, after, input, family, body) {
    if (family) {
      const prior = before.states.find(item => item.family === family), current = after.states.find(item => item.family === family);
      report(`${input.action}: one actor-owned receipt and workspace revision commit`, after.receipts.length === before.receipts.length + 1 && after.receipts.some(item => item.request_id === input.idempotencyKey && item.actor_user_id === lead.user.membershipId) && current?.revision === (prior?.revision ?? 0) + 1);
      report(`${input.action}: one Intelligence audit commits with the receipt`, after.audits.filter(item => item.entity_type === 'intelligence').length === before.audits.filter(item => item.entity_type === 'intelligence').length + 1);
      const expectedEvents = ['analyse', 'refresh'].includes(input.action) ? after.signals.filter(item => item.analyser_version === family).length : 1;
      report(`${input.action}: signal history is durable and exact`, after.events.length === before.events.length + expectedEvents);
      if (input.signalId) {
        const signal = after.signals.find(item => item.id === input.signalId);
        report(`${input.action}: original signal revision advances once`, signal?.revision === input.expectedRevision + 1);
        if (['accept', 'create_action'].includes(input.action)) {
          const actionId = body.operationalActionId ?? body.signal?.linkedOperationalActionId;
          report(`${input.action}: signal links to its actual committed action`, Boolean(actionId) && signal?.linked_operational_action_id === actionId && after.actions.some(item => item.id === actionId) && after.actions.length - before.actions.length >= 0 && after.actions.length - before.actions.length <= 1);
        } else report(`${input.action}: no unrelated operational action is created`, after.actions.length === before.actions.length);
      } else report(`${input.action}: analysis never creates operational actions`, same(after.actions, before.actions));
    }
  }
  const uncertain = options => verifyRetainedOperationTransport({ app, page, lead, snapshot, report, verifyCommit, idle, ...options });
  async function challengeDecision(kind, input) {
    const before = await snapshot();
    for (const actor of [manager, employee, other]) {
      const response = await actor.context.request.post(`${app}${paths[kind]}`, { headers: pins(actor), data: input });
      report(`${kind}: ${actor.tenant.key}:${actor.user.role} cannot replay the Lead's actual signal command`, response.status() === 403);
    }
    const staleScope = await lead.context.request.post(`${app}${paths[kind]}`, { headers: { ...pins(lead), 'X-LevyTate-Organisation': other.tenant.id }, data: input });
    report(`${kind}: a foreign retained tenant cannot replay the actual command`, staleScope.status() === 409);
    const staleRevision = await lead.context.request.post(`${app}${paths[kind]}`, { headers: pins(lead), data: { ...input, idempotencyKey: randomUUID() } });
    report(`${kind}: a new command cannot reuse the old signal revision`, staleRevision.status() === 409);
    report(`${kind}: role, tenant and stale-revision denials create no durable changes`, same(before, await snapshot()));
  }
  async function recordCurrentFictionalEvidence() {
    if (!learnerId) return;
    if (!/^learner-[a-f0-9-]{36}$/.test(learnerId)) throw Error('A real core enrolment learner ID is required');
    const today = new Date().toISOString().slice(0, 10), nextDate = new Date(`${today}T12:00:00Z`); nextDate.setUTCDate(nextDate.getUTCDate() + 7);
    const reviewDate = nextDate.toISOString().slice(0, 10), progressText = `Fictional Operations acceptance progress ${manifest.run}`;
    const reviewText = `Fictional Operations acceptance review ${manifest.run}: on track. Synthetic scenario only; no real provider report.`;
    const detailResponse = await lead.context.request.get(`${app}/api/levytate-learners/${learnerId}`, { headers: pins(lead) });
    report('normal fictional evidence uses the genuinely enrolled current-tenant learner', detailResponse.status() === 200);
    const detail = (await detailResponse.json()).learner;
    report('the supplied learner is active and belongs to an actual same-tenant test identity', detail?.learnerRecordId === learnerId && detail.lifecycleStatus === 'enrolled' && [employee.user.personId, manager.user.personId].includes(detail.learner.id));
    const records = () => Promise.all([
      select(lead.tenant.id, 'levytate_learner_progress_updates', 'id,update_date,target_progress_percentage,actual_progress_percentage,variance_percentage,summary,updated_by', `&learner_record_id=eq.${learnerId}&order=id`),
      select(lead.tenant.id, 'levytate_learner_reviews', 'id,review_type,review_date,next_review_date,summary,status,provider_id', `&learner_record_id=eq.${learnerId}&order=id`),
      select(lead.tenant.id, 'levytate_learner_command_receipts', 'request_id', `&learner_record_id=eq.${learnerId}&order=request_id`),
      select(lead.tenant.id, 'levytate_learner_lifecycle_events', 'id', `&learner_record_id=eq.${learnerId}&order=id`),
    ]);
    await page.goto(`${app}/levytate/app?module=Learners`);
    const row = page.getByTestId('learner-row').filter({ has: page.getByText(detail.learner.name, { exact: true }) });
    await row.first().waitFor();
    report('the actual enrolled learner has one visible row', await row.count() === 1);
    await row.getByTestId('learner-open-record').click();
    for (const kind of ['progress', 'review']) {
      const before = await records(), existing = before[kind === 'progress' ? 0 : 1].filter(item => item.summary === (kind === 'progress' ? progressText : reviewText));
      report(`${kind}: no duplicate earlier acceptance observation exists`, existing.length <= 1);
      if (existing.length) continue; // A bounded retry uses the previously recorded fictional observation.
      const section = page.getByRole('heading', { name: 'Progress and reviews', exact: true }).locator('xpath=ancestor::section[1]');
      const name = kind === 'progress' ? 'Add progress update' : 'Record review or check-in';
      await section.getByRole('button', { name, exact: true }).click();
      const form = page.getByRole('dialog', { name, exact: true });
      if (kind === 'progress') {
        await form.getByLabel('Update date', { exact: true }).fill(today);
        await form.getByRole('combobox', { name: 'Progress source', exact: true }).selectOption('provider_report');
        await form.getByLabel('Target progress percentage', { exact: true }).fill('30');
        await form.getByLabel('Actual progress percentage', { exact: true }).fill('5');
        await form.getByLabel('Source reference', { exact: true }).fill('Isolated fictional acceptance observation; no real provider report');
        await form.getByRole('textbox', { name: 'Progress summary', exact: true }).fill(progressText);
      } else {
        await form.getByRole('combobox', { name: 'Review type', exact: true }).selectOption('provider_review');
        await form.getByRole('combobox', { name: 'Status', exact: true }).selectOption('completed');
        await form.getByLabel('Review date', { exact: true }).fill(today);
        await form.getByLabel('Next review date', { exact: true }).fill(reviewDate);
        await form.getByLabel('Reviewer name', { exact: true }).fill('Fictional acceptance reviewer');
        report('fictional provider review retains the actual enrolled provider identity', await form.getByLabel('Provider ID', { exact: true }).inputValue() === detail.programme.providerId);
        await form.getByRole('textbox', { name: 'Summary', exact: true }).fill(reviewText);
      }
      const endpoint = `/api/levytate-learners/${learnerId}/${kind === 'progress' ? 'progress' : 'reviews'}`;
      const responsePromise = observe(page.waitForResponse(response => new URL(response.url()).pathname === endpoint && response.request().method() === 'POST'));
      await form.getByRole('button', { name: kind === 'progress' ? 'Record progress update' : name, exact: true }).click();
      const response = await observed(responsePromise); report(`${kind}: normal Lead UI records the explicit fictional observation`, response.status() === 200 && (await response.json()).ok === true);
      await form.waitFor({ state: 'hidden' });
      const after = await records(); report(`${kind}: one source record, receipt and lifecycle event persist`, after[kind === 'progress' ? 0 : 1].length === before[kind === 'progress' ? 0 : 1].length + 1 && after[2].length === before[2].length + 1 && after[3].length === before[3].length + 1);
    }
    const [progress, reviews] = await records(), measured = progress.find(item => item.summary === progressText), review = reviews.find(item => item.summary === reviewText);
    report('current-date scenario durably records 30/5, variance −25 and the distinct fictional provider narrative', measured?.update_date === today && measured.target_progress_percentage === 30 && measured.actual_progress_percentage === 5 && measured.variance_percentage === -25 && measured.updated_by === lead.user.email && review?.review_date === today && review.next_review_date === reviewDate && review.review_type === 'provider_review' && review.status === 'completed' && review.provider_id === detail.programme.providerId);
  }
  let phase = 'role and scope boundaries';
  try {
    for (const kind of ['operations', 'autopilot', 'intelligence']) {
      await read(kind);
      const before = await snapshot();
      for (const actor of [manager, employee, other]) {
        const get = await actor.context.request.get(`${app}${paths[kind]}`, { headers: pins(actor) });
        report(`${actor.tenant.key}:${actor.user.role} cannot read employer ${kind}`, get.status() === 403);
        const post = await actor.context.request.post(`${app}${paths[kind]}`, { headers: pins(actor), data: kind === 'operations' ? {} : { action: kind === 'autopilot' ? 'refresh' : 'analyse', idempotencyKey: randomUUID() } });
        report(`${actor.tenant.key}:${actor.user.role} cannot mutate employer ${kind}`, post.status() === 403);
      }
      const stale = await lead.context.request.get(`${app}${paths[kind]}`, { headers: { ...pins(lead), 'X-LevyTate-Organisation': other.tenant.id } });
      report(`${kind} refuses a foreign retained workspace before returning data`, stale.status() === 409);
      report(`${kind} denied requests preserve all durable state`, same(before, await snapshot()));
    }
    phase = 'current-date fictional observations through normal Learner UI';
    await recordCurrentFictionalEvidence();
    phase = 'Autopilot malformed live read';
    const beforeRead = await snapshot(); let invalidReads = 0, badReadFailed = false;
    const pendingReads = new Set();
    const badRead = async route => {
      const operation = (async () => {
        // Corrupt every initial GET until the unavailable state is observed;
        // StrictMode can issue competing reads and a healthy second read wins.
        if (route.request().method() !== 'GET') { await route.continue(); return; }
        invalidReads++;
        try {
          const response = await route.fetch({ maxRedirects: 0 }), body = await response.json();
          if (response.status() !== 200 || body.ok !== true) { badReadFailed = true; await route.fulfill({ response }); return; }
          body.workspace.lanes = {}; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        } catch { badReadFailed = true; try { await route.abort(); } catch {} }
      })();
      pendingReads.add(operation); try { await operation; } finally { pendingReads.delete(operation); }
    };
    await page.route(`${app}${paths.autopilot}`, badRead);
    try { await page.goto(`${app}/levytate/app?module=Operations`); await page.getByTestId('operations-autopilot').getByRole('alert').waitFor(); }
    finally { await page.unroute(`${app}${paths.autopilot}`, badRead); await within(Promise.all([...pendingReads]), 'Malformed read cleanup timed out'); }
    report('malformed successful Autopilot read never mutates data or advertises an all-clear', invalidReads > 0 && !badReadFailed && same(beforeRead, await snapshot()) && await page.getByText('No items needed attention at the last check', { exact: true }).count() === 0);
    await page.getByRole('button', { name: 'Try loading again', exact: true }).click();
    for (const fault of ['lost', 'malformed']) {
      phase = `Autopilot refresh ${fault}`;
      await uncertain({ label: phase, path: paths.autopilot, action: 'refresh', family: 'operations-autopilot-v1', fault,
        trigger: () => page.getByRole('button', { name: 'Refresh intelligence', exact: true }).click(),
        validate: (body, input) => body.workspace?.checked === true && body.workspace.confirmation?.idempotencyKey === input.idempotencyKey,
        malformed: body => { body.workspace.lanes = {}; return body; },
        during: async () => report(`${phase}: workspace navigation stays locked`, await modes.getByRole('button', { name: 'Active work', exact: true, includeHidden: true }).isDisabled()),
      });
    }
    phase = 'Autopilot action creation recovery';
    const autopilot = await read('autopilot'), signals = Object.values(autopilot.lanes).flat();
    if (learnerId) report('actual scheduled review fires a source-backed Autopilot review signal', signals.some(signal => signal.learnerRecordId === learnerId && ['review_upcoming', 'review_due_with_outstanding_actions'].includes(signal.signalType)));
    const candidate = signals.find(signal => ['new', 'acknowledged'].includes(signal.status) && signal.suggestedActionType && !signal.linkedOperationalActionId && !['application_stalled', 'application_awaiting_provider'].includes(signal.signalType));
    if (candidate) {
      const row = page.getByTestId('operations-autopilot').locator('article').filter({ has: page.getByRole('heading', { name: candidate.interpretation.headline, exact: true }) }).filter({ hasText: candidate.subjectLabel });
      report('the selected real Autopilot signal has one unambiguous rendered review', await row.count() === 1);
      await row.getByRole('button', { name: 'Review action', exact: true }).click();
      const drawer = page.getByRole('dialog', { name: 'Review suggested operational action', exact: true, includeHidden: true });
      const created = await uncertain({ label: phase, path: paths.autopilot, action: 'create_action', family: 'operations-autopilot-v1', fault: 'malformed',
        trigger: () => drawer.getByRole('button', { name: 'Create action', exact: true }).click(),
        validate: (body, input) => Boolean(body.operationalActionId) && body.confirmation?.idempotencyKey === input.idempotencyKey,
        malformed: body => { body.workspace.brief = {}; return body; },
        during: async () => report('in-flight prepared action retains disabled original title and owner', await drawer.getByRole('textbox', { name: 'Action title', exact: true, includeHidden: true }).isDisabled() && await drawer.getByRole('combobox', { name: 'Owner', exact: true, includeHidden: true }).isDisabled()),
      });
      await challengeDecision('autopilot', created.input);
      const actionId = created.body.operationalActionId, detail = page.getByTestId('operational-action-detail'); await detail.waitFor();
      phase = 'Operations action acknowledgement recovery';
      await uncertain({ label: phase, path: `/api/levytate-operational-actions/${encodeURIComponent(actionId)}`, method: 'PATCH', fault: 'lost',
        trigger: () => detail.getByRole('button', { name: 'Acknowledge', exact: true }).first().click(),
        validate: body => body.action?.id === actionId && body.action.status === 'acknowledged',
        malformed: body => { body.action.metadata = null; return body; },
        after: async ({ before, durable, body }) => report('Operations acknowledgement commits one version, receipt, event and audit', body.action.version === before.actions.find(item => item.id === actionId).version + 1 && durable.actionReceipts.length === before.actionReceipts.length + 1 && durable.actionEvents.length === before.actionEvents.length + 1 && durable.audits.length === before.audits.length + 1),
      });
      await detail.getByRole('button', { name: 'Back to Operations Centre', exact: true }).click();
    } else missing('a current task-eligible Autopilot signal for visible create-action and Operations acknowledgement');

    phase = 'Operations source synchronisation recovery';
    await uncertain({ label: phase, path: paths.operations, fault: 'malformed',
      trigger: () => modes.getByRole('button', { name: 'Active work', exact: true }).click(),
      validate: body => body.scope?.organisationId === lead.tenant.id && body.scope.userEmail === lead.user.email,
      malformed: body => { body.queues = {}; return body; },
    });
    phase = 'Progress Intelligence analysis recovery';
    await uncertain({ label: phase, path: paths.intelligence, action: 'analyse', family: 'progress-review-v1', fault: 'lost',
      trigger: () => page.getByRole('button', { name: 'Refresh review intelligence', exact: true }).click(),
      validate: (body, input) => body.checked === true && body.confirmation?.idempotencyKey === input.idempotencyKey && Array.isArray(body.signals),
      malformed: body => { body.signals = null; return body; },
      during: async () => report('Progress analysis locks mode switching until its receipt is confirmed', await modes.getByRole('button', { name: 'Autopilot', exact: true, includeHidden: true }).isDisabled()),
    });
    const progress = await read('intelligence');
    if (learnerId) report('actual evidence fires review_progress_inconsistency for the enrolled learner', progress.signals.some(signal => signal.learnerRecordId === learnerId && signal.signalType === 'review_progress_inconsistency'));
    const progressSignal = progress.signals.slice(0, 4).find(signal => signal.status === 'new');
    if (progressSignal) {
      phase = 'Progress signal decision recovery';
      const panel = page.getByTestId('progress-review-intelligence');
      if (await panel.locator('details > summary').count()) await panel.locator('details > summary').click();
      const article = panel.locator('article').filter({ has: page.getByRole('heading', { name: progressSignal.title, exact: true }) });
      report('the selected real Progress signal has one unambiguous rendered review', await article.count() === 1);
      await article.getByRole('button', { name: /^Review evidence/ }).click();
      const dialog = page.getByRole('dialog', { includeHidden: true }).filter({ has: page.getByRole('heading', { name: progressSignal.title, exact: true, includeHidden: true }) });
      const acknowledged = await uncertain({ label: phase, path: paths.intelligence, action: 'acknowledge', family: 'progress-review-v1', fault: 'malformed',
        trigger: () => dialog.getByRole('button', { name: 'Acknowledge', exact: true }).click(),
        validate: (body, input) => body.signal?.id === progressSignal.id && body.signal.status === 'acknowledged' && body.confirmation?.idempotencyKey === input.idempotencyKey,
        malformed: body => { body.signal.evidence = null; return body; },
      });
      await challengeDecision('intelligence', acknowledged.input);
      phase = 'Progress action acceptance recovery';
      const accepted = await uncertain({ label: phase, path: paths.intelligence, action: 'accept', family: 'progress-review-v1', fault: 'lost',
        trigger: () => dialog.getByRole('button', { name: 'Accept action', exact: true }).click(),
        validate: (body, input) => body.signal?.id === progressSignal.id && body.signal.status === 'accepted' && Boolean(body.signal.linkedOperationalActionId) && body.confirmation?.idempotencyKey === input.idempotencyKey,
        during: async () => report('in-flight acceptance cannot dismiss or close the original review', await dialog.getByRole('button', { name: 'Close signal review', exact: true, includeHidden: true }).isDisabled()),
      });
      await challengeDecision('intelligence', accepted.input);
      await dialog.getByRole('button', { name: 'Close signal review', exact: true }).click();
    } else missing('a new source-backed Progress signal for visible acknowledgement');

    phase = 'canonical application workflow navigation';
    await modes.getByRole('button', { name: 'Autopilot', exact: true }).click();
    const current = await read('autopilot'), workflowSignals = Object.values(current.lanes).flat().filter(signal => signal.entityType === 'application' && ['application_stalled', 'application_awaiting_provider'].includes(signal.signalType) && signal.status !== 'resolved');
    if (workflowSignals.length) {
      const signal = workflowSignals[0], label = signal.signalType === 'application_awaiting_provider' ? 'Open enrolment handoff' : 'Review application';
      const row = page.getByTestId('operations-autopilot').locator('article').filter({ has: page.getByRole('heading', { name: signal.interpretation.headline, exact: true }) }).filter({ hasText: signal.subjectLabel });
      report('canonical signal links to its exact application, including older linked tasks', await row.count() === 1 && await row.getByRole('link', { name: label, exact: true }).getAttribute('href') === `/levytate/app?module=Applications&application=${encodeURIComponent(signal.entityId)}`);
      await row.getByRole('link', { name: label, exact: true }).click(); await page.getByRole('dialog').waitFor();
      report('canonical application opens under the same genuine application origin', new URL(page.url()).origin === app && new URL(page.url()).searchParams.get('application') === signal.entityId);
    } else unexercised('Genuine aged application Autopilot row absent in the fresh local run; canonical destination is tested separately, and no aging or signal rows are manufactured.');

    phase = 'canonical application and existing learner handoff';
    if (learnerId) {
      const response = await lead.context.request.get(`${app}/api/levytate-learners/${learnerId}`, { headers: pins(lead) });
      report('canonical handoff starts from the actual authorised enrolled learner', response.status() === 200);
      const detail = (await response.json()).learner, applicationId = detail?.programme?.applicationReference;
      report('canonical handoff uses the durable application identity on that exact learner', detail?.learnerRecordId === learnerId && detail.lifecycleStatus === 'enrolled' && validApplicationReference(applicationId));
      const linkedRecords = () => select(lead.tenant.id, 'levytate_learner_records', 'id,organisation_id,application_id,mutation_revision,lifecycle_status', `&application_id=eq.${encodeURIComponent(applicationId)}&order=id`);
      const applicationRows = await select(lead.tenant.id, 'levytate_applications', 'id,organisation_id,employee_id,status', `&id=eq.${encodeURIComponent(applicationId)}`);
      const before = await linkedRecords(), beforeOperations = await snapshot();
      report('one enrolled learner and its canonical application belong to the exact current tenant and employee', matchesCanonicalEnrolment(detail, learnerId, applicationRows, before, lead.tenant.id));
      await page.goto(`${app}/levytate/app?module=Applications&application=${encodeURIComponent(applicationId)}`);
      const modal = page.getByRole('dialog').filter({ has: page.getByRole('region', { name: 'Enrolment handoff', exact: true }) });
      const existing = modal.getByRole('link', { name: 'Open learner record', exact: true }); await existing.waitFor();
      report('canonical application offers the exact existing learner and cannot start a duplicate pre-enrolment', await existing.getAttribute('href') === `/levytate/app?module=Learners&learner=${encodeURIComponent(learnerId)}` && await modal.getByRole('button', { name: 'Start pre-enrolment', exact: true }).count() === 0);
      await existing.click(); await page.getByRole('heading', { name: detail.learner.name, exact: true, level: 2 }).waitFor();
      report('the canonical handoff reaches the same recorded learner on the application origin', new URL(page.url()).origin === app && new URL(page.url()).searchParams.get('learner') === learnerId);
      await manager.page.goto(`${app}/levytate/app?module=Approvals&application=${encodeURIComponent(applicationId)}`);
      await manager.page.getByRole('heading', { name: 'Approvals', exact: true }).waitFor();
      report('the genuine Manager does not acquire Lead pre-enrolment or learner-handoff controls', await manager.page.getByRole('button', { name: 'Start pre-enrolment', exact: true }).count() === 0 && await manager.page.getByRole('link', { name: 'Open learner record', exact: true }).count() === 0);
      report('canonical navigation changes no learner, Operations record or command receipt', same(before, await linkedRecords()) && same(beforeOperations, await snapshot()));
    } else unexercised('No genuine core enrolment learner was supplied for canonical Applications handoff navigation.');

    phase = 'durable readback after reload';
    const durable = await snapshot(); await page.goto(`${app}/levytate/app?module=Operations`); await page.getByTestId('operations-autopilot').waitFor(); await read('autopilot'); await read('intelligence');
    report('reload and independent reads add no commands or hidden mutations', same(durable, await snapshot()));
    report('other employer Intelligence and Operations remain unchanged', same(otherBefore, await snapshot(other.tenant.id)));
    return { newSignIns: 0, paidModelCalls: false, directSourceWrites: false, missingCoverage: gaps, notRunScopes };
  } catch {
    check(`Operations/Intelligence: stopped safely at ${phase}`, false);
    throw Error(`Operations/Intelligence acceptance stopped at ${phase}`);
  }
}
