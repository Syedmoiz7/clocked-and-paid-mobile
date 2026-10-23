import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import {
  mockAccount,
  validateCredentials,
  type Credentials,
} from "../features/auth/model";
import { validatePassword } from "../features/settings/model";
import type { MockAccount } from "../types";

// This adapter performs no HTTP calls. A real auth adapter can replace its operations later.
export type MockAuthClient = {
  signIn: (input: Credentials) => Promise<MockAccount>;
  signUp: (input: Credentials) => Promise<MockAccount>;
  requestRecovery: (email: string) => Promise<void>;
  setPassword: (password: string, confirmation: string) => Promise<void>;
};
export const mockAuth: MockAuthClient = {
  async signIn(input) {
    const error = validateCredentials(input);
    if (error) throw new Error(error);
    return mockAccount(input.email, input.name);
  },
  async signUp(input) {
    const error = validateCredentials(input, true);
    if (error) throw new Error(error);
    return mockAccount(input.email, input.name);
  },
  async requestRecovery(email) {
    if (!email.trim()) throw new Error("Enter a mock email value.");
  },
  async setPassword(password, confirmation) {
    const error = validatePassword(password, confirmation);
    if (error) throw new Error(error);
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
};
