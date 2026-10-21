import { Pressable, Text, View } from "react-native";
import { colors, styles } from "../theme";
import type { Shift } from "../types";
import { PaywallCard } from "../components/PaywallCard";

type Props = { activeShift: Shift | null; onClockIn: () => void; onClockOut: () => void; onPremium: () => void };

function elapsed(startedAt: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function TrackerScreen({ activeShift, onClockIn, onClockOut, onPremium }: Props) {
  const working = Boolean(activeShift);
  return <View style={styles.screen}><View style={styles.content}>
    <Text style={styles.eyebrow}>Wednesday, October 21</Text>
    <Text style={styles.title}>Good morning.</Text>
    <Text style={styles.subtitle}>Stay on top of your hours, breaks, and take-home pay.</Text>
    <View style={styles.card}>
      <View style={{ alignItems: "center" }}>
        <Text style={styles.cardMeta}>{working ? "CURRENT SHIFT" : "READY TO TRACK"}</Text>
        <Text style={{ color: working ? colors.accent : colors.text, fontSize: 48, fontVariant: ["tabular-nums"], fontWeight: "800", marginTop: 12 }}>{working ? elapsed(activeShift!.startedAt) : "00:00:00"}</Text>
        <Text style={styles.cardMeta}>{working ? "Working · hourly shift" : "No active shift"}</Text>
      </View>
      <Pressable onPress={working ? onClockOut : onClockIn} style={[styles.button, { marginTop: 22, backgroundColor: working ? colors.danger : colors.accent }]}>
        <Text style={styles.buttonText}>{working ? "Clock out" : "Clock in"}</Text>
      </Pressable>
      {working && <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}><Pressable style={[styles.secondaryButton, { flex: 1 }]}><Text style={styles.secondaryButtonText}>Start lunch</Text></Pressable><Pressable style={[styles.secondaryButton, { flex: 1 }]}><Text style={styles.secondaryButtonText}>Take break</Text></Pressable></View>}
    </View>
    <View style={styles.card}><Text style={styles.cardTitle}>Today’s plan</Text><Text style={styles.cardMeta}>8h work · 30m lunch · $24.00/hr</Text><View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 18 }}><View><Text style={styles.cardMeta}>Estimated clock-out</Text><Text style={{ color: colors.text, fontSize: 20, fontWeight: "800", marginTop: 5 }}>5:00 PM</Text></View><View><Text style={styles.cardMeta}>Estimated pay</Text><Text style={{ color: colors.accent, fontSize: 20, fontWeight: "800", marginTop: 5 }}>$192.00</Text></View></View></View>
    <PaywallCard onPress={onPremium} title="Unlock smart reminders" description="Get lunch, return-to-work, and custom job reminders with Premium." />
  </View></View>;
}
