import { strict as assert } from 'node:assert';

// Original LevyTate copy. This only refines the public explanation and illustrative
// examples; it does not enable application capabilities or change financial maths.
const arrow = '<span aria-hidden="true">↗</span>';
const rows = entries => `<dl class="useful-rows">${entries.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
const feature = (id, title, copy, active = false) => `<button type="button" data-feature="${id}" aria-pressed="${active}"><strong>${title} ${arrow}</strong><span>${copy}</span></button>`;
const panel = (id, body, active = false) => `<div class="window-body" data-feature-panel="${id}"${active ? '' : ' hidden'}>${body}</div>`;
const disclosure = (title, body) => `<details class="buyer-detail"><summary>${title}</summary><div>${body}</div></details>`;

function element(html, opening, tag = 'div') {
  const start = html.indexOf(opening);
  assert(start >= 0, `Missing source element: ${opening}`);
  const tags = new RegExp(`<${tag}\\b[^>]*>|<\\/${tag}>`, 'g');
  tags.lastIndex = start;
  let depth = 0;
  for (let match; (match = tags.exec(html));) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(start, tags.lastIndex);
  }
  throw new Error(`Unclosed source element: ${opening}`);
}
function replaceElement(html, opening, replacement, tag = 'div') {
  return html.replace(element(html, opening, tag), replacement);
}
function replaceIntro(html, id, copy) {
  const expression = new RegExp(`(<h1 id="${id}-title"[^>]*>[\\s\\S]*?<\\/h1>\\s*)<p>[\\s\\S]*?<\\/p>`);
  assert(expression.test(html), `${id}: missing introduction`);
  return html.replace(expression, `$1<p>${copy}</p>`);
}
function replaceWindow(html, theme, title, panels) {
  const titleId = theme === 'mint' ? 'discovery' : theme === 'coral' ? 'funding' : 'journey';
  return replaceElement(html, `<div class="product-window theme-${theme}">`, `<div class="product-window theme-${theme}"><div class="window-bar"><span id="${titleId}-window-label">${title}</span><span class="example">Example</span></div>${panels}</div>`);
}

export function refinePageContent(id, html) {
  if (id === 'programmes') {
    const roles = element(html, '<div class="window-body" data-feature-panel="roles">');
    const guidance = element(html, '<div class="window-body" data-feature-panel="guidance" hidden>');
    html = replaceIntro(html, id, 'Good employees can miss out because nobody has connected their role with the right development. LevyTate helps your team identify relevant apprenticeships, compare the provider’s offer and choose which programmes to make available.');
    html = replaceElement(html, '<div class="feature-list"', `<div class="feature-list" aria-label="Explore apprenticeship discovery">
${feature('roles', 'Match the role to an apprenticeship', 'See the programme, level and reason for the fit—not just a list of courses.', true)}
${feature('offers', 'Compare what the provider actually delivers', 'Check teaching, delivery and support before starting a sales conversation.')}
${feature('portfolio', 'Choose what your people can apply for', 'My Programmes keeps your selected options together for employees.')}
${feature('guidance', 'Give employees a useful next step', 'Understand the commitment, ask for guidance and prepare a request.')}
</div>${disclosure('Need more evidence before choosing development?', '<p>The latest employer build also includes AI capability assessments. Employees reflect on their experience; authorised teams can review shared findings and workplace barriers before discussing development.</p><p>This is an AI-focused assessment, not a complete skills test for every role. Findings support a conversation; they do not decide eligibility or approval. Availability is confirmed in your walkthrough.</p>')}`);
    const offers = panel('offers', `<h3>Same apprenticeship.<br>Different teaching and support.</h3><p class="compact">For a Customer service practitioner programme, the standard alone won’t answer these questions.</p>${rows([
      ['Learning', 'Does the programme cover the customer conversations and service challenges this employee handles?'],
      ['Delivery', 'How are workshops, workplace learning and coaching organised?'],
      ['Support', 'Who helps when the learner struggles, and how does the manager stay informed?'],
      ['Included extras', 'Which additional qualifications, resources or specialist modules are actually included?']
    ])}<div class="decision-note"><strong>Compare the offer against the job.</strong><p>Programme details sit beside the provider and standard, so the employer can judge the differences that matter.</p></div><a class="text-link" href="/apprenticeships#providers">How providers show their programmes ${arrow}</a>`);
    const portfolio = panel('portfolio', `<h3>Your programme choices.<br>Clear options for employees.</h3><p class="compact">The shared catalogue shows what is available. My Programmes holds the options your organisation has selected.</p>${rows([
      ['Customer-facing roles', 'Customer service practitioner · Level 2'],
      ['Finance roles', 'Assistant accountant · Level 3'],
      ['Employee access', 'Active programmes selected by their employer'],
      ['Employer control', 'Add or deactivate selections without changing the shared catalogue']
    ])}<div class="decision-note"><strong>Less searching. A clearer starting point.</strong><p>Employees explore relevant internal options before submitting an application for the normal manager and apprenticeship-lead reviews.</p></div><p class="footnote">Illustrative selection. My Programmes is part of the latest employer build; we confirm availability before access is agreed.</p>`);
    html = replaceWindow(html, 'mint', 'From role to programme', roles + offers + portfolio + guidance);
    return html;
  }
  if (id === 'funding') {
    const spend = element(html, '<div class="window-body" data-feature-panel="spend">').replace('data-feature-panel="spend">', 'data-feature-panel="spend" hidden>');
    html = replaceIntro(html, id, 'Before approving more training, you need to know what has already been spent and what the new development involves. LevyTate brings imported levy information into view, alongside programme choices and a transparent business-case calculator.');
    html = replaceElement(html, '<div class="feature-list"', `<div class="feature-list" aria-label="Explore funding decisions">
