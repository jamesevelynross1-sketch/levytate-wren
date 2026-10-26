const test = require('node:test');
const assert = require('node:assert/strict');
const forecast = require('../public/mission-v3/forecast-model.js');

test('fictional opening balance reconciles to the cohort ledger', () => {
  assert.equal(forecast.openingBalance, 185000);
  assert.equal(forecast.monthlyContribution, 18000);
  assert.equal(forecast.monthlyPaymentPerNewLearner, 480);
});

for (const newStarts of [0, 8, 16]) {
  test(newStarts + ' starts: every month and the total ledger reconcile', () => {
    const result = forecast.project(newStarts);
    assert.equal(result.rows.length, 12);
    assert.equal(result.totalReceived, 216000);
    let previous = result.openingBalance;
    let accumulatedExpiry = 0;
    let accumulatedPayments = 0;
    for (const [index, month] of result.rows.entries()) {
      assert.equal(month.contribution, 18000);
      assert.equal(month.existingPaid, 9500);
      assert.equal(month.newPaid, index === 0 ? 0 : newStarts * 480);
      assert.equal(month.unfunded, 0);
      assert.equal(month.closing, previous + month.contribution - month.paid - month.expired);
      assert.ok(month.closing >= 0);
      assert.ok(month.expired >= 0);
      previous = month.closing;
      accumulatedExpiry += month.expired;
      accumulatedPayments += month.paid;
    }
    assert.equal(accumulatedExpiry, result.totalExpired);
    assert.equal(accumulatedPayments, result.totalPaid);
    assert.equal(result.closingBalance, previous);
    assert.equal(
      result.openingBalance + result.totalReceived - result.totalPaid - result.totalExpired,
      result.closingBalance
    );
  });
}

test('additional starts change commitments and reduce modelled expiry without inventing savings', () => {
  const hold = forecast.project(0);
  const planned = forecast.project(8);
  const accelerated = forecast.project(16);
  assert.equal(hold.totalNew, 0);
  assert.equal(planned.totalNew, 42240);
  assert.equal(accelerated.totalNew, 84480);
  assert.ok(hold.totalExpired > planned.totalExpired);
  assert.ok(planned.totalExpired > accelerated.totalExpired);
  assert.equal(planned.sixMonthExpiry, planned.rows.slice(0, 6).reduce((sum, row) => sum + row.expired, 0));
});

test('unsupported marketing scenarios fail rather than silently changing the sample', () => {
  assert.throws(() => forecast.project(4), RangeError);
  assert.throws(() => forecast.project(-1), RangeError);
});
