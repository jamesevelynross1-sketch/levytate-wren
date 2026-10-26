/* Fictional DAS ledger for a public marketing illustration.
 * No employer data is loaded and no account forecast is offered as a service.
 * The cohort figures, rather than the underlying funding rules, are invented.
 */
(function (root, makeModel) {
  const model = makeModel();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.LevyTateForecastDemo = model;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const openingCohorts = [
    [9000, 0], [12000, 1], [18000, 2], [19000, 3],
    [23000, 4], [21000, 5], [16000, 6], [17000, 7],
    [12000, 8], [10000, 9], [9000, 10], [6000, 11],
    [13000, 18]
  ];
  const openingBalance = openingCohorts.reduce((sum, cohort) => sum + cohort[0], 0);
  const monthlyContribution = 18000;
  const existingMonthlyPayments = 9500;
  const exampleProgrammeFunding = 12000;
  const monthsInLearning = 20;
  const monthlyPaymentPerNewLearner = exampleProgrammeFunding * 0.8 / monthsInLearning;

  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })
      .format(new Date(Date.UTC(2026, 9 + i, 1)))
  );

  function project(newStarts = 8) {
    if (![0, 8, 16].includes(newStarts)) throw new RangeError('Unsupported illustrative scenario');
    const cohorts = openingCohorts.map(([remaining, expires]) => ({ remaining, expires }));
    const rows = [];
    let totalExpired = 0;
    let totalPaid = 0;
    let totalNew = 0;

    for (let month = 0; month < 12; month += 1) {
      // From August 2026: no 10% top-up and new receipts expire after 12 months.
      cohorts.push({ remaining: monthlyContribution, expires: month + 12 });
      const newPayments = month === 0 ? 0 : newStarts * monthlyPaymentPerNewLearner;
      const plannedPayment = existingMonthlyPayments + newPayments;
      let toPay = plannedPayment;

      // The oldest available DAS funds are spent first.
      for (const cohort of cohorts) {
        const used = Math.min(cohort.remaining, toPay);
        cohort.remaining -= used;
        toPay -= used;
        if (toPay === 0) break;
      }
      const paid = plannedPayment - toPay;
      // Any amount still unused when its vintage expires leaves the account.
      let expired = 0;
      for (const cohort of cohorts) {
        if (cohort.expires <= month) {
          expired += cohort.remaining;
          cohort.remaining = 0;
        }
      }
      const closing = cohorts.reduce((sum, cohort) => sum + cohort.remaining, 0);
      const row = {
        label: monthNames[month],
        contribution: monthlyContribution,
        existingPaid: existingMonthlyPayments,
        newPaid: newPayments,
        paid,
        unfunded: toPay,
        expired,
        closing
      };
      rows.push(row);
      totalPaid += paid;
      totalNew += newPayments;
      totalExpired += expired;
    }
    return {
      newStarts,
      openingBalance,
      totalReceived: monthlyContribution * 12,
      totalPaid,
      totalNew,
      totalExpired,
      sixMonthExpiry: rows.slice(0, 6).reduce((sum, row) => sum + row.expired, 0),
      closingBalance: rows[11].closing,
      rows
    };
  }

  return {
    project,
    openingBalance,
    monthlyContribution,
    existingMonthlyPayments,
    exampleProgrammeFunding,
    monthsInLearning,
    monthlyPaymentPerNewLearner
  };
});
