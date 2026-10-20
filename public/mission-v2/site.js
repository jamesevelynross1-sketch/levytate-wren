/* LevyTate public story. No employer records, tracking or live-platform mutations. */
(function () {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const destinations = ['programmes', 'funding', 'journey', 'roi', 'providers'];
  const sectionNames = { programmes: 'Find apprenticeships', funding: 'Use your funding', journey: 'Keep everyone connected', roi: 'ROI calculator', providers: 'For providers' };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const behaviour = () => reducedMotion.matches ? 'auto' : 'smooth';
  const roleExamples = {
    service: { name: 'Customer service practitioner', level: 2, standard: 'st0072', need: 'Handling difficult conversations and resolving customer enquiries.', fit: 'Build practical skills in customer communication, service delivery and problem-solving.' },
    finance: { name: 'Assistant accountant', level: 3, standard: 'st0002', need: 'Taking on reconciliations, financial records and month-end accounting work.', fit: 'Develop the accounting knowledge and practical skills needed to support a finance team.' },
    engineering: { name: 'Engineering manufacturing technician', level: 4, standard: 'st0841', need: 'Supporting manufacturing processes, technical documentation and production improvements.', fit: 'Develop manufacturing engineering knowledge and apply it to technical work in the business.' },
    procurement: { name: 'Procurement and supply assistant', level: 3, standard: 'st0810', need: 'Handling purchasing information, supplier enquiries and procurement processes.', fit: 'Build practical skills in procurement, supplier communication and accurate purchasing administration.' }
  };
  const featureTitles = {
    roles: 'From role to programme', offers: 'Choose on more than a name', guidance: 'A clearer development conversation',
    spend: 'Before you buy training', levy: 'Plan with the whole picture',
    approvals: 'One request. A clear next step.', progress: 'After the apprenticeship starts', views: 'The information each person needs'
  };
  const stakeholderExamples = {
    employee: { q: 'What happens next for me?', rows: [['My request', 'With my line manager for review'], ['What I need to do', 'Discuss the learning time and support I’ll need']] },
    manager: { q: 'What does my team need from me?', rows: [['Decision to make', 'Review a team member’s apprenticeship request'], ['What to consider', 'Role fit, study time and practical support at work'], ['Next owner', 'Apprenticeship lead, if I approve the request']] },
    lead: { q: 'Where does someone need our help?', rows: [['Applications', 'See requests awaiting a final decision'], ['Learners', 'See reviews and actions that need attention'], ['Providers', 'Keep delivery contacts beside the learner record']] },
    finance: { q: 'What are we committing the budget to?', rows: [['Current commitments', 'Training already agreed and its remaining costs'], ['Planned development', 'New needs to check against available funding'], ['Decision needed', 'Confirm funding and any additional employer costs']] },
    leader: { q: 'What is the business getting from this?', rows: [['Participation', 'Which teams are developing their people'], ['Progress', 'Where learning is moving forward or needs support'], ['Value to review', 'Applied skills, completed projects and business outcomes']] }
  };
  function currentDestination() {
    const hash = window.location.hash.slice(1);
    if (destinations.includes(hash)) return hash;
    const p = new URLSearchParams(window.location.search);
    if (p.get('view') === 'roi' || p.get('section') === 'roi') return 'roi';
    if (p.get('audience') === 'provider') return 'providers';
    const aliases = { investment: 'funding', workforce: 'programmes', impact: 'journey' };
    return aliases[p.get('view')] || 'programmes';
  }
  function showDestination(id, scroll, moveFocus) {
    const selected = destinations.includes(id) ? id : 'programmes';
    destinations.forEach(key => { document.getElementById(key).hidden = key !== selected; });
    $$('[data-chapter]').forEach(a => {
      if (a.dataset.chapter === selected || (selected === 'roi' && a.dataset.chapter === 'funding') || (selected === 'providers' && a.dataset.chapter === 'programmes')) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
    if (window.location.hash || window.location.search) document.title = sectionNames[selected] + ' | LevyTate';
    else document.title = 'LevyTate | More opportunity. Less chasing.';
    if (scroll) document.getElementById('explore').scrollIntoView({ behavior: behaviour(), block: 'start' });
    if (moveFocus) {
      const heading = document.getElementById(selected + '-title');
      if (heading) heading.focus({ preventScroll: true });
    }
    if (selected === 'roi') updateCalculation();
  }
  document.addEventListener('click', function (event) {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const id = link.getAttribute('href').slice(1);
    if (!destinations.includes(id)) return;
    event.preventDefault();
    const next = new URL(window.location.href);
    ['view', 'audience', 'section', 'tour', 'step'].forEach(k => next.searchParams.delete(k));
    next.hash = id;
    if (window.location.hash !== '#' + id || window.location.search !== next.search) history.pushState({ levytate: id }, '', next.href);
    showDestination(id, true, true);
  });
  window.addEventListener('popstate', () => showDestination(currentDestination(), Boolean(window.location.hash), false));
  window.addEventListener('hashchange', () => showDestination(currentDestination(), Boolean(window.location.hash), false));
  $$('[data-highlight]').forEach(el => {
    const change = enabled => $$('[data-highlight="' + el.dataset.highlight + '"]').forEach(other => other.classList.toggle('is-hovered', enabled));
    el.addEventListener('mouseenter', () => change(true)); el.addEventListener('mouseleave', () => change(false));
    el.addEventListener('focus', () => change(true)); el.addEventListener('blur', () => change(false));
  });
  $$('[data-feature]').forEach(button => button.addEventListener('click', function () {
    const chapter = button.closest('.chapter');
    const selected = button.dataset.feature;
    $$('[data-feature]', chapter).forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    $$('[data-feature-panel]', chapter).forEach(p => { p.hidden = p.dataset.featurePanel !== selected; });
    const title = $('.window-bar > span:first-child', chapter);
    if (title) title.textContent = featureTitles[selected];
  }));
  $('#role-select').addEventListener('change', function (event) {
    const row = roleExamples[event.target.value] || roleExamples.service;
    $('#role-need').textContent = row.need;
    $('#programme-name').textContent = row.name;
    $('#programme-level').textContent = 'Level ' + row.level + ' apprenticeship';
    $('#programme-fit').textContent = row.fit;
    $('#standard-link').href = 'https://skillsengland.education.gov.uk/apprenticeships/' + row.standard;
  });
  $$('[data-role]').forEach(button => button.addEventListener('click', function () {
    const row = stakeholderExamples[button.dataset.role];
    if (!row) return;
    $$('[data-role]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    $('#view-question').textContent = row.q;
    const output = $('#stakeholder-output'); output.replaceChildren();
    row.rows.forEach(([key, text]) => { const div = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = key; dd.textContent = text; div.append(dt, dd); output.append(div); });
  }));
  const currency = value => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
  const numeral = value => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value);
  function number(input) {
    const raw = Number(input.value), min = Number(input.min || 0), max = input.max ? Number(input.max) : 1e11;
    return Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : min;
  }
  function input(id) { return number(document.getElementById(id)); }
  function calculation() {
    const weeks = input('weeks'), hourly = input('hourly');
    const jobs = $$('.time-row').map(row => ({ title: $('strong', row).textContent, people: number($('[data-count]', row)), hours: number($('[data-hours]', row)), reduction: number($('[data-reduction]', row)) }));
    jobs.forEach(row => { row.yearly = row.people * row.hours * row.reduction / 100 * weeks; });
    const hours = jobs.reduce((sum, row) => sum + row.yearly, 0);
    const capacity = hours * hourly, licence = input('licence'), setup = input('setup'), training = input('training');
    const cost = licence + setup, hasCost = $('#licence').value.trim() !== '';
    const cash = training - cost, net = cash + capacity, roi = hasCost && cost > 0 ? net / cost * 100 : null;
    const levy = Math.max(0, input('payroll') * .005 - input('allowance')), england = levy * input('england') / 100;
    return { jobs, weeks, hourly, hours, capacity, licence, setup, training, cost, hasCost, cash, net, roi, levy, england, payroll: input('payroll'), allowance: input('allowance'), englandShare: input('england'), expiring: input('expiring') };
  }
  let announcement;
  function updateCalculation() {
    const r = calculation();
    const outputs = { 'hours-result': numeral(r.hours), 'capacity-result': currency(r.capacity), 'cash-result': r.hasCost ? currency(r.cash) : '—', 'net-result': r.hasCost ? currency(r.net) : '—', 'roi-result': r.roi === null ? '—' : numeral(r.roi) + '%', 'levy-result': currency(r.levy), 'england-result': currency(r.england) };
    Object.entries(outputs).forEach(([id, text]) => { document.getElementById(id).textContent = text; });
    $('#cash-result').classList.toggle('negative', r.hasCost && r.cash < 0);
    $('#net-result').classList.toggle('negative', r.hasCost && r.net < 0);
    $('#roi-result').classList.toggle('negative', r.roi !== null && r.roi < 0);
    $('#result-note').textContent = !r.hasCost ? 'Add your software quote to calculate net value and ROI.' : r.cost === 0 ? 'No ROI percentage is calculated with zero software and setup costs.' : 'Staff capacity is included in the ROI figure. Levy balances and funds at risk are not.';
    const detail = $('#role-results'); detail.replaceChildren();
    r.jobs.filter(row => row.yearly > 0).forEach(row => { const p = document.createElement('p'), span = document.createElement('span'), b = document.createElement('b'); span.textContent = row.title; b.textContent = numeral(row.yearly) + ' hrs'; p.append(span, b); detail.append(p); });
    clearTimeout(announcement);
    announcement = setTimeout(() => { if (!$('#roi').hidden) $('#calculation-announcement').textContent = 'Updated estimate: ' + numeral(r.hours) + ' annual hours freed. ' + (r.hasCost ? 'Net value including capacity: ' + currency(r.net) + '.' : 'Enter your software quote for ROI.'); }, 500);
    return r;
  }
  $('#roi-form').addEventListener('submit', event => event.preventDefault());
  $('#roi-form').addEventListener('input', updateCalculation);
  $('#roi-form').addEventListener('change', event => {
    if (event.target.matches('input[type="number"]') && event.target.value !== '') event.target.value = String(number(event.target));
    updateCalculation();
  });
  $('#load-example').addEventListener('click', function () {
    const rows = [[2, 6, 30], [15, .75, 20], [3, 3, 25], [2, 1.5, 20], [30, .25, 20]];
    $$('.time-row').forEach((row, i) => ['[data-count]', '[data-hours]', '[data-reduction]'].forEach((selector, j) => { $(selector, row).value = rows[i][j]; }));
    Object.entries({ weeks: 46, hourly: 24.59, licence: 6500, setup: 1000, training: 0, payroll: 12000000, allowance: 15000, england: 100, expiring: 0 }).forEach(([id, value]) => { document.getElementById(id).value = value; });
    $('#scenario-note').textContent = 'Example loaded. Staffing, time reductions and the £6,500 / £1,000 software costs are illustrative assumptions, not measured results or a quote. Replace them with your figures.';
    updateCalculation();
  });
  $('#download-case').addEventListener('click', function () {
    const r = calculation();
    const lines = ['LevyTate — first-year business-case scenario', 'Generated: ' + new Date().toISOString().slice(0, 10), '', 'YOUR ASSUMPTIONS', 'Working weeks: ' + r.weeks, 'Hourly employer cost: £' + r.hourly, ...r.jobs.map(j => j.title + ': ' + j.people + ' people × ' + j.hours + ' coordination hours each/week × ' + j.reduction + '% assumed reduction = ' + numeral(j.yearly) + ' hours/year'), '', 'RESULTS', 'Annual hours freed: ' + numeral(r.hours), 'Staff capacity value: ' + currency(r.capacity), 'Net training spending avoided: ' + currency(r.training), 'Annual software: ' + (r.hasCost ? currency(r.licence) : 'Not entered'), 'Setup: ' + currency(r.setup), 'Year-one cash effect: ' + (r.hasCost ? currency(r.cash) : 'Not calculated'), 'Net value including capacity: ' + (r.hasCost ? currency(r.net) : 'Not calculated'), 'ROI including capacity: ' + (r.roi === null ? 'Not calculated' : numeral(r.roi) + '%'), '', 'FUNDING CONTEXT — NOT INCLUDED IN ROI', 'Annual payroll: ' + currency(r.payroll), 'Allocated allowance: ' + currency(r.allowance), 'England share: ' + r.englandShare + '%', 'Annual levy estimate: ' + currency(r.levy), 'Indicative England funding: ' + currency(r.england), 'User-entered funds at risk: ' + currency(r.expiring), '', 'METHOD AND LIMITS', 'Hours = people × hours/person/week × assumed reduction × working weeks.', 'Cash effect = net training costs avoided − software − setup. Net equivalent value adds staff capacity. ROI divides net equivalent value by software and setup costs.', 'Time released is not automatically cash saved. Staff-time estimates are assumptions, not verified LevyTate outcomes. Do not double count participants or training benefits. Confirm eligibility and all extra costs. Figures must use the same first-year period.', 'HMRC levy = max(0, 0.5% NI-able payroll − allocated allowance). This is not an account forecast. Funding applies to England. No 10% top-up is added. New funds from August 2026 expire in 12 months; earlier funds retain 24 months.', 'Hourly default: ONS full-time median £19.67 (April 2025), with an illustrative 25% uplift, rounded to £24.59. Use actual employer costs.', '', 'SOURCES — checked 20 October 2026', 'https://www.gov.uk/guidance/pay-apprenticeship-levy', 'https://www.gov.uk/government/publications/apprenticeship-funding/apprenticeship-funding', 'https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/bulletins/annualsurveyofhoursandearnings/2025'];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'LevyTate-business-case.txt'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
  });
  updateCalculation();
  const initial = currentDestination();
  showDestination(initial, false, false);
  if (window.location.hash || new URLSearchParams(window.location.search).get('view') || new URLSearchParams(window.location.search).get('audience')) requestAnimationFrame(() => document.getElementById('explore').scrollIntoView({ behavior: 'auto', block: 'start' }));
})();
