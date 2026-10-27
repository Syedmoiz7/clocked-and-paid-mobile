import { useEffect, useRef, useState } from "react";
import { Keyboard, Text, View } from "react-native";
import { Action, Field } from "../../components/FormControls";
import { useThemeTokens } from "../../providers/ThemeProvider";
import type { MockAccount } from "../../types";
import { rebaseAccountDraft, validateAccount, validatePassword } from "./model";

type AccountAction = "profile" | "email" | "password";
type AccountResult = { action: AccountAction; message: string; error: boolean };

function AccountFeedback({
  result,
  action,
}: {
  result: AccountResult | null;
  action: AccountAction;
}) {
  const { colors } = useThemeTokens();
  return result?.action === action ? (
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        color: result.error ? colors.danger : colors.success,
        marginTop: 10,
      }}
    >
      {result.message}
    </Text>
  ) : null;
}

export function AccountCard({
  account,
  saving,
  onAccount,
  onPassword,
  onSignIn,
  onSignOut,
}: {
  account: MockAccount;
  saving: boolean;
  onAccount: (
    value: Partial<Pick<MockAccount, "name" | "email">>,
  ) => Promise<string | null>;
  onPassword: (value: string) => Promise<void>;
  onSignIn: () => void;
  onSignOut: (hasDrafts: boolean) => void;
}) {
  const { colors, styles } = useThemeTokens();
  const [draft, setDraft] = useState(account),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState<AccountResult | null>(null);
  const [busy, setBusy] = useState<AccountAction | null>(null);
  const previous = useRef(account),
    pending = useRef(false);
  useEffect(() => {
    const old = previous.current;
    previous.current = account;
    setDraft((value) => rebaseAccountDraft(value, old, account));
  }, [account]);
  const run = async (
    action: AccountAction,
    operation: () => Promise<string | null | void>,
    message: string,
  ) => {
    if (pending.current || saving) return false;
    pending.current = true;
    Keyboard.dismiss();
    setBusy(action);
    setResult(null);
    try {
      const error = await operation();
      if (error) {
        setResult({ action, message: error, error: true });
        return false;
      }
      setResult({ action, message, error: false });
      return true;
    } catch (error) {
      setResult({
        action,
        error: true,
        message:
          error instanceof Error
            ? error.message
            : "Could not save on this device. Your inputs are still here.",
      });
      return false;
    } finally {
      pending.current = false;
      setBusy(null);
    }
  };
  const clearResult = (action: AccountAction) => {
    setResult((current) => (current?.action === action ? null : current));
  };
  const showError = (action: AccountAction, message: string) => {
    Keyboard.dismiss();
    setResult({ action, message, error: true });
  };
  const disabled = busy !== null || saving;
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
            disabled={disabled}
            onChange={(name) => {
              clearResult("profile");
              setDraft((value) => ({ ...value, name }));
            }}
          />
          <AccountFeedback result={result} action="profile" />
          <Action
            title={
              busy === "profile" ? "Saving profile…" : "Save profile (mock)"
            }
            disabled={disabled || draft.name.trim() === account.name}
            onPress={() => {
              if (!draft.name.trim()) {
                showError("profile", "Enter a display name.");
                return;
              }
              void run(
                "profile",
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
            disabled={disabled}
            onChange={(email) => {
              clearResult("email");
              setDraft((value) => ({ ...value, email }));
            }}
          />
          <Text style={styles.cardMeta}>
            Enter a new email address, such as name@example.com, to enable
            Update email.
          </Text>
          <AccountFeedback result={result} action="email" />
          <Action
            title={busy === "email" ? "Updating email…" : "Update email (mock)"}
            disabled={disabled || draft.email.trim() === account.email}
            onPress={() => {
              const error = validateAccount({
                ...account,
                name: account.name || "Mock user",
                email: draft.email,
              });
              if (error) {
                showError("email", error);
                return;
              }
              void run(
                "email",
                () => onAccount({ email: draft.email.trim() }),
                "Local email saved. No verification email was sent.",
              );
            }}
          />
          <Text style={[styles.cardTitle, { marginTop: 18 }]}>
            Change password
          </Text>
          <Text style={styles.cardMeta}>
            Use at least 6 characters and enter the same password in both
            fields. Use test values only. Mock sign-in still accepts any
            non-empty credentials.
          </Text>
          <Field
            label="New password"
            secure
            value={password}
            disabled={disabled}
            onChange={(value) => {
              clearResult("password");
              setPassword(value);
            }}
          />
          <Field
            label="Confirm password"
            secure
            value={confirmation}
            disabled={disabled}
            onChange={(value) => {
              clearResult("password");
              setConfirmation(value);
            }}
          />
          <AccountFeedback result={result} action="password" />
          <Action
            title={
              busy === "password"
                ? "Updating password…"
                : "Update password (mock)"
            }
            disabled={disabled}
            onPress={() => {
              const error = validatePassword(password, confirmation);
              if (error) {
                showError("password", error);
                return;
              }
              void run(
                "password",
                async () => {
                  await onPassword(password);
                },
                "Mock password saved securely on this device. No server credential changed.",
              ).then((saved) => {
                if (saved) {
                  setPassword("");
                  setConfirmation("");
                }
              });
            }}
          />
          <Action
            title="Sign out"
            disabled={disabled}
            onPress={() =>
              onSignOut(
                draft.name.trim() !== account.name ||
                  draft.email.trim() !== account.email ||
                  password !== "" ||
                  confirmation !== "",
              )
            }
          />
        </>
      )}
    </View>
  );
}
