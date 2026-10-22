import { Alert, Share } from "react-native";
import { useRouter } from "expo-router";
import { HistoryScreen } from "../../src/screens/HistoryScreen";
import {
  csvFor,
  localDate,
  prepareEntry,
  type EntryDraft,
} from "../../src/features/history/model";
import {
  addManualShift,
  deleteHistoryShift,
  discardActiveHistoryShift,
  markHistoryPaidMany,
  reactivateHistoryShift,
  setPayVisible,
  setPremiumPreview,
  toggleHistoryPaid,
  updateHistoryShift,
} from "../../src/store/appSlice";
import { useAppDispatch, useAppSelector } from "../../src/store/hooks";
import { cancelReminder } from "../../src/services/notifications";
export default function HistoryRoute() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const data = useAppSelector((state) => state.app);
  const save = (draft: EntryDraft, id?: string) => {
    const existing = id
      ? data.history.find((entry) => entry.id === id)
      : undefined;
    if (id && !existing)
      return "This entry no longer exists. Close the form and try again.";
    const result = prepareEntry(draft, data.jobs, data.todayPlan, existing);
    if (!result.ok) return result.error;
    dispatch(
      id
        ? updateHistoryShift({ id, changes: result.entry })
        : addManualShift(result.entry),
    );
    if (!data.isPremium && draft.date.slice(0, 7) !== localDate().slice(0, 7))
      Alert.alert(
        "Entry saved",
        "Your entry is saved on this device. Older history is available in the Premium preview.",
      );
    return null;
  };
  return (
    <HistoryScreen
      data={data}
      onPremium={() =>
        Alert.alert(
          "Preview Premium",
          "Try the Premium experience with local mock entitlements. No purchase or charge is made.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Start preview",
              onPress: () => dispatch(setPremiumPreview(true)),
            },
          ],
        )
      }
      onEndPreview={() => dispatch(setPremiumPreview(false))}
      onSave={save}
      onDelete={(id) => dispatch(deleteHistoryShift(id))}
      onPaid={(id) => dispatch(toggleHistoryPaid(id))}
      onBulkPaid={(ids) => dispatch(markHistoryPaidMany(ids))}
      onPayVisibility={(value) => dispatch(setPayVisible(value))}
      onOpenTracker={() => router.push("/(tabs)/tracker")}
      onReactivate={(id) => {
        const entry = data.history.find((entry) => entry.id === id);
        if (!data.activeShift && entry?.date === localDate()) {
          dispatch(reactivateHistoryShift(id));
          router.push("/(tabs)/tracker");
        }
      }}
      onDiscard={() => {
        void Promise.all([
          cancelReminder(data.scheduledLunchReminderId),
          cancelReminder(data.scheduledReturnReminderId),
        ])
          .then(() => dispatch(discardActiveHistoryShift()))
          .catch(() =>
            Alert.alert(
              "Could not discard shift",
              "Please try again so scheduled reminders can be cancelled.",
            ),
          );
      }}
      onExport={(entries) => {
        void Share.share({
          message: csvFor(entries, data.jobs, data.todayPlan),
          title: "Clocked & Paid History.csv",
        }).catch(() =>
          Alert.alert("Could not share history", "Please try again."),
        );
      }}
    />
  );
}
