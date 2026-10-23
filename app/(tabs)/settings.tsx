import { Alert } from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { SettingsScreen } from "../../src/screens/SettingsScreen";
import { entitlementsFor } from "../../src/services/entitlements";
import { settingsDraft } from "../../src/features/settings/model";
import { useAppDispatch, useAppSelector } from "../../src/store/hooks";
import {
  initialAppState,
  resetLocalData,
  restoreData,
  saveSettings,
  setMockAccount,
  setPremiumPreview,
  setThemeHue,
} from "../../src/store/appSlice";
import {
  applyImport,
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
} from "../../src/services/storage";

export default function SettingsRoute() {
  const data = useAppSelector((state) => state.app);
  const dispatch = useAppDispatch();
  const requirePremium = () => {
    if (!entitlementsFor(data).backupRestore)
      throw new Error("Enable mock Premium preview to use this tool.");
  };
  return (
    <SettingsScreen
      data={data}
      actions={{
        onSave: (draft) => dispatch(saveSettings(draft)),
        onHue: (hue) => {
          if (hue === 338 || entitlementsFor(data).fullThemePalette)
            dispatch(setThemeHue(hue));
        },
        onAccount: (account) => dispatch(setMockAccount(account)),
        onPassword: async (password) => {
          const salt = Crypto.randomUUID();
          const hash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            `${salt}:${password}`,
          );
          await SecureStore.setItemAsync(
            "clocked-paid.mock-password.v1",
            JSON.stringify({ salt, hash }),
            { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
          );
        },
        onSignIn: () => router.push("/auth"),
        onSignOut: () =>
          Alert.alert(
            "Sign out of mock account?",
            "The local workspace and privacy lock remain on this device. No server session exists to revoke.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Sign out",
                onPress: () => {
                  dispatch(
                    setMockAccount({ mode: "guest", name: "", email: "" }),
                  );
                  router.replace("/auth");
                },
              },
            ],
          ),
        onPremium: () =>
          Alert.alert(
            "Preview Premium",
            "Enable local demo entitlements. No purchase or charge is made.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Start preview",
                onPress: () => dispatch(setPremiumPreview(true)),
              },
            ],
          ),
        onEndPreview: () => dispatch(setPremiumPreview(false)),
        onExport: async (format) => {
          requirePremium();
          await exportBackupFile(
            format === "json" ? backupText(data) : csvText(data),
            format,
          );
        },
        onPick: async () => {
          requirePremium();
          const file = await pickBackupFile();
          return file ? parseBackup(file.text, file.name, data) : null;
        },
        onImport: async (imported, mode, includeSettings) => {
          requirePremium();
          applyImport(data, imported, mode, includeSettings);
          await saveAppState(data);
          dispatch(restoreData({ imported, mode, includeSettings }));
        },
        onScan: async () => {
          requirePremium();
          const backup = await loadRecovery();
          if (!backup) return null;
          const imported = parseBackup(
            backupText(backup.state),
            "recovery.json",
            data,
          );
          const currentIds = new Set([
            ...data.history.map((item) => item.id),
            data.activeShift?.id,
            data.orphanedShift?.id,
            ...data.extraShifts.map((item) => item.id),
          ]);
          return {
            savedAt: backup.savedAt,
            imported,
            missing: imported.history.filter((item) => !currentIds.has(item.id))
              .length,
          };
        },
        onReset: async () => {
          const next = {
            ...initialAppState,
            account: data.account,
            isPremium: data.isPremium,
          };
          await Notifications.cancelAllScheduledNotificationsAsync();
          await resetStoredWorkspace(next);
          dispatch(resetLocalData());
          return settingsDraft(next);
        },
      }}
    />
  );
}
