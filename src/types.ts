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
  tipType?: "cash" | "card" | "other" | null;
  jobId?: string | null;
  breakLabel?: string | null;
  lunchStartedAt?: string | null;
  breakStartedAt?: string | null;
};

export type MockJob = { id: string; name: string; hourlyRate: number; color: string };

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
};
