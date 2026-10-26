import { useState } from "react";
import { Text, View } from "react-native";
import type { AppState } from "../../types";
import { Choices, Field, Toggle } from "../../components/FormControls";
import { duration, money } from "../history/model";
import { useThemeTokens } from "../../providers/ThemeProvider";
import { ErrorText } from "./Forms";
import {
  estimateDeductions,
  periodEntries,
  manualDeduction,
  shiftAmounts,
  type Bounds,
} from "./model";
import { Metric } from "./Section";

export function Estimator({
  data,
  currency,
  jobId,
  bounds,
}: {
  data: AppState;
  currency: string;
  jobId: string | null;
  bounds: Bounds;
}) {
  const { colors, styles } = useThemeTokens();
  const [preferConfigured, setPreferConfigured] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualType, setManualType] = useState("amount");
  const [manualValue, setManualValue] = useState("");
  const code = currency;
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
  const override = manualDeduction(gross, manualType, manualValue);
  const manualError = manual ? override.error : null;
  const deductions = manual ? override.amount : estimate.total;
  const fmt = (amount: number) =>
    data.payVisible ? money(amount, code) : "•••••";
  return (
    <View>
      <Text style={styles.cardTitle}>Paycheck Estimator</Text>
      <Text style={styles.cardMeta}>
        {bounds.start} → {bounds.end} ·{" "}
        {data.jobs.find((job) => job.id === jobId)?.name ?? "All jobs"} · {code}
        . Uses the filters above and completed shifts only.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Metric label="Gross pay" value={fmt(gross)} />
        <Metric
          label="Est. deductions"
          value={
            deductions == null ? "Enter valid deductions" : fmt(deductions)
          }
        />
        <Metric
          label="Est. net pay"
          value={
            deductions == null ? "—" : fmt(Math.max(0, gross - deductions))
          }
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
      {!manual && estimate.count > 0 && (
        <Text style={styles.cardMeta}>
          Confidence:{" "}
          {estimate.count >= 8
            ? "High"
            : estimate.count >= 4
              ? "Medium"
              : "Low"}
        </Text>
      )}
      {gross > 0 && deductions != null && deductions / gross > 0.4 && (
        <Text style={[styles.cardMeta, { color: colors.warning }]}>
          Deductions exceed 40% of gross. Check your saved settings and paycheck
          history.
        </Text>
      )}
      {!manual && (
        <Toggle
          title="Prefer saved deductions over paycheck history"
          value={preferConfigured}
          onChange={setPreferConfigured}
        />
      )}
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
            onChange={(value) => {
              if (value === manualType) return;
              setManualType(value);
              setManualValue("");
            }}
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
