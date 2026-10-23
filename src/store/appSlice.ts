import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  AppState,
  Shift,
  TodayPlan,
  ReminderSettings,
  Deduction,
  MockPaycheck,
  PaySchedule,
  MockJob,
  MockAccount,
  MockAuthFlow,
} from "../types";
import {
  authDefaults,
  canReuseStarter,
  migrateAuth,
  mockAccount,
  normalizeEmail,
  prepareOnboardingJob,
  validDemoFlow,
  type OnboardingJobDraft,
} from "../features/auth/model";
import {
  preferenceDefaults,
  validateSettings,
  type SettingsDraft,
} from "../features/settings/model";
import { applyImport, type ImportData } from "../features/settings/backup";
import { localDate } from "../utils/dateOnly";
import {
  jobEditError,
  jobPlan,
  jobReferenced,
  normalizeJob,
  validateJob,
} from "../features/jobs/model";

function applyJobDefaults(state: AppState, job: MockJob) {
  state.selectedJobId = job.id;
  state.todayPlan = jobPlan(job, state.defaultPlan);
  {
    const settings = job.reminderSettings ?? state.preferences.defaultReminders;
    state.reminders = {
      ...state.reminders,
      lunchReminder: settings.lunchMode !== "off",
      returnReminder: settings.returnReminder,
      reminderSnoozeMinutes: settings.snoozeMinutes,
      reminderSound: settings.sound,
      reminderOverlay: settings.overlay,
      reminderTabFlash: settings.indicator,
    };
  }
}

export const initialAppState: AppState = {
  preferences: preferenceDefaults(),
  account: { mode: "guest", name: "", email: "" },
  auth: authDefaults(),
  activeShift: null,
  extraShifts: [],
  history: [],
  hourlyRate: 24,
  isPremium: false,
  todayPlan: {
    plannedHours: 8,
    lunchEnabled: true,
    lunchMinutes: 30,
    hourlyRate: 24,
    overtimeThreshold: 8,
    overtimeMultiplier: 1.5,
    planningMode: "duration",
    plannedClockOut: null,
    timerDirection: "count-up",
  },
  reminders: {
    lunchReminder: true,
    returnReminder: true,
    customReminderMinutes: null,
    reminderSnoozeMinutes: 10,
    reminderOverlay: true,
    reminderSound: true,
    reminderTabFlash: true,
  },
  jobs: [
    {
      id: "default",
      name: "Default job",
      hourlyRate: 24,
      color: "#d65c90",
      isDefault: true,
    },
  ],
  selectedJobId: "default",
  deductionRate: 0.1,
  defaultPlan: {
    plannedHours: 8,
    lunchEnabled: true,
    lunchMinutes: 30,
    hourlyRate: 24,
    overtimeThreshold: 8,
    overtimeMultiplier: 1.5,
    planningMode: "duration",
    plannedClockOut: null,
    timerDirection: "count-up",
  },
  orphanedShift: null,
  breakIncludedInRemaining: false,
  notificationPermission: "default",
  notificationPromptDismissed: false,
  scheduledLunchReminderId: null,
  scheduledReturnReminderId: null,
  deductions: [],
  paychecks: [],
  payVisible: false,
  paySchedules: {},
  jobReminderAcknowledgements: {},
};

export function resetWorkspaceState(state: AppState): AppState {
  return {
    ...initialAppState,
    account: state.account,
    isPremium: state.isPremium,
    auth: {
      ...state.auth,
      pending: null,
      onboarding: {
        ...state.auth.onboarding,
        createdJobIds: [],
        lastSavedJobId: null,
      },
    },
  };
}

