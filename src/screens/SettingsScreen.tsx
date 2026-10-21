import { Pressable, Text, View } from "react-native";
import { colors, styles } from "../theme";

export function SettingsScreen({ isPremium, onPremium }: { isPremium: boolean; onPremium: () => void }) {
  return <View style={styles.screen}><View style={styles.content}><Text style={styles.eyebrow}>Personalize</Text><Text style={styles.title}>Settings</Text><Text style={styles.subtitle}>Your preferences stay on this device until cloud sync is connected.</Text><View style={styles.card}><Text style={styles.cardTitle}>Account</Text><Text style={styles.cardMeta}>{isPremium ? "Premium plan" : "Free plan"}</Text><Pressable onPress={onPremium} style={[styles.secondaryButton, { marginTop: 14 }]}><Text style={styles.secondaryButtonText}>{isPremium ? "Manage plan" : "Explore Premium"}</Text></Pressable></View>{["Workday defaults", "Privacy lock", "Backup & restore", "Appearance", "About Clocked & Paid"].map((item) => <View key={item} style={[styles.card, { flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingVertical: 16 }]}><Text style={styles.cardTitle}>{item}</Text><Text style={{ color: colors.muted, fontSize: 20 }}>›</Text></View>)}</View></View>;
}
