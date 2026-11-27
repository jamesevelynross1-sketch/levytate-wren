/** Separate levy balances and cumulative employer cash. Unverified or
 * private programmes may create cash obligations without reducing DAS.
 * Never combine unrelated measures on one axis or invent divergence. */
import { forecastLevy } from "./levy-planner";

export type ForecastChartView = "levy" | "cash";
export type ForecastScenario = ReturnType<typeof forecastLevy>;
export type ForecastComparisonMonth = {
  month: string;
  levyBaselinePence: number;
  levyPlannedPence: number;
  cashBaselinePence: number;
  cashPlannedPence: number;
  cashDifferencePence: number;
  levyDifferencePence: number;
  existingCashThisMonthPence: number;
  plannedCashThisMonthPence: number;
};

export function compareForecastScenarios(baseline: ForecastScenario, planned: ForecastScenario) {
  if (baseline.rows.length !== planned.rows.length ||
      baseline.rows.some((item, index) => item.month !== planned.rows[index]?.month)) {
    throw new Error("Forecast scenarios have different monthly timelines.");
  }
  let baselineCash = 0, plannedCash = 0;
  const rows: ForecastComparisonMonth[] = baseline.rows.map((baseRow, index) => {
    const proposedRow = planned.rows[index];
    const baselineThisMonth = baseRow.existingCash + baseRow.proposedCash;
    const plannedThisMonth = proposedRow.existingCash + proposedRow.proposedCash;
    baselineCash += baselineThisMonth;
    plannedCash += plannedThisMonth;
    return {
      month: baseRow.month,
      levyBaselinePence: baseRow.closing,
      levyPlannedPence: proposedRow.closing,
      cashBaselinePence: baselineCash,
      cashPlannedPence: plannedCash,
      cashDifferencePence: plannedCash - baselineCash,
      levyDifferencePence: baseRow.closing - proposedRow.closing,
      existingCashThisMonthPence: baselineThisMonth,
      plannedCashThisMonthPence: plannedThisMonth,
    };
  });
  const levyLinesMatch = rows.every(row => row.levyBaselinePence === row.levyPlannedPence);
  const cashLinesMatch = rows.every(row => row.cashBaselinePence === row.cashPlannedPence);
  return {
    rows,
    levyBaseline: rows.map(row => row.levyBaselinePence),
    levyPlanned: rows.map(row => row.levyPlannedPence),
    cashBaseline: rows.map(row => row.cashBaselinePence),
    cashPlanned: rows.map(row => row.cashPlannedPence),
    levyLinesMatch,
    cashLinesMatch,
    preferredView: (levyLinesMatch && !cashLinesMatch ? "cash" : "levy") as ForecastChartView,
    extraCashPence: planned.cash - baseline.cash,
    levyBalanceDifferencePence: baseline.closing - planned.closing,
  };
}
