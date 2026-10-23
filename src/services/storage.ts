import Storage from "expo-sqlite/kv-store";
import type { AppState } from "../types";

const STORAGE_KEY = "clocked-and-paid.mobile.state.v1";
const RECOVERY_KEY = "clocked-and-paid.mobile.recovery.v1";
let queue: Promise<void> = Promise.resolve();
const serialized = (operation: () => Promise<void>) => {
  queue = queue.catch(() => {}).then(operation);
  return queue;
};

export async function loadAppState(): Promise<AppState | null> {
  const raw = await Storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (
      !value ||
      !Array.isArray(value.history) ||
      (value.jobs !== undefined && !Array.isArray(value.jobs))
    )
      throw new Error("Invalid workspace shape.");
    return value as AppState;
  } catch {
    throw new Error(
      "Saved workspace is unreadable. It has not been overwritten.",
    );
  }
}

export async function saveAppState(state: AppState): Promise<void> {
  const raw = JSON.stringify(state);
  return serialized(async () => {
    const saved = await Storage.getItem(RECOVERY_KEY);
    let count = -1;
    try {
      count = saved ? JSON.parse(saved).state.history.length : -1;
    } catch {
      /* replace an invalid recovery snapshot, not the active workspace */
    }
    if (
      state.history.length >= count &&
      (state.history.length > 0 || state.jobs.length > 0)
    )
      await Storage.setItem(
        RECOVERY_KEY,
        JSON.stringify({ savedAt: new Date().toISOString(), state }),
      );
    await Storage.setItem(STORAGE_KEY, raw);
  });
}

export async function loadRecovery(): Promise<{
  savedAt: string;
  state: AppState;
} | null> {
  await queue.catch(() => {});
  const raw = await Storage.getItem(RECOVERY_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!parsed || !parsed.state || !Array.isArray(parsed.state.history))
    throw new Error("Device recovery snapshot is unreadable.");
  return parsed;
}
export async function resetStoredWorkspace(state: AppState) {
  return serialized(async () => {
    await Storage.setItem(STORAGE_KEY, JSON.stringify(state));
    await Storage.removeItem(RECOVERY_KEY);
  });
}
