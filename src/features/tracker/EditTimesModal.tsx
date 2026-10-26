import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Action } from "../../components/FormControls";
import { useThemeTokens } from "../../providers/ThemeProvider";
import { usePrivacyLock } from "../settings/PrivacyProvider";
import { ManualEditor } from "./ManualEditor";
import type { ManualTimes } from "./model";
import type { Shift } from "../../types";

export function EditTimesModal({
  shift,
  jobName,
  busy,
  onSave,
  onClose,
}: {
  shift: Shift;
  jobName?: string;
  busy: boolean;
  onSave: (times: ManualTimes) => Promise<boolean>;
  onClose: () => void;
}) {
  const { styles, colors } = useThemeTokens();
  const { locked } = usePrivacyLock();
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const close = () => {
    if (!busy && !pending.current) onClose();
  };
  const save = async (times: ManualTimes) => {
    if (pending.current || busy) return false;
    pending.current = true;
    setSaving(true);
    try {
      return await onSave(times);
    } finally {
      pending.current = false;
      setSaving(false);
    }
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
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={styles.cardTitle}>
                Edit times
              </Text>
              <Text style={styles.cardMeta}>
                {shift.date}
                {jobName ? ` · ${jobName}` : ""}
              </Text>
            </View>
            <Action title="Cancel" disabled={busy || saving} onPress={close} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
          >
            <ManualEditor
              shift={shift}
              editing
              busy={busy || saving}
              onSave={save}
              onCancel={close}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
