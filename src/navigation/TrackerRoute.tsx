import { useCallback, useState } from "react";
import { TipsDialog, type TipsRequest } from "../components/TipsDialog";
import { Alert } from "react-native";
import { TrackerScreen } from "../screens/TrackerScreen";
import {
  addManualShift,
  clearScheduledReminders,
  clockIn,
  clockOut,
  clockOutExtraShift,
  dismissNotificationPrompt,
  discardOrphanedShift,
  endBreak,
  endLunch,
  resetTodayPlan,
  resolveOrphanedShift,
  savePlanAsDefault,
  selectJob,
  setNotificationPermission,
  setScheduledReturnReminder,
  startBreak,
  startExtraShift,
  startLunch,
  updateBreakPreference,
  updateHistoryShift,
  updateReminders,
  updateTodayPlan,
} from "../store/appSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import type { MockJob, Shift } from "../types";
import {
  cancelReminder,
  requestReminderPermission,
} from "../services/notifications";
import { localDate } from "../features/history/model";
import { entitlementsFor } from "../services/entitlements";
import { setPayVisible } from "../store/appSlice";

function createShift(jobId: string): Shift {
  const now = new Date().toISOString();
  return {
    id: String(Date.now()),
    date: localDate(new Date(now)),
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
  return Number.isInteger(hours) && Number.isInteger(minutes)
    ? hours * 60 + minutes
    : null;
}

export function TrackerRoute({ onPremium }: { onPremium: () => void }) {
  const [tipsRequest, setTipsRequest] = useState<TipsRequest | null>(null);
  const dispatch = useAppDispatch();
  const {
    activeShift,
    extraShifts,
    orphanedShift,
    history,
    hourlyRate,
    preferences,
    payVisible,
    isPremium,
    todayPlan,
    reminders,
    jobs,
    selectedJobId,
    deductionRate,
    defaultPlan,
    breakIncludedInRemaining,
    notificationPermission,
    notificationPromptDismissed,
    scheduledLunchReminderId,
    scheduledReturnReminderId,
  } = useAppSelector((state) => state.app);
  const activeJob = jobs.find(
    (job) => job.id === (activeShift?.jobId ?? selectedJobId),
  );

  const calculateEarnings = useCallback(
    (
      startedAt: string,
      endedAt: string,
      lunchMinutes: number,
      rate: number,
      job?: MockJob,
    ) => {
      const workedMinutes = Math.max(
        0,
        (Date.parse(endedAt) - Date.parse(startedAt)) / 60000 - lunchMinutes,
      );
      const regularMinutes = Math.min(
        workedMinutes,
        (job?.overtimeThreshold ?? todayPlan.overtimeThreshold) * 60,
      );
      const overtimeMinutes = Math.max(0, workedMinutes - regularMinutes);
      return (
        (regularMinutes / 60) * rate +
        (overtimeMinutes / 60) *
          rate *
          (job?.overtimeMultiplier ?? todayPlan.overtimeMultiplier)
      );
    },
    [todayPlan.overtimeMultiplier, todayPlan.overtimeThreshold],
  );

  const handleClockIn = useCallback(() => {
    const job = jobs.find(
      (item) => item.id === selectedJobId && !item.archived,
    );
    if (!job) {
      Alert.alert(
        "Add a job",
        "Open Jobs and add or select a job before clocking in.",
      );
      return;
    }
    const shift = {
      ...createShift(selectedJobId),
      currency: job.currency ?? preferences.currency,
    };
    dispatch(clockIn(shift));
  }, [dispatch, jobs, selectedJobId, preferences.currency]);

  const handleStartExtraShift = useCallback(
    (jobId: string) => {
      if (!preferences.allowConcurrentShifts) {
        Alert.alert(
          "Concurrent jobs disabled",
          "Enable concurrent jobs in Settings first.",
        );
        return;
      }
      if (!entitlementsFor({ isPremium }).multipleSimultaneousJobs) {
        onPremium();
        return;
      }
      const job = jobs.find((item) => item.id === jobId && !item.archived);
      if (
        !job ||
        activeShift?.jobId === jobId ||
        extraShifts.some((item) => item.jobId === jobId)
      )
        return;
      dispatch(
        startExtraShift({
          ...createShift(jobId),
          currency: job.currency ?? preferences.currency,
        }),
      );
    },
    [
      dispatch,
      jobs,
      activeShift,
      extraShifts,
      isPremium,
      onPremium,
      preferences.allowConcurrentShifts,
      preferences.currency,
    ],
  );

  const handleClockOutExtraShift = useCallback(
    (shift: Shift) => {
      const job = jobs.find((item) => item.id === shift.jobId);
      const finish = (tips = 0, tipType: Shift["tipType"] = null) => {
        const endedAt = new Date().toISOString();
        dispatch(
          clockOutExtraShift({
            ...shift,
            endedAt,
            tips,
            tipType,
            earnings: calculateEarnings(
              shift.startedAt,
              endedAt,
              shift.lunchMinutes + shift.breakMinutes,
              jobs.find((job) => job.id === shift.jobId)?.hourlyRate ??
                hourlyRate,
              jobs.find((job) => job.id === shift.jobId),
            ),
          }),
        );
      };
      if (job?.enableTips)
        setTipsRequest({
          jobName: job.name,
          currency: shift.currency ?? job.currency ?? preferences.currency,
          onConfirm: finish,
        });
      else finish();
    },
    [calculateEarnings, dispatch, hourlyRate, jobs, preferences.currency],
  );

  const completeClockOut = useCallback(
    (tips = 0, tipType: Shift["tipType"] = null) => {
      if (!activeShift) return;
      const endedAt = new Date().toISOString();
      void Promise.all([
        cancelReminder(scheduledLunchReminderId),
        cancelReminder(scheduledReturnReminderId),
      ]).then(() => dispatch(clearScheduledReminders()));
      dispatch(
        clockOut({
          ...activeShift,
          endedAt,
          tips: tips || undefined,
          tipType: tips ? tipType : null,
          earnings: calculateEarnings(
            activeShift.startedAt,
            endedAt,
            activeShift.lunchMinutes + activeShift.breakMinutes,
            activeJob?.hourlyRate ?? hourlyRate,
          ),
        }),
      );
    },
    [
      activeJob?.hourlyRate,
      activeShift,
      calculateEarnings,
      dispatch,
      hourlyRate,
      scheduledLunchReminderId,
      scheduledReturnReminderId,
    ],
  );

  const handleClockOut = useCallback(() => {
    if (!activeShift) return;
    if (!activeJob?.enableTips) {
      completeClockOut();
      return;
    }
    setTipsRequest({
      jobName: activeJob.name,
      currency:
        activeShift.currency ?? activeJob.currency ?? preferences.currency,
      onConfirm: completeClockOut,
    });
  }, [activeShift, activeJob, completeClockOut, preferences.currency]);

  const handleResolveOrphan = useCallback(() => {
    if (!orphanedShift) return;
    const endedAt = new Date().toISOString();
    dispatch(
      resolveOrphanedShift({
        ...orphanedShift,
        endedAt,
        earnings: calculateEarnings(
          orphanedShift.startedAt,
          endedAt,
          orphanedShift.lunchMinutes + orphanedShift.breakMinutes,
          activeJob?.hourlyRate ?? hourlyRate,
        ),
      }),
    );
  }, [
    activeJob?.hourlyRate,
    calculateEarnings,
    dispatch,
    hourlyRate,
    orphanedShift,
  ]);

  const handleLunch = useCallback(() => {
    if (!activeShift) return;
    if (activeShift.lunchStartedAt) {
      void cancelReminder(scheduledReturnReminderId).then(() =>
        dispatch(setScheduledReturnReminder(null)),
      );
      dispatch(endLunch(new Date().toISOString()));
    } else {
      dispatch(startLunch(new Date().toISOString()));
    }
  }, [
    activeShift,
    activeJob,
    dispatch,
    notificationPermission,
    reminders.returnReminder,
    scheduledReturnReminderId,
    todayPlan.lunchMinutes,
  ]);

  const handleRequestNotifications = useCallback(() => {
    void requestReminderPermission().then((permission) =>
      dispatch(setNotificationPermission(permission)),
    );
  }, [dispatch]);

  const handleBreak = useCallback(
    (label?: unknown) => {
      if (!activeShift) return;
      if (activeShift.breakStartedAt) {
        dispatch(endBreak(new Date().toISOString()));
        return;
      }
      if (typeof label === "string") {
        dispatch(startBreak({ at: new Date().toISOString(), label }));
        return;
      }
      Alert.prompt(
        "Start break",
        "Add a label so this break is easy to identify later.",
        [
          {
            text: "Start break",
            onPress: (value: string | undefined) =>
              dispatch(
                startBreak({
                  at: new Date().toISOString(),
                  label: value?.trim() || "General break",
                }),
              ),
          },
          { text: "Cancel", style: "cancel" },
        ],
        "plain-text",
        "General break",
      );
    },
    [activeShift, dispatch],
  );

  const handleManualTimes = useCallback(
    (times: {
      start: string;
      lunchStart: string;
      lunchEnd: string;
      end: string;
    }): boolean => {
      if (!activeJob || activeJob.archived) return false;
      const parseToday = (value: string) => {
        const [hours = NaN, minutes = NaN] = value.split(":").map(Number);
        if (
          !Number.isInteger(hours) ||
          !Number.isInteger(minutes) ||
          hours < 0 ||
          hours > 23 ||
          minutes < 0 ||
          minutes > 59
        )
          return null;
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
      };
      const startedAt = parseToday(times.start);
      const lunchStartedAt = parseToday(times.lunchStart);
      const lunchEndedAt = parseToday(times.lunchEnd);
      let endedAt = parseToday(times.end);
      if (!startedAt || !endedAt) return false;
      if (endedAt <= startedAt)
        endedAt = new Date(endedAt.getTime() + 24 * 60 * 60 * 1000);
      if (
        (lunchStartedAt && !lunchEndedAt) ||
        (!lunchStartedAt && lunchEndedAt)
      )
        return false;
      let normalizedLunchEnd = lunchEndedAt;
      if (
        lunchStartedAt &&
        normalizedLunchEnd &&
        normalizedLunchEnd <= lunchStartedAt
      )
        normalizedLunchEnd = new Date(
          normalizedLunchEnd.getTime() + 24 * 60 * 60 * 1000,
        );
      if (
        lunchStartedAt &&
        normalizedLunchEnd &&
        (lunchStartedAt < startedAt || normalizedLunchEnd > endedAt)
      )
        return false;
      const lunchMinutes =
        lunchStartedAt && normalizedLunchEnd
          ? Math.round(
              (normalizedLunchEnd.getTime() - lunchStartedAt.getTime()) / 60000,
            )
          : 0;
      const completedShift = {
        ...(activeShift ?? createShift(selectedJobId)),
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        date: localDate(startedAt),
        currency:
          activeShift?.currency ?? activeJob.currency ?? preferences.currency,
        lunchMinutes,
        lunchStartedAt: null,
        breakStartedAt: null,
        jobId: activeShift?.jobId ?? selectedJobId,
        earnings: calculateEarnings(
          startedAt.toISOString(),
          endedAt.toISOString(),
          lunchMinutes,
          activeJob?.hourlyRate ?? hourlyRate,
        ),
      };
      dispatch(
        activeShift ? clockOut(completedShift) : addManualShift(completedShift),
      );
      return true;
    },
    [
      activeJob,
      activeShift,
      calculateEarnings,
      dispatch,
      hourlyRate,
      selectedJobId,
      preferences.currency,
    ],
  );

  const handleEditTimes = useCallback(
    (
      id: string,
      times: {
        start: string;
        lunchStart: string;
        lunchEnd: string;
        end: string;
      },
    ): boolean => {
      const parse = (value: string) => {
        const [hours = NaN, minutes = NaN] = value.split(":").map(Number);
        if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
      };
      const start = parse(times.start);
      const end = parse(times.end);
      const lunchStart = times.lunchStart ? parse(times.lunchStart) : null;
      const lunchEnd = times.lunchEnd ? parse(times.lunchEnd) : null;
      if (!start || !end) return false;
      if (end <= start) end.setDate(end.getDate() + 1);
      if ((lunchStart && !lunchEnd) || (!lunchStart && lunchEnd)) return false;
      if (lunchStart && lunchEnd && lunchEnd <= lunchStart)
        lunchEnd.setDate(lunchEnd.getDate() + 1);
      if (lunchStart && lunchEnd && (lunchStart < start || lunchEnd > end))
        return false;
      const lunchMinutes =
        lunchStart && lunchEnd
          ? Math.round((lunchEnd.getTime() - lunchStart.getTime()) / 60000)
          : 0;
      const existing = history.find((shift) => shift.id === id);
      if (!existing) return false;
      const startedAt = start.toISOString();
      const endedAt = end.toISOString();
      dispatch(
        updateHistoryShift({
          id,
          changes: {
            startedAt,
            endedAt,
            date: localDate(start),
            lunchMinutes,
            lunchStartedAt: null,
            earnings: calculateEarnings(
              startedAt,
              endedAt,
              lunchMinutes + (existing.breakMinutes ?? 0),
              jobs.find((job) => job.id === existing.jobId)?.hourlyRate ??
                hourlyRate,
              jobs.find((job) => job.id === existing.jobId),
            ),
          },
        }),
      );
      return true;
    },
    [calculateEarnings, dispatch, history, hourlyRate, jobs],
  );

  const handlePlanChange = useCallback(
    (changes: Partial<typeof todayPlan>) => {
      const mode = changes.planningMode ?? todayPlan.planningMode;
      if (mode === "end-time" && changes.plannedClockOut) {
        const clockIn = activeShift
          ? new Date(activeShift.startedAt)
          : new Date();
        const start = clockIn.getHours() * 60 + clockIn.getMinutes();
        const end = timeMinutes(changes.plannedClockOut);
        if (end !== null) {
          const elapsed = end >= start ? end - start : end + 1440 - start;
          const lunch =
            (changes.lunchEnabled ?? todayPlan.lunchEnabled)
              ? (changes.lunchMinutes ?? todayPlan.lunchMinutes)
              : 0;
          changes = {
            ...changes,
            plannedHours: Math.max(0, (elapsed - lunch) / 60),
          };
        }
      }
      dispatch(updateTodayPlan(changes));
    },
    [activeShift, dispatch, todayPlan],
  );

  return (
    <>
      <TrackerScreen
        canCalculate={entitlementsFor({ isPremium }).calculator}
        preferences={preferences}
        payVisible={payVisible}
        onPayVisible={(value) => dispatch(setPayVisible(value))}
        activeShift={activeShift}
        extraShifts={extraShifts}
        orphanedShift={orphanedShift}
        completedToday={history.filter(
          (shift) =>
            shift.date === localDate() &&
            shift.entryType !== "project" &&
            !shift.missingClockIn &&
            Boolean(shift.endedAt),
        )}
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
        onDismissNotificationPrompt={() =>
          dispatch(dismissNotificationPrompt())
        }
        onClockIn={handleClockIn}
        onStartExtraShift={handleStartExtraShift}
        onClockOutExtraShift={handleClockOutExtraShift}
        onClockOut={handleClockOut}
        onResolveOrphanedShift={handleResolveOrphan}
        onDiscardOrphanedShift={() => dispatch(discardOrphanedShift())}
        onToggleBreakRemaining={(value) =>
          dispatch(updateBreakPreference(value))
        }
        onLunch={handleLunch}
        onBreak={handleBreak}
        onManualTimes={handleManualTimes}
        onEditTimes={handleEditTimes}
        onPremium={onPremium}
      />
      {tipsRequest && (
        <TipsDialog
          request={tipsRequest}
          onClose={() => setTipsRequest(null)}
        />
      )}
    </>
  );
}
