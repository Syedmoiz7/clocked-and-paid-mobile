import { StyleSheet } from "react-native";

export const colors = {
  background: "#0d1011",
  surface: "#171b1d",
  surfaceRaised: "#202628",
  border: "#2d3739",
  text: "#f3f6f5",
  muted: "#9ba8a5",
  accent: "#52c7a5",
  accentSoft: "#153d35",
  warning: "#f0b969",
  danger: "#ee7d7d",
};

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 116 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 30, fontWeight: "800", marginTop: 6 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 22, borderWidth: 1, padding: 18, marginTop: 16 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  cardMeta: { color: colors.muted, fontSize: 13, marginTop: 5 },
  button: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 16, minHeight: 54, justifyContent: "center", paddingHorizontal: 18 },
  buttonText: { color: "#071312", fontSize: 16, fontWeight: "800" },
  secondaryButton: { alignItems: "center", borderColor: colors.border, borderRadius: 14, borderWidth: 1, minHeight: 48, justifyContent: "center", paddingHorizontal: 16 },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: "700" },
});
