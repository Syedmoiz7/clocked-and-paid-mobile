import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Action } from "../../components/FormControls";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeTokens } from "../../providers/ThemeProvider";
import { usePrivacyLock } from "../settings/PrivacyProvider";
import { EntryForm } from "./EntryForm";
import type { AppState } from "../../types";
import { paymentStatus, type EntryDraft } from "./model";

export function EntryModal({
  initial,
  id,
  data,
  onSave,
  onClose,
}: {
  initial: EntryDraft;
  id?: string;
  data: AppState;
  onSave: (draft: EntryDraft, id?: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const { styles } = useThemeTokens();
  const { locked } = usePrivacyLock();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const entry = data.history.find((item) => item.id === id);
  const close = () => {
    if (!pending.current) onClose();
  };
  return (
    <Modal
      visible={!locked}
      animationType="slide"
      presentationStyle="pageSheet"
      allowSwipeDismissal={false}
      onRequestClose={close}
    >
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 20,
              paddingBottom: 12,
            }}
          >
            <Text
              accessibilityRole="header"
              style={[styles.cardTitle, { flex: 1 }]}
            >
              {id ? "Edit" : "Add"}{" "}
              {initial.entryType === "project" ? "project" : "shift"}
            </Text>
            <Action title="Cancel" disabled={busy} onPress={close} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          >
            <EntryForm
              initial={initial}
              existing={entry}
              editing={Boolean(id)}
              jobs={data.jobs}
              plan={data.defaultPlan}
              payVisible={data.payVisible}
              defaultCurrency={data.preferences.currency}
              paymentLocked={Boolean(
                entry &&
                paymentStatus(entry, data.paychecks, data.jobs) ===
                  "Paid via Paycheck",
              )}
              existingDates={data.history.map((item) => item.date)}
              busy={busy}
              onSave={async (draft) => {
                if (pending.current) return "Saving your entry…";
                pending.current = true;
                setBusy(true);
                try {
                  const error = await onSave(draft, id);
                  if (!error) onClose();
                  return error;
                } finally {
                  pending.current = false;
                  setBusy(false);
                }
              }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
