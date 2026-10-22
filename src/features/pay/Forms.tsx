import { useState } from "react";
import { Text, View } from "react-native";
import {
  Action,
  Choices,
  DateField,
  Field,
  Toggle,
} from "../../components/FormControls";
import { styles, colors } from "../../theme";
import type {
  AppState,
  Deduction,
  MockPaycheck,
  PayFrequency,
  PaySchedule,
} from "../../types";
import { localDate, money } from "../history/model";
import {
  daysBetween,
  frequencies,
  paycheckDraft,
  scheduleFor,
  periodEntries,
  shiftAmounts,
  validateDeduction,
  validateReceipt,
  validateSchedule,
  type Bounds,
} from "./model";
import { addDays } from "../history/payPeriods";

export function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <Text
      accessibilityRole="alert"
      style={[styles.cardMeta, { color: colors.danger }]}
    >
      {error}
    </Text>
  ) : null;
}
export function ScheduleForm({
  initial,
  jobId,
  onSave,
  onCancel,
}: {
  initial: PaySchedule;
  jobId: string | null;
  onSave: (schedule: PaySchedule, applyToJob: boolean) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [applyToJob, setApplyToJob] = useState(Boolean(jobId));
  const update = (value: Partial<PaySchedule>) => {
    setError(null);
    setDraft((current) => ({ ...current, ...value }));
  };
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Pay Schedule</Text>
      <Choices
        options={frequencies}
        value={draft.frequency}
        onChange={(frequency) =>
          setDraft(
            scheduleFor(
              frequency as PayFrequency,
              draft.periodStart,
              draft.payDelayDays,
            ),
          )
        }
      />
      <DateField
        label="Period start"
        value={draft.periodStart}
        onChange={(start) =>
          setDraft(scheduleFor(draft.frequency, start, draft.payDelayDays))
        }
      />
      <DateField
        label="Period end"
        value={draft.periodEnd}
        onChange={(end) =>
          update({
            periodEnd: end,
            payDate: addDays(end, draft.payDelayDays),
            customPeriod:
              end !== scheduleFor(draft.frequency, draft.periodStart).periodEnd,
          })
        }
      />
      <DateField
        label="Pay date"
        value={draft.payDate}
        onChange={(payDate) =>
          update({
            payDate,
            payDelayDays: daysBetween(draft.periodEnd, payDate),
          })
        }
      />
      {jobId && (
        <Toggle
          title="Use for this job’s paycheck schedule"
          value={applyToJob}
          onChange={setApplyToJob}
        />
      )}
      <ErrorText error={error} />
      <Action
        title="Save schedule"
        onPress={() => {
          const validation = validateSchedule(draft);
          if (validation) setError(validation);
          else onSave(draft, applyToJob);
        }}
      />
      <Action title="Cancel" onPress={onCancel} />
    </View>
  );
}

const deductionFrequencies: { value: Deduction["frequency"]; label: string }[] =
  [
    { value: "daily", label: "Per day" },
    { value: "weekly", label: "Per week" },
    { value: "per-pay-period", label: "Per pay period" },
    { value: "monthly", label: "Per month" },
    { value: "yearly", label: "Per year" },
    { value: "one-time", label: "One-time" },
  ];
