import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import {
  AuthField,
  AuthLayout,
  FlowMessage,
  PrimaryAction,
} from "../src/features/auth/Controls";
import { Action } from "../src/components/FormControls";
import { useThemeTokens } from "../src/providers/ThemeProvider";
import {
  useAppDispatch,
  useAppSelector,
  useAppStore,
} from "../src/store/hooks";
import {
  clearMockFlow,
  completeMockConfirmation,
  completeMockRecovery,
} from "../src/store/appSlice";
import { entryDestination, validDemoFlow } from "../src/features/auth/model";
import { mockAuth } from "../src/services/mockAuth";

export default function AuthCallbackRoute() {
  const params = useLocalSearchParams<{
    demo?: string;
    flow?: string;
    id?: string;
    code?: string;
    access_token?: string;
    refresh_token?: string;
    error?: string;
  }>();
  const pending = useAppSelector((state) => state.app.auth.pending);
  const dispatch = useAppDispatch(),
    store = useAppStore();
  const { styles } = useThemeTokens();
  const [now, setNow] = useState(Date.now()),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const external = Boolean(
    params.code || params.access_token || params.refresh_token || params.error,
  );
  const valid = !external && validDemoFlow(pending, params, now);
  const back = () => {
    if (store.getState().app.auth.pending?.id === params.id)
      dispatch(clearMockFlow());
    router.replace("/auth");
  };
  const complete = async () => {
    if (inFlight.current) return;
    if (
      external ||
      !validDemoFlow(store.getState().app.auth.pending, params, Date.now())
    ) {
      setError(
        "This mock link is invalid, expired or already used. Prepare a new one.",
      );
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if (params.flow === "confirmation") {
        dispatch(completeMockConfirmation({ id: params.id!, now: Date.now() }));
        router.replace(entryDestination(store.getState().app));
      } else {
        await mockAuth.setPassword(password, confirmation);
        if (
          !validDemoFlow(store.getState().app.auth.pending, params, Date.now())
        )
          throw new Error(
            "This demo flow is no longer current. Prepare a new recovery link.",
          );
        dispatch(completeMockRecovery({ id: params.id!, now: Date.now() }));
        setPassword("");
        setConfirmation("");
        setDone(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mock callback failed.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <AuthLayout>
      {done ? (
        <>
          <Text style={styles.cardTitle}>Mock password updated</Text>
          <FlowMessage message="A salted password digest was saved securely on this device. No server credential changed. Mock sign-in still accepts any non-empty credentials." />
          <Action title="Back to Sign In" onPress={back} />
        </>
      ) : !valid ? (
        <>
          <Text style={styles.cardTitle}>Link unavailable</Text>
          <FlowMessage
            error
            message={
              external
                ? "Real authentication links need the future backend adapter. Tokens were not exchanged or saved."
                : "This mock link is missing, expired or already used. Prepare a new confirmation or recovery link."
            }
          />
          <Action title="Back to Sign In" onPress={back} />
        </>
      ) : (
        <>
          <Text style={styles.cardTitle}>
            {params.flow === "confirmation"
              ? "Confirm mock account"
              : "Set new password"}
          </Text>
          <Text style={styles.cardMeta}>
            {pending?.email} · local preview only
          </Text>
          {params.flow === "recovery" && (
            <>
              <AuthField
                label="New password (6+ characters)"
                password
                value={password}
                onChange={setPassword}
              />
              <AuthField
                label="Confirm password"
                password
                value={confirmation}
                onChange={setConfirmation}
              />
            </>
          )}
          <FlowMessage message={error} error />
          <PrimaryAction
            title={
              busy
                ? "Please wait…"
                : params.flow === "confirmation"
                  ? "Confirm & continue (mock)"
                  : "Set Password (mock)"
            }
            disabled={busy}
            onPress={() => {
              void complete();
            }}
          />
          <Action title="Cancel" disabled={busy} onPress={back} />
        </>
      )}
    </AuthLayout>
  );
}
