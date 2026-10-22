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
  buttonText: { color: "#fff7fa", fontSize: 16, fontWeight: "800" },
  secondaryButton: { alignItems: "center", borderColor: colors.border, borderRadius: 14, borderWidth: 1, minHeight: 48, justifyContent: "center", paddingHorizontal: 16 },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: "700" },
});
