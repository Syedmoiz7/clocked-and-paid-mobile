import { useState, type PropsWithChildren } from "react";
import { Pressable, Text, View } from "react-native";
import { useThemeTokens } from "../../providers/ThemeProvider";
export function PaySection({
  title,
  subtitle,
  children,
  defaultOpen = true,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
}>) {
  const { colors, styles } = useThemeTokens();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={{ color: colors.accent }}>{open ? "▴" : "▾"}</Text>
        </View>
        {subtitle && <Text style={styles.cardMeta}>{subtitle}</Text>}
      </Pressable>
      {open && <View style={{ marginTop: 12 }}>{children}</View>}
    </View>
  );
}
export function Metric({
  label,
  value,
  accent = false,
  color,
}: {
  label: string;
  value: string;
  accent?: boolean;
  color?: string;
}) {
  const { colors, styles } = useThemeTokens();
  return (
    <View style={{ minWidth: "45%", paddingVertical: 10 }}>
      <Text style={styles.cardMeta}>{label}</Text>
      <Text
        style={{
          color: color ?? (accent ? colors.success : colors.text),
          fontWeight: "800",
          fontSize: 21,
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
