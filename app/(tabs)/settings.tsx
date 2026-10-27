import { Alert } from "react-native";
import { useRef, useState } from "react";
import { router } from "expo-router";
import { mockAuth } from "../../src/services/mockAuth";
import { useUpgrade } from "../../src/features/auth/useUpgrade";
import * as Notifications from "expo-notifications";
import { SettingsScreen } from "../../src/screens/SettingsScreen";
import { entitlementsFor } from "../../src/services/entitlements";
import {
  settingsDraft,
  prepareAccountUpdate,
} from "../../src/features/settings/model";
import { prepareSettingsSave } from "../../src/features/settings/drafts";
import { recoveryImport } from "../../src/features/settings/recovery";
import {
  useAppDispatch,
  useAppSelector,
  useAppStore,
} from "../../src/store/hooks";
import { commitWorkspaceAction } from "../../src/services/commitWorkspace";
import {
  signOutMockSession,
  resetLocalData,
  restoreData,
  saveSettings,
  setMockAccount,
  setPremiumPreview,
  setThemeHue,
  setPayVisible,
} from "../../src/store/appSlice";
import {
  backupText,
  csvText,
  parseBackup,
} from "../../src/features/settings/backup";
import {
  exportBackupFile,
  pickBackupFile,
} from "../../src/services/backupFiles";
import {
  loadRecovery,
  resetStoredWorkspace,
  saveAppState,
  saveReplacedWorkspace,
} from "../../src/services/storage";

export default function SettingsRoute() {
  const data = useAppSelector((state) => state.app);
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const read = () => store.getState().app;
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const operation = async <T,>(work: () => Promise<T>): Promise<T> => {
    if (pending.current)
      throw new Error("Please wait for the current Settings action to finish.");
    pending.current = true;
    setBusy(true);
    try {
      return await work();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const commit = async (
    action: Parameters<typeof commitWorkspaceAction>[0],
    write = saveAppState,
  ) => commitWorkspaceAction(action, { read, write, dispatch });
  const errorMessage = (error: unknown) =>
    error instanceof Error
      ? error.message
      : "Could not save on this device. Please try again.";
  const onPremium = useUpgrade(undefined, "/settings");
  const requirePremium = () => {
    if (!entitlementsFor(read()).backupRestore)
      throw new Error("Enable mock Premium preview to use this tool.");
  };
  return (
    <SettingsScreen
      data={data}
      busy={busy}
      actions={{
        onSave: async (draft, base) => {
          try {
            return await operation(async () => {
              const prepared = prepareSettingsSave(read(), draft, base);
              if (prepared.error) return { error: prepared.error };
              await commit(saveSettings(prepared.draft));
              return { draft: settingsDraft(read()), error: null };
            });
          } catch (error) {
            return { error: errorMessage(error) };
          }
        },
        onHue: async (hue) => {
          try {
            return await operation(async () => {
              if (hue !== 338 && !entitlementsFor(read()).fullThemePalette)
                return "Preview Premium to change this theme color.";
              await commit(setThemeHue(hue));
              return null;
            });
          } catch (error) {
            return errorMessage(error);
          }
        },
        onAccount: async (changes) => {
          try {
            return await operation(async () => {
              const prepared = prepareAccountUpdate(read().account, changes);
              if (prepared.error) return prepared.error;
              if (prepared.account)
                await commit(setMockAccount(prepared.account));
              return null;
            });
          } catch (error) {
            return errorMessage(error);
          }
        },
        onPassword: (password) =>
          operation(async () => {
            if (read().account.mode !== "mock")
              throw new Error("Sign in with mock data first.");
            await mockAuth.setPassword(password, password);
          }),
        onSignIn: () => router.push("/auth"),
        onSignOut: (hasDrafts) =>
          Alert.alert(
            "Sign out of mock account?",
            `${hasDrafts ? "Unsaved Settings/profile inputs will be discarded. " : ""}The saved workspace and privacy lock remain on this device. No server session exists to revoke.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Sign out",
                onPress: () => {
                  void operation(async () => {
                    await commit(signOutMockSession());
                    router.replace("/auth");
                  }).catch((error) =>
                    Alert.alert("Could not sign out", errorMessage(error)),
                  );
                },
              },
            ],
          ),
        onPremium,
        onPayVisibility: () => dispatch(setPayVisible(!read().payVisible)),
        onEndPreview: () => dispatch(setPremiumPreview(false)),
        onExport: (format) =>
          operation(async () => {
            requirePremium();
            const data = read();
            await exportBackupFile(
              format === "json" ? backupText(data) : csvText(data),
              format,
            );
          }),
        onPick: () =>
          operation(async () => {
            requirePremium();
            const file = await pickBackupFile();
            requirePremium();
            return file ? parseBackup(file.text, file.name, read()) : null;
          }),
        onImport: (imported, mode, includeSettings) =>
          operation(async () => {
            requirePremium();
            const before = read();
            await commit(
              restoreData({ imported, mode, includeSettings }),
              mode === "replace"
                ? (next) => saveReplacedWorkspace(before, next)
                : saveAppState,
            );
            return settingsDraft(read());
          }),
        onScan: () =>
          operation(async () => {
            requirePremium();
            const backup = await loadRecovery();
            if (!backup) return null;
            requirePremium();
            const imported = parseBackup(
              backupText(backup.state),
              "recovery.json",
              read(),
            );
            return {
              savedAt: backup.savedAt,
              imported,
              missing: recoveryImport(read(), imported).history.length,
            };
          }),
        onRecover: (scan) =>
          operation(async () => {
            requirePremium();
            const imported = recoveryImport(read(), scan.imported);
            if (!imported.history.length)
              throw new Error(
                "No missing entries remain. Scan again to refresh the result.",
              );
            await commit(
              restoreData({ imported, mode: "merge", includeSettings: false }),
            );
          }),
        onReset: () =>
          operation(async () => {
            await commit(resetLocalData(), resetStoredWorkspace);
            try {
              await Notifications.cancelAllScheduledNotificationsAsync();
            } catch {
              Alert.alert(
                "Workspace reset",
                "Data was cleared, but notification cleanup failed. Check the app’s notification settings on this device.",
              );
            }
            return settingsDraft(read());
          }),
      }}
    />
  );
}
