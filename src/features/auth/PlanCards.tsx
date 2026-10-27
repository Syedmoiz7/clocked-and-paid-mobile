import { Pressable, Text, View } from "react-native";
import { useThemeTokens } from "../../providers/ThemeProvider";

export type PlanChoice = "free" | "premium";

const plans = [
  {
    id: "free",
    title: "Free",
    advertising: "Ad-supported",
    detail:
      "One job profile, live clock-in/out, lunch and breaks, basic reminders, current-month History, current-period Pay, clock format and basic theme.",
  },
  {
    id: "premium",
    title: "Premium",
    advertising: "Ads removed",
    detail:
      "Multiple job profiles, Hours Calculator, full History/Calendar and export, advanced Pay/trends/estimator, deduction management, backup/recovery and the full theme palette.",
  },
] as const;

type Props = {
  selection?: {
    value: PlanChoice;
    onChange: (value: PlanChoice) => void;
    disabled: boolean;
  };
};

export function PlanCards({ selection }: Props) {
  const { colors, styles } = useThemeTokens();
  return (
    <View accessibilityRole={selection ? "radiogroup" : undefined}>
      {plans.map((plan) => {
        const selected = selection?.value === plan.id;
        const content = (
          <>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <Text style={[styles.cardTitle, { flex: 1 }]}>{plan.title}</Text>
              {selection && (
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: selected ? colors.accent : colors.muted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selected && (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: colors.accent,
                      }}
                    />
                  )}
                </View>
              )}
            </View>
            <Text style={styles.cardMeta}>{plan.advertising}</Text>
            <Text style={styles.subtitle}>{plan.detail}</Text>
          </>
        );
        const cardStyle = [
          styles.card,
          {
            borderColor: selection
              ? selected
                ? colors.accent
                : colors.border
              : plan.id === "premium"
                ? colors.accent
                : colors.border,
          },
        ];
        return selection ? (
          <Pressable
            key={plan.id}
            accessibilityRole="radio"
            accessibilityLabel={`${plan.title}, ${plan.advertising}. ${plan.detail}`}
            accessibilityState={{
              checked: selected,
              disabled: selection.disabled,
            }}
            disabled={selection.disabled}
            onPress={() => selection.onChange(plan.id)}
            style={cardStyle}
          >
            {content}
          </Pressable>
        ) : (
          <View key={plan.id} style={cardStyle}>
            {content}
          </View>
        );
      })}
      <Text style={[styles.cardMeta, { marginTop: 14, marginBottom: 16 }]}>
        Demo only: neither plan loads real ads in this build.
      </Text>
    </View>
  );
}
