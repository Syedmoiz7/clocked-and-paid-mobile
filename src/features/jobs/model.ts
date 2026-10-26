import type {
  AppState,
  CustomReminder,
  JobReminderSettings,
  MockJob,
  Shift,
} from "../../types";
import { validDate } from "../../utils/dateOnly";
import { addDays, payPeriod } from "../history/payPeriods";
import { entitlementsFor } from "../../services/entitlements";

export const currencies = [
  "USD",
  "CAD",
  "EUR",
  "GBP",
  "AUD",
  "JPY",
  "INR",
  "MXN",
  "BRL",
  "CHF",
];
export const jobColors = [
  "#d65c90",
  "#e83074",
  "#f37216",
  "#f2a60d",
  "#95ca2b",
  "#37be6f",
  "#2baba1",
  "#20afdf",
  "#4479e4",
  "#6952e0",
  "#9952e0",
  "#b74eda",
  "#df49c6",
];
export function reminderDefaults(): JobReminderSettings {
  return {
    lunchMode: "off",
    lunchHours: 5,
    lunchTime: "12:00",
    returnReminder: true,
    repeatMinutes: 10,
    snoozeMinutes: 10,
    sound: true,
    indicator: true,
    overlay: true,
    custom: [],
  };
}
export function newJob(id: string, rate = 24): MockJob {
  return {
    id,
    name: "",
    title: "",
    notes: "",
    hourlyRate: rate,
    color: jobColors[0]!,
    currency: "USD",
    lunchMinutes: 30,
    lunchEnabled: true,
    enableTips: false,
    reminderSettings: reminderDefaults(),
    createdAt: new Date().toISOString(),
  };
}
export function validateJob(job: MockJob): string | null {
  if (!job.name.trim()) return "Company / job name is required.";
  if (!Number.isFinite(job.hourlyRate) || job.hourlyRate < 0)
    return "Hourly rate must be a non-negative number.";
  if (!currencies.includes(job.currency ?? "USD"))
    return "Choose a supported currency.";
  if (
    job.overtimeThreshold != null &&
    (!Number.isFinite(job.overtimeThreshold) ||
      job.overtimeThreshold < 1 ||
      job.overtimeThreshold > 24)
  )
    return "OT after must be between 1 and 24 hours.";
  if (
    job.overtimeMultiplier != null &&
    (!Number.isFinite(job.overtimeMultiplier) ||
      job.overtimeMultiplier < 1 ||
      job.overtimeMultiplier > 4)
  )
    return "OT multiplier must be between 1 and 4.";
  if (
    job.lunchMinutes != null &&
    (!Number.isInteger(job.lunchMinutes) ||
      job.lunchMinutes < 0 ||
      job.lunchMinutes > 120)
  )
    return "Lunch duration must be a whole number from 0 to 120 minutes.";
  if (
    job.payFrequency &&
    !["weekly", "biweekly", "semi-monthly", "monthly"].includes(
      job.payFrequency,
    )
  )
    return "Choose a supported pay frequency.";
  if (job.payFrequency && !validDate(job.payPeriodStart ?? ""))
    return "Choose an anchor start date for the pay schedule.";
  if (job.nextPayDate && !validDate(job.nextPayDate))
    return "Choose a valid next pay date.";
  const settings = job.reminderSettings;
  if (!settings) return null;
  if (
    !["off", "relative", "fixed"].includes(settings.lunchMode) ||
    !Array.isArray(settings.custom)
  )
    return "Invalid reminder mode or custom reminder list.";
  for (const key of [
    "returnReminder",
    "sound",
    "indicator",
    "overlay",
  ] as const)
    if (typeof settings[key] !== "boolean")
      return "Invalid reminder effect flag.";
  if (
    settings.lunchMode === "relative" &&
    (!Number.isFinite(settings.lunchHours) ||
      settings.lunchHours < 0.5 ||
      settings.lunchHours > 12)
  )
    return "Lunch reminder must be between 0.5 and 12 hours after clock-in.";
  if (settings.lunchMode === "fixed" && !validTime(settings.lunchTime))
    return "Choose a lunch reminder time.";
  if (
    !Number.isInteger(settings.repeatMinutes) ||
    settings.repeatMinutes < 0 ||
    settings.repeatMinutes > 60
  )
    return "Re-fire interval must be 0–60 whole minutes.";
  if (
    !Number.isInteger(settings.snoozeMinutes) ||
    settings.snoozeMinutes < 1 ||
    settings.snoozeMinutes > 60
  )
    return "Snooze must be 1–60 whole minutes.";
  for (const reminder of settings.custom) {
    const error = validateReminder(reminder);
    if (error) return error;
  }
  if (new Set(settings.custom.map((r) => r.id)).size !== settings.custom.length)
    return "Reminder IDs must be unique.";
  return null;
}
export function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function validateReminder(reminder: CustomReminder): string | null {
  if (!reminder || typeof reminder.name !== "string" || !reminder.name.trim())
    return "Reminder name is required.";
  if (
    typeof reminder.id !== "string" ||
    !reminder.id ||
    !["after-clock-in", "after-lunch-start", "at-time"].includes(
      reminder.trigger,
    ) ||
    !["low", "medium", "high"].includes(reminder.priority) ||
    typeof reminder.enabled !== "boolean" ||
    typeof reminder.message !== "string"
  )
    return "Invalid reminder trigger, identity or priority.";
  if (
    reminder.trigger === "at-time"
      ? !validTime(reminder.atTime)
      : !Number.isInteger(reminder.offsetMinutes) ||
        reminder.offsetMinutes < 1 ||
        reminder.offsetMinutes > 480
  )
    return "Choose a time or an offset of 1–480 whole minutes.";
  if (
    !Number.isInteger(reminder.repeatMinutes) ||
    reminder.repeatMinutes < 0 ||
    reminder.repeatMinutes > 120
  )
    return "Reminder repeat must be 0–120 whole minutes.";
  return null;
}
export function normalizeJob(job: MockJob): MockJob {
  const period =
    job.payFrequency && job.payPeriodStart
      ? payPeriod(job.payPeriodStart, job)
      : null;
  return {
    ...job,
    name: job.name.trim(),
    title: job.title?.trim(),
    notes: job.notes?.trim(),
    currency: job.currency ?? "USD",
    payPeriodEnd: period?.end,
    payPeriodStart: job.payFrequency ? job.payPeriodStart : undefined,
    nextPayDate: job.payFrequency ? job.nextPayDate : undefined,
    payDelayDays: job.payFrequency ? jobPayDelay(job) : undefined,
    archived: false,
  };
}

