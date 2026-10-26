import type {
  AppState,
  Deduction,
  MockPaycheck,
  PayFrequency,
  PaySchedule,
  Shift,
} from "../../types";
import {
  localDate,
  validDate,
  wagesFor,
  workedMinutes,
} from "../history/model";
import { addDays, payPeriod } from "../history/payPeriods";

export type Range =
  "thisWeek" | "last7" | "thisMonth" | "last30" | "last90" | "allTime";
export type Bounds = { start: string; end: string };
export const ranges: { value: Range; label: string }[] = [
  { value: "thisWeek", label: "This week" },
  { value: "last7", label: "Last 7 days" },
  { value: "thisMonth", label: "This month" },
  { value: "last30", label: "Last 30 days" },
  { value: "last90", label: "Last 90 days" },
  { value: "allTime", label: "All time" },
];
export const frequencies: { value: PayFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "semi-monthly", label: "Semi-monthly" },
  { value: "monthly", label: "Monthly" },
];
export const annualMultipliers: Record<Deduction["frequency"], number> = {
  daily: 260,
  weekly: 52,
  "per-pay-period": 26,
  monthly: 12,
  yearly: 1,
  "one-time": 1,
};
export const periodsPerYear: Record<PayFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  "semi-monthly": 24,
  monthly: 12,
};
export function daysBetween(start: string, end: string) {
  const number = (value: string) => {
    const date = new Date(`${value}T12:00:00`);
    return (
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
    );
  };
  return number(end) - number(start);
}
export function validBounds(bounds: Bounds) {
  return (
    validDate(bounds.start) &&
    validDate(bounds.end) &&
    bounds.start <= bounds.end
  );
}
export function rangeBounds(
  range: Range,
  history: Shift[] = [],
  today = localDate(),
): Bounds {
  if (range === "allTime")
    return {
      start:
        history
          .map((entry) => entry.date)
          .filter(validDate)
          .sort()[0] ?? today,
      end: today,
    };
  if (range === "thisMonth")
    return { start: `${today.slice(0, 7)}-01`, end: today };
  const date = new Date(`${today}T12:00:00`);
  const offset =
    range === "thisWeek"
      ? (date.getDay() + 6) % 7
      : range === "last7"
        ? 6
        : range === "last30"
          ? 29
          : 89;
  return { start: addDays(today, -offset), end: today };
}
export function scheduleFor(
  frequency: PayFrequency,
  periodStart: string,
  delay = 7,
): PaySchedule {
  const period = payPeriod(periodStart, {
    id: "schedule",
    name: "",
    hourlyRate: 0,
    color: "",
    payFrequency: frequency,
    payPeriodStart: periodStart,
  });
  const end = period?.end ?? periodStart;
  return {
    frequency,
    periodStart,
    periodEnd: end,
    payDate: addDays(end, delay),
    payDelayDays: delay,
    anchorDate: periodStart,
  };
}
export function validateSchedule(schedule: PaySchedule) {
  if (
    !validBounds({ start: schedule.periodStart, end: schedule.periodEnd }) ||
    !validDate(schedule.payDate)
  )
    return "Choose valid dates with the period end on or after its start.";
  if (schedule.payDate < schedule.periodEnd)
    return "Pay date must be on or after the period end.";
  return null;
}
export function moveSchedule(
  schedule: PaySchedule,
  direction: 1 | -1,
): PaySchedule {
  const target =
    direction === 1
      ? addDays(schedule.periodEnd, 1)
      : addDays(schedule.periodStart, -1);
  const anchored = payPeriod(target, {
    id: "",
    name: "",
    color: "",
    hourlyRate: 0,
    payFrequency: schedule.frequency,
    payPeriodStart: schedule.anchorDate ?? schedule.periodStart,
  })!;
  const period = schedule.customPeriod
    ? direction === 1
      ? {
          start: target,
          end: addDays(
            target,
            daysBetween(schedule.periodStart, schedule.periodEnd),
          ),
        }
      : {
          start: addDays(
            target,
            -daysBetween(schedule.periodStart, schedule.periodEnd),
          ),
          end: target,
        }
    : anchored;
  return {
    ...schedule,
    periodStart: period.start,
    periodEnd: period.end,
    payDate: addDays(period.end, schedule.payDelayDays),
  };
}
export function scopeCurrency(
  data: AppState,
  jobId: string | null,
  fallback = data.preferences.currency,
) {
  return data.jobs.find((job) => job.id === jobId)?.currency ?? fallback;
}
export function entryCurrency(entry: Shift, data: AppState) {
  return entry.currency ?? scopeCurrency(data, entry.jobId ?? null);
}
export function periodEntries(
  data: AppState,
  bounds: Bounds,
  jobId: string | null,
  currency: string,
  shiftsOnly = false,
) {
  if (!validBounds(bounds)) return [];
  return data.history.filter(
    (entry) =>
      entry.id !== data.activeShift?.id &&
      entry.date >= bounds.start &&
      entry.date <= bounds.end &&
      (!jobId || entry.jobId === jobId) &&
      entryCurrency(entry, data) === currency &&
      (entry.entryType === "project"
        ? !shiftsOnly
        : Boolean(entry.endedAt && entry.startedAt && !entry.missingClockIn)),
  );
}
export function shiftAmounts(entry: Shift, data: AppState, now?: number) {
  const job = data.jobs.find((job) => job.id === entry.jobId);
  const fallback =
    entry.id === data.activeShift?.id ? data.todayPlan : data.defaultPlan;
  const plan = {
    ...fallback,
    overtimeThreshold: job?.overtimeThreshold ?? fallback.overtimeThreshold,
    overtimeMultiplier: job?.overtimeMultiplier ?? fallback.overtimeMultiplier,
  };
  const wages = wagesFor(entry, data.jobs, plan, now);
  const tips = entry.entryType === "project" ? 0 : (entry.tips ?? 0);
  return {
    wages,
    gross: wages + (entry.tipType === "paycheck" ? tips : 0),
    cashTips: entry.tipType !== "paycheck" ? tips : 0,
    minutes: workedMinutes(entry, now),
  };
}
export function deductionAmount(
  item: Deduction,
  gross: number,
  perJobGross: Map<string | null, number>,
  bounds: Bounds,
) {
  if (
    !item.enabled ||
    (item.frequency === "one-time" && item.consumedByPaycheckId)
  )
    return 0;
  if (item.isPercentage)
    return (
      ((item.jobId ? (perJobGross.get(item.jobId) ?? 0) : gross) *
        item.amount) /
      100
    );
  const from = item.applicableFromDate;
  const to = item.applicableToDate;
  if (from && to)
    return to >= bounds.start && to <= bounds.end ? item.amount : 0;
  const start = from && from > bounds.start ? from : bounds.start;
  const end = to && to < bounds.end ? to : bounds.end;
  if (start > end) return 0;
  if (item.frequency === "one-time") return item.amount;
  return (
    (item.amount *
      annualMultipliers[item.frequency] *
      (daysBetween(start, end) + 1)) /
    365
  );
}
function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
export function historicalRate(
  paychecks: MockPaycheck[],
  jobId: string | null,
  currency: string,
) {
  let records = paychecks
    .filter(
      (record) =>
        record.paid &&
        (record.currency ?? "USD") === currency &&
        (jobId == null || record.jobId === jobId) &&
        Number.isFinite(record.grossPay) &&
        record.grossPay! > 0 &&
        Number.isFinite(record.netPay) &&
        record.netPay! >= 0 &&
        record.netPay! <= record.grossPay!,
    )
    .sort((a, b) => (b.payDate ?? "").localeCompare(a.payDate ?? ""))
    .slice(0, 10);
  if (!records.length && jobId)
    return historicalRate(paychecks, null, currency);
  if (!records.length) return null;
  const rates = records.map(
    (record) => (record.grossPay! - record.netPay!) / record.grossPay!,
  );
  const mid = median(rates);
  const kept = rates.filter(
    (rate) => mid === 0 || (rate >= mid * 0.4 && rate <= mid * 2.2),
  );
  const values = kept.length >= 5 ? kept : rates;
  return {
    rate: median(values),
    count: values.length,
    excluded: rates.length - values.length,
  };
}
export type DeductionEstimate = {
  total: number;
  taxSetAside: number;
  source: "actual-history" | "configured" | "fallback";
  label: string;
  count: number;
  excluded: number;
  lineItems: { id: string; label: string; amount: number }[];
};
export function configuredHistoricalRate(
  data: AppState,
  jobId: string | null,
  currency: string,
  currentStart: string,
) {
  const snapshots = data.deductions.filter(
    (item) =>
      item.enabled &&
      !item.consumedByPaycheckId &&
      item.applicableToDate &&
      item.applicableToDate < currentStart &&
      (!item.jobId || !jobId || item.jobId === jobId),
  );
  const groups = new Map<
    string,
    { start: string; end: string; amount: number }
  >();
  snapshots.forEach((item) => {
    const end = item.applicableToDate!;
    const start = item.applicableFromDate ?? end;
    const key = `${start}|${end}`;
    const value = groups.get(key) ?? { start, end, amount: 0 };
    value.amount += item.amount;
    groups.set(key, value);
  });
  const samples = [...groups.values()]
    .sort((a, b) => b.end.localeCompare(a.end))
    .slice(0, 10)
    .map((period) => {
      const gross = periodEntries(data, period, jobId, currency, true).reduce(
        (sum, entry) => sum + shiftAmounts(entry, data).gross,
        0,
      );
      return gross > 0 ? period.amount / gross : null;
    })
    .filter((value): value is number => value !== null);
  return samples.length
    ? {
        rate: samples.reduce((sum, rate) => sum + rate, 0) / samples.length,
        count: samples.length,
      }
    : null;
}
export function estimateDeductions(
  data: AppState,
  bounds: Bounds,
  jobId: string | null,
  perJobGross: Map<string | null, number>,
  currency: string,
  preferConfigured = false,
): DeductionEstimate {
  const gross = [...perJobGross.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
  if (!validBounds(bounds) || gross <= 0)
    return {
      total: 0,
      taxSetAside: 0,
      source: "fallback",
      label: "No earnings in this period",
      count: 0,
      excluded: 0,
      lineItems: [],
    };
  const enabled = data.deductions.filter(
    (item) =>
      item.enabled &&
      (!item.jobId || !jobId || item.jobId === jobId) &&
      (!item.jobId || scopeCurrency(data, item.jobId) === currency),
  );
  let total = 0;
  let count = 0;
  let excluded = 0;
  let taxSetAside = 0;
  let usedHistory = false;
  const uncovered = new Map<string | null, number>();
  for (const [id, value] of perJobGross) {
    const rate = preferConfigured
      ? null
      : historicalRate(data.paychecks, id, currency);
    if (rate) {
      total += value * rate.rate;
      count += rate.count;
      excluded += rate.excluded;
      usedHistory = true;
    } else uncovered.set(id, value);
  }
  const uncoveredGross = [...uncovered.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
  const lineItems = enabled.map((item) => {
    if (item.jobId && !uncovered.has(item.jobId))
      return { id: item.id, label: item.label, amount: 0 };
    const amount = deductionAmount(item, uncoveredGross, uncovered, bounds);
    return { id: item.id, label: item.label, amount };
  });
  const configuredTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  total += configuredTotal;
  enabled.forEach((item) => {
    if (item.taxSetAside)
      taxSetAside += lineItems.find((line) => line.id === item.id)?.amount ?? 0;
  });
  // Past date-bounded snapshots inform new estimates without being charged again as an actual deduction.
  if (uncoveredGross > 0 && enabled.length && configuredTotal === 0) {
    const periods = new Map<string, number>();
    enabled
      .filter(
        (item) =>
          item.applicableToDate &&
          item.applicableToDate < bounds.start &&
          item.frequency !== "one-time",
      )
      .forEach((item) => {
        const key = item.applicableToDate!;
        periods.set(key, (periods.get(key) ?? 0) + item.amount);
      });
    const amounts = [...periods.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 10)
      .map(([, value]) => value);
    const historicalScope =
      uncovered.size === 1 ? ([...uncovered.keys()][0] ?? null) : jobId;
    const historical = configuredHistoricalRate(
      data,
      historicalScope,
      currency,
      bounds.start,
    );
    if (historical && historical.rate > 0)
      total += uncoveredGross * historical.rate;
    else if (amounts.length)
      total += amounts.reduce((sum, value) => sum + value, 0) / amounts.length;
  }
  // Jobs with no applicable deduction rules use the client's explicit temporary 25% fallback.
  for (const [id, value] of uncovered)
    if (!enabled.some((item) => !item.jobId || item.jobId === id))
      total += value * 0.25;
  const source = usedHistory
    ? "actual-history"
    : enabled.length
      ? "configured"
      : "fallback";
  return {
    total: Math.min(gross, Math.max(0, total)),
    taxSetAside: Math.min(gross, taxSetAside),
    source,
    count,
    excluded,
    lineItems,
    label:
      source === "actual-history"
        ? `Based on confirmed paycheck history (${count} samples${excluded ? `; ${excluded} outliers excluded` : ""})`
        : source === "configured"
          ? "Based on saved deduction settings"
          : "Temporary 25% estimate — no paycheck or deduction data",
  };
}
export function financialSummary(
  data: AppState,
  bounds: Bounds,
  jobId: string | null,
  currency: string,
  now = Date.now(),
  preferConfigured = false,
  includeLive = true,
) {
  const entries = periodEntries(data, bounds, jobId, currency);
  const perJobGross = new Map<string | null, number>();
  let gross = 0;
  let cashTips = 0;
  let paid = 0;
  let minutes = 0;
  let overtime = 0;
  const rows = new Map<
    string | null,
    {
      jobId: string | null;
      gross: number;
      cashTips: number;
      minutes: number;
      count: number;
    }
  >();
  entries.forEach((entry) => {
    const amounts = shiftAmounts(entry, data);
    const id = entry.jobId ?? null;
    gross += amounts.gross;
    cashTips += amounts.cashTips;
    minutes += amounts.minutes;
    overtime += Math.max(
      0,
      amounts.minutes -
        (entry.overtimeThreshold ??
          data.jobs.find((job) => job.id === id)?.overtimeThreshold ??
          data.defaultPlan.overtimeThreshold) *
          60,
    );
    const covered = data.paychecks.some(
      (record) =>
        record.paid &&
        record.jobId === id &&
        entry.entryType !== "project" &&
        entry.date >= record.startDate &&
        entry.date <= record.endDate,
    );
    if (entry.paid || covered) paid += amounts.gross;
    perJobGross.set(id, (perJobGross.get(id) ?? 0) + amounts.gross);
    const row = rows.get(id) ?? {
      jobId: id,
      gross: 0,
      cashTips: 0,
      minutes: 0,
      count: 0,
    };
    row.gross += amounts.gross;
    row.cashTips += amounts.cashTips;
    row.minutes += amounts.minutes;
    row.count++;
    rows.set(id, row);
  });
  const active = data.activeShift;
  const live =
    includeLive &&
    active &&
    validBounds(bounds) &&
    active.date >= bounds.start &&
    active.date <= bounds.end &&
    (!jobId || active.jobId === jobId) &&
    entryCurrency(active, data) === currency
      ? shiftAmounts(active, data, now)
      : null;
  if (live && active) {
    gross += live.gross;
    minutes += live.minutes;
    perJobGross.set(
      active.jobId ?? null,
      (perJobGross.get(active.jobId ?? null) ?? 0) + live.gross,
    );
  }
  const estimate = estimateDeductions(
    data,
    bounds,
    jobId,
    perJobGross,
    currency,
    preferConfigured,
  );
  // Confirmed full periods override estimates; a partially selected period keeps the proportional estimate.
  const confirmed = data.paychecks.filter(
    (record) =>
      record.paid &&
      (!jobId || record.jobId === jobId) &&
      (record.currency ?? "USD") === currency &&
      record.startDate >= bounds.start &&
      record.endDate <= bounds.end &&
      Number.isFinite(record.totalDeductions),
  );
  const actual = confirmed.reduce(
    (sum, record) => sum + record.totalDeductions!,
    0,
  );
  const remaining = new Map(perJobGross);
  for (const record of confirmed) {
    const coveredGross = entries
      .filter(
        (entry) =>
          entry.entryType !== "project" &&
          entry.jobId === record.jobId &&
          entry.date >= record.startDate &&
          entry.date <= record.endDate,
      )
      .reduce((sum, entry) => sum + shiftAmounts(entry, data).gross, 0);
    remaining.set(
      record.jobId,
      Math.max(0, (remaining.get(record.jobId) ?? 0) - coveredGross),
    );
  }
  const remainderEstimate = estimateDeductions(
    data,
    bounds,
    jobId,
    remaining,
    currency,
    preferConfigured,
  );
  const deductionTotal = confirmed.length
    ? Math.min(gross, actual + remainderEstimate.total)
    : estimate.total;
  return {
    entries,
    gross,
    cashTips,
    paid,
    outstanding: Math.max(0, gross - paid),
    minutes,
    overtime,
    daysWorked: new Set(
      entries
        .filter((entry) => workedMinutes(entry) > 0)
        .map((entry) => entry.date),
    ).size,
    rows: [...rows.values()],
    deductions: deductionTotal,
    taxSetAside: confirmed.length
      ? remainderEstimate.taxSetAside
      : estimate.taxSetAside,
    net: Math.max(
      0,
      gross -
        (deductionTotal -
          (confirmed.length
            ? remainderEstimate.taxSetAside
            : estimate.taxSetAside)),
    ),
    takeHome: Math.max(0, gross - deductionTotal),
    estimate,
    confirmedCount: confirmed.length,
    live: Boolean(live),
    count: entries.length + (live ? 1 : 0),
  };
}
export function projectedDeductions(
  data: AppState,
  jobId: string | null,
  annualGross = 0,
  today = localDate(),
  perJobAnnualGross = new Map<string | null, number>(),
) {
  const items = data.deductions.filter(
    (item) =>
      item.enabled &&
      !item.consumedByPaycheckId &&
      item.frequency !== "one-time" &&
      (!jobId || !item.jobId || item.jobId === jobId),
  );
  const snapshots = new Map<string, Map<string, number>>();
  let annual = 0;
  for (const item of items) {
    if (
      item.frequency === "per-pay-period" &&
      item.applicableFromDate &&
      item.applicableToDate
    ) {
      const key = item.jobId ?? "all";
      const periods = snapshots.get(key) ?? new Map<string, number>();
      periods.set(
        item.applicableToDate,
        (periods.get(item.applicableToDate) ?? 0) + item.amount,
      );
      snapshots.set(key, periods);
    } else if (
      (!item.applicableFromDate || item.applicableFromDate <= today) &&
      (!item.applicableToDate || item.applicableToDate >= today)
    )
      annual += item.isPercentage
        ? ((item.jobId
            ? (perJobAnnualGross.get(item.jobId) ??
              (jobId === item.jobId ? annualGross : 0))
            : annualGross) *
            item.amount) /
          100
        : item.amount * annualMultipliers[item.frequency];
  }
  for (const [id, periods] of snapshots) {
    const values = [...periods.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 10)
      .map(([, value]) => value);
    annual +=
      median(values) *
      periodsPerYear[
        data.jobs.find((job) => job.id === id)?.payFrequency ?? "biweekly"
      ];
  }
  return { annual, monthly: annual / 12 };
}
export function validateDeduction(item: Deduction) {
  if (!item.label.trim()) return "Enter a deduction name.";
  if (
    !Number.isFinite(item.amount) ||
    item.amount < 0 ||
    (item.isPercentage && item.amount > 100)
  )
    return "Enter a valid non-negative amount (percentages cannot exceed 100%).";
  if (
    (item.applicableFromDate && !validDate(item.applicableFromDate)) ||
    (item.applicableToDate && !validDate(item.applicableToDate)) ||
    (item.payDate && !validDate(item.payDate))
  )
    return "Choose valid dates.";
  if (
    item.applicableFromDate &&
    item.applicableToDate &&
    item.applicableFromDate > item.applicableToDate
  )
    return "Applicable end date must be on or after the start date.";
  if (
    item.frequency === "one-time" &&
    (!item.applicableFromDate || !item.applicableToDate)
  )
    return "One-time deductions need both an applicable start and end date.";
  return null;
}
export function paycheckDraft(data: AppState, jobId: string, bounds: Bounds) {
  const currency = scopeCurrency(data, jobId);
  const entries = periodEntries(data, bounds, jobId, currency, true);
  const gross = entries.reduce(
    (sum, entry) => sum + shiftAmounts(entry, data).gross,
    0,
  );
  const estimate = estimateDeductions(
    data,
    bounds,
    jobId,
    new Map([[jobId, gross]]),
    currency,
  );
  return {
    gross,
    deductions: estimate.total,
    hours: entries.reduce((sum, entry) => sum + workedMinutes(entry), 0) / 60,
    entries,
    estimate,
  };
}
export function validateReceipt(record: MockPaycheck) {
  if (
    !validBounds({ start: record.startDate, end: record.endDate }) ||
    !record.payDate ||
    !validDate(record.payDate)
  )
    return "Choose a valid period and pay date.";
  if (
    ![record.grossPay, record.totalDeductions, record.netPay].every(
      (value) =>
        typeof value === "number" && Number.isFinite(value) && value >= 0,
    )
  )
    return "Enter valid non-negative paycheck amounts.";
  if (record.totalDeductions! > record.grossPay!)
    return "Deductions cannot exceed gross pay.";
  if (
    Math.abs(record.netPay! - (record.grossPay! - record.totalDeductions!)) >
    0.011
  )
    return "Net pay must equal gross pay minus deductions.";
  return null;
}
export function consumptionIds(data: AppState, record: MockPaycheck) {
  const bounds = { start: record.startDate, end: record.endDate };
  return data.deductions
    .filter(
      (item) =>
        item.enabled &&
        item.frequency === "one-time" &&
        !item.consumedByPaycheckId &&
        (!item.jobId || item.jobId === record.jobId) &&
        deductionAmount(
          item,
          record.grossPay ?? 0,
          new Map([[record.jobId, record.grossPay ?? 0]]),
          bounds,
        ) > 0,
    )
    .map((item) => item.id);
}