const appSlice = createSlice({
  name: "app",
  initialState: initialAppState,
  reducers: {
    enterGuest: (state) => {
      if (state.account.mode === "mock")
        state.auth.lastProfile = {
          name: state.account.name,
          email: state.account.email,
        };
      state.account = { mode: "guest", name: "", email: "" };
      state.auth.session = "guest";
      state.auth.pending = null;
    },
    enterMockSession: (state, action: PayloadAction<MockAccount>) => {
      if (!action.payload.email.trim()) return;
      const same =
        normalizeEmail(state.auth.lastProfile?.email ?? "") ===
        normalizeEmail(action.payload.email);
      const converting = state.auth.session === "guest";
      state.account = mockAccount(
        action.payload.email,
        action.payload.name || (same ? state.auth.lastProfile?.name : ""),
      );
      state.auth.lastProfile = {
        name: state.account.name,
        email: state.account.email,
      };
      state.auth.session = "mock";
      state.auth.pending = null;
      if (!same) state.auth.onboarding = authDefaults().onboarding;
      if (converting) state.auth.guestConversionAt = new Date().toISOString();
    },
    signOutMockSession: (state) => {
      if (state.account.mode === "mock")
        state.auth.lastProfile = {
          name: state.account.name,
          email: state.account.email,
        };
      state.account = { mode: "guest", name: "", email: "" };
      state.auth.session = "signed-out";
      state.auth.pending = null;
    },
    prepareMockFlow: (state, action: PayloadAction<MockAuthFlow>) => {
      const flow = action.payload;
      if (
        !flow.id ||
        !flow.email.trim() ||
        !["confirmation", "recovery"].includes(flow.kind) ||
        !Number.isFinite(flow.createdAt)
      )
        return;
      state.auth.pending = {
        id: flow.id,
        kind: flow.kind,
        email: normalizeEmail(flow.email),
        name: flow.name.trim(),
        createdAt: flow.createdAt,
      };
    },
    clearMockFlow: (state) => {
      state.auth.pending = null;
    },
    completeMockConfirmation: (
      state,
      action: PayloadAction<{ id: string; now: number }>,
    ) => {
      const flow = state.auth.pending;
      if (
        !validDemoFlow(
          flow,
          { demo: "1", flow: "confirmation", id: action.payload.id },
          action.payload.now,
        )
      )
        return;
      const same =
        normalizeEmail(state.auth.lastProfile?.email ?? "") === flow!.email;
      if (state.auth.session === "guest")
        state.auth.guestConversionAt = new Date().toISOString();
      state.account = mockAccount(flow!.email, flow!.name);
      state.auth.lastProfile = {
        name: state.account.name,
        email: state.account.email,
      };
      state.auth.session = "mock";
      state.auth.pending = null;
      if (!same) state.auth.onboarding = authDefaults().onboarding;
    },
    completeMockRecovery: (
      state,
      action: PayloadAction<{ id: string; now: number }>,
    ) => {
      if (
        validDemoFlow(
          state.auth.pending,
          { demo: "1", flow: "recovery", id: action.payload.id },
          action.payload.now,
        )
      )
        state.auth.pending = null;
    },
    advanceOnboarding: (state, action: PayloadAction<string>) => {
      if (state.auth.session !== "mock" || !action.payload.trim()) return;
      state.account.name = action.payload.trim();
      state.auth.lastProfile = {
        name: state.account.name,
        email: state.account.email,
      };
      state.auth.onboarding.step = 2;
    },
    backOnboarding: (state) => {
      state.auth.onboarding.step = 1;
    },
    clearOnboardingSuccess: (state) => {
      state.auth.onboarding.lastSavedJobId = null;
    },
    saveOnboardingJob: (
      state,
      action: PayloadAction<{ draft: OnboardingJobDraft; id: string }>,
    ) => {
      if (state.auth.session !== "mock" || state.auth.onboarding.lastSavedJobId)
        return;
      const reusable = canReuseStarter(state);
      const result = prepareOnboardingJob(
        state,
        action.payload.draft,
        action.payload.id,
      );
      if (
        "error" in result ||
        (state.jobs.some((job) => job.id === result.job.id) && !reusable)
      )
        return;
      if (reusable) state.jobs = [result.job];
      else state.jobs.push(result.job);
      if (result.job.isDefault && !state.activeShift)
        applyJobDefaults(state, result.job);
      state.auth.onboarding.createdJobIds.push(result.job.id);
      state.auth.onboarding.lastSavedJobId = result.job.id;
    },
    finishOnboarding: (state, action: PayloadAction<string>) => {
      if (state.auth.session !== "mock") return;
      if (action.payload.trim()) state.account.name = action.payload.trim();
      state.auth.lastProfile = {
        name: state.account.name,
        email: state.account.email,
      };
      state.auth.onboarding.complete = true;
      state.auth.onboarding.step = 1;
      state.auth.onboarding.lastSavedJobId = null;
    },
    saveSettings: (state, action: PayloadAction<SettingsDraft>) => {
      if (validateSettings(action.payload)) return;
      const { preferences, plan, breakIncluded } = action.payload;
      const privacyChanged =
        preferences.payHiddenByDefault !== state.preferences.payHiddenByDefault;
      state.preferences = preferences;
      state.defaultPlan = plan;
      state.hourlyRate = plan.hourlyRate;
      state.breakIncludedInRemaining = breakIncluded;
      if (privacyChanged) state.payVisible = !preferences.payHiddenByDefault;
      if (!state.activeShift) {
        const job = state.jobs.find((item) => item.id === state.selectedJobId);
        state.todayPlan = job ? jobPlan(job, plan) : plan;
      } else state.todayPlan.timerDirection = plan.timerDirection;
      const settings =
        state.jobs.find((item) => item.id === state.selectedJobId)
          ?.reminderSettings ?? preferences.defaultReminders;
      state.reminders = {
        ...state.reminders,
        lunchReminder: settings.lunchMode !== "off",
        returnReminder: settings.returnReminder,
        reminderSound: settings.sound,
        reminderOverlay: settings.overlay,
        reminderTabFlash: settings.indicator,
        reminderSnoozeMinutes: settings.snoozeMinutes,
      };
    },
    setThemeHue: (state, action: PayloadAction<number>) => {
      const draft = {
        preferences: { ...state.preferences, themeHue: action.payload },
        plan: state.defaultPlan,
        breakIncluded: state.breakIncludedInRemaining,
      };
      if (!validateSettings(draft)) state.preferences.themeHue = action.payload;
    },
    setMockAccount: (state, action: PayloadAction<MockAccount>) => {
      state.account = action.payload;
      if (action.payload.mode === "mock")
        state.auth.lastProfile = {
          name: action.payload.name,
          email: action.payload.email,
        };
    },
    restoreData: (
      state,
      action: PayloadAction<{
        imported: ImportData;
        mode: "merge" | "replace";
        includeSettings: boolean;
      }>,
    ) => {
      return applyImport(
        state,
        action.payload.imported,
        action.payload.mode,
        action.payload.includeSettings,
      );
    },
    resetLocalData: (state) => resetWorkspaceState(state),
    hydrate: (_state, action: PayloadAction<Partial<AppState>>) => {
      const savedJobs = action.payload.jobs;
      const hasLegacyPlaceholderJobs = savedJobs?.some(
        (job) =>
          job.id === "primary" ||
          job.id === "side" ||
          job.name === "Primary job" ||
          job.name === "Side project",
      );
      const jobs =
        hasLegacyPlaceholderJobs || !savedJobs
          ? initialAppState.jobs
          : savedJobs;
      const selectedJobId = jobs.some(
        (job) => !job.archived && job.id === action.payload.selectedJobId,
      )
        ? action.payload.selectedJobId!
        : (jobs.find((job) => !job.archived && job.isDefault)?.id ??
          jobs.find((job) => !job.archived)?.id ??
          "");
      const savedActiveShift = action.payload.activeShift ?? null;
      const isOrphaned = Boolean(
        savedActiveShift &&
        savedActiveShift.date !== localDate(new Date()) &&
        !savedActiveShift.endedAt,
      );
      return {
        ...initialAppState,
        ...action.payload,
        auth: migrateAuth(action.payload),
        payVisible:
          action.payload.payVisible ??
          (action.payload.preferences
            ? !action.payload.preferences.payHiddenByDefault
            : true),
        preferences: {
          ...preferenceDefaults(),
          payHiddenByDefault:
            action.payload.preferences?.payHiddenByDefault ?? false,
          ...action.payload.preferences,
          defaultReminders: {
            ...preferenceDefaults().defaultReminders,
            ...action.payload.preferences?.defaultReminders,
          },
        },
        account: {
          mode: action.payload.account?.mode === "mock" ? "mock" : "guest",
          name:
            typeof action.payload.account?.name === "string"
              ? action.payload.account.name
              : "",
          email:
            typeof action.payload.account?.email === "string"
              ? action.payload.account.email
              : "",
        },
        activeShift: isOrphaned ? null : savedActiveShift,
        extraShifts: action.payload.extraShifts ?? [],
        orphanedShift: isOrphaned
          ? savedActiveShift
          : (action.payload.orphanedShift ?? null),
        jobs,
        selectedJobId,
        todayPlan: {
          ...initialAppState.todayPlan,
          ...(action.payload.todayPlan ?? {}),
        },
        reminders: {
          ...initialAppState.reminders,
          ...(action.payload.reminders ?? {}),
        },
        defaultPlan: {
          ...initialAppState.defaultPlan,
          ...(action.payload.defaultPlan ?? {}),
        },
      };
    },
    clockIn: (state, action: PayloadAction<Shift>) => {
      state.activeShift = action.payload;
    },
    startExtraShift: (state, action: PayloadAction<Shift>) => {
      if (
        !state.isPremium ||
        !state.preferences.allowConcurrentShifts ||
        !state.activeShift ||
        action.payload.jobId === state.activeShift.jobId ||
        state.extraShifts.some((shift) => shift.jobId === action.payload.jobId)
      )
        return;
      state.extraShifts.push(action.payload);
    },
    clockOutExtraShift: (state, action: PayloadAction<Shift>) => {
      state.extraShifts = state.extraShifts.filter(
        (shift) => shift.id !== action.payload.id,
      );
      state.history.unshift(action.payload);
    },
    updateHistoryShift: (
      state,
      action: PayloadAction<{ id: string; changes: Partial<Shift> }>,
    ) => {
      const index = state.history.findIndex(
        (shift) => shift.id === action.payload.id,
      );
      if (index >= 0) {
        const existing = state.history[index]!;
        const changed = { ...existing, ...action.payload.changes } as Shift;
        if (
          action.payload.changes.paid !== undefined &&
          action.payload.changes.paid !== existing.paid
        )
          changed.paidByPaycheckId = null;
        state.history[index] = changed;
      }
    },
    deleteHistoryShift: (state, action: PayloadAction<string>) => {
      state.history = state.history.filter(
        (shift) => shift.id !== action.payload,
      );
    },
    toggleHistoryPaid: (state, action: PayloadAction<string>) => {
      const shift = state.history.find((item) => item.id === action.payload);
      if (shift) {
        shift.paid = !shift.paid;
        shift.paidAt = shift.paid ? new Date().toISOString() : null;
        shift.paidByPaycheckId = null;
      }
    },
    markHistoryPaidMany: (state, action: PayloadAction<string[]>) => {
      const ids = new Set(action.payload);
      state.history.forEach((shift) => {
        const paycheck = state.paychecks.some(
          (paycheck) =>
            paycheck.paid &&
            paycheck.jobId === shift.jobId &&
            shift.date >= paycheck.startDate &&
            shift.date <= paycheck.endDate,
        );
        if (
          ids.has(shift.id) &&
          !shift.paid &&
          shift.entryType !== "project" &&
          !paycheck
        ) {
          shift.paid = true;
          shift.paidAt = new Date().toISOString();
        }
      });
    },
    clockOut: (state, action: PayloadAction<Shift>) => {
      state.activeShift = null;
      state.history.unshift(action.payload);
    },
    resolveOrphanedShift: (state, action: PayloadAction<Shift>) => {
      state.orphanedShift = null;
      state.history.unshift(action.payload);
    },
    discardOrphanedShift: (state) => {
      state.orphanedShift = null;
    },
    updateBreakPreference: (state, action: PayloadAction<boolean>) => {
      state.breakIncludedInRemaining = action.payload;
    },
    setNotificationPermission: (
      state,
      action: PayloadAction<AppState["notificationPermission"]>,
    ) => {
      state.notificationPermission = action.payload;
    },
    dismissNotificationPrompt: (state) => {
      state.notificationPromptDismissed = true;
    },
    setScheduledLunchReminder: (
      state,
      action: PayloadAction<string | null>,
    ) => {
      state.scheduledLunchReminderId = action.payload;
    },
    setScheduledReturnReminder: (
      state,
      action: PayloadAction<string | null>,
    ) => {
      state.scheduledReturnReminderId = action.payload;
    },
    clearScheduledReminders: (state) => {
      state.scheduledLunchReminderId = null;
      state.scheduledReturnReminderId = null;
    },
    startLunch: (state, action: PayloadAction<string>) => {
      if (state.activeShift) state.activeShift.lunchStartedAt = action.payload;
    },
    endLunch: (state, action: PayloadAction<string>) => {
      if (state.activeShift?.lunchStartedAt) {
        state.activeShift.lunchMinutes += Math.max(
          0,
          Math.round(
            (Date.parse(action.payload) -
              Date.parse(state.activeShift.lunchStartedAt)) /
              60000,
          ),
        );
        state.activeShift.lunchStartedAt = null;
      }
    },
    startBreak: (
      state,
      action: PayloadAction<{ at: string; label?: string }>,
    ) => {
      if (state.activeShift) {
        state.activeShift.breakStartedAt = action.payload.at;
        state.activeShift.breakLabel = action.payload.label ?? "General break";
      }
    },
    endBreak: (state, action: PayloadAction<string>) => {
      if (state.activeShift?.breakStartedAt) {
        state.activeShift.breakMinutes += Math.max(
          0,
          Math.round(
            (Date.parse(action.payload) -
              Date.parse(state.activeShift.breakStartedAt)) /
              60000,
          ),
        );
        state.activeShift.breakStartedAt = null;
        state.activeShift.breakLabel = null;
      }
    },
    addManualShift: (state, action: PayloadAction<Shift>) => {
      state.history.unshift(action.payload);
    },
    setPayVisible: (state, action: PayloadAction<boolean>) => {
      state.payVisible = action.payload;
    },
    setPremiumPreview: (state, action: PayloadAction<boolean>) => {
      state.isPremium = action.payload;
    },
    savePaySchedule: (
      state,
      action: PayloadAction<{
        scope: string;
        schedule: PaySchedule;
        applyToJob?: boolean;
      }>,
    ) => {
      state.paySchedules[action.payload.scope] = action.payload.schedule;
      if (action.payload.applyToJob) {
        const job = state.jobs.find((job) => job.id === action.payload.scope);
        if (job) {
          const schedule = action.payload.schedule;
          job.payFrequency = schedule.frequency;
          job.payPeriodStart = schedule.periodStart;
          job.payPeriodEnd = schedule.periodEnd;
          job.nextPayDate = schedule.payDate;
          job.payDelayDays = schedule.payDelayDays;
        }
      }
    },
    upsertDeduction: (state, action: PayloadAction<Deduction>) => {
      const index = state.deductions.findIndex(
        (item) => item.id === action.payload.id,
      );
      if (index < 0) state.deductions.push(action.payload);
      else state.deductions[index] = action.payload;
    },
    removeDeduction: (state, action: PayloadAction<string>) => {
      state.deductions = state.deductions.filter(
        (item) => item.id !== action.payload,
      );
    },
    recordPaycheck: (
      state,
      action: PayloadAction<{
        paycheck: MockPaycheck;
        markShifts: boolean;
        consumeDeductionIds: string[];
      }>,
    ) => {
      const { paycheck, markShifts, consumeDeductionIds } = action.payload;
      if (
        state.paychecks.some(
          (item) =>
            item.jobId === paycheck.jobId &&
            item.startDate <= paycheck.endDate &&
            item.endDate >= paycheck.startDate,
        )
      )
        return;
      state.paychecks.push(paycheck);
      if (markShifts)
        state.history.forEach((shift) => {
          if (
            !shift.paid &&
            shift.entryType !== "project" &&
            shift.endedAt &&
            !shift.missingClockIn &&
            shift.jobId === paycheck.jobId &&
            shift.date >= paycheck.startDate &&
            shift.date <= paycheck.endDate
          ) {
            shift.paid = true;
            shift.paidAt = new Date().toISOString();
            shift.paidByPaycheckId = paycheck.id;
          }
        });
      state.deductions.forEach((item) => {
        if (
          item.enabled &&
          item.frequency === "one-time" &&
          !item.consumedByPaycheckId &&
          consumeDeductionIds.includes(item.id)
        )
          item.consumedByPaycheckId = paycheck.id;
      });
    },
    deletePaycheck: (state, action: PayloadAction<string>) => {
      state.paychecks = state.paychecks.filter(
        (item) => item.id !== action.payload,
      );
      state.history.forEach((shift) => {
        if (shift.paidByPaycheckId === action.payload) {
          shift.paid = false;
          shift.paidAt = null;
          shift.paidByPaycheckId = null;
        }
      });
      state.deductions.forEach((item) => {
        if (item.consumedByPaycheckId === action.payload)
          item.consumedByPaycheckId = undefined;
      });
    },
    discardActiveHistoryShift: (state) => {
      if (state.activeShift)
        state.history = state.history.filter(
          (shift) => shift.id !== state.activeShift!.id,
        );
      state.activeShift = null;
      state.scheduledLunchReminderId = null;
      state.scheduledReturnReminderId = null;
    },
    reactivateHistoryShift: (state, action: PayloadAction<string>) => {
      const shift = state.history.find((shift) => shift.id === action.payload);
      if (
        state.activeShift ||
        !shift ||
        shift.entryType === "project" ||
        shift.missingClockIn ||
        shift.endedAt
      )
        return;
      state.activeShift = { ...shift };
      state.history = state.history.filter((item) => item.id !== shift.id);
    },
    updateTodayPlan: (state, action: PayloadAction<Partial<TodayPlan>>) => {
      state.todayPlan = { ...state.todayPlan, ...action.payload };
    },
    savePlanAsDefault: (state) => {
      state.defaultPlan = { ...state.todayPlan };
    },
    resetTodayPlan: (state) => {
      const job = state.jobs.find(
        (item) => item.id === (state.activeShift?.jobId ?? state.selectedJobId),
      );
      state.todayPlan = job
        ? jobPlan(job, state.defaultPlan)
        : { ...state.defaultPlan };
    },
    upsertJob: (state, action: PayloadAction<MockJob>) => {
      if (validateJob(action.payload) || jobEditError(state, action.payload))
        return;
      const job = normalizeJob(action.payload);
      const existing = state.jobs.find((item) => item.id === job.id);
      const oldSchedule = existing
        ? `${existing.payFrequency}:${existing.payPeriodStart}:${existing.nextPayDate}`
        : "";
      // A running shift keeps its current plan; selecting a different job is disabled until clock-out.
      const makeDefault =
        !state.jobs.some((item) => !item.archived) ||
        job.isDefault ||
        existing?.isDefault;
      if (makeDefault)
        state.jobs.forEach((item) => {
          item.isDefault = item.id === job.id;
        });
      job.isDefault = Boolean(makeDefault);
      if (existing) Object.assign(existing, job);
      else state.jobs.push(job);
      if (
        existing &&
        oldSchedule !==
          `${job.payFrequency}:${job.payPeriodStart}:${job.nextPayDate}`
      )
        delete state.paySchedules[job.id];
      if (
        !state.activeShift &&
        (job.isDefault ||
          state.selectedJobId === job.id ||
          !state.selectedJobId)
      ) {
        applyJobDefaults(state, job);
      }
    },
    acknowledgeJobReminder: (
      state,
      action: PayloadAction<{ key: string; nextAt: number }>,
    ) => {
      state.jobReminderAcknowledgements[action.payload.key] =
        action.payload.nextAt;
    },
    setDefaultJob: (state, action: PayloadAction<string>) => {
      const job = state.jobs.find(
        (item) => item.id === action.payload && !item.archived,
      );
      if (!job || state.activeShift) return;
      state.jobs.forEach((item) => {
        item.isDefault = item.id === job.id;
      });
      applyJobDefaults(state, job);
    },
    removeJob: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      const job = state.jobs.find((item) => item.id === id);
      if (
        !job ||
        state.activeShift?.jobId === id ||
        state.extraShifts.some((item) => item.jobId === id)
      )
        return;
      if (jobReferenced(state, id)) {
        job.archived = true;
        job.isDefault = false;
      } else state.jobs = state.jobs.filter((item) => item.id !== id);
      delete state.paySchedules[id];
      const remaining = state.jobs.filter((item) => !item.archived);
      if (!remaining.some((item) => item.isDefault) && remaining[0])
        remaining[0].isDefault = true;
      if (state.selectedJobId === id) {
        const next = remaining.find((item) => item.isDefault) ?? remaining[0];
        state.selectedJobId = next?.id ?? "";
        if (next && !state.activeShift) applyJobDefaults(state, next);
      }
    },
    selectJob: (state, action: PayloadAction<string>) => {
      if (state.activeShift) return;
      const job = state.jobs.find(
        (item) => item.id === action.payload && !item.archived,
      );
      if (job) {
        applyJobDefaults(state, job);
      }
    },
    updateReminders: (
      state,
      action: PayloadAction<Partial<ReminderSettings>>,
    ) => {
      state.reminders = { ...state.reminders, ...action.payload };
      const settings = state.jobs.find(
        (job) => job.id === (state.activeShift?.jobId ?? state.selectedJobId),
      )?.reminderSettings;
      if (settings) {
        const changes = action.payload;
        if (changes.lunchReminder !== undefined)
          settings.lunchMode = changes.lunchReminder
            ? settings.lunchMode === "off"
              ? "relative"
              : settings.lunchMode
            : "off";
        if (changes.returnReminder !== undefined)
          settings.returnReminder = changes.returnReminder;
        if (changes.reminderSnoozeMinutes !== undefined)
          settings.snoozeMinutes = changes.reminderSnoozeMinutes;
        if (changes.reminderSound !== undefined)
          settings.sound = changes.reminderSound;
        if (changes.reminderOverlay !== undefined)
          settings.overlay = changes.reminderOverlay;
        if (changes.reminderTabFlash !== undefined)
          settings.indicator = changes.reminderTabFlash;
      }
    },
  },
});

