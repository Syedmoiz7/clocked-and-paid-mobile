import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AppState, Shift, TodayPlan, ReminderSettings } from "../types";

export const initialAppState: AppState = {
  activeShift: null,
  extraShifts: [],
  history: [],
  hourlyRate: 24,
  isPremium: false,
  todayPlan: { plannedHours: 8, lunchEnabled: true, lunchMinutes: 30, hourlyRate: 24, overtimeThreshold: 8, overtimeMultiplier: 1.5, planningMode: "duration", plannedClockOut: null, timerDirection: "count-up" },
  reminders: { lunchReminder: true, returnReminder: true, customReminderMinutes: null, reminderSnoozeMinutes: 10, reminderOverlay: true, reminderSound: true, reminderTabFlash: true },
  jobs: [{ id: "default", name: "Default job", hourlyRate: 24, color: "#d65c90" }],
  selectedJobId: "default",
  deductionRate: 0.1,
  defaultPlan: { plannedHours: 8, lunchEnabled: true, lunchMinutes: 30, hourlyRate: 24, overtimeThreshold: 8, overtimeMultiplier: 1.5, planningMode: "duration", plannedClockOut: null, timerDirection: "count-up" },
  orphanedShift: null,
  breakIncludedInRemaining: false,
  notificationPermission: "default",
  notificationPromptDismissed: false,
  scheduledLunchReminderId: null,
  scheduledReturnReminderId: null,
  deductions: [],
  paychecks: [],
  payVisible: true,
};

