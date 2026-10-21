import type { AppState } from "../types";

/** Backend seam: replace these no-op adapters when the backend is implemented. */
export type BackendClient = {
  sync: (state: AppState) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
};

export const backend: BackendClient = {
  async sync() {},
  async signIn() {},
};
