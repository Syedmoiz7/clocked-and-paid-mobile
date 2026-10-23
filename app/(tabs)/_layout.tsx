import { Redirect, Tabs } from "expo-router";
import { entryDestination } from "../../src/features/auth/model";
import { Text, View } from "react-native";
import { useThemeTokens } from "../../src/providers/ThemeProvider";
import { useEffect, useState } from "react";
import { useAppSelector } from "../../src/store/hooks";
import { workedMinutes } from "../../src/features/history/model";

const tabs = [
  { name: "tracker", title: "Tracker", icon: "◷" },
  { name: "history", title: "History", icon: "▤" },
  { name: "pay", title: "Pay", icon: "$" },
  { name: "jobs", title: "Jobs", icon: "▣" },
  { name: "settings", title: "Settings", icon: "⚙" },
] as const;

export default function TabsLayout() {
  const { colors, styles } = useThemeTokens();
  const data = useAppSelector((state) => state.app);
  const { activeShift, todayPlan, preferences } = data;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!activeShift || preferences.headerTimerMode === "off") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeShift?.id, preferences.headerTimerMode]);
  const seconds = activeShift
    ? Math.round(workedMinutes(activeShift, now) * 60)
    : 0;
  const value =
    preferences.headerTimerMode === "count-down"
      ? todayPlan.plannedHours * 3600 - seconds
      : seconds;
  const label = `${value < 0 ? "+" : ""}${Math.floor(Math.abs(value) / 3600)}:${String(Math.floor(Math.abs(value) / 60) % 60).padStart(2, "0")}`;
  const entry = entryDestination(data);
  if (entry !== "/tracker") return <Redirect href={entry} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 78,
          paddingBottom: 14,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
        },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarLabel:
              tab.name === "tracker" &&
              activeShift &&
              preferences.headerTimerMode !== "off"
                ? ({ color }) => (
                    <View style={{ alignItems: "center" }}>
                      <Text style={{ color, fontSize: 11, fontWeight: "700" }}>
                        Tracker
                      </Text>
                      <Text style={{ color, fontSize: 9 }}>{label}</Text>
                    </View>
                  )
                : undefined,
            tabBarIcon: ({ color }) => (
              <Text style={{ color, fontSize: 21 }}>{tab.icon}</Text>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
