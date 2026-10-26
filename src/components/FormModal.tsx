import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";
import { Action } from "./FormControls";
import { useThemeTokens } from "../providers/ThemeProvider";
import { usePrivacyLock } from "../features/settings/PrivacyProvider";

export function FormModal({
  title,
  busy,
  onClose,
  children,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { styles } = useThemeTokens();
  const { locked } = usePrivacyLock();
  const close = () => {
    if (!busy) onClose();
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
              {title}
            </Text>
            <Action title="Cancel" disabled={busy} onPress={close} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