export function DeductionForm({
  initial,
  data,
  defaultJobId = null,
  grossPay = 0,
  onSave,
  onCancel,
}: {
  initial?: Deduction;
  data: AppState;
  defaultJobId?: string | null;
  grossPay?: number;
  onSave: (deduction: Deduction) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Deduction>(
    initial ?? {
      id: `deduction-${Date.now()}`,
      label: "",
      amount: 0,
      frequency: "monthly",
      enabled: true,
      jobId: defaultJobId,
    },
  );
  const [flatAmount, setFlatAmount] = useState(
    initial && !initial.isPercentage ? String(initial.amount) : "",
  );
  const [percentAmount, setPercentAmount] = useState(
    initial?.isPercentage ? String(initial.amount) : "",
  );
  const amount = draft.isPercentage ? percentAmount : flatAmount;
  const setAmount = (value: string) => {
    setError(null);
    if (draft.isPercentage) setPercentAmount(value);
    else setFlatAmount(value);
  };
  const [error, setError] = useState<string | null>(null);
  const update = (changes: Partial<Deduction>) => {
    setError(null);
    setDraft((value) => ({ ...value, ...changes }));
  };
  const currency =
    data.jobs.find((job) => job.id === draft.jobId)?.currency ?? "USD";
  const boundedEntries =
    draft.applicableFromDate && draft.applicableToDate
      ? periodEntries(
          data,
          { start: draft.applicableFromDate, end: draft.applicableToDate },
          draft.jobId ?? null,
          currency,
          true,
        )
      : null;
  const effectiveGross = boundedEntries
    ? boundedEntries.reduce(
        (sum, entry) => sum + shiftAmounts(entry, data).gross,
        0,
      )
    : grossPay;
  const switchMode = (percentage: boolean) => {
    if (
      percentage &&
      !percentAmount &&
      effectiveGross > 0 &&
      Number(flatAmount) > 0
    )
      setPercentAmount(
        ((Number(flatAmount) / effectiveGross) * 100).toFixed(2),
      );
    if (
      !percentage &&
      !flatAmount &&
      effectiveGross > 0 &&
      Number(percentAmount) > 0
    )
      setFlatAmount(
        ((effectiveGross * Number(percentAmount)) / 100).toFixed(2),
      );
    update({ isPercentage: percentage });
  };
  const optionalDate = (
    label: string,
    key: "applicableFromDate" | "applicableToDate" | "payDate",
  ) => (
    <View>
      <DateField
        label={label}
        value={draft[key] ?? ""}
        onChange={(value) => update({ [key]: value })}
      />
      {draft[key] && (
        <Action
          title={`Clear ${label.toLowerCase()}`}
          onPress={() => update({ [key]: undefined })}
        />
      )}
    </View>
  );
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{initial ? "Edit" : "Add"} Deduction</Text>
      <Field
        label="Name"
        value={draft.label}
        onChange={(label) => update({ label })}
      />
      <Choices
        options={[
          { value: "amount", label: "Flat amount" },
          { value: "percent", label: "Percentage" },
        ]}
        value={draft.isPercentage ? "percent" : "amount"}
        onChange={(value) => switchMode(value === "percent")}
      />
      <Field
        label={draft.isPercentage ? "Percentage (%)" : "Amount"}
        numeric
        value={amount}
        onChange={setAmount}
      />
      {effectiveGross > 0 && (
        <Text style={styles.cardMeta}>
          {data.payVisible
            ? `Period gross ${money(effectiveGross, currency)} · Equivalent ${draft.isPercentage ? money((effectiveGross * (Number(amount) || 0)) / 100, currency) : `${(((Number(amount) || 0) / effectiveGross) * 100).toFixed(2)}%`}`
            : "Period amounts hidden"}
          {boundedEntries ? ` · ${boundedEntries.length} completed shifts` : ""}
        </Text>
      )}
      <Choices
        options={deductionFrequencies}
        value={draft.frequency}
        onChange={(frequency) =>
          update({ frequency: frequency as Deduction["frequency"] })
        }
      />
      <Choices
        value={draft.jobId ?? ""}
        options={[
          { value: "", label: "All jobs" },
          ...data.jobs.map((job) => ({ value: job.id, label: job.name })),
        ]}
        onChange={(jobId) => update({ jobId: jobId || null })}
      />
      <Toggle
        title="Enabled"
        value={draft.enabled}
        onChange={(enabled) => update({ enabled })}
      />
      <Toggle
        title="Pre-tax deduction"
        value={draft.beforeTax ?? false}
        onChange={(beforeTax) => update({ beforeTax })}
      />
      <Toggle
        title="Tax set-aside"
        value={draft.taxSetAside ?? false}
        onChange={(taxSetAside) => update({ taxSetAside })}
      />
      {optionalDate("Applicable from", "applicableFromDate")}
      {optionalDate("Applicable to", "applicableToDate")}
      {optionalDate("Payment received date", "payDate")}
      <Field
        label="Notes"
        multiline
        value={draft.notes ?? ""}
        onChange={(notes) => update({ notes })}
      />
      {draft.consumedByPaycheckId && (
        <Text style={[styles.cardMeta, { color: colors.warning }]}>
          Applied to a received paycheck; excluded from future estimates.
        </Text>
      )}
      <ErrorText error={error} />
      <Action
        title="Save deduction"
        onPress={() => {
          const value = {
            ...draft,
            label: draft.label.trim(),
            amount: amount.trim() === "" ? NaN : Number(amount),
          };
          const validation = validateDeduction(value);
          if (validation) setError(validation);
          else onSave(value);
        }}
      />
      <Action title="Cancel" onPress={onCancel} />
    </View>
  );
}

