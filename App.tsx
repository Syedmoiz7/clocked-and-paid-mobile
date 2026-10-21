import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { BottomTabs } from "./src/components/BottomTabs";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { PayScreen } from "./src/screens/PayScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { TrackerScreen } from "./src/screens/TrackerScreen";
import { colors } from "./src/theme";
import type { AppState, TabKey } from "./src/types";
import { loadAppState, saveAppState } from "./src/services/storage";

const initialState: AppState = { activeShift: null, history: [], hourlyRate: 24, isPremium: false };

export default function App() {
  const [tab, setTab] = useState<TabKey>("tracker");
  const [state, setState] = useState<AppState>(initialState);
  const [ready, setReady] = useState(false);

  useEffect(() => { loadAppState().then((saved) => { if (saved) setState(saved); setReady(true); }); }, []);
  useEffect(() => { if (ready) void saveAppState(state); }, [state, ready]);

  const clockIn = () => setState((current) => ({ ...current, activeShift: { id: String(Date.now()), date: new Date().toISOString().slice(0, 10), startedAt: new Date().toISOString(), endedAt: null, lunchMinutes: 0, breakMinutes: 0, earnings: 0 } }));
  const clockOut = () => setState((current) => { if (!current.activeShift) return current; const endedAt = new Date().toISOString(); const hours = (Date.parse(endedAt) - Date.parse(current.activeShift.startedAt)) / 3_600_000; const completed = { ...current.activeShift, endedAt, earnings: Math.max(0, hours * current.hourlyRate) }; return { ...current, activeShift: null, history: [completed, ...current.history] }; });
  const showPremium = () => Alert.alert("Clocked & Paid Premium", "Premium billing will be connected after the backend and payments phase. The feature boundary is ready in the mobile app.");

  if (!ready) return <SafeAreaProvider><View style={{ backgroundColor: colors.background, flex: 1, justifyContent: "center", alignItems: "center" }}><Text style={{ color: colors.muted }}>Loading Clocked & Paid…</Text></View></SafeAreaProvider>;
  return <SafeAreaProvider><StatusBar style="light" /><SafeAreaView edges={["top", "left", "right"]} style={{ backgroundColor: colors.background, flex: 1 }}>
    {tab === "tracker" && <TrackerScreen activeShift={state.activeShift} onClockIn={clockIn} onClockOut={clockOut} onPremium={showPremium} />}
    {tab === "history" && <HistoryScreen history={state.history} onPremium={showPremium} />}
    {tab === "pay" && <PayScreen onPremium={showPremium} />}
    {tab === "settings" && <SettingsScreen isPremium={state.isPremium} onPremium={showPremium} />}
    <BottomTabs active={tab} onChange={setTab} />
  </SafeAreaView></SafeAreaProvider>;
}
