import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Action, Field } from "../../components/FormControls";
import { useThemeTokens } from "../../providers/ThemeProvider";
import type { MockAccount } from "../../types";
import { validateAccount, validatePassword } from "./model";

export function AccountCard({
  account,
  onAccount,
  onPassword,
  onSignIn,
  onSignOut,
  onSetup,
}: {
  account: MockAccount;
  onAccount: (value: MockAccount) => void;
  onPassword: (value: string) => Promise<void>;
  onSignIn: () => void;
  onSignOut: () => void;
  onSetup: () => void;
}) {
  const { colors, styles } = useThemeTokens();
  const [draft, setDraft] = useState(account),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [feedback, setFeedback] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setDraft(account);
  }, [account]);
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
            onPress={() => {
              onAccount({ ...account, name: draft.name.trim() });
              setError("");
              setFeedback("Local mock profile updated.");
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
              onAccount({
                ...account,
                email: draft.email.trim(),
              });
              setError("");
              setFeedback(
                "Local mock profile updated. No verification email was sent.",
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
            disabled={busy}
            onPress={() => {
              const error = validatePassword(password, confirmation);
              if (error) {
                setError(error);
                return;
              }
              setBusy(true);
              void onPassword(password)
                .then(() => {
                  setPassword("");
                  setConfirmation("");
                  setError("");
                  setFeedback(
                    "Mock password updated securely on this device. No server credential was changed.",
                  );
                })
                .catch(() =>
                  setError("Could not save the mock password securely."),
                )
                .finally(() => setBusy(false));
            }}
          />
          <Action title="Sign out" onPress={onSignOut} />
          <Action title="Review name & job setup" onPress={onSetup} />
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