${feature('levy', 'See where your levy is going', 'Read contributions, spending and recorded expiry from your imported DAS data.', true)}
${feature('spending', 'Understand spending by provider and programme', 'See the breakdown where your imported file contains the relevant detail.')}
${feature('spend', 'Check planned training before paying separately', 'Compare a suitable apprenticeship with the training you were going to buy.')}
<a href="#roi"><strong>Build a business case you can explain ${arrow}</strong><span>Use your figures for costs avoided, time freed and the cost of LevyTate.</span></a>
</div>`);
    const levy = panel('levy', `<h3>A dated financial picture.<br>Not another estimate to chase.</h3><p class="compact">Illustrative DAS import · January–March 2026</p>${rows([
      ['Levy contributions', '£18,000'],
      ['Apprenticeship spending', '£12,600'],
      ['Recorded expiry', '£0'],
      ['Account balance', 'Not confirmed in this example']
    ])}<div class="decision-note"><strong>Transaction totals are not your account balance.</strong><p>LevyTate shows the source period and missing information. A balance needs its own imported evidence or manual confirmation.</p></div><p class="footnote">Fictional figures to demonstrate the Finance view—not customer results. Finance uses uploaded DAS evidence, not a live account connection or future-expiry forecast.</p>`, true);
    const spending = panel('spending', `<h3>See the detail behind the total.</h3><p class="compact">The same illustrative £12,600 apprenticeship spend, grouped by programme.</p>${rows([
      ['Customer service practitioner', '£8,400'],
      ['Assistant accountant', '£4,200'],
      ['Total for the imported period', '£12,600']
    ])}<div class="decision-note"><strong>Bring a specific question to your next review.</strong><p>Check spending alongside the programmes and providers your organisation uses, rather than asking each team for a separate spreadsheet.</p></div><p class="footnote">Fictional programme totals. Provider and programme breakdowns depend on the fields in your file. Missing links and unclassified transactions are shown for review, not silently guessed.</p>`);
    return replaceWindow(html, 'coral', 'Your imported levy position', levy + spending + spend);
  }
  if (id === 'journey') {
    const approvals = element(html, '<div class="window-body" data-feature-panel="approvals">');
    const progress = element(html, '<div class="window-body" data-feature-panel="progress" hidden>');
    const views = element(html, '<div class="window-body" data-feature-panel="views" hidden>');
    html = replaceIntro(html, id, 'An employee is waiting, a review is overdue and the latest update is in somebody else’s inbox. LevyTate connects applications, learner progress and named actions—so your team can see the work that needs doing, not just the records.');
    html = replaceElement(html, '<div class="feature-list"', `<div class="feature-list" aria-label="Explore apprenticeship management">
