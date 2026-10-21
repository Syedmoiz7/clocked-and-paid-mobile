import { Text, View } from "react-native";
import { colors, styles } from "../theme";
import type { Shift } from "../types";
import { PaywallCard } from "../components/PaywallCard";

export function HistoryScreen({ history, onPremium }: { history: Shift[]; onPremium: () => void }) {
  return <View style={styles.screen}><View style={styles.content}><Text style={styles.eyebrow}>Your work</Text><Text style={styles.title}>History</Text><Text style={styles.subtitle}>Review shifts, breaks, and earnings in one place.</Text>{history.length === 0 ? <View style={styles.card}><Text style={styles.cardTitle}>No completed shifts yet</Text><Text style={styles.cardMeta}>Your completed shifts will appear here.</Text></View> : history.map((shift) => <View key={shift.id} style={styles.card}><Text style={styles.cardTitle}>{shift.date}</Text><Text style={styles.cardMeta}>{shift.startedAt} · {shift.endedAt ?? "In progress"}</Text><Text style={{ color: colors.accent, fontSize: 22, fontWeight: "800", marginTop: 12 }}>${shift.earnings.toFixed(2)}</Text></View>)}<PaywallCard onPress={onPremium} title="Go further with insights" description="Premium unlocks trends, pay calendar, CSV export, and longer history." /></View></View>;
}
