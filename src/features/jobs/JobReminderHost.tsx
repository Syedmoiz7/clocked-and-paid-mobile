import { useEffect, useMemo, useState } from "react";
import { AppState as NativeAppState, Modal, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { acknowledgeJobReminder } from "../../store/appSlice";
import { reconcileJobNotifications } from "../../services/notifications";
import { Action } from "../../components/FormControls";
import { colors, styles } from "../../theme";
import { alertNextAt, jobAlerts, notificationTimes } from "./model";

// Mounted once above the routes, so reminders keep working outside Tracker.
export function JobReminderHost() {
  const data = useAppSelector((state) => state.app);
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(Date.now());
  const [queueRevision, setQueueRevision] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const refresh = () => {
      setNow(Date.now());
      setQueueRevision((value) => value + 1);
    };
    const timer = setInterval(refresh, 5 * 60000);
    const listener = NativeAppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  const alerts = useMemo(
    () =>
      [data.activeShift, ...data.extraShifts].flatMap((shift) => {
        const job = data.jobs.find((item) => item.id === shift?.jobId);
        return shift && job
          ? jobAlerts(
              shift,
              shift.id === data.activeShift?.id
                ? { ...job, lunchMinutes: data.todayPlan.lunchMinutes }
                : job,
            )
          : [];
      }),
    [
      data.activeShift,
      data.extraShifts,
      data.jobs,
      data.todayPlan.lunchMinutes,
    ],
  );
  const acknowledgements = data.jobReminderAcknowledgements;
  const due = alerts
    .filter((item) => {
      const at = alertNextAt(item, acknowledgements);
      return at != null && at <= now;
    })
    .sort(
      (a, b) =>
        ({ high: 0, medium: 1, low: 2 })[a.priority] -
        { high: 0, medium: 1, low: 2 }[b.priority],
    );
  const current = due.find(
    (item) => item.settings.overlay || item.settings.indicator,
  );
  const acknowledge = (snooze: boolean) => {
    if (!current) return;
    const minutes = snooze
      ? current.settings.snoozeMinutes
      : current.repeatMinutes;
    dispatch(
      acknowledgeJobReminder({
        key: current.key,
        nextAt: minutes > 0 ? Date.now() + minutes * 60000 : -1,
      }),
    );
  };
  useEffect(() => {
    const times =
      data.notificationPermission === "granted"
        ? notificationTimes(alerts, acknowledgements, Date.now())
        : [];
    void reconcileJobNotifications(
      times.map(({ alert, at }) => ({
        name: alert.name,
        message: alert.message,
        at,
        sound: alert.settings.sound,
      })),
    ).catch(() => {
      /* OS permission may change externally; in-app reminders remain available. */
    });
  }, [alerts, acknowledgements, data.notificationPermission, queueRevision]);
  if (!current) return null;
  const job = data.jobs.find((item) => item.id === current.jobId);
  const content = (
    <View
      style={[
        styles.card,
        {
          width: "100%",
          borderColor:
            current.priority === "high" ? colors.danger : colors.warning,
        },
      ]}
    >
      <Text style={styles.cardTitle}>{current.name}</Text>
      <Text style={styles.cardMeta}>
        {job?.name} · {current.priority} priority
      </Text>
      <Text style={[styles.cardMeta, { color: colors.text }]}>
        {current.message}
      </Text>
      <Action title="Dismiss" onPress={() => acknowledge(false)} />
      <Action
        title={`Snooze ${current.settings.snoozeMinutes}m`}
        onPress={() => acknowledge(true)}
      />
    </View>
  );
  if (!current.settings.overlay)
    return (
      <View
        style={{
          position: "absolute",
          zIndex: 100,
          top: insets.top,
          left: 20,
          right: 20,
        }}
      >
        {content}
      </View>
    );
  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={() => acknowledge(false)}
    >
      <View
        style={{
          flex: 1,
          padding: 24,
          justifyContent: "center",
          backgroundColor: "#000000b0",
        }}
      >
        {content}
      </View>
    </Modal>
  );
}