${feature('approvals', 'Know who needs to make the next decision', 'Applications and approvals show the owner, status and information needed.', true)}
${feature('progress', 'Keep sight of the learner after enrolment', 'Record progress, reviews, breaks in learning and the steps towards assessment.')}
${feature('operations', 'See what needs attention first', 'The Operations Centre brings overdue reviews and unresolved actions together.')}
${feature('views', 'Give the right people a useful answer', 'Show each person their next step, and give the employer a clearer overview.')}
</div>`);
    const operations = panel('operations', `<h3>One overdue review.<br>A clear person to follow it up.</h3>${rows([
      ['Learner', 'Jamie Ellis · Customer service practitioner'],
      ['Needs attention', 'Provider review is 7 days overdue'],
      ['Action owner', 'Apprenticeship lead'],
      ['Next step', 'Agree a review date with the provider and learner'],
      ['Follow-through', 'Keep the action open until the review is recorded']
    ])}<p class="compact">Priority, owner and next action stay beside the learner record. Completing an action does not hide an unresolved underlying issue.</p>${disclosure('Ask Copilot instead of searching', '<p><strong>“Which reviews need attention?”</strong></p><p>Copilot can retrieve authorised operational records and link you to the relevant learner or action. You still make the decision; it does not send a message or complete the task for you.</p><p class="footnote">This explains a supported query, not a live AI conversation.</p>')}<p class="footnote">Fictional operational example—not a real learner.</p>`);
    const enhancedViews = views.replace('</dl><p class="footnote">', `</dl>${disclosure('What can we take to a leadership meeting?', '<p>The latest employer build includes a printable executive summary of applications awaiting decisions, active learners, operational priorities and imported financial evidence. Each measure carries its source or reporting period.</p><p>It reports the recorded position—not an automatic claim of productivity gains or training ROI. The aggregate report removes personal names; access and availability are confirmed in the walkthrough.</p>')}<p class="footnote">`);
    html = replaceWindow(html, 'navy', 'One request. A clear next step.', approvals + progress + operations + enhancedViews);
    return html;
  }
  if (id === 'providers') {
    return `<section id="providers" class="provider-section" aria-labelledby="providers-title"><div><h2 id="providers-title" tabindex="-1">Your programme deserves more than a standard’s name.</h2><p>The same apprenticeship can be taught very differently. Help employers understand your learning, delivery and support before they decide who to speak to.</p><p>LevyTate brings those details into programme discovery and comparison. Your offer can be considered against a real role and development need—not just a qualification title.</p><a class="button" href="mailto:hello@levytate.co.uk?subject=Discuss%20joining%20LevyTate">Discuss joining LevyTate ${arrow}</a></div><div class="provider-details"><h3>Make the difference in your delivery visible.</h3>${rows([
      ['Who it is for', 'Name the roles, experience and sector needs your programme supports.'],
      ['What people learn', 'Describe the modules, skills and workplace application—not just the standard.'],
      ['How it works', 'Set out teaching, coaching, learning time and the support employers receive.'],
      ['What is included', 'Show genuine additional qualifications, resources and specialist support.']
    ])}<p>Programme information is reviewed before publication. Joining starts with a conversation about your provision and fit.</p></div></section>`;
  }
  return html;
}

export const contentStyles = `
.buyer-detail{margin-top:18px;border-top:1px solid var(--line);font-size:14px;line-height:1.6}
.buyer-detail>summary{cursor:pointer;min-height:44px;display:list-item;padding:12px 0;color:var(--ink);font-weight:550;list-style-position:inside}
.buyer-detail>summary:focus-visible{outline:2px solid var(--mint-dark);outline-offset:4px;border-radius:3px}
.buyer-detail>div{padding:0 0 14px}
.buyer-detail p{font-size:14px;line-height:1.65;margin:10px 0;color:var(--muted)}
.buyer-detail p strong{color:var(--ink);font-weight:550}
.chapter-copy .buyer-detail{max-width:560px}
.window-body .buyer-detail{margin-top:20px}
`;

// Only labels and illustrative stakeholder copy are extended. Existing event
// handlers, approved role examples, icon navigation and ROI arithmetic stay intact.
export const contentInteractionOverrides = `
  Object.assign(featureTitles, {
    roles: 'From role to programme', offers: 'Compare the provider’s offer',
    portfolio: 'My Programmes · illustrative selection', guidance: 'A clearer development conversation',
    levy: 'Your imported levy position', spending: 'Spend by programme · example',
    operations: 'Operations Centre · example', views: 'Information for the right person'
  });
  Object.assign(stakeholderExamples, {
    finance: { q: 'What do our financial records show?', rows: [['Recorded period', 'The dates covered by the uploaded DAS transactions'], ['Spending', 'Contributions, apprenticeship payments and recorded expiry'], ['Evidence to check', 'Balance date, missing links and unclassified transactions']] },
    leader: { q: 'What needs a decision or support?', rows: [['Operating position', 'Applications awaiting decisions and active learners'], ['Attention needed', 'Overdue reviews, blockers and outstanding actions'], ['Financial evidence', 'Imported spending and the latest evidenced balance']] }
  });
`;