export function jobPayDelay(job: MockJob) {
  if (job.payDelayDays != null) return job.payDelayDays;
  if (!job.nextPayDate || !validDate(job.nextPayDate)) return 7;
  const period = payPeriod(job.nextPayDate, job);
  if (!period) return 7;
  const end =
    period.end <= job.nextPayDate
      ? period.end
      : payPeriod(addDays(period.start, -1), job)?.end;
  if (!end) return 7;
  const number = (value: string) => {
    const [y, m, d] = value.split("-").map(Number);
    return Date.UTC(y!, m! - 1, d!) / 86400000;
  };
  return Math.max(0, number(job.nextPayDate) - number(end));
}
export function jobPlan(job: MockJob, fallback: AppState["defaultPlan"]) {
  return {
    ...fallback,
    hourlyRate: job.hourlyRate,
    overtimeThreshold: job.overtimeThreshold ?? fallback.overtimeThreshold,
    overtimeMultiplier: job.overtimeMultiplier ?? fallback.overtimeMultiplier,
    lunchEnabled: job.lunchEnabled ?? fallback.lunchEnabled,
    lunchMinutes: job.lunchMinutes ?? fallback.lunchMinutes,
  };
}
export function schedulePreview(job: MockJob, today: string) {
  const period = payPeriod(today, job);
  if (!period) return [];
  return [
    { label: "Previous", ...payPeriod(addDays(period.start, -1), job)! },
    { label: "Current", ...period },
    { label: "Next", ...payPeriod(addDays(period.end, 1), job)! },
  ];
}
export function jobReferenced(data: AppState, id: string) {
  return (
    data.history.some((item) => item.jobId === id) ||
    data.paychecks.some((item) => item.jobId === id) ||
    data.deductions.some((item) => item.jobId === id) ||
    data.orphanedShift?.jobId === id
  );
}
export function jobEditError(data: AppState, job: MockJob) {
  const existing = data.jobs.find((item) => item.id === job.id);
  if (data.activeShift && job.isDefault && !existing?.isDefault)
    return "Clock out before changing the active/default job.";
  const running =
    data.activeShift?.jobId === job.id ||
    data.extraShifts.some((item) => item.jobId === job.id);
  if (
    existing &&
    running &&
    (
      [
        "hourlyRate",
        "currency",
        "overtimeThreshold",
        "overtimeMultiplier",
      ] as const
    ).some((key) => existing[key] !== job[key])
  )
    return "Clock out this job before changing its rate, currency or overtime rules.";
  if (
    (!existing || existing.archived) &&
    data.jobs.filter((item) => !item.archived).length >=
      entitlementsFor(data).jobLimit
  )
    return "Multiple jobs require Premium preview.";
  return null;
}

