import { useCallback } from "react";
import { Alert } from "react-native";
import { TrackerScreen } from "../screens/TrackerScreen";
import { addManualShift, clearScheduledReminders, clockIn, clockOut, clockOutExtraShift, dismissNotificationPrompt, discardOrphanedShift, endBreak, endLunch, resetTodayPlan, resolveOrphanedShift, savePlanAsDefault, selectJob, setNotificationPermission, setScheduledLunchReminder, setScheduledReturnReminder, startBreak, startExtraShift, startLunch, updateBreakPreference, updateHistoryShift, updateReminders, updateTodayPlan } from "../store/appSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import type { Shift } from "../types";
import { cancelReminder, requestReminderPermission, scheduleReminder } from "../services/notifications";

function createShift(jobId: string): Shift {
  const now = new Date().toISOString();
  return {
    id: String(Date.now()),
    date: now.slice(0, 10),
    startedAt: now,
    endedAt: null,
    lunchMinutes: 0,
    breakMinutes: 0,
    earnings: 0,
    jobId,
  };
}

function timeMinutes(value: string) {
  const [hours = NaN, minutes = NaN] = value.split(":").map(Number);
  return Number.isInteger(hours) && Number.isInteger(minutes) ? hours * 60 + minutes : null;
}

export function TrackerRoute({ onPremium }: { onPremium: () => void }) {
  const dispatch = useAppDispatch();
  const { activeShift, extraShifts, orphanedShift, history, hourlyRate, todayPlan, reminders, jobs, selectedJobId, deductionRate, defaultPlan, breakIncludedInRemaining, notificationPermission, notificationPromptDismissed, scheduledLunchReminderId, scheduledReturnReminderId } = useAppSelector((state) => state.app);
  const activeJob = jobs.find((job) => job.id === (activeShift?.jobId ?? selectedJobId));

  const calculateEarnings = useCallback((startedAt: string, endedAt: string, lunchMinutes: number, rate: number) => {
    const workedMinutes = Math.max(0, (Date.parse(endedAt) - Date.parse(startedAt)) / 60000 - lunchMinutes);
    const regularMinutes = Math.min(workedMinutes, todayPlan.overtimeThreshold * 60);
    const overtimeMinutes = Math.max(0, workedMinutes - regularMinutes);
    return (regularMinutes / 60) * rate + (overtimeMinutes / 60) * rate * todayPlan.overtimeMultiplier;
  }, [todayPlan.overtimeMultiplier, todayPlan.overtimeThreshold]);

  const handleClockIn = useCallback(() => {
    const shift = createShift(selectedJobId);
    dispatch(clockIn(shift));
    if (notificationPermission === "granted" && reminders.lunchReminder) void scheduleReminder("Lunch reminder", "Your planned lunch break is coming up.", new Date(Date.now() + Math.max(30, todayPlan.plannedHours * 30) * 60_000)).then((id) => dispatch(setScheduledLunchReminder(id)));
    if (notificationPermission === "granted" && reminders.customReminderMinutes && reminders.customReminderMinutes > 0) void scheduleReminder("Clocked & Paid reminder", "Your custom work reminder is ready.", new Date(Date.now() + reminders.customReminderMinutes * 60_000));
  }, [dispatch, notificationPermission, reminders.lunchReminder, selectedJobId, todayPlan.plannedHours]);

  const handleStartExtraShift = useCallback((jobId: string) => {
    dispatch(startExtraShift(createShift(jobId)));
  }, [dispatch]);

  const handleClockOutExtraShift = useCallback((shift: Shift) => {
    const endedAt = new Date().toISOString();
    dispatch(clockOutExtraShift({
      ...shift,
      endedAt,
      earnings: calculateEarnings(shift.startedAt, endedAt, shift.lunchMinutes + shift.breakMinutes, jobs.find((job) => job.id === shift.jobId)?.hourlyRate ?? hourlyRate),
    }));
  }, [calculateEarnings, dispatch, hourlyRate, jobs]);

  const completeClockOut = useCallback((tips = 0, tipType: Shift["tipType"] = null) => {
    if (!activeShift) return;
    const endedAt = new Date().toISOString();
    void Promise.all([cancelReminder(scheduledLunchReminderId), cancelReminder(scheduledReturnReminderId)]).then(() => dispatch(clearScheduledReminders()));
    dispatch(
      clockOut({
        ...activeShift,
        endedAt,
        tips: tips || undefined,
        tipType: tips ? tipType : null,
        earnings: calculateEarnings(activeShift.startedAt, endedAt, activeShift.lunchMinutes + activeShift.breakMinutes, activeJob?.hourlyRate ?? hourlyRate),
      }),
    );
  }, [activeJob?.hourlyRate, activeShift, calculateEarnings, dispatch, hourlyRate, scheduledLunchReminderId, scheduledReturnReminderId]);

  const handleClockOut = useCallback(() => {
    if (!activeShift) return;
    const finishWithTips = (tips: number) => {
      if (tips <= 0) { completeClockOut(); return; }
      Alert.alert("Tip payment type", "How was this tip paid?", [
        { text: "Cash", onPress: () => completeClockOut(tips, "cash") },
        { text: "Card", onPress: () => completeClockOut(tips, "card") },
        { text: "Other", onPress: () => completeClockOut(tips, "other") },
        { text: "Cancel", style: "cancel" },
      ]);
    };
    Alert.prompt("Add tips", "Leave blank or enter the tip amount for this shift.", [
      { text: "No tips", onPress: () => completeClockOut() },
      { text: "Continue", onPress: (value: string | undefined) => { const tips = Number.parseFloat(value?.replace(/[^0-9.]/g, "") ?? "0"); finishWithTips(Number.isFinite(tips) ? tips : 0); } },
      { text: "Cancel", style: "cancel" },
    ], "plain-text");
  }, [activeShift, completeClockOut]);

  const handleResolveOrphan = useCallback(() => {
    if (!orphanedShift) return;
    const endedAt = new Date().toISOString();
    dispatch(resolveOrphanedShift({ ...orphanedShift, endedAt, earnings: calculateEarnings(orphanedShift.startedAt, endedAt, orphanedShift.lunchMinutes + orphanedShift.breakMinutes, activeJob?.hourlyRate ?? hourlyRate) }));
  }, [activeJob?.hourlyRate, calculateEarnings, dispatch, hourlyRate, orphanedShift]);

  const handleLunch = useCallback(() => {
    if (!activeShift) return;
    if (activeShift.lunchStartedAt) {
      void cancelReminder(scheduledReturnReminderId).then(() => dispatch(setScheduledReturnReminder(null)));
      dispatch(endLunch(new Date().toISOString()));
    } else {
      dispatch(startLunch(new Date().toISOString()));
      if (notificationPermission === "granted" && reminders.returnReminder) void scheduleReminder("Return to work", "Your lunch break is scheduled to end now.", new Date(Date.now() + todayPlan.lunchMinutes * 60_000)).then((id) => dispatch(setScheduledReturnReminder(id)));
    }
  }, [activeShift, dispatch, notificationPermission, reminders.returnReminder, scheduledReturnReminderId, todayPlan.lunchMinutes]);

  const handleRequestNotifications = useCallback(() => {
    void requestReminderPermission().then((permission) => dispatch(setNotificationPermission(permission)));
  }, [dispatch]);

  const handleBreak = useCallback((label?: unknown) => {
    if (!activeShift) return;
    if (activeShift.breakStartedAt) {
      dispatch(endBreak(new Date().toISOString()));
      return;
    }
    if (typeof label === "string") {
      dispatch(startBreak({ at: new Date().toISOString(), label }));
      return;
    }
    Alert.prompt("Start break", "Add a label so this break is easy to identify later.", [
      { text: "Start break", onPress: (value: string | undefined) => dispatch(startBreak({ at: new Date().toISOString(), label: value?.trim() || "General break" })) },
      { text: "Cancel", style: "cancel" },
    ], "plain-text", "General break");
  }, [activeShift, dispatch]);

  const handleManualTimes = useCallback((times: { start: string; lunchStart: string; lunchEnd: string; end: string }): boolean => {
    const parseToday = (value: string) => {
      const [hours = NaN, minutes = NaN] = value.split(":").map(Number);
      if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date;
    };
    const startedAt = parseToday(times.start);
    const lunchStartedAt = parseToday(times.lunchStart);
    const lunchEndedAt = parseToday(times.lunchEnd);
    let endedAt = parseToday(times.end);
    if (!startedAt || !endedAt) return false;
    if (endedAt <= startedAt) endedAt = new Date(endedAt.getTime() + 24 * 60 * 60 * 1000);
    if ((lunchStartedAt && !lunchEndedAt) || (!lunchStartedAt && lunchEndedAt)) return false;
    let normalizedLunchEnd = lunchEndedAt;
    if (lunchStartedAt && normalizedLunchEnd && normalizedLunchEnd <= lunchStartedAt) normalizedLunchEnd = new Date(normalizedLunchEnd.getTime() + 24 * 60 * 60 * 1000);
    if (lunchStartedAt && normalizedLunchEnd && (lunchStartedAt < startedAt || normalizedLunchEnd > endedAt)) return false;
    const lunchMinutes = lunchStartedAt && normalizedLunchEnd ? Math.round((normalizedLunchEnd.getTime() - lunchStartedAt.getTime()) / 60000) : 0;
    const completedShift = { ...(activeShift ?? createShift(selectedJobId)), startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), date: startedAt.toISOString().slice(0, 10), lunchMinutes, lunchStartedAt: null, breakStartedAt: null, jobId: activeShift?.jobId ?? selectedJobId, earnings: calculateEarnings(startedAt.toISOString(), endedAt.toISOString(), lunchMinutes, activeJob?.hourlyRate ?? hourlyRate) };
    dispatch(activeShift ? clockOut(completedShift) : addManualShift(completedShift));
    return true;
  }, [activeJob?.hourlyRate, calculateEarnings, dispatch, hourlyRate, selectedJobId]);

  const handleEditTimes = useCallback((id: string, times: { start: string; lunchStart: string; lunchEnd: string; end: string }): boolean => {
    const parse = (value: string) => { const [hours = NaN, minutes = NaN] = value.split(":").map(Number); if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null; const date = new Date(); date.setHours(hours, minutes, 0, 0); return date; };
    const start = parse(times.start); const end = parse(times.end); const lunchStart = times.lunchStart ? parse(times.lunchStart) : null; const lunchEnd = times.lunchEnd ? parse(times.lunchEnd) : null;
    if (!start || !end) return false;
    if (end <= start) end.setDate(end.getDate() + 1);
    if ((lunchStart && !lunchEnd) || (!lunchStart && lunchEnd)) return false;
    if (lunchStart && lunchEnd && lunchEnd <= lunchStart) lunchEnd.setDate(lunchEnd.getDate() + 1);
    if (lunchStart && lunchEnd && (lunchStart < start || lunchEnd > end)) return false;
    const lunchMinutes = lunchStart && lunchEnd ? Math.round((lunchEnd.getTime() - lunchStart.getTime()) / 60000) : 0;
    const existing = history.find((shift) => shift.id === id); if (!existing) return false;
    const startedAt = start.toISOString(); const endedAt = end.toISOString();
    dispatch(updateHistoryShift({ id, changes: { startedAt, endedAt, date: startedAt.slice(0, 10), lunchMinutes, lunchStartedAt: null, earnings: calculateEarnings(startedAt, endedAt, lunchMinutes + (existing.breakMinutes ?? 0), jobs.find((job) => job.id === existing.jobId)?.hourlyRate ?? hourlyRate) } }));
    return true;
  }, [calculateEarnings, dispatch, history, hourlyRate, jobs]);

  const handlePlanChange = useCallback((changes: Partial<typeof todayPlan>) => {
    const mode = changes.planningMode ?? todayPlan.planningMode;
    if (mode === "end-time" && changes.plannedClockOut) {
      const clockIn = activeShift ? new Date(activeShift.startedAt) : new Date();
      const start = clockIn.getHours() * 60 + clockIn.getMinutes();
      const end = timeMinutes(changes.plannedClockOut);
      if (end !== null) {
        const elapsed = end >= start ? end - start : end + 1440 - start;
        const lunch = (changes.lunchEnabled ?? todayPlan.lunchEnabled) ? (changes.lunchMinutes ?? todayPlan.lunchMinutes) : 0;
        changes = { ...changes, plannedHours: Math.max(0, (elapsed - lunch) / 60) };
      }
    }
    dispatch(updateTodayPlan(changes));
  }, [activeShift, dispatch, todayPlan]);

  return (
    <TrackerScreen
      activeShift={activeShift}
      extraShifts={extraShifts}
      orphanedShift={orphanedShift}
      completedToday={history.filter((shift) => shift.date === new Date().toISOString().slice(0, 10))}
      todayPlan={todayPlan}
      defaultPlan={defaultPlan}
      jobs={jobs}
      selectedJobId={selectedJobId}
      deductionRate={deductionRate}
      breakIncludedInRemaining={breakIncludedInRemaining}
      reminders={reminders}
      notificationPermission={notificationPermission}
      notificationPromptDismissed={notificationPromptDismissed}
      onPlanChange={handlePlanChange}
      onSavePlanDefault={() => dispatch(savePlanAsDefault())}
      onResetPlan={() => dispatch(resetTodayPlan())}
      onJobChange={(jobId) => dispatch(selectJob(jobId))}
      onRemindersChange={(changes) => dispatch(updateReminders(changes))}
      onRequestNotifications={handleRequestNotifications}
      onDismissNotificationPrompt={() => dispatch(dismissNotificationPrompt())}
      onClockIn={handleClockIn}
      onStartExtraShift={handleStartExtraShift}
      onClockOutExtraShift={handleClockOutExtraShift}
      onClockOut={handleClockOut}
      onResolveOrphanedShift={handleResolveOrphan}
      onDiscardOrphanedShift={() => dispatch(discardOrphanedShift())}
      onToggleBreakRemaining={(value) => dispatch(updateBreakPreference(value))}
      onLunch={handleLunch}
      onBreak={handleBreak}
      onManualTimes={handleManualTimes}
      onEditTimes={handleEditTimes}
      onPremium={onPremium}
    />
  );
}
