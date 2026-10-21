import { Pressable, Text, View } from "react-native";
import type { TabKey } from "../types";
import { colors } from "../theme";

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "tracker", label: "Today", icon: "◷" },
  { key: "history", label: "History", icon: "▤" },
  { key: "pay", label: "Pay", icon: "$" },
  { key: "settings", label: "Settings", icon: "⚙" },
];

export function BottomTabs({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderTopWidth: 1,
        bottom: 0,
        flexDirection: "row",
        left: 0,
        paddingBottom: 18,
        paddingTop: 12,
        position: "absolute",
        right: 0,
      }}
    >
      {tabs.map((tab) => {
        const selected = active === tab.key;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={{ alignItems: "center", flex: 1, gap: 4 }}
          >
            <Text
              style={{
                color: selected ? colors.accent : colors.muted,
                fontSize: 21,
                fontWeight: "700",
              }}
            >
              {tab.icon}
            </Text>
            <Text
              style={{
                color: selected ? colors.text : colors.muted,
                fontSize: 12,
                fontWeight: selected ? "800" : "600",
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