const appSlice = createSlice({
  name: "app",
  initialState: initialAppState,
  reducers: {
    hydrate: (_state, action: PayloadAction<Partial<AppState>>) => {
      const savedJobs = action.payload.jobs;
      const hasLegacyPlaceholderJobs = savedJobs?.some((job) => job.id === "primary" || job.id === "side" || job.name === "Primary job" || job.name === "Side project");
      const jobs = hasLegacyPlaceholderJobs || !savedJobs?.length ? initialAppState.jobs : savedJobs;
      const selectedJobId = jobs.some((job) => job.id === action.payload.selectedJobId) ? action.payload.selectedJobId! : (jobs[0]?.id ?? initialAppState.selectedJobId);
      const savedActiveShift = action.payload.activeShift ?? null;
      const isOrphaned = Boolean(savedActiveShift && savedActiveShift.date !== new Date().toISOString().slice(0, 10) && !savedActiveShift.endedAt);
      return {
        ...initialAppState,
        ...action.payload,
        activeShift: isOrphaned ? null : savedActiveShift,
        extraShifts: action.payload.extraShifts ?? [],
        orphanedShift: isOrphaned ? savedActiveShift : (action.payload.orphanedShift ?? null),
        jobs,
        selectedJobId,
        todayPlan: { ...initialAppState.todayPlan, ...(action.payload.todayPlan ?? {}) },
        reminders: { ...initialAppState.reminders, ...(action.payload.reminders ?? {}) },
        defaultPlan: { ...initialAppState.defaultPlan, ...(action.payload.defaultPlan ?? {}) },
      };
    },
    clockIn: (state, action: PayloadAction<Shift>) => {
      state.activeShift = action.payload;
    },
    startExtraShift: (state, action: PayloadAction<Shift>) => {
      state.extraShifts.push(action.payload);
    },
    clockOutExtraShift: (state, action: PayloadAction<Shift>) => {
      state.extraShifts = state.extraShifts.filter((shift) => shift.id !== action.payload.id);
      state.history.unshift(action.payload);
    },
    updateHistoryShift: (state, action: PayloadAction<{ id: string; changes: Partial<Shift> }>) => {
      const index = state.history.findIndex((shift) => shift.id === action.payload.id);
      if (index >= 0) state.history[index] = { ...state.history[index], ...action.payload.changes } as Shift;
    },
    deleteHistoryShift: (state, action: PayloadAction<string>) => {
      state.history = state.history.filter((shift) => shift.id !== action.payload);
    },
    toggleHistoryPaid: (state, action: PayloadAction<string>) => {
      const shift = state.history.find((item) => item.id === action.payload);
      if (shift) { shift.paid = !shift.paid; shift.paidAt = shift.paid ? new Date().toISOString() : null; }
    },
    markHistoryPaidMany: (state, action: PayloadAction<string[]>) => {
      const ids = new Set(action.payload);
      state.history.forEach((shift) => {
        const paycheck = state.paychecks.some((paycheck) => paycheck.paid && paycheck.jobId === shift.jobId && shift.date >= paycheck.startDate && shift.date <= paycheck.endDate);
        if (ids.has(shift.id) && !shift.paid && shift.entryType !== "project" && !paycheck) { shift.paid = true; shift.paidAt = new Date().toISOString(); }
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
    discardOrphanedShift: (state) => { state.orphanedShift = null; },
    updateBreakPreference: (state, action: PayloadAction<boolean>) => { state.breakIncludedInRemaining = action.payload; },
    setNotificationPermission: (state, action: PayloadAction<AppState["notificationPermission"]>) => { state.notificationPermission = action.payload; },
    dismissNotificationPrompt: (state) => { state.notificationPromptDismissed = true; },
    setScheduledLunchReminder: (state, action: PayloadAction<string | null>) => { state.scheduledLunchReminderId = action.payload; },
    setScheduledReturnReminder: (state, action: PayloadAction<string | null>) => { state.scheduledReturnReminderId = action.payload; },
    clearScheduledReminders: (state) => { state.scheduledLunchReminderId = null; state.scheduledReturnReminderId = null; },
    startLunch: (state, action: PayloadAction<string>) => {
      if (state.activeShift) state.activeShift.lunchStartedAt = action.payload;
    },
    endLunch: (state, action: PayloadAction<string>) => {
      if (state.activeShift?.lunchStartedAt) {
        state.activeShift.lunchMinutes += Math.max(0, Math.round((Date.parse(action.payload) - Date.parse(state.activeShift.lunchStartedAt)) / 60000));
        state.activeShift.lunchStartedAt = null;
      }
    },
    startBreak: (state, action: PayloadAction<{ at: string; label?: string }>) => {
      if (state.activeShift) {
        state.activeShift.breakStartedAt = action.payload.at;
        state.activeShift.breakLabel = action.payload.label ?? "General break";
      }
    },
    endBreak: (state, action: PayloadAction<string>) => {
      if (state.activeShift?.breakStartedAt) {
        state.activeShift.breakMinutes += Math.max(0, Math.round((Date.parse(action.payload) - Date.parse(state.activeShift.breakStartedAt)) / 60000));
        state.activeShift.breakStartedAt = null;
        state.activeShift.breakLabel = null;
      }
    },
    addManualShift: (state, action: PayloadAction<Shift>) => {
      state.history.unshift(action.payload);
    },
    setPayVisible: (state, action: PayloadAction<boolean>) => { state.payVisible = action.payload; },
    setPremiumPreview: (state, action: PayloadAction<boolean>) => { state.isPremium = action.payload; },
    discardActiveHistoryShift: (state) => {
      if (state.activeShift) state.history = state.history.filter((shift) => shift.id !== state.activeShift!.id);
      state.activeShift = null;
      state.scheduledLunchReminderId = null;
      state.scheduledReturnReminderId = null;
    },
    reactivateHistoryShift: (state, action: PayloadAction<string>) => {
      const shift = state.history.find((shift) => shift.id === action.payload);
      if (state.activeShift || !shift || shift.entryType === "project" || shift.missingClockIn || shift.endedAt) return;
      state.activeShift = { ...shift };
      state.history = state.history.filter((item) => item.id !== shift.id);
    },
    updateTodayPlan: (state, action: PayloadAction<Partial<TodayPlan>>) => {
      state.todayPlan = { ...state.todayPlan, ...action.payload };
    },
    savePlanAsDefault: (state) => { state.defaultPlan = { ...state.todayPlan }; },
    resetTodayPlan: (state) => { state.todayPlan = { ...state.defaultPlan }; },
    selectJob: (state, action: PayloadAction<string>) => {
      const job = state.jobs.find((item) => item.id === action.payload);
      if (job) {
        state.selectedJobId = job.id;
        state.todayPlan.hourlyRate = job.hourlyRate;
      }
    },
    updateReminders: (state, action: PayloadAction<Partial<ReminderSettings>>) => {
      state.reminders = { ...state.reminders, ...action.payload };
    },
  },
});

export const { hydrate, clockIn, startExtraShift, clockOutExtraShift, updateHistoryShift, deleteHistoryShift, toggleHistoryPaid, markHistoryPaidMany, clockOut, resolveOrphanedShift, discardOrphanedShift, updateBreakPreference, setNotificationPermission, dismissNotificationPrompt, setScheduledLunchReminder, setScheduledReturnReminder, clearScheduledReminders, startLunch, endLunch, startBreak, endBreak, addManualShift, updateTodayPlan, savePlanAsDefault, resetTodayPlan, selectJob, updateReminders } = appSlice.actions;
export const appReducer = appSlice.reducer;
export const { setPayVisible, setPremiumPreview, discardActiveHistoryShift, reactivateHistoryShift } = appSlice.actions;
