import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Action, Field } from "../../components/FormControls";
import { useThemeTokens } from "../../providers/ThemeProvider";
import type { MockAccount } from "../../types";
import { rebaseAccountDraft, validateAccount, validatePassword } from "./model";

export function AccountCard({
  account,
  saving,
  onAccount,
  onPassword,
  onSignIn,
  onSignOut,
  onSetup,
}: {
  account: MockAccount;
  saving: boolean;
  onAccount: (
    value: Partial<Pick<MockAccount, "name" | "email">>,
  ) => Promise<string | null>;
  onPassword: (value: string) => Promise<void>;
  onSignIn: () => void;
  onSignOut: (hasDrafts: boolean) => void;
  onSetup: () => void;
}) {
  const { colors, styles } = useThemeTokens();
  const [draft, setDraft] = useState(account),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [feedback, setFeedback] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const previous = useRef(account),
    pending = useRef(false);
  useEffect(() => {
    const old = previous.current;
    previous.current = account;
    setDraft((value) => rebaseAccountDraft(value, old, account));
  }, [account]);
  const run = async (
    operation: () => Promise<string | null | void>,
    message: string,
  ) => {
    if (pending.current || saving) return false;
    pending.current = true;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const error = await operation();
      if (error) {
        setError(error);
        return false;
      }
      setFeedback(message);
      return true;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save on this device. Your inputs are still here.",
      );
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Account</Text>
      <Text style={styles.cardMeta}>
        {account.mode === "guest"
          ? "Guest workspace · data stays on this device"
          : "Mock account · no backend authentication"}
      </Text>
      {account.mode === "guest" ? (
        <>
          <Text style={styles.cardMeta}>
            Sign in with mock data to preview account management. Your existing
            local workspace is retained; no cloud migration is claimed.
          </Text>
          <Action title="Sign in / Create account" onPress={onSignIn} />
        </>
      ) : (
        <>
          <Field
            label="Full name"
            value={draft.name}
            onChange={(name) => setDraft((value) => ({ ...value, name }))}
          />
          <Action
            title="Save profile (mock)"
            disabled={busy || saving || draft.name.trim() === account.name}
            onPress={() => {
              if (!draft.name.trim()) {
                setError("Enter a display name.");
                return;
              }
              void run(
                () => onAccount({ name: draft.name.trim() }),
                "Local mock profile saved on this device.",
              );
            }}
          />
          <Text style={[styles.cardTitle, { marginTop: 18 }]}>
            Change email
          </Text>
          <Text style={styles.cardMeta}>Current: {account.email}</Text>
          <Field
            label="Email address"
            keyboardType="email-address"
            autoCapitalize="none"
            value={draft.email}
            onChange={(email) => setDraft((value) => ({ ...value, email }))}
          />
          <Action
            title="Update email (mock)"
            disabled={busy || saving || draft.email.trim() === account.email}
            onPress={() => {
              const error = validateAccount({
                ...account,
                name: account.name || "Mock user",
                email: draft.email,
              });
              if (error) {
                setError(error);
                return;
              }
              void run(
                () => onAccount({ email: draft.email.trim() }),
                "Local email saved. No verification email was sent.",
              );
            }}
          />
          <Text style={[styles.cardTitle, { marginTop: 18 }]}>
            Change password
          </Text>
          <Text style={styles.cardMeta}>
            Use test values only. Mock sign-in still accepts any non-empty
            credentials.
          </Text>
          <Field
            label="New password"
            secure
            value={password}
            onChange={setPassword}
          />
          <Field
            label="Confirm password"
            secure
            value={confirmation}
            onChange={setConfirmation}
          />
          <Action
            title={busy ? "Updating…" : "Update password (mock)"}
            disabled={busy || saving}
            onPress={() => {
              const error = validatePassword(password, confirmation);
              if (error) {
                setError(error);
                return;
              }
              void run(async () => {
                await onPassword(password);
              }, "Mock password saved securely on this device. No server credential changed.").then(
                (saved) => {
                  if (saved) {
                    setPassword("");
                    setConfirmation("");
                  }
                },
              );
            }}
          />
          <Action
            title="Sign out"
            disabled={busy || saving}
            onPress={() =>
              onSignOut(
                draft.name.trim() !== account.name ||
                  draft.email.trim() !== account.email ||
                  password !== "" ||
                  confirmation !== "",
              )
            }
          />
          <Action
            title="Review name & job setup"
            disabled={busy || saving}
            onPress={onSetup}
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
