import { Pressable, Text, View } from "react-native";
import { colors, styles } from "../theme";

type Props = { title: string; description: string; onPress: () => void };

export function PaywallCard({ title, description, onPress }: Props) {
  return (
    <View style={[styles.card, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
      <Text style={styles.eyebrow}>Premium feature</Text>
      <Text style={[styles.cardTitle, { marginTop: 8 }]}>{title}</Text>
      <Text style={styles.subtitle}>{description}</Text>
      <Pressable onPress={onPress} style={[styles.button, { marginTop: 16, backgroundColor: colors.text }]}>
        <Text style={styles.buttonText}>See plans</Text>
      </Pressable>
    </View>
  );
}
