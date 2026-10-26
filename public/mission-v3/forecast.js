/* Browser-only controls for the fictional levy illustration. */
(() => {
  'use strict';
  const root = document.querySelector('[data-das-forecast]');
  const model = window.LevyTateForecastDemo;
  if (!root || !model) return;

  const find = selector => root.querySelector(selector);
  const findAll = selector => [...root.querySelectorAll(selector)];
  const cash = value => new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0
  }).format(value);
  const shortCash = value => '£' + Math.round(value / 1000).toLocaleString('en-GB') + 'k';

  let selectedStarts = 8;
  let expanded = false;
  const baseline = model.project(0);

  function drawLine(rows) {
    // A consistent scale makes the two scenarios directly comparable.
    return rows.map((row, index) => {
      const x = 55 + 610 * index / 11;
      const y = 222 - Math.min(300000, Math.max(0, row.closing)) * 198 / 300000;
      return (index ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
  }

  function addCell(row, textValue, label) {
    const cell = document.createElement('td');
    cell.textContent = textValue;
    if (label) cell.setAttribute('data-label', label);
    row.append(cell);
  }

  function renderLedger(result) {
    const body = find('[data-das-rows]');
    body.replaceChildren();
    result.rows.forEach((item, index) => {
      const row = document.createElement('tr');
      if (index >= 6 && !expanded) row.hidden = true;
      addCell(row, item.label, 'Month');
      addCell(row, cash(item.contribution), 'Funds added');
      addCell(row, cash(item.existingPaid), 'Existing learners');
      addCell(row, cash(item.newPaid), 'New starts');
      addCell(row, cash(item.expired), 'Expiry');
      addCell(row, cash(item.closing), 'Closing balance');
      if (item.expired > 0) row.classList.add('ps-das-ledger-expiry');
      body.append(row);
    });
    const toggle = find('[data-das-show-all]');
    toggle.textContent = expanded ? 'Show first 6 months' : 'Show all 12 months';
    toggle.setAttribute('aria-expanded', String(expanded));
  }

  function renderRisk(result) {
    find('[data-das-six-month-risk]').textContent = cash(result.sixMonthExpiry);
    const container = find('[data-das-risk-months]');
    container.replaceChildren();
    const exposed = result.rows.slice(0, 6).filter(row => row.expired > 0);
    if (exposed.length === 0) {
      const message = document.createElement('p');
      message.textContent = 'No expiry modelled in the next six months.';
      container.append(message);
      return;
    }
    exposed.forEach(row => {
      const item = document.createElement('div');
      const period = document.createElement('span');
      const value = document.createElement('strong');
      period.textContent = row.label;
      value.textContent = cash(row.expired);
      item.append(period, value);
      container.append(item);
    });
  }

  function render() {
    const result = model.project(selectedStarts);
    find('[data-metric="das-expiry"]').textContent = cash(result.totalExpired);
    find('[data-metric="das-closing"]').textContent = cash(result.closingBalance);
    find('[data-das-line-baseline]').setAttribute('d', drawLine(baseline.rows));
    find('[data-das-line-selected]').setAttribute('d', drawLine(result.rows));
    find('[data-das-chart-desc]').textContent =
      selectedStarts + ' planned starts. Opening balance ' + cash(result.openingBalance) +
      '; projected September 2027 closing balance ' + cash(result.closingBalance) +
      ' compared with ' + cash(baseline.closingBalance) + ' without new starts.';
    const avoidedExpiry = baseline.totalExpired - result.totalExpired;
    const comparative = selectedStarts === 0
      ? 'This holds new starts at zero to show the unaltered pipeline.'
      : avoidedExpiry > 0
        ? 'Compared with no new starts, ' + cash(avoidedExpiry) +
          ' less funding is modelled to expire, while monthly training payments rise.'
        : 'Additional starts increase planned payments; modelled expiry does not fall in this period.';
    find('[data-das-insight]').textContent = comparative +
      ' Estimated training payments over 12 months: ' + cash(result.totalPaid) + '.';
    find('[data-das-payments]').textContent =
      cash(result.totalPaid) + ' forecast payments: ' +
      cash(result.totalPaid - result.totalNew) + ' existing commitments and ' +
      cash(result.totalNew) + ' instalments from new starts.';
    findAll('[data-das-starts]').forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.dasStarts) === selectedStarts));
    });
    renderLedger(result);
    renderRisk(result);
  }

  findAll('[data-das-starts]').forEach(button => button.addEventListener('click', () => {
    selectedStarts = Number(button.dataset.dasStarts);
    render();
  }));
  find('[data-das-show-all]').addEventListener('click', () => {
    expanded = !expanded;
    render();
  });
  render();
})();
