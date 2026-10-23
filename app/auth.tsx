import { Redirect, router } from "expo-router";
import * as Crypto from "expo-crypto";
import { AuthScreen } from "../src/screens/AuthScreen";
import {
  useAppDispatch,
  useAppSelector,
  useAppStore,
} from "../src/store/hooks";
import {
  clearMockFlow,
  enterGuest,
  enterMockSession,
  prepareMockFlow,
} from "../src/store/appSlice";
import { entryDestination, normalizeEmail } from "../src/features/auth/model";
import { mockAuth } from "../src/services/mockAuth";

export default function AuthRoute() {
  const data = useAppSelector((state) => state.app),
    dispatch = useAppDispatch(),
    store = useAppStore();
  if (data.auth.session === "mock" && !data.auth.pending)
    return <Redirect href={entryDestination(data)} />;
  return (
    <AuthScreen
      data={data}
      actions={{
        onSignIn: async (input) => {
          const remembered = data.auth.lastProfile;
          const account = await mockAuth.signIn({
            ...input,
            name:
              normalizeEmail(remembered?.email ?? "") ===
              normalizeEmail(input.email)
                ? remembered?.name
                : undefined,
          });
          dispatch(enterMockSession(account));
          router.replace(entryDestination(store.getState().app));
        },
        onSignUp: async (input) => {
          const account = await mockAuth.signUp(input);
          dispatch(
            prepareMockFlow({
              id: Crypto.randomUUID(),
              kind: "confirmation",
              email: account.email,
              name: account.name,
              createdAt: Date.now(),
            }),
          );
        },
        onRecovery: async (email) => {
          await mockAuth.requestRecovery(email);
          dispatch(
            prepareMockFlow({
              id: Crypto.randomUUID(),
              kind: "recovery",
              email,
              name: "",
              createdAt: Date.now(),
            }),
          );
        },
        onResend: () => {
          const flow = store.getState().app.auth.pending;
          if (flow?.kind === "confirmation")
            dispatch(
              prepareMockFlow({
                ...flow,
                id: Crypto.randomUUID(),
                createdAt: Date.now(),
              }),
            );
        },
        onCallback: () => {
          const flow = store.getState().app.auth.pending;
          if (flow)
            router.push({
              pathname: "/auth-callback",
              params: { demo: "1", flow: flow.kind, id: flow.id },
            });
        },
        onCancelFlow: () => dispatch(clearMockFlow()),
        onGuest: () => {
          dispatch(enterGuest());
          router.replace("/tracker");
        },
        onReturn: () => router.replace(entryDestination(store.getState().app)),
      }}
    />
  );
}
