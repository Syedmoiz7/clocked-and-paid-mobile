import Storage from "expo-sqlite/kv-store";
import type { AppState } from "../types";

const STORAGE_KEY = "clocked-and-paid.mobile.state.v1";

export async function loadAppState(): Promise<AppState | null> {
  const raw = await Storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppState;
  } catch {
    return null;
  }
}

export async function saveAppState(state: AppState): Promise<void> {
  await Storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
