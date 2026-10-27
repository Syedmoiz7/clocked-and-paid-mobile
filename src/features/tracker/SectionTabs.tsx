import { useEffect, useRef, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useThemeTokens } from "../../providers/ThemeProvider";
import type { TrackerSectionId } from "./sections";

export function SectionTabs({
  options,
  value,
  onChange,
}: {
  options: { id: TrackerSectionId; label: string }[];
  value: TrackerSectionId;
  onChange: (id: TrackerSectionId) => void;
}) {
  const { colors } = useThemeTokens();
  const scroll = useRef<ScrollView>(null);
  const positions = useRef<Partial<Record<TrackerSectionId, number>>>({});
  useEffect(() => {
    const x = positions.current[value];
    if (x !== undefined)
      scroll.current?.scrollTo({ x: Math.max(0, x - 8), animated: true });
  }, [value]);
  return (
    <ScrollView
      ref={scroll}
      horizontal
      accessibilityRole="tablist"
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={{ marginTop: 20 }}
      contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
    >
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <Pressable
            key={option.id}
            onLayout={(event) => {
              const x = event.nativeEvent.layout.x;
              positions.current[option.id] = x;
              if (selected)
                scroll.current?.scrollTo({
                  x: Math.max(0, x - 8),
                  animated: false,
                });
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.id)}
            style={({ pressed }) => ({
              minHeight: 44,
              justifyContent: "center",
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: selected ? colors.accent : colors.border,
              backgroundColor: selected ? colors.accentSoft : colors.surface,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Text
              style={{
                color: selected ? colors.accent : colors.muted,
                fontWeight: "700",
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SectionPanel({
  title,
  subtitle,
  visible,
  children,
}: {
  title: string;
  subtitle: string;
  visible: boolean;
  children: ReactNode;
}) {
  const { colors, styles } = useThemeTokens();
  return (
    // Keep inactive panels mounted so calculator/manual drafts survive switching.
    <View
      style={[
        styles.trackerCard,
        {
          display: visible ? "flex" : "none",
          marginTop: 6,
          padding: 0,
          overflow: "hidden",
        },
      ]}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
    >
      <View style={{ padding: 18, backgroundColor: colors.surfaceRaised }}>
        <Text accessibilityRole="header" style={styles.cardTitle}>
          {title}
        </Text>
        <Text style={styles.cardMeta}>{subtitle}</Text>
      </View>
      <View
        style={{
          gap: 14,
          padding: 18,
          borderTopWidth: 1,
          borderTopColor: `${colors.muted}40`,
        }}
      >
        {children}
      </View>
    </View>
  );
}
