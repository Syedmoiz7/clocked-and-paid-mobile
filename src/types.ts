export type TabKey = "tracker" | "history" | "pay" | "settings";

export type Shift = {
  id: string;
  date: string;
  startedAt: string;
  endedAt: string | null;
  lunchMinutes: number;
  breakMinutes: number;
  earnings: number;
  tips?: number;
  tipType?: "cash" | "paycheck" | "card" | "other" | null;
  missingClockIn?: boolean;
  historyLunchStart?: string | null;
  historyLunchEnd?: string | null;
  breaks?: { id: string; start: string; end: string | null; label?: string }[];
  jobId?: string | null;
  breakLabel?: string | null;
  lunchStartedAt?: string | null;
  breakStartedAt?: string | null;
  entryType?: "shift" | "project";
  projectName?: string | null;
  endDate?: string | null;
  flatAmount?: number | null;
  currency?: string | null;
  projectNotes?: string | null;
  customRate?: number | null;
  lunchPaid?: boolean;
  paid?: boolean;
  paidAt?: string | null;
};

export type Deduction = { id: string; label: string; amount: number; frequency: "daily" | "weekly" | "per-pay-period" | "monthly" | "yearly" | "one-time"; enabled: boolean; jobId?: string | null; isPercentage?: boolean };

export type MockJob = { id: string; name: string; hourlyRate: number; color: string; currency?: string; payFrequency?: "weekly" | "biweekly" | "semi-monthly" | "monthly"; payPeriodStart?: string };

export type MockPaycheck = { id: string; jobId: string; startDate: string; endDate: string; paid: boolean };

export type TodayPlan = {
  plannedHours: number;
  lunchEnabled: boolean;
  lunchMinutes: number;
  hourlyRate: number;
  overtimeThreshold: number;
  overtimeMultiplier: number;
  planningMode: "duration" | "end-time";
  plannedClockOut: string | null;
  timerDirection: "count-up" | "count-down";
};

export type ReminderSettings = {
  lunchReminder: boolean;
  returnReminder: boolean;
  customReminderMinutes: number | null;
  reminderSnoozeMinutes: number;
  reminderOverlay: boolean;
  reminderSound: boolean;
  reminderTabFlash: boolean;
};

export type AppState = {
  activeShift: Shift | null;
  extraShifts: Shift[];
  history: Shift[];
  hourlyRate: number;
  isPremium: boolean;
  todayPlan: TodayPlan;
  reminders: ReminderSettings;
  jobs: MockJob[];
  selectedJobId: string;
  deductionRate: number;
  defaultPlan: TodayPlan;
  orphanedShift: Shift | null;
  breakIncludedInRemaining: boolean;
  notificationPermission: "default" | "granted" | "denied";
  notificationPromptDismissed: boolean;
  scheduledLunchReminderId: string | null;
  scheduledReturnReminderId: string | null;
  deductions: Deduction[];
  paychecks: MockPaycheck[];
  payVisible: boolean;
};
