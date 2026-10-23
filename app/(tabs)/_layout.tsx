import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "../../src/theme";

const tabs = [
  { name: "tracker", title: "Tracker", icon: "◷" },
  { name: "history", title: "History", icon: "▤" },
  { name: "pay", title: "Pay", icon: "$" },
  { name: "jobs", title: "Jobs", icon: "▣" },
  { name: "settings", title: "Settings", icon: "⚙" },
] as const;

export default function TabsLayout() {
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
            tabBarIcon: ({ color }) => (
              <Text style={{ color, fontSize: 21 }}>{tab.icon}</Text>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
