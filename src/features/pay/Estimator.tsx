import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { AppState, PaySchedule } from "../../types";
import { Action, Choices, Field, Toggle } from "../../components/FormControls";
import { duration, localDate, money } from "../history/model";
import { payPeriod } from "../history/payPeriods";
import { useThemeTokens } from "../../providers/ThemeProvider";
import { ErrorText, ScheduleForm } from "./Forms";
import {
  estimateDeductions,
  moveSchedule,
  periodEntries,
  scheduleFor,
  shiftAmounts,
} from "./model";
import { Metric } from "./Section";

export function Estimator({
  data,
  currency,
  onSaveSchedule,
}: {
  data: AppState;
  currency: string;
  onSaveSchedule: (
    scope: string,
    schedule: PaySchedule,
    applyToJob: boolean,
  ) => void;
}) {
  const { colors, styles } = useThemeTokens();
  const [scope, setScope] = useState("__all__");
  const [editing, setEditing] = useState(false);
  const [preferConfigured, setPreferConfigured] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualType, setManualType] = useState("amount");
  const [manualValue, setManualValue] = useState("");
  const job = data.jobs.find((job) => job.id === scope);
  const code = job?.currency ?? currency;
  const jobId = job?.id ?? null;
  const schedule =
    data.paySchedules[scope] ??
    (job?.payFrequency && job.payPeriodStart
      ? (() => {
          const period = payPeriod(localDate(), job)!;
          return {
            ...scheduleFor(
              job.payFrequency!,
              period.start,
              job.payDelayDays ?? 7,
            ),
            anchorDate: job.payPeriodStart,
          };
        })()
      : scheduleFor("biweekly", localDate()));
  useEffect(() => {
    if (!data.paySchedules[scope]) onSaveSchedule(scope, schedule, false);
  }, [scope]);
  const bounds = { start: schedule.periodStart, end: schedule.periodEnd };
  const entries = periodEntries(data, bounds, jobId, code, true);
  const perJobGross = new Map<string | null, number>();
  let gross = 0;
  let minutes = 0;
  entries.forEach((entry) => {
    const value = shiftAmounts(entry, data);
    gross += value.gross;
    minutes += value.minutes;
    perJobGross.set(
      entry.jobId ?? null,
      (perJobGross.get(entry.jobId ?? null) ?? 0) + value.gross,
    );
  });
  const estimate = estimateDeductions(
    data,
    bounds,
    jobId,
    perJobGross,
    code,
    preferConfigured,
  );
  const manualNumber = Number(manualValue);
  const manualError =
    manual &&
    (!manualValue.trim() ||
      !Number.isFinite(manualNumber) ||
      manualNumber < 0 ||
      (manualType === "percent" && manualNumber > 100))
      ? "Enter a valid amount, or a percentage between 0 and 100."
      : null;
  const deductions =
    manual && !manualError
      ? manualType === "percent"
        ? (gross * manualNumber) / 100
        : manualNumber
      : estimate.total;
  const fmt = (amount: number) =>
    data.payVisible ? money(amount, code) : "•••••";
  return (
    <View>
      <Text style={styles.cardTitle}>Paycheck Estimator</Text>
      <Choices
        options={[
          { value: "__all__", label: "All jobs" },
          ...data.jobs.map((job) => ({ value: job.id, label: job.name })),
        ]}
        value={scope}
        onChange={(value) => {
          setScope(value);
          setEditing(false);
          setManual(false);
          setManualValue("");
        }}
      />
      <Text style={styles.cardMeta}>
        {schedule.periodStart} → {schedule.periodEnd} · Pay date{" "}
        {schedule.payDate} · {code}
      </Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Action
            title="← Previous period"
            onPress={() =>
              onSaveSchedule(scope, moveSchedule(schedule, -1), false)
            }
          />
        </View>
        <View style={{ flex: 1 }}>
          <Action
            title="Next period →"
            onPress={() =>
              onSaveSchedule(scope, moveSchedule(schedule, 1), false)
            }
          />
        </View>
      </View>
      <Action
        title="Edit pay schedule"
        onPress={() => setEditing((value) => !value)}
      />
      {editing && (
        <ScheduleForm
          key={scope}
          initial={schedule}
          jobId={jobId}
          onSave={(value, apply) => {
            onSaveSchedule(scope, value, apply);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Metric label="Gross pay" value={fmt(gross)} />
        <Metric label="Est. deductions" value={fmt(deductions)} />
        <Metric
          label="Est. net pay"
          value={fmt(Math.max(0, gross - deductions))}
          accent
        />
        <Metric
          label="Recorded work"
          value={`${duration(minutes)} · ${entries.length} shifts`}
        />
      </View>
      <Text style={styles.cardMeta}>
        {manual ? "Manual deduction override" : estimate.label}
      </Text>
      {estimate.count > 0 && (
        <Text style={styles.cardMeta}>
          Confidence:{" "}
          {estimate.count >= 8
            ? "High"
            : estimate.count >= 4
              ? "Medium"
              : "Low"}
        </Text>
      )}
      {gross > 0 && deductions / gross > 0.4 && (
        <Text style={[styles.cardMeta, { color: colors.warning }]}>
          Deductions exceed 40% of gross. Check your saved settings and paycheck
          history.
        </Text>
      )}
      <Toggle
        title="Prefer saved deductions over paycheck history"
        value={preferConfigured}
        onChange={setPreferConfigured}
      />
      <Toggle
        title="Override deductions manually"
        value={manual}
        onChange={setManual}
      />
      {manual && (
        <>
          <Choices
            options={[
              { value: "amount", label: "Amount" },
              { value: "percent", label: "Percentage" },
            ]}
            value={manualType}
            onChange={setManualType}
          />
          <Field
            label={
              manualType === "percent"
                ? "Deduction percentage"
                : "Deduction amount"
            }
            numeric
            value={manualValue}
            onChange={setManualValue}
          />
          <ErrorText error={manualError} />
        </>
      )}
      {!manual &&
        estimate.lineItems.map((item) => (
          <Text key={item.id} style={styles.cardMeta}>
            {item.label}: {fmt(item.amount)}
          </Text>
        ))}
      {entries.length === 0 && (
        <Text style={styles.cardMeta}>
          No completed shifts in this period. Add or complete a shift in Tracker
          or History to see an estimate.
        </Text>
      )}
      <Text style={styles.cardMeta}>
        Cash tips are received separately and are excluded from paycheck gross.
        This estimator does not modify recorded shifts.
      </Text>
    </View>
  );
}
