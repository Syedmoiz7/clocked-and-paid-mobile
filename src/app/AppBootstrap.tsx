import { useEffect, useState, type PropsWithChildren } from "react";
import { AppLoading } from "../components/AppLoading";
import { loadAppState, saveAppState } from "../services/storage";
import { hydrate } from "../store/appSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";

export function AppBootstrap({ children }: PropsWithChildren) {
  const dispatch = useAppDispatch();
  const appState = useAppSelector((state) => state.app);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    loadAppState()
      .then((savedState) => {
        if (!active) return;
        if (savedState) dispatch(hydrate(savedState));
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, [dispatch]);

  useEffect(() => {
    if (ready) void saveAppState(appState);
  }, [appState, ready]);

  return ready ? children : <AppLoading />;
}
