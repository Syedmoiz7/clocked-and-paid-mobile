import { ScrollView, Text, View } from "react-native";
import type { AppState } from "../../types";
import { useThemeTokens } from "../../providers/ThemeProvider";
import { duration, money, localDate } from "../history/model";
import { payPeriod } from "../history/payPeriods";
import {
  daysBetween,
  financialSummary,
  periodEntries,
  shiftAmounts,
  type Bounds,
} from "./model";
import { Metric } from "./Section";

function Bars({
  title,
  rows,
  kind,
  data,
  currency,
}: {
  title: string;
  rows: { date: string; earnings: number; hours: number }[];
  kind: "earnings" | "hours";
  data: AppState;
  currency: string;
}) {
  const { colors, styles } = useThemeTokens();
  const max = Math.max(1, ...rows.map((row) => row[kind]));
  return (
    <View style={{ marginTop: 15 }}>
      <Text style={styles.cardTitle}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={{ gap: 12, paddingVertical: 12 }}
      >
        {rows.map((row) => (
          <View
            key={row.date}
            accessible
            accessibilityLabel={`${row.date}: ${kind === "earnings" ? (data.payVisible ? money(row.earnings, currency) : "hidden") : `${row.hours.toFixed(1)} hours`}`}
            style={{ width: 65, justifyContent: "flex-end" }}
          >
            <View style={{ height: 110, justifyContent: "flex-end" }}>
              <View
                style={{
                  height:
                    kind === "earnings" && !data.payVisible
                      ? 4
                      : Math.max(2, (row[kind] / max) * 110),
                  borderRadius: 5,
                  backgroundColor:
                    kind === "earnings" ? colors.success : colors.accent,
                }}
              />
            </View>
            <Text style={styles.cardMeta}>{row.date.slice(5)}</Text>
            <Text style={[styles.cardMeta, { fontSize: 10 }]}>
              {kind === "earnings"
                ? data.payVisible
                  ? money(row.earnings, currency)
                  : "•••"
                : `${row.hours.toFixed(1)}h`}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
export function PayTrends({
  data,
  bounds,
  jobId,
  currency,
}: {
  data: AppState;
  bounds: Bounds;
  jobId: string | null;
  currency: string;
}) {
  const { colors, styles } = useThemeTokens();
  const entries = periodEntries(data, bounds, jobId, currency);
  const dates = new Map<
    string,
    { date: string; earnings: number; hours: number }
  >();
  entries.forEach((entry) => {
    const value = shiftAmounts(entry, data);
    const row = dates.get(entry.date) ?? {
      date: entry.date,
      earnings: 0,
      hours: 0,
    };
    row.earnings += value.gross + value.cashTips;
    row.hours += value.minutes / 60;
    dates.set(entry.date, row);
  });
  const rows = [...dates.values()].sort((a, b) => a.date.localeCompare(b.date));
  const summary = financialSummary(
    data,
    bounds,
    jobId,
    currency,
    Date.now(),
    false,
    false,
  );
  const fmt = (value: number) =>
    data.payVisible ? money(value, currency) : "•••••";
  return (
    <View>
      {!rows.length ? (
        <Text style={styles.cardMeta}>
          Add completed shifts to see earnings and hours trends.
        </Text>
      ) : (
        <>
          <Bars
            title="Earnings over time"
            rows={rows}
            kind="earnings"
            data={data}
            currency={currency}
          />
          <Bars
            title="Hours worked"
            rows={rows}
            kind="hours"
            data={data}
            currency={currency}
          />
          <Text style={styles.cardTitle}>Earnings by job</Text>
          {summary.rows.map((row) => (
            <View
              key={row.jobId ?? "none"}
              style={{
                paddingVertical: 12,
                borderBottomColor: colors.border,
                borderBottomWidth: 1,
              }}
            >
              <Text style={styles.cardTitle}>
                {data.jobs.find((job) => job.id === row.jobId)?.name ??
                  "No job assigned"}
              </Text>
              <Text style={styles.cardMeta}>
                {fmt(row.gross)} gross · {fmt(row.cashTips)} cash tips ·{" "}
                {duration(row.minutes)}
              </Text>
            </View>
          ))}
          <Text style={[styles.cardTitle, { marginTop: 14 }]}>
            Payment status
          </Text>
          <Text style={styles.cardMeta}>
            Received: {fmt(summary.paid)} · Outstanding:{" "}
            {fmt(summary.outstanding)}
          </Text>
        </>
      )}
    </View>
  );
}
export function Progress({
  data,
  bounds,
  jobId,
  currency,
}: {
  data: AppState;
  bounds: Bounds;
  jobId: string | null;
  currency: string;
}) {
  const { colors, styles } = useThemeTokens();
  const summary = financialSummary(
    data,
    bounds,
    jobId,
    currency,
    Date.now(),
    false,
    false,
  );
  const scheduled = data.jobs.find(
    (job) =>
      (!jobId || job.id === jobId) && job.payFrequency && job.payPeriodStart,
  );
  const period = scheduled ? payPeriod(localDate(), scheduled) : null;
  const progress = period
    ? Math.max(
        0,
        Math.min(
          100,
          ((daysBetween(period.start, localDate()) + 1) /
            (daysBetween(period.start, period.end) + 1)) *
            100,
        ),
      )
    : 0;
  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Metric label="Hours worked" value={duration(summary.minutes)} />
        <Metric
          label="Overtime"
          value={duration(summary.overtime)}
          color={summary.overtime > 0 ? colors.danger : colors.muted}
        />
        <Metric label="Days worked" value={String(summary.daysWorked)} />
      </View>
      {scheduled && period && (
        <>
          <Text style={styles.cardMeta}>
            {scheduled.name} · {period.start} → {period.end} ·{" "}
            {Math.round(progress)}%
          </Text>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progress) }}
            style={{
              height: 8,
              borderRadius: 6,
              backgroundColor: colors.border,
              marginTop: 10,
            }}
          >
            <View
              style={{
                width: `${progress}%`,
                height: 8,
                borderRadius: 6,
                backgroundColor: colors.accent,
              }}
            />
          </View>
        </>
      )}
    </View>
  );
}
