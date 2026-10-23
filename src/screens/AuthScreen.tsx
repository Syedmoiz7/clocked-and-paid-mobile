import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { Action, Choices } from "../components/FormControls";
import { useThemeTokens } from "../providers/ThemeProvider";
import type { AppState } from "../types";
import type { Credentials } from "../features/auth/model";
import {
  AuthField,
  AuthLayout,
  FlowMessage,
  PrimaryAction,
} from "../features/auth/Controls";

export type AuthActions = {
  onSignIn: (value: Credentials) => Promise<void>;
  onSignUp: (value: Credentials) => Promise<void>;
  onRecovery: (email: string) => Promise<void>;
  onResend: () => void;
  onCallback: () => void;
  onCancelFlow: () => void;
  onGuest: () => void;
  onReturn: () => void;
};
type AuthView =
  "profile" | "sign-in" | "sign-up" | "forgot" | "confirmation" | "reset-sent";
export function AuthScreen({
  data,
  actions,
}: {
  data: AppState;
  actions: AuthActions;
}) {
  const { colors, styles } = useThemeTokens();
  const [view, setView] = useState<AuthView>(() =>
    data.auth.pending
      ? data.auth.pending.kind === "confirmation"
        ? "confirmation"
        : "reset-sent"
      : data.auth.lastProfile
        ? "profile"
        : "sign-in",
  );
  const [email, setEmail] = useState(
      data.auth.pending?.email ?? data.auth.lastProfile?.email ?? "",
    ),
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState(""),
    [info, setInfo] = useState(""),
    [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const changeView = (next: AuthView) => {
    if (inFlight.current) return;
    setView(next);
    setPassword("");
    setConfirmation("");
    setError("");
    setInfo("");
  };
  const run = async (operation: () => Promise<void>, next?: AuthView) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
      setPassword("");
      setConfirmation("");
      if (next) setView(next);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Mock action failed. Try again.",
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };
  const back = () => {
    actions.onCancelFlow();
    changeView(data.auth.lastProfile ? "profile" : "sign-in");
  };
  const remembered = data.auth.lastProfile;
  const pending = data.auth.pending;
  return (
    <AuthLayout>
      {(view === "sign-in" || view === "sign-up") && (
        <Choices
          value={view}
          options={[
            { value: "sign-in", label: "Sign In" },
            { value: "sign-up", label: "Sign Up" },
          ]}
          onChange={(value) => changeView(value as AuthView)}
        />
      )}
      {view === "profile" && remembered ? (
        <>
          <View
            style={{
              backgroundColor: colors.accentSoft,
              padding: 16,
              borderRadius: 12,
            }}
          >
            <Text style={styles.cardTitle}>
              Welcome back, {remembered.name || remembered.email.split("@")[0]}
            </Text>
            <Text style={styles.cardMeta}>{remembered.email}</Text>
          </View>
          <AuthField
            label="Password"
            password
            value={password}
            onChange={setPassword}
          />
          <PrimaryAction
            title={busy ? "Please wait…" : "Sign In"}
            disabled={busy}
            onPress={() => {
              void run(() =>
                actions.onSignIn({ email: remembered.email, password }),
              );
            }}
          />
          <Action
            title="Forgot password?"
            disabled={busy}
            onPress={() => {
              setEmail(remembered.email);
              changeView("forgot");
            }}
          />
          <Action
            title={`Not ${remembered.name || "you"}?`}
            disabled={busy}
            onPress={() => {
              setEmail("");
              changeView("sign-in");
            }}
          />
        </>
      ) : view === "sign-in" || view === "sign-up" ? (
        <>
          <Text style={styles.cardTitle}>
            {view === "sign-up" ? "Create your account" : "Sign In"}
          </Text>
          {view === "sign-up" && (
            <AuthField label="Your name" value={name} onChange={setName} />
          )}
          <AuthField label="Email" email value={email} onChange={setEmail} />
          <AuthField
            label="Password"
            password
            value={password}
            onChange={setPassword}
          />
          {view === "sign-up" && (
            <AuthField
              label="Confirm password"
              password
              value={confirmation}
              onChange={setConfirmation}
            />
          )}
          <PrimaryAction
            title={
              busy
                ? "Please wait…"
                : view === "sign-up"
                  ? "Create Account (mock)"
                  : "Sign In"
            }
            disabled={busy}
            onPress={() => {
              void run(
                () =>
                  view === "sign-up"
                    ? actions.onSignUp({ email, password, name, confirmation })
                    : actions.onSignIn({ email, password }),
                view === "sign-up" ? "confirmation" : undefined,
              );
            }}
          />
          {view === "sign-in" && (
            <Action
              title="Forgot password?"
              disabled={busy}
              onPress={() => changeView("forgot")}
            />
          )}
        </>
      ) : view === "forgot" ? (
        <>
          <Text style={styles.cardTitle}>Forgot password?</Text>
          <Text style={styles.cardMeta}>
            Preview password recovery locally. No reset email will be sent.
          </Text>
          <AuthField label="Email" email value={email} onChange={setEmail} />
          <PrimaryAction
            title={busy ? "Preparing…" : "Prepare mock reset link"}
            disabled={busy}
            onPress={() => {
              void run(() => actions.onRecovery(email), "reset-sent");
            }}
          />
          <Action title="Back to Sign In" disabled={busy} onPress={back} />
        </>
      ) : (
        <>
          <Text style={styles.cardTitle}>
            {view === "confirmation"
              ? "Confirm your mock account"
              : "Mock reset link ready"}
          </Text>
          <Text style={styles.cardMeta}>
            For {pending?.email ?? email}. This is a demonstration; no email was
            sent.
          </Text>
          <PrimaryAction
            title={
              view === "confirmation"
                ? "Open mock confirmation"
                : "Open mock password recovery"
            }
            disabled={busy || !pending}
            onPress={actions.onCallback}
          />
          {view === "confirmation" && (
            <Action
              title="Prepare confirmation again (no email)"
              disabled={busy || !pending}
              onPress={() => {
                actions.onResend();
                setInfo(
                  "A fresh mock confirmation is ready. Previous demo links are invalidated; no email was sent.",
                );
              }}
            />
          )}
          <Action title="Back to Sign In" disabled={busy} onPress={back} />
        </>
      )}
      <FlowMessage message={error} error />
      <FlowMessage message={info} />
      <Text style={[styles.cardMeta, { marginTop: 18 }]}>
        Any non-empty mock email/password can sign in. Existing work, jobs, pay
        records and settings stay in this device workspace; this is not cloud
        migration.
      </Text>
      <Action
        title="Continue as Guest"
        disabled={busy}
        onPress={actions.onGuest}
      />
      {data.auth.session !== "signed-out" && (
        <Action
          title="Back to current workspace"
          disabled={busy}
          onPress={actions.onReturn}
        />
      )}
    </AuthLayout>
  );
}
