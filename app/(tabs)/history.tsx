import { useUpgrade } from "../../src/features/auth/useUpgrade";
import { useRef, useState } from "react";
import { Alert, Share } from "react-native";
import { useRouter } from "expo-router";
import { HistoryScreen } from "../../src/screens/HistoryScreen";
import {
  csvFor,
  localDate,
  prepareEntry,
  paymentStatus,
  type EntryDraft,
} from "../../src/features/history/model";
import {
  addManualShift,
  deleteHistoryShift,
  markHistoryPaidMany,
  reactivateHistoryShift,
  setPayVisible,
  setPremiumPreview,
  toggleHistoryPaid,
  updateHistoryShift,
} from "../../src/store/appSlice";
import {
  useAppDispatch,
  useAppSelector,
  useAppStore,
} from "../../src/store/hooks";
import { commitWorkspaceAction } from "../../src/services/commitWorkspace";
import { saveAppState } from "../../src/services/storage";
import { entitlementsFor } from "../../src/services/entitlements";
export default function HistoryRoute() {
  const onPremium = useUpgrade("fullHistory", "/history");
  const router = useRouter();
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const data = useAppSelector((state) => state.app);
  const commit = async (
    action: Parameters<typeof commitWorkspaceAction>[0],
  ) => {
    if (pending.current)
      throw new Error("Please wait for the current change to finish.");
    pending.current = true;
    setBusy(true);
    try {
      return await commitWorkspaceAction(action, {
        read: () => store.getState().app,
        write: saveAppState,
        dispatch,
      });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const run = (
    action: Parameters<typeof commitWorkspaceAction>[0],
    after?: () => void,
  ) => {
    return commit(action)
      .then((changed) => {
        if (changed) after?.();
        else
          Alert.alert(
            "History unchanged",
            "This action is no longer available. Please check the current entry or open Tracker.",
          );
        return changed;
      })
      .catch(() => {
        Alert.alert(
          "Could not save change",
          "Please try again. Your saved history has been kept.",
        );
        return false;
      });
  };
  const save = async (draft: EntryDraft, id?: string) => {
    const data = store.getState().app;
    const existing = id
      ? data.history.find((entry) => entry.id === id)
      : undefined;
    if (id && !existing)
      return "This entry no longer exists. Close the form and try again.";
    if (
      existing &&
      paymentStatus(existing, data.paychecks, data.jobs) ===
        "Paid via Paycheck" &&
      draft.paid !== Boolean(existing.paid)
    )
      return "Manage this entry’s payment status in Pay.";
    const result = prepareEntry(
      draft,
      data.jobs,
      data.defaultPlan,
      existing,
      data.preferences.currency,
    );
    if (!result.ok) return result.error;
    try {
      await commit(
        id
          ? updateHistoryShift({ id, changes: result.entry })
          : addManualShift(result.entry),
      );
    } catch {
      return "Could not save on this device. Your changes are still here. Please try again.";
    }
    if (
      !entitlementsFor(data).fullHistory &&
      draft.date.slice(0, 7) !== localDate().slice(0, 7)
    )
      Alert.alert(
        "Entry saved",
        "Your entry is saved on this device. Older history is available in the Premium preview.",
      );
    return null;
  };
  return (
    <HistoryScreen
      data={data}
      busy={busy}
      onPremium={onPremium}
      onEndPreview={() => dispatch(setPremiumPreview(false))}
      onSave={save}
      onDelete={(id) => run(deleteHistoryShift(id))}
      onPaid={(id) => run(toggleHistoryPaid(id))}
      onBulkPaid={(ids) => run(markHistoryPaidMany(ids))}
      onPayVisibility={(value) => dispatch(setPayVisible(value))}
      onOpenTracker={() => router.push("/(tabs)/tracker")}
      onReactivate={(id) => {
        run(reactivateHistoryShift(id), () => router.push("/(tabs)/tracker"));
      }}
      onExport={(entries) => {
        const data = store.getState().app;
        if (!entitlementsFor(data).fullHistory) {
          onPremium();
          return;
        }
        const ids = new Set(entries.map((entry) => entry.id));
        void Share.share({
          message: csvFor(
            data.history.filter((entry) => ids.has(entry.id)),
            data.jobs,
            data.defaultPlan,
            data.preferences.currency,
            data.paychecks,
          ),
          title: "Clocked & Paid History.csv",
        }).catch(() =>
          Alert.alert("Could not share history", "Please try again."),
        );
      }}
    />
  );
}