export function ReceiptForm({
  data,
  jobId,
  initialBounds,
  onSave,
  onCancel,
}: {
  data: AppState;
  jobId: string;
  initialBounds: Bounds;
  onSave: (record: MockPaycheck, markShifts: boolean) => string | null;
  onCancel: () => void;
}) {
  const estimate = paycheckDraft(data, jobId, initialBounds);
  const [bounds, setBounds] = useState(initialBounds);
  const [date, setDate] = useState(localDate());
  const [gross, setGross] = useState(estimate.gross.toFixed(2));
  const [deductions, setDeductions] = useState(estimate.deductions.toFixed(2));
  const [notes, setNotes] = useState("");
  const [markShifts, setMarkShifts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currency = data.jobs.find((job) => job.id === jobId)?.currency ?? "USD";
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Paycheck Received</Text>
      <Text style={styles.cardMeta}>
        {data.jobs.find((job) => job.id === jobId)?.name} · {currency}
      </Text>
      <DateField
        label="Period start"
        value={bounds.start}
        onChange={(start) => setBounds((value) => ({ ...value, start }))}
      />
      <DateField
        label="Period end"
        value={bounds.end}
        onChange={(end) => setBounds((value) => ({ ...value, end }))}
      />
      <Action
        title="Use tracked amounts for these dates"
        onPress={() => {
          const calculated = paycheckDraft(data, jobId, bounds);
          setGross(calculated.gross.toFixed(2));
          setDeductions(calculated.deductions.toFixed(2));
        }}
      />
      <DateField label="Received on" value={date} onChange={setDate} />
      <Field
        label="Actual gross pay"
        numeric
        value={gross}
        onChange={setGross}
      />
      <Field
        label="Actual deductions"
        numeric
        value={deductions}
        onChange={setDeductions}
      />
      <Text style={styles.cardTitle}>
        Net pay:{" "}
        {data.payVisible
          ? money(
              Math.max(0, (Number(gross) || 0) - (Number(deductions) || 0)),
              currency,
            )
          : "•••••"}
      </Text>
      <Field label="Notes" multiline value={notes} onChange={setNotes} />
      <Toggle
        title="Mark covered shifts as paid"
        value={markShifts}
        onChange={setMarkShifts}
      />
      <ErrorText error={error} />
      <Action
        title="Confirm received paycheck"
        onPress={() => {
          const record: MockPaycheck = {
            id: `paycheck-${Date.now()}`,
            jobId,
            startDate: bounds.start,
            endDate: bounds.end,
            paid: true,
            payDate: date,
            grossPay: gross.trim() === "" ? NaN : Number(gross),
            totalDeductions:
              deductions.trim() === "" ? NaN : Number(deductions),
            netPay: Number(gross) - Number(deductions),
            notes: notes.trim(),
            currency,
            hoursWorked: paycheckDraft(data, jobId, bounds).hours,
            shiftCount: paycheckDraft(data, jobId, bounds).entries.length,
            createdAt: new Date().toISOString(),
          };
          const validation = validateReceipt(record);
          setError(validation ?? onSave(record, markShifts));
        }}
      />
      <Action title="Cancel" onPress={onCancel} />
    </View>
  );
}
