import { useState } from "react";
import { Text, View } from "react-native";
import { Action, Choices, Field, Toggle } from "../../components/FormControls";
import { useThemeTokens } from "../../providers/ThemeProvider";
import { usePrivacyLock } from "./PrivacyProvider";

export function PrivacyCard() {
  const lock = usePrivacyLock();
  const { colors, styles } = useThemeTokens();
  const [type, setType] = useState<"pin4" | "pin6" | "password">("pin4");
  const [old, setOld] = useState(""),
    [value, setValue] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [feedback, setFeedback] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const run = async (operation: () => Promise<void>, message: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await operation();
      setFeedback(message);
      setValue("");
      setConfirmation("");
      setOld("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Privacy change failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Privacy lock</Text>
      <Text style={styles.cardMeta}>
        {lock.configured ? `Enabled · ${lock.type}` : "Not configured"}. Locks
        on app background and cold launch. This is an app access gate, not
        database or export encryption.
      </Text>
      <Text style={styles.cardMeta}>
        Keep your credential safe. Mock sign-in cannot reset or bypass it.
        Privacy credentials are never included in backups.
      </Text>
      {lock.configured && (
        <Field
          label="Current PIN / password"
          secure
          value={old}
          onChange={setOld}
        />
      )}
      <Choices
        value={type}
        options={[
          { value: "pin4", label: "4-digit PIN" },
          { value: "pin6", label: "6-digit PIN" },
          { value: "password", label: "Password" },
        ]}
        onChange={(value) => setType(value as typeof type)}
      />
      <Field
        label="New PIN / password"
        secure
        numeric={type !== "password"}
        value={value}
        onChange={setValue}
      />
      <Field
        label="Confirm new credential"
        secure
        numeric={type !== "password"}
        value={confirmation}
        onChange={setConfirmation}
      />
      <Action
        title={
          busy
            ? "Saving…"
            : lock.configured
              ? "Change privacy lock"
              : "Enable privacy lock"
        }
        disabled={busy}
        onPress={() => {
          if (value !== confirmation) {
            setError("Credentials don't match.");
            return;
          }
          void run(
            () => lock.setup(type, value, old),
            "Privacy lock saved securely.",
          );
        }}
      />
      {lock.configured && (
        <>
          <Toggle
            title={
              lock.biometricAvailable
                ? "Device authentication"
                : "Device authentication (not enrolled/available)"
            }
            value={lock.biometrics}
            onChange={(enabled) => {
              void run(
                () => lock.setBiometrics(enabled),
                "Device authentication preference updated.",
              );
            }}
          />
          <Action title="Lock now" disabled={busy} onPress={lock.lock} />
          <Action
            title="Remove privacy lock (verify current credential)"
            disabled={busy}
            onPress={() => {
              void run(
                () => lock.remove(old),
                "Privacy lock removed from this device.",
              );
            }}
          />
        </>
      )}
      {feedback !== "" && (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.success, marginTop: 12 }}
        >
          {feedback}
        </Text>
      )}
      {error !== "" && (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.danger, marginTop: 12 }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
