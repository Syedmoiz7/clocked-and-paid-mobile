import { useState } from "react";
import { Text, View } from "react-native";
import { Choices } from "../../components/FormControls";
import { useThemeTokens } from "../../providers/ThemeProvider";
import { money } from "../history/model";
import { formatDuration } from "./model";
import { dailySummary, type DailySummarySource } from "./dailySummary";

export function TodaySummaryCard({
  data,
  now,
  payVisible,
}: {
  data: DailySummarySource;
  now: number;
  payVisible: boolean;
}) {
  const { styles, colors } = useThemeTokens();
  const [mode, setMode] = useState("gross");
  const summary = dailySummary(data, now);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Today's Summary</Text>
      <Text style={styles.cardMeta}>
        All entries dated today · completed work plus running shifts
      </Text>

      {summary.groups.length === 0 ? (
        <Text style={[styles.subtitle, { marginTop: 16 }]}>
          No time recorded today.
        </Text>
      ) : (
        <>
          <Choices
            value={mode}
            options={[
              { value: "gross", label: "Gross" },
              { value: "net", label: "Estimated net" },
            ]}
            onChange={setMode}
          />
          {summary.groups.map((total) => (
            <View
              key={total.currency}
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.border,
                marginTop: 12,
                paddingTop: 12,
              }}
            >
              <Text style={styles.eyebrow}>
                {total.currency} ·{" "}
                {total.runningCount ? "Live + saved" : "Saved"}
              </Text>
              <Text
                style={{
                  color: colors.accent,
                  fontSize: 36,
                  fontWeight: "900",
                  marginTop: 8,
                }}
              >
                {payVisible
                  ? money(
                      mode === "net" ? total.net : total.gross,
                      total.currency,
                    )
                  : "•••••"}
              </Text>
              <Text style={styles.cardMeta}>
                {total.completedCount} completed · {total.runningCount} running
                {total.projectCount
                  ? ` · ${total.projectCount} project(s)`
                  : ""}
                {total.tips > 0
                  ? ` · tips ${payVisible ? money(total.tips, total.currency) : "•••••"} included`
                  : ""}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  marginTop: 12,
                }}
              >
                {[
                  ["Worked", total.workedSeconds],
                  ["Lunch", total.lunchSeconds],
                  ["Breaks", total.breakSeconds],
                  ["Regular", total.regularSeconds],
                  ["Overtime", total.overtimeSeconds],
                ].map(([label, seconds]) => (
                  <View key={label} style={{ width: "50%", marginBottom: 10 }}>
                    <Text style={styles.cardMeta}>{label}</Text>
                    <Text style={{ color: colors.text, fontWeight: "800" }}>
                      {formatDuration(Number(seconds))}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
          <Text style={styles.cardMeta}>
            {mode === "net"
              ? "Net is estimated per job/currency from received paychecks. Without matching paycheck history, net equals gross. Tips outside the paycheck stay undeducted."
              : "Before estimated deductions; recorded tips are included."}{" "}
            Concurrent shifts add their recorded hours. Currencies stay
            separate.
          </Text>
        </>
      )}
    </View>
  );
}
