import { useState } from "react";
import { Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomTabs } from "../components/BottomTabs";
import { HistoryScreen } from "../screens/HistoryScreen";
import { PayScreen } from "../screens/PayScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { TrackerScreen } from "../screens/TrackerScreen";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { clockIn, clockOut } from "../store/appSlice";
import { colors } from "../theme";
import type { Shift, TabKey } from "../types";

function createShift(): Shift {
  const now = new Date().toISOString();
  return {
    id: String(Date.now()),
    date: now.slice(0, 10),
    startedAt: now,
    endedAt: null,
    lunchMinutes: 0,
    breakMinutes: 0,
    earnings: 0,
  };
}

export function RootNavigator() {
  const dispatch = useAppDispatch();
  const { activeShift, history, hourlyRate, isPremium } = useAppSelector(
    (state) => state.app,
  );
  const [tab, setTab] = useState<TabKey>("tracker");

  const handleClockIn = () => dispatch(clockIn(createShift()));

  const handleClockOut = () => {
    if (!activeShift) return;
    const endedAt = new Date().toISOString();
    const hours =
      (Date.parse(endedAt) - Date.parse(activeShift.startedAt)) / 3_600_000;

    dispatch(
      clockOut({
        ...activeShift,
        endedAt,
        earnings: Math.max(0, hours * hourlyRate),
      }),
    );
  };

  const showPremium = () =>
    Alert.alert(
      "Clocked & Paid Premium",
      "Premium billing will be connected after the backend and payments phase. The feature boundary is ready in the mobile app.",
    );

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={{ backgroundColor: colors.background, flex: 1 }}
      >
        {tab === "tracker" && (
          <TrackerScreen
            activeShift={activeShift}
            onClockIn={handleClockIn}
            onClockOut={handleClockOut}
            onPremium={showPremium}
          />
        )}
        {tab === "history" && (
          <HistoryScreen history={history} onPremium={showPremium} />
        )}
        {tab === "pay" && <PayScreen onPremium={showPremium} />}
        {tab === "settings" && (
          <SettingsScreen isPremium={isPremium} onPremium={showPremium} />
        )}
        <BottomTabs active={tab} onChange={setTab} />
      </SafeAreaView>
    </>
  );
}
