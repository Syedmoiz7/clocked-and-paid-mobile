import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState as NativeAppState, Modal, Text, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import { Action, Field } from "../../components/FormControls";
import { AppLoading } from "../../components/AppLoading";
import { useThemeTokens } from "../../providers/ThemeProvider";
import { validateLockCredential } from "./model";

type LockType = "pin4" | "pin6" | "password";
type LockRecord = {
  type: LockType;
  salt: string;
  hash: string;
  biometrics: boolean;
  failures: number;
  blockedUntil: number;
};
const KEY = "clocked-paid.privacy-lock.v1";
type LockAPI = {
  locked: boolean;
  configured: boolean;
  type: LockType | null;
  biometrics: boolean;
  biometricAvailable: boolean;
  setup: (type: LockType, value: string, current: string) => Promise<void>;
  unlock: (value: string) => Promise<void>;
  biometricUnlock: () => Promise<void>;
  setBiometrics: (enabled: boolean) => Promise<void>;
  remove: (current: string) => Promise<void>;
  lock: () => void;
};
const Context = createContext<LockAPI | null>(null);
export function usePrivacyLock() {
  const value = useContext(Context);
  if (!value) throw new Error("Privacy provider missing");
  return value;
}
const digest = (salt: string, value: string) =>
  Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${value}`,
  );

export function PrivacyProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const [configured, setConfigured] = useState(false),
    [locked, setLocked] = useState(false);
  const [record, setRecord] = useState<LockRecord | null>(null);
  const current = useRef<LockRecord | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [credential, setCredential] = useState(""),
    [unlockError, setUnlockError] = useState(""),
    [busy, setBusy] = useState(false);
  const { colors, styles } = useThemeTokens();
  const load = async () => {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      const parsed: LockRecord | null = raw ? JSON.parse(raw) : null;
      if (
        parsed &&
        (!["pin4", "pin6", "password"].includes(parsed.type) ||
          typeof parsed.salt !== "string" ||
          typeof parsed.hash !== "string" ||
          !parsed.hash)
      )
        throw new Error(
          "Privacy configuration is unreadable. Restore device access before proceeding.",
        );
      current.current = parsed;
      setRecord(parsed);
      setConfigured(Boolean(parsed));
      setLocked(Boolean(parsed));
      setError("");
      setReady(true);
      setBiometricAvailable(
        (await LocalAuthentication.hasHardwareAsync()) &&
          (await LocalAuthentication.isEnrolledAsync()),
      );
    } catch {
      setError(
        "Secure storage is unavailable. Rebuild with the privacy modules installed, then retry. The lock has not been bypassed.",
      );
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    const subscription = NativeAppState.addEventListener("change", (state) => {
      if (state !== "active" && current.current) {
        setLocked(true);
        setCredential("");
      }
    });
    return () => subscription.remove();
  }, []);
  const persist = async (next: LockRecord) => {
    await SecureStore.setItemAsync(KEY, JSON.stringify(next), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    current.current = next;
    setRecord(next);
    setConfigured(true);
  };
  const verify = async (value: string) => {
    const saved = current.current;
    if (!saved) return;
    if (saved.blockedUntil > Date.now())
      throw new Error(
        `Try again in ${Math.ceil((saved.blockedUntil - Date.now()) / 1000)} seconds.`,
      );
    if ((await digest(saved.salt, value)) !== saved.hash) {
      const failures = (saved.failures ?? 0) + 1;
      await persist({
        ...saved,
        failures,
        blockedUntil: failures >= 5 ? Date.now() + 30000 : 0,
      });
      throw new Error(
        failures >= 5
          ? "Too many attempts. Wait 30 seconds."
          : "Incorrect PIN or password.",
      );
    }
    await persist({ ...saved, failures: 0, blockedUntil: 0 });
  };
  const api: LockAPI = {
    locked,
    configured,
    type: record?.type ?? null,
    biometrics: record?.biometrics ?? false,
    biometricAvailable,
    setup: async (type, value, old) => {
      const error = validateLockCredential(type, value);
      if (error) throw new Error(error);
      await verify(old);
      const salt = Crypto.randomUUID();
      await persist({
        type,
        salt,
        hash: await digest(salt, value),
        biometrics: false,
        failures: 0,
        blockedUntil: 0,
      });
      setLocked(false);
    },
    unlock: async (value) => {
      await verify(value);
      setLocked(false);
      setCredential("");
      setUnlockError("");
    },
    biometricUnlock: async () => {
      if (!current.current?.biometrics)
        throw new Error("Biometric unlock is not enabled.");
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Clocked & Paid",
        disableDeviceFallback: false,
      });
      if (!result.success)
        throw new Error("Device authentication was cancelled or unsuccessful.");
      setLocked(false);
    },
    setBiometrics: async (enabled) => {
      if (!current.current) throw new Error("Set up a privacy lock first.");
      if (enabled) {
        if (!biometricAvailable)
          throw new Error("Enroll device authentication first.");
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Enable device unlock",
        });
        if (!result.success)
          throw new Error("Device authentication was not completed.");
      }
      await persist({ ...current.current!, biometrics: enabled });
      setLocked(false);
    },
    remove: async (value) => {
      await verify(value);
      await SecureStore.deleteItemAsync(KEY);
      current.current = null;
      setRecord(null);
      setConfigured(false);
      setLocked(false);
    },
    lock: () => {
      if (current.current) {
        setCredential("");
        setLocked(true);
      }
    },
  };
  const runUnlock = async (biometric = false) => {
    if (busy) return;
    setBusy(true);
    try {
      if (biometric) await api.biometricUnlock();
      else await api.unlock(credential);
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : "Unlock failed.");
    } finally {
      setBusy(false);
    }
  };
  if (!ready)
    return error ? (
      <View style={[styles.screen, { justifyContent: "center", padding: 24 }]}>
        <Text style={styles.cardTitle}>Privacy protection unavailable</Text>
        <Text style={styles.cardMeta}>{error}</Text>
        <Action
          title="Retry secure storage"
          onPress={() => {
            void load();
          }}
        />
      </View>
    ) : (
      <AppLoading />
    );
  return (
    <Context.Provider value={api}>
      {children}
      <Modal visible={locked} animationType="fade" onRequestClose={() => {}}>
        <View
          style={[styles.screen, { justifyContent: "center", padding: 24 }]}
        >
          <Text style={styles.title}>Clocked & Paid is locked</Text>
          <Text style={styles.subtitle}>Unlock your local workspace.</Text>
          <Field
            label={record?.type === "password" ? "Password" : "PIN"}
            secure
            numeric={record?.type !== "password"}
            value={credential}
            onChange={setCredential}
          />
          {unlockError !== "" && (
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              {unlockError}
            </Text>
          )}
          <Action
            title={busy ? "Checking…" : "Unlock"}
            disabled={busy}
            onPress={() => {
              void runUnlock();
            }}
          />
          {record?.biometrics && biometricAvailable && (
            <Action
              title="Unlock with device authentication"
              disabled={busy}
              onPress={() => {
                void runUnlock(true);
              }}
            />
          )}
          <Text style={styles.cardMeta}>
            Your privacy credential is stored securely on this device and is not
            included in exports. There is no mock-account password bypass.
          </Text>
        </View>
      </Modal>
    </Context.Provider>
  );
}
