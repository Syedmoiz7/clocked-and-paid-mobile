import { useRef, useState } from "react";
import { Alert } from "react-native";
import * as Crypto from "expo-crypto";
import { TipsDialog, type TipsRequest } from "../components/TipsDialog";
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
  startBreak,
  startExtraShift,
  startLunch,
  updateActiveShift,
  updateBreakPreference,
  updateHistoryShift,
  updateReminders,
  updateTodayPlan,
  refreshTrackerDay,
} from "../store/appSlice";
import { useAppDispatch, useAppSelector, useAppStore } from "../store/hooks";
import type { Shift } from "../types";
import { requestReminderPermission } from "../services/notifications";
import { localDate, wagesFor } from "../features/history/model";
import { jobPlan } from "../features/jobs/model";
import { entitlementsFor } from "../services/entitlements";
import { setPayVisible } from "../store/appSlice";
import {
  finishShift,
  prepareRecovery,
  manualShift,
  withPlanRates,
  type ManualTimes,
} from "../features/tracker/model";
import { commitTrackerAction } from "../features/tracker/commit";
import { saveAppState } from "../services/storage";

function createShift(jobId: string, currency: string): Shift {
  const now = new Date().toISOString();
  return {
    id: Crypto.randomUUID(),
    date: localDate(new Date(now)),
    startedAt: now,
    endedAt: null,
    lunchMinutes: 0,
    breakMinutes: 0,
    earnings: 0,
    jobId,
    currency,
  };
}
export function TrackerRoute({ onPremium }: { onPremium: () => void }) {
  const data = useAppSelector((state) => state.app),
    dispatch = useAppDispatch(),
    store = useAppStore();
  const [tipsRequest, setTipsRequest] = useState<TipsRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const read = () => store.getState().app;
  const commit = async (
    action: Parameters<typeof dispatch>[0],
  ): Promise<boolean> => {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    try {
      return await commitTrackerAction(action, {
        read,
        write: saveAppState,
        dispatch,
      });
    } catch {
      Alert.alert(
        "Could not save",
        "Your running shift and existing records are still available. Keep the app open and try again.",
      );
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const clockInNow = () => {
    if (saving.current) return;
    dispatch(refreshTrackerDay(localDate()));
    const current = read(),
      job = current.jobs.find(
        (job) => job.id === current.selectedJobId && !job.archived,
      );
    if (!job) {
      Alert.alert(
        "Add a job",
        "Open Jobs and add or select a job before clocking in.",
      );
      return;
    }
    dispatch(
      clockIn(
        createShift(job.id, job.currency ?? current.preferences.currency),
      ),
    );
  };
  const requestClockOut = (id: string, extra = false) => {
    if (saving.current || tipsRequest) return;
    const current = read(),
      source = extra
        ? current.extraShifts.find((shift) => shift.id === id)
        : current.activeShift;
    if (!source || source.id !== id) return;
    const job = current.jobs.find((job) => job.id === source.jobId);
    const finish = (tips = 0, tipType: Shift["tipType"] = null) => {
      const latest = read(),
        shift = extra
          ? latest.extraShifts.find((item) => item.id === id)
          : latest.activeShift;
      if (!shift || shift.id !== id) return;
      const result = {
        ...finishShift(shift, new Date().toISOString(), latest, !extra),
        tips,
        tipType: tips ? tipType : null,
      };
      void commit(extra ? clockOutExtraShift(result) : clockOut(result)).then(
        (saved) => {
          if (saved && !extra) dispatch(clearScheduledReminders());
        },
      );
    };
    if (job?.enableTips)
      setTipsRequest({
        jobName: job.name,
        currency:
          source.currency ?? job.currency ?? current.preferences.currency,
        onConfirm: finish,
      });
    else finish();
  };
  const saveTimes = async (times: ManualTimes, id?: string) => {
    const current = read();
    const existing = id
      ? current.history.find((shift) => shift.id === id)
      : current.activeShift;
    if (id && !existing) return false;
    const job = current.jobs.find(
      (job) => job.id === (existing?.jobId ?? current.selectedJobId),
    );
    if (!existing && (!job || job.archived || current.orphanedShift))
      return false;
    if (
      !existing &&
      !times.end &&
      current.extraShifts.some((shift) => shift.jobId === job?.id)
    ) {
      Alert.alert(
        "Shift already running",
        "Clock out the additional shift for this job before starting it again.",
      );
      return false;
    }
    const result = manualShift(
      existing ??
        createShift(job!.id, job!.currency ?? current.preferences.currency),
      times,
    );
    if ("error" in result) {
      Alert.alert("Check times", result.error);
      return false;
    }
    let shift = result.shift;
    if (!id) shift = withPlanRates(shift, current.todayPlan);
    shift.earnings = wagesFor(
      shift,
      current.jobs,
      current.defaultPlan,
      Date.now(),
    );
    const action = id
      ? updateHistoryShift({ id, changes: shift })
      : shift.endedAt
        ? current.activeShift
          ? clockOut(shift)
          : addManualShift(shift)
        : current.activeShift
          ? updateActiveShift(shift)
          : clockIn(shift);
    return commit(action);
  };
  const recover = async (id: string, endedAt: string): Promise<boolean> => {
    const current = read(),
      shift = current.orphanedShift;
    if (!shift || shift.id !== id) return false;
    const result = prepareRecovery(shift, endedAt, current);
    if ("error" in result) {
      Alert.alert("Check recovery times", result.error);
      return false;
    }
    return commit(resolveOrphanedShift(result.entry));
  };
  return (
    <>
      <TrackerScreen
        busy={busy}
        canCalculate={entitlementsFor(data).calculator}
        preferences={data.preferences}
        payVisible={data.payVisible}
        onPayVisible={(value) => dispatch(setPayVisible(value))}
        activeShift={data.activeShift}
        extraShifts={data.extraShifts}
        orphanedShift={data.orphanedShift}
        completedToday={data.history.filter(
          (shift) =>
            shift.date === localDate() &&
            shift.entryType !== "project" &&
            !shift.missingClockIn &&
            Boolean(shift.endedAt),
        )}
        todayPlan={data.todayPlan}
        defaultPlan={data.defaultPlan}
        jobs={data.jobs}
        selectedJobId={data.selectedJobId}
        deductions={data.deductions}
        summaryData={data}
        breakIncludedInRemaining={data.breakIncludedInRemaining}
        reminders={data.reminders}
        notificationPermission={data.notificationPermission}
        notificationPromptDismissed={data.notificationPromptDismissed}
        onPlanChange={(changes) => {
          if (!saving.current) dispatch(updateTodayPlan(changes));
        }}
        onSavePlanDefault={() => {
          if (saving.current) return;
          const current = read(),
            job = current.jobs.find(
              (job) =>
                job.id ===
                (current.activeShift?.jobId ?? current.selectedJobId),
            );
          if (
            (current.activeShift?.currency ??
              job?.currency ??
              current.preferences.currency) !== current.preferences.currency
          )
            return;
          dispatch(savePlanAsDefault());
          Alert.alert(
            "Global defaults saved",
            "Saved global work hours, lunch and pay defaults. Job-specific rate, lunch and overtime settings still take priority when resetting or starting a job. Today's clock-out target stays a daily override.",
          );
        }}
        onResetPlan={() => {
          if (!saving.current) dispatch(resetTodayPlan());
        }}
        onJobChange={(id) => dispatch(selectJob(id))}
        onRemindersChange={(changes) => dispatch(updateReminders(changes))}
        onRequestNotifications={() => {
          void requestReminderPermission()
            .then((permission) =>
              dispatch(setNotificationPermission(permission)),
            )
            .catch(() =>
              Alert.alert(
                "Notifications unavailable",
                "Check the app's notification permission in device settings.",
              ),
            );
        }}
        onDismissNotificationPrompt={() =>
          dispatch(dismissNotificationPrompt())
        }
        onClockIn={clockInNow}
        onClockOut={() => {
          const shift = read().activeShift;
          if (shift) requestClockOut(shift.id);
        }}
        onStartExtraShift={(jobId) => {
          if (saving.current) return;
          const current = read();
          if (!entitlementsFor(current).multipleSimultaneousJobs) {
            onPremium();
            return;
          }
          if (!current.preferences.allowConcurrentShifts) return;
          const job = current.jobs.find(
            (job) => job.id === jobId && !job.archived,
          );
          if (job)
            dispatch(
              startExtraShift(
                withPlanRates(
                  createShift(
                    jobId,
                    job.currency ?? current.preferences.currency,
                  ),
                  jobPlan(job, current.defaultPlan),
                ),
              ),
            );
        }}
        onClockOutExtraShift={(shift) => requestClockOut(shift.id, true)}
        onResolveOrphanedShift={recover}
        onDiscardOrphanedShift={() =>
          Alert.alert(
            "Discard unfinished shift?",
            "This removes the unsaved shift. Choose a recovery clock-out time to keep the work instead.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Discard",
                style: "destructive",
                onPress: () => {
                  void commit(discardOrphanedShift());
                },
              },
            ],
          )
        }
        onToggleBreakRemaining={(value) =>
          dispatch(updateBreakPreference(value))
        }
        onLunch={() => {
          if (saving.current) return;
          dispatch(
            read().activeShift?.lunchStartedAt
              ? endLunch(new Date().toISOString())
              : startLunch(new Date().toISOString()),
          );
        }}
        onBreak={(label) => {
          if (saving.current) return;
          dispatch(
            read().activeShift?.breakStartedAt
              ? endBreak(new Date().toISOString())
              : startBreak({ at: new Date().toISOString(), label }),
          );
        }}
        onManualTimes={(times) => saveTimes(times)}
        onEditTimes={(id, times) => saveTimes(times, id)}
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