export type JobAlert = {
  key: string;
  jobId: string;
  shiftId: string;
  name: string;
  message: string;
  at: number;
  repeatMinutes: number;
  priority: CustomReminder["priority"];
  settings: JobReminderSettings;
};
// Derive rules from persisted timestamps: mounting a different tab never resets a timer.
export function jobAlerts(shift: Shift, job: MockJob): JobAlert[] {
  const settings = job.reminderSettings;
  if (!settings || shift.endedAt) return [];
  const started = Date.parse(shift.startedAt);
  if (!Number.isFinite(started)) return [];
  const clockTime = (value: string) => {
    if (!validTime(value)) return NaN;
    const date = new Date(started);
    const [h, m] = value.split(":").map(Number);
    date.setHours(h!, m!, 0, 0);
    if (date.getTime() < started - 60000) return NaN;
    return date.getTime();
  };
  const result: JobAlert[] = [];
  const add = (
    id: string,
    name: string,
    message: string,
    at: number,
    repeatMinutes: number,
    priority: CustomReminder["priority"] = "medium",
  ) => {
    if (Number.isFinite(at))
      result.push({
        key: `${shift.id}:${id}:${at}`,
        shiftId: shift.id,
        jobId: job.id,
        name,
        message: message || name,
        at,
        repeatMinutes,
        priority,
        settings,
      });
  };
  if (
    job.lunchEnabled !== false &&
    !shift.lunchStartedAt &&
    !shift.lunchMinutes &&
    settings.lunchMode !== "off"
  )
    add(
      "lunch",
      "Lunch break reminder",
      "Time to take your lunch break.",
      settings.lunchMode === "relative"
        ? started + settings.lunchHours * 3600000
        : clockTime(settings.lunchTime),
      settings.repeatMinutes,
    );
  if (settings.returnReminder && shift.lunchStartedAt)
    add(
      "return",
      "Return to work",
      "Your planned lunch break has ended.",
      Date.parse(shift.lunchStartedAt) + (job.lunchMinutes ?? 30) * 60000,
      settings.repeatMinutes,
    );
  for (const reminder of settings.custom.filter((item) => item.enabled)) {
    if (reminder.trigger === "after-lunch-start" && !shift.lunchStartedAt)
      continue;
    const at =
      reminder.trigger === "at-time"
        ? clockTime(reminder.atTime)
        : Date.parse(
            reminder.trigger === "after-lunch-start"
              ? shift.lunchStartedAt!
              : shift.startedAt,
          ) +
          reminder.offsetMinutes * 60000;
    add(
      reminder.id,
      reminder.name,
      reminder.message,
      at,
      reminder.repeatMinutes,
      reminder.priority,
    );
  }
  return result.sort((a, b) => a.at - b.at);
}

export function alertNextAt(
  alert: JobAlert,
  acknowledgements: Record<string, number>,
) {
  const acknowledged = acknowledgements[alert.key];
  return acknowledged === -1 ? null : (acknowledged ?? alert.at);
}
// iOS limits pending notifications. Use a bounded, chronological rolling queue.
export function notificationTimes(
  alerts: JobAlert[],
  acknowledgements: Record<string, number>,
  now: number,
) {
  const result: { alert: JobAlert; at: number }[] = [];
  for (const alert of alerts) {
    let at = alertNextAt(alert, acknowledgements);
    if (at == null) continue;
    if (at <= now) {
      if (alert.repeatMinutes <= 0) continue;
      at +=
        (Math.floor((now - at) / (alert.repeatMinutes * 60000)) + 1) *
        alert.repeatMinutes *
        60000;
    }
    for (let i = 0; i < 48 && at <= now + 86400000; i++) {
      result.push({ alert, at });
      if (alert.repeatMinutes <= 0) break;
      at += alert.repeatMinutes * 60000;
    }
  }
  return result.sort((a, b) => a.at - b.at).slice(0, 48);
}
