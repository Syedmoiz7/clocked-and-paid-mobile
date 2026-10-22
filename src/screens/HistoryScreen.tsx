import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { colors, styles } from "../theme";
import type { Shift } from "../types";
import { PaywallCard } from "../components/PaywallCard";
import { SafeAreaView } from "react-native-safe-area-context";

type Filter = "all" | "week" | "lastWeek" | "month" | "year" | "custom";
type EarningsView = "all" | "net" | "tips";

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function duration(shift: Shift) {
  if (!shift.endedAt) return "In progress";
  const seconds = Math.max(0, Math.floor((Date.parse(shift.endedAt) - Date.parse(shift.startedAt)) / 1000) - shift.lunchMinutes * 60 - shift.breakMinutes * 60);
  return `${Math.floor(seconds / 3600)}h ${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}m`;
}

function inFilter(date: string, filter: Filter) {
  if (filter === "all") return true;
  const today = new Date();
  const current = new Date(`${date}T12:00:00`);
  if (filter === "month") return current.getFullYear() === today.getFullYear() && current.getMonth() === today.getMonth();
  if (filter === "year") return current.getFullYear() === today.getFullYear();
  if (filter === "custom") return false;
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  if (filter === "lastWeek") { const lastMonday = new Date(monday); lastMonday.setDate(monday.getDate() - 7); const nextMonday = new Date(lastMonday); nextMonday.setDate(lastMonday.getDate() + 7); return current >= lastMonday && current < nextMonday; }
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  return current >= monday && current < nextMonday;
}

export function HistoryScreen({ history, onPremium }: { history: Shift[]; onPremium: () => void }) {
  const [filter, setFilter] = useState<Filter>("month");
  const [earningsView, setEarningsView] = useState<EarningsView>("all");
  const [customStart, setCustomStart] = useState(""); const [customEnd, setCustomEnd] = useState("");
  const entries = useMemo(() => history.filter((shift) => filter === "custom" ? Boolean(customStart && customEnd && shift.date >= customStart && shift.date <= customEnd) : inFilter(shift.date, filter)), [history, filter, customEnd, customStart]);
  const totalHours = entries.reduce((total, shift) => total + (shift.endedAt ? Math.max(0, (Date.parse(shift.endedAt) - Date.parse(shift.startedAt)) / 3_600_000 - shift.lunchMinutes / 60 - shift.breakMinutes / 60) : 0), 0);
  const totalPay = entries.reduce((total, shift) => total + shift.earnings + (shift.tips ?? 0), 0);
  const totalTips = entries.reduce((total, shift) => total + (shift.tips ?? 0), 0);
  const displayedPay = earningsView === "tips" ? totalTips : earningsView === "net" ? totalPay * 0.9 : totalPay;

  return <SafeAreaView style={styles.screen} edges={["top"]}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={{ borderBottomColor: colors.border, borderBottomWidth: 1, paddingBottom: 18 }}><Text style={styles.title}>Work History</Text><Text style={styles.subtitle}>Review your shifts, time, and earnings.</Text></View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 18 }}>{(["week", "lastWeek", "month", "year", "all", "custom"] as const).map((value) => <Pressable key={value} onPress={() => setFilter(value)} style={{ backgroundColor: filter === value ? `${colors.accent}24` : colors.surface, borderColor: filter === value ? colors.accent : colors.border, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 }}><Text style={{ color: filter === value ? colors.accent : colors.muted, fontSize: 12, fontWeight: "800" }}>{value === "week" ? "This week" : value === "lastWeek" ? "Last week" : value === "month" ? "This month" : value === "year" ? "This year" : value === "custom" ? "Custom" : "All time"}</Text></Pressable>)}</ScrollView>
    {filter === "custom" && <View style={[styles.card, { flexDirection: "row", gap: 10 }]}><View style={{ flex: 1 }}><Text style={styles.cardMeta}>FROM</Text><TextInput value={customStart} onChangeText={setCustomStart} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} style={{ color: colors.text, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 8, marginTop: 5, padding: 10 }} /></View><View style={{ flex: 1 }}><Text style={styles.cardMeta}>TO</Text><TextInput value={customEnd} onChangeText={setCustomEnd} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} style={{ color: colors.text, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 8, marginTop: 5, padding: 10 }} /></View></View>}

    <View style={styles.card}><View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}><Text style={styles.cardMeta}>PERIOD SUMMARY</Text><View style={{ flexDirection: "row", gap: 8 }}>{(["all", "net", "tips"] as const).map((value) => <Pressable key={value} onPress={() => setEarningsView(value)}><Text style={{ color: earningsView === value ? colors.accent : colors.muted, fontSize: 11, fontWeight: "800" }}>{value.toUpperCase()}</Text></Pressable>)}</View></View><View style={{ flexDirection: "row", marginTop: 16 }}><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>{totalHours.toFixed(1)}h</Text><Text style={styles.cardMeta}>Worked</Text></View><View style={{ flex: 1 }}><Text style={{ color: colors.accent, fontSize: 24, fontWeight: "900" }}>${displayedPay.toFixed(2)}</Text><Text style={styles.cardMeta}>{earningsView === "tips" ? "Tips" : earningsView === "net" ? "Est. net" : "Gross pay"}</Text></View><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>{entries.length}</Text><Text style={styles.cardMeta}>Shifts</Text></View></View><Text style={[styles.cardMeta, { marginTop: 12 }]}>Tips: ${totalTips.toFixed(2)} · Estimated deductions: ${(totalPay * 0.1).toFixed(2)}</Text></View>

    <View style={{ marginTop: 22 }}><Text style={styles.cardTitle}>Entries</Text><Text style={styles.cardMeta}>{entries.length ? `${entries.length} completed ${entries.length === 1 ? "shift" : "shifts"}` : "No entries for this period"}</Text></View>
    {entries.length === 0 ? <View style={[styles.card, { alignItems: "center", paddingVertical: 28 }]}><Text style={{ color: colors.accent, fontSize: 28 }}>◷</Text><Text style={[styles.cardTitle, { marginTop: 12 }]}>No completed shifts yet</Text><Text style={[styles.cardMeta, { textAlign: "center" }]}>Your completed shifts will appear here after you clock out.</Text></View> : entries.map((shift) => <View key={shift.id} style={styles.card}><View style={{ flexDirection: "row", justifyContent: "space-between" }}><View><Text style={styles.cardTitle}>{formatDate(shift.date)}</Text><Text style={styles.cardMeta}>{duration(shift)}</Text></View><Text style={{ color: colors.accent, fontSize: 20, fontWeight: "900" }}>${shift.earnings.toFixed(2)}</Text></View><View style={{ borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", marginTop: 14, paddingTop: 12 }}><Text style={[styles.cardMeta, { flex: 1 }]}>{new Date(shift.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text><Text style={[styles.cardMeta, { flex: 1, textAlign: "center" }]}>{shift.lunchMinutes ? `${shift.lunchMinutes}m lunch` : "No lunch"}</Text><Text style={[styles.cardMeta, { flex: 1, textAlign: "right" }]}>{shift.endedAt ? new Date(shift.endedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Active"}</Text></View></View>)}

    <PaywallCard onPress={onPremium} title="Go further with insights" description="Premium unlocks trends, pay calendar, CSV export, and longer history." />
  </ScrollView></SafeAreaView>;
}
