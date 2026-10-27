import { Redirect, Tabs } from "expo-router";
import { entryDestination } from "../../src/features/auth/model";
import { Text, View } from "react-native";
import { useThemeTokens } from "../../src/providers/ThemeProvider";
import { useEffect, useState } from "react";
import { useAppSelector } from "../../src/store/hooks";
import { workedMinutes } from "../../src/features/history/model";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

const tabs = [
  { name: "tracker", title: "Tracker", icon: "clock" },
  { name: "history", title: "History", icon: "list" },
  { name: "pay", title: "Pay", icon: "credit-card" },
  { name: "jobs", title: "Jobs", icon: "briefcase" },
  { name: "settings", title: "Settings", icon: "settings" },
] as const;

export default function TabsLayout() {
  const { colors } = useThemeTokens();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(14, insets.bottom);
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
          height: 64 + bottomPadding,
          paddingBottom: bottomPadding,
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
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  width: 28,
                  height: 28,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather
                  name={tab.icon}
                  size={24}
                  color={color}
                  allowFontScaling={false}
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