export const {
  enterGuest,
  enterMockSession,
  signOutMockSession,
  prepareMockFlow,
  clearMockFlow,
  completeMockConfirmation,
  completeMockRecovery,
  advanceOnboarding,
  backOnboarding,
  clearOnboardingSuccess,
  saveOnboardingJob,
  finishOnboarding,
  saveSettings,
  setThemeHue,
  setMockAccount,
  restoreData,
  resetLocalData,
  hydrate,
  clockIn,
  startExtraShift,
  clockOutExtraShift,
  updateHistoryShift,
  deleteHistoryShift,
  toggleHistoryPaid,
  markHistoryPaidMany,
  clockOut,
  resolveOrphanedShift,
  discardOrphanedShift,
  updateBreakPreference,
  setNotificationPermission,
  dismissNotificationPrompt,
  setScheduledLunchReminder,
  setScheduledReturnReminder,
  clearScheduledReminders,
  startLunch,
  endLunch,
  startBreak,
  endBreak,
  addManualShift,
  updateTodayPlan,
  savePlanAsDefault,
  resetTodayPlan,
  selectJob,
  updateReminders,
} = appSlice.actions;
export const appReducer = appSlice.reducer;
export const {
  setPayVisible,
  setPremiumPreview,
  discardActiveHistoryShift,
  reactivateHistoryShift,
} = appSlice.actions;
export const {
  savePaySchedule,
  upsertDeduction,
  removeDeduction,
  upsertJob,
  setDefaultJob,
  removeJob,
  acknowledgeJobReminder,
  recordPaycheck,
  deletePaycheck,
} = appSlice.actions;
