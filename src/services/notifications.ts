import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: Boolean(notification.request.content.sound),
    shouldSetBadge: false,
  }),
});

export async function requestReminderPermission(): Promise<
  "granted" | "denied"
> {
  const current = await Notifications.getPermissionsAsync();
  const result = current.granted
    ? current
    : await Notifications.requestPermissionsAsync();
  return result.granted ? "granted" : "denied";
}

export async function scheduleReminder(
  title: string,
  body: string,
  date: Date,
  sound = false,
  managedJobReminder = false,
): Promise<string | null> {
  if (date.getTime() <= Date.now()) return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: sound ? "default" : undefined,
      data: managedJobReminder ? { managedJobReminder: true } : {},
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}

export async function cancelReminder(id: string | null | undefined) {
  if (id) await Notifications.cancelScheduledNotificationAsync(id);
}

let jobQueue: Promise<void> = Promise.resolve();
let jobRevision = 0;
// Serialize reconciliation to avoid stale schedules during rapid edits or app reloads.
// Only our tagged notifications are cancelled, never another feature's reminders.
export function reconcileJobNotifications(
  items: { name: string; message: string; at: number; sound: boolean }[],
) {
  const revision = ++jobRevision;
  jobQueue = jobQueue
    .catch(() => {})
    .then(async () => {
      if (revision !== jobRevision) return;
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        pending
          .filter((item) => item.content.data?.managedJobReminder === true)
          .map((item) => cancelReminder(item.identifier)),
      );
      for (const item of items) {
        if (revision !== jobRevision) break;
        const id = await scheduleReminder(
          item.name,
          item.message,
          new Date(item.at),
          item.sound,
          true,
        );
        if (id && revision !== jobRevision) await cancelReminder(id);
      }
    });
  return jobQueue;
}
