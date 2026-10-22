import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

export async function requestReminderPermission(): Promise<"granted" | "denied"> {
  const current = await Notifications.getPermissionsAsync();
  const result = current.granted ? current : await Notifications.requestPermissionsAsync();
  return result.granted ? "granted" : "denied";
}

export async function scheduleReminder(title: string, body: string, date: Date): Promise<string | null> {
  if (date.getTime() <= Date.now()) return null;
  return Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date } });
}

export async function cancelReminder(id: string | null | undefined) {
  if (id) await Notifications.cancelScheduledNotificationAsync(id);
}
