import { Text, View } from "react-native";
import { colors, styles } from "../theme";
import { PaywallCard } from "../components/PaywallCard";
import { SafeAreaView } from "react-native-safe-area-context";

export function PayScreen({ onPremium }: { onPremium: () => void }) {
  return <SafeAreaView style={styles.screen} edges={["top"]}><View style={styles.content}><Text style={styles.eyebrow}>Money at a glance</Text><Text style={styles.title}>Pay summary</Text><Text style={styles.subtitle}>Estimate gross and net pay from your tracked time.</Text><View style={styles.card}><Text style={styles.cardMeta}>THIS PAY PERIOD</Text><Text style={{ color: colors.text, fontSize: 38, fontWeight: "800", marginTop: 10 }}>$0.00</Text><Text style={styles.cardMeta}>No completed shifts in this period</Text><View style={{ borderColor: colors.border, borderTopWidth: 1, marginTop: 18, paddingTop: 14 }}><Text style={styles.cardMeta}>Deductions</Text><Text style={{ color: colors.muted, fontSize: 15, marginTop: 5 }}>Configure deductions after your first shift.</Text></View></View><PaywallCard onPress={onPremium} title="See your real take-home pay" description="Premium adds pay-period scheduling, deduction estimates, and confirmed paycheck history." /></View></SafeAreaView>;
}
