import { Text, View } from "react-native";
import { Action } from "../../components/FormControls";
import { useThemeTokens } from "../../providers/ThemeProvider";
import { useClockFormat } from "../settings/useClockFormat";
import { money } from "../history/model";
import { completedShiftTotals, formatDuration } from "./model";
import type { MockJob, Shift, TodayPlan } from "../../types";

export function CompletedShiftCard({
  shift,
  jobs,
  plan,
  currency,
  payVisible,
  canEdit,
  busy,
  onEdit,
}: {
  shift: Shift;
  jobs: MockJob[];
  plan: TodayPlan;
  currency: string;
  payVisible: boolean;
  canEdit: boolean;
  busy: boolean;
  onEdit: () => void;
}) {
  const { styles, colors } = useThemeTokens(),
    { timeLabel } = useClockFormat();
  const job = jobs.find((job) => job.id === shift.jobId);
  const totals = completedShiftTotals(shift, jobs, plan, currency);
  const amount = (value: number) =>
    payVisible ? money(value, totals.currency) : "•••••";
  return (
    <View style={[styles.card, { marginTop: 10 }]}>
      <Text style={styles.cardTitle}>{job?.name ?? "Unassigned job"}</Text>
      <Text style={styles.cardMeta}>
        {shift.date} · {timeLabel(shift.startedAt)} –{" "}
        {timeLabel(shift.endedAt ?? "")}
      </Text>
      <Text style={styles.cardMeta}>
        {formatDuration(totals.workedSeconds)} worked · {shift.lunchMinutes}m
        lunch · {shift.breakMinutes}m breaks
      </Text>
      <Text style={[styles.cardMeta, { marginTop: 10 }]}>
        Wages: {amount(totals.wages)} · Tips: {amount(totals.tips)}
      </Text>
      <Text
        style={{
          color: colors.accent,
          fontWeight: "900",
          fontSize: 22,
          marginTop: 6,
        }}
      >
        Gross earnings: {amount(totals.total)}
      </Text>
      {canEdit && (
        <Action title="Edit times" disabled={busy} onPress={onEdit} />
      )}
    </View>
  );
}
