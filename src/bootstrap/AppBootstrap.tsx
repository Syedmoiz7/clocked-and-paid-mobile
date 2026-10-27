import { useEffect, useState, type PropsWithChildren } from "react";
import { AppLoading } from "../components/AppLoading";
import { loadAppState, loadRecovery, saveAppState } from "../services/storage";
import {
  hydrate,
  initialAppState,
  setPayVisible,
  refreshTrackerDay,
} from "../store/appSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { JobReminderHost } from "../features/jobs/JobReminderHost";
import { PrivacyProvider } from "../features/settings/PrivacyProvider";
import { Alert, Text, View, AppState as NativeAppState } from "react-native";
import { localDate } from "../utils/dateOnly";
import {
  applyImport,
  backupText,
  parseBackup,
} from "../features/settings/backup";
import { Action } from "../components/FormControls";
import { useThemeTokens } from "../providers/ThemeProvider";
import * as SplashScreen from "expo-splash-screen";

export function AppBootstrap({ children }: PropsWithChildren) {
  const dispatch = useAppDispatch();
  const appState = useAppSelector((state) => state.app);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const { colors, styles } = useThemeTokens();
  useEffect(() => {
    if (!ready) return;
    const refresh = () => dispatch(refreshTrackerDay(localDate()));
    refresh();
    const timer = setInterval(refresh, 60000);
    const listener = NativeAppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [dispatch, ready]);

  useEffect(() => {
    let active = true;

    loadAppState()
      .then((savedState) => {
        if (!active) return;
        if (savedState) {
          dispatch(hydrate(savedState));
          if (savedState.preferences?.payHiddenByDefault ?? false)
            dispatch(setPayVisible(false));
        }
      })
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active)
          setError(
            "Your saved workspace could not be loaded. It has not been overwritten. Restart the app to retry.",
          );
      });

    return () => {
      active = false;
    };
  }, [dispatch]);

  useEffect(() => {
    if (ready)
      void saveAppState(appState)
        .then(() => setError(""))
        .catch(() =>
          setError(
            "Local saving failed. Keep the app open and export a backup before closing it.",
          ),
        );
  }, [appState, ready]);

  return (
    <View
      key={ready ? "ready" : error ? "error" : "loading"}
      style={styles.screen}
      onLayout={() => {
        if (ready || error) SplashScreen.hide();
      }}
    >
      {ready ? (
        <PrivacyProvider>
          {children}
          <JobReminderHost />
          {error !== "" && (
            <View
              style={{
                position: "absolute",
                bottom: 100,
                left: 20,
                right: 20,
                backgroundColor: colors.surface,
                padding: 12,
              }}
            >
              <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                {error}
              </Text>
            </View>
          )}
        </PrivacyProvider>
      ) : error ? (
        <View
          style={[styles.screen, { justifyContent: "center", padding: 24 }]}
        >
          <Text style={styles.cardTitle}>Workspace unavailable</Text>
          <Text style={styles.cardMeta}>{error}</Text>
          <Action
            title="Restore device recovery snapshot"
            onPress={() =>
              Alert.alert(
                "Restore device recovery?",
                "Your unreadable workspace will only be replaced after the device snapshot passes validation. Your secure privacy lock is not changed.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Restore",
                    onPress: () => {
                      void (async () => {
                        const snapshot = await loadRecovery();
                        if (!snapshot)
                          throw new Error(
                            "No device recovery snapshot is available. The unreadable workspace was not changed.",
                          );
                        const imported = parseBackup(
                          backupText(snapshot.state),
                          "recovery.json",
                          initialAppState,
                        );
                        const recovered = applyImport(
                          initialAppState,
                          imported,
                          "replace",
                          true,
                        );
                        await saveAppState(recovered);
                        dispatch(hydrate(recovered));
                        setError("");
                        setReady(true);
                      })().catch((e) =>
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Recovery failed; existing storage was not changed.",
                        ),
                      );
                    },
                  },
                ],
              )
            }
          />
        </View>
      ) : (
        <AppLoading />
      )}
    </View>
  );
}
