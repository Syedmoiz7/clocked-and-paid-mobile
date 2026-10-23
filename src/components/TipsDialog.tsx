import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Action, Choices, Field } from "./FormControls";
import { useThemeTokens } from "../providers/ThemeProvider";
import type { Shift } from "../types";

export type TipsRequest = {
  jobName: string;
  currency: string;
  onConfirm: (amount: number, type: Shift["tipType"]) => void;
};
export function TipsDialog({
  request,
  onClose,
}: {
  request: TipsRequest;
  onClose: () => void;
}) {
  const { colors, styles } = useThemeTokens();
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<NonNullable<Shift["tipType"]>>("cash");
  const [error, setError] = useState("");
  const confirm = (value: number) => {
    request.onConfirm(value, value > 0 ? type : null);
    onClose();
  };
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          justifyContent: "center",
          padding: 24,
          backgroundColor: "#000000b0",
        }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tips at clock-out</Text>
            <Text style={styles.cardMeta}>{request.jobName}</Text>
            <Field
              label={`Tips (${request.currency})`}
              numeric
              value={amount}
              onChange={(value) => {
                setAmount(value);
                setError("");
              }}
            />
            <Choices
              value={type}
              options={[
                { value: "cash", label: "Cash" },
                { value: "paycheck", label: "On paycheck" },
                { value: "other", label: "Other" },
              ]}
              onChange={(value) =>
                setType(value as NonNullable<Shift["tipType"]>)
              }
            />
            {error !== "" && (
              <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                {error}
              </Text>
            )}
            <Action
              title="Save tips & clock out"
              onPress={() => {
                const value = amount.trim() ? Number(amount) : 0;
                if (!Number.isFinite(value) || value < 0)
                  setError("Enter a non-negative tip amount.");
                else confirm(value);
              }}
            />
            <Action title="Clock out without tips" onPress={() => confirm(0)} />
            <Action title="Cancel" onPress={onClose} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
