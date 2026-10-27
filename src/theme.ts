import { StyleSheet } from "react-native";

export const colors = {
  background: "#100a0d",
  surface: "#171013",
  surfaceRaised: "#21151a",
  border: "#2b1c23",
  text: "#f1e7eb",
  muted: "#9a858f",
  accent: "#d65c90",
  accentSoft: "#351828",
  warning: "#e8ae5a",
  danger: "#df696d",
  blue: "#6ab6d1",
  success: "hsl(142, 62%, 52%)",
};

export type ThemeColors = typeof colors;
export function themedColors(hue: number): ThemeColors {
  if (hue === 338) return colors;
  const hex = (s: number, l: number) => {
    const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
    const f = (n: number) => {
      const k = (n + hue / 30) % 12;
      return Math.round(
        255 * (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))),
      )
        .toString(16)
        .padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };
  return {
    ...colors,
    background: hex(20, 5),
    surface: hex(18, 8),
    surfaceRaised: hex(18, 11),
    border: hex(16, 14),
    text: hex(18, 92),
    muted: hex(14, 58),
    accent: hex(62, 55),
    accentSoft: hex(30, 15),
  };
}
export const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 116 },
    eyebrow: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    title: {
      color: colors.text,
      fontSize: 30,
      fontWeight: "800",
      marginTop: 6,
    },
    subtitle: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 8,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 22,
      borderWidth: 1,
      padding: 18,
      marginTop: 16,
    },
    cardTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
    trackerCard: {
      backgroundColor: colors.surface,
      borderColor: `${colors.muted}40`,
      borderRadius: 18,
      borderWidth: 1,
      padding: 18,
      marginTop: 16,
    },
    cardMeta: { color: colors.muted, fontSize: 13, marginTop: 5 },
    button: {
      alignItems: "center",
      backgroundColor: colors.accent,
      borderRadius: 16,
      minHeight: 54,
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    buttonText: { color: "#fff7fa", fontSize: 16, fontWeight: "800" },
    secondaryButton: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      minHeight: 48,
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
  });
export const styles = makeStyles(colors);
