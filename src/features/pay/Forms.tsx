import { useRef, useState } from "react";
import { Text, View } from "react-native";
import {
  Action,
  Choices,
  DateField,
  Field,
  Toggle,
} from "../../components/FormControls";
import { useThemeTokens } from "../../providers/ThemeProvider";
import type {
  AppState,
  Deduction,
  MockPaycheck,
  PaySchedule,
} from "../../types";
import { localDate, money } from "../history/model";
import {
  editSchedule,
  frequencies,
  paycheckDraft,
  periodEntries,
  shiftAmounts,
  validateDeduction,
  validateReceipt,
  validateSchedule,
  validBounds,
  type Bounds,
} from "./model";

function usePayForm() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (operation: () => Promise<string | null>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      setError(await operation());
    } catch {
      setError(
        "Could not save on this device. Your inputs are still here. Please try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return { busy, error, setError, save };
}

export function ErrorText({ error }: { error: string | null }) {
  const { colors, styles } = useThemeTokens();
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
}: {
  initial: PaySchedule;
  jobId: string | null;
  onSave: (
    schedule: PaySchedule,
    applyToJob: boolean,
  ) => Promise<string | null>;
}) {
  const { styles } = useThemeTokens();
  const [draft, setDraft] = useState(initial);
  const { busy, error, setError, save } = usePayForm();
  const [applyToJob, setApplyToJob] = useState(Boolean(jobId));
  return (
    <View style={styles.card} pointerEvents={busy ? "none" : "auto"}>
      <Text style={styles.cardTitle}>Pay Schedule</Text>
      <Choices
        options={frequencies}
        value={draft.frequency}
        onChange={(frequency) => {
          setError(null);
          setDraft((current) => editSchedule(current, "frequency", frequency));
        }}
      />
      <DateField
        label="Period start"
        value={draft.periodStart}
        onChange={(value) => {
          setError(null);
          setDraft((current) => editSchedule(current, "periodStart", value));
        }}
      />
      <Text style={styles.cardMeta}>
        Changing the frequency or start rebuilds the period end and expected pay
        date. A custom end keeps the selected period length when navigating.
      </Text>
      <DateField
        label="Period end"
        value={draft.periodEnd}
        onChange={(value) => {
          setError(null);
          setDraft((current) => editSchedule(current, "periodEnd", value));
        }}
      />
      <DateField
        label="Pay date"
        value={draft.payDate}
        onChange={(value) => {
          setError(null);
          setDraft((current) => editSchedule(current, "payDate", value));
        }}
      />
      {jobId && !draft.customPeriod && (
        <Toggle
          title="Use for this job’s paycheck schedule"
          value={applyToJob}
          onChange={setApplyToJob}
        />
      )}
      {jobId && draft.customPeriod && (
        <Text style={styles.cardMeta}>
          This custom window is saved for Pay only. The job’s recurring schedule
          stays unchanged.
        </Text>
      )}
      <ErrorText error={error} />
      <Action
        title={busy ? "Saving…" : "Save schedule"}
        disabled={busy}
        onPress={() => {
          const validation = validateSchedule(draft);
          if (validation) setError(validation);
          else
            void save(() => onSave(draft, applyToJob && !draft.customPeriod));
        }}
      />
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
  lockedJobId,
  referenceBounds,
  onCancel,
  onSave,
}: {
  initial?: Deduction;
  data: AppState;
  defaultJobId?: string | null;
  lockedJobId?: string;
  referenceBounds?: Bounds;
  onCancel?: () => void;
  onSave: (deduction: Deduction) => Promise<string | null> | void;
}) {
  const { colors, styles } = useThemeTokens();
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
  const [amount, changeAmount] = useState(
    initial ? String(initial.amount) : "",
  );
  const setAmount = (value: string) => {
    setError(null);
    changeAmount(value);
  };
  const { busy, error, setError, save } = usePayForm();
  const update = (changes: Partial<Deduction>) => {
    setError(null);
    setDraft((value) => ({ ...value, ...changes }));
  };
  const currency =
    data.jobs.find((job) => job.id === draft.jobId)?.currency ??
    data.preferences.currency;
  const boundedEntries = periodEntries(
    data,
    {
      start:
        draft.applicableFromDate ??
        referenceBounds?.start ??
        `${localDate().slice(0, 7)}-01`,
      end: draft.applicableToDate ?? referenceBounds?.end ?? localDate(),
    },
    draft.jobId ?? null,
    currency,
    true,
  );
  const effectiveGross = boundedEntries.reduce(
    (sum, entry) => sum + shiftAmounts(entry, data).gross,
    0,
  );
  const switchMode = (percentage: boolean) => {
    if (percentage === Boolean(draft.isPercentage)) return;
    changeAmount("");
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
    <View style={styles.card} pointerEvents={busy ? "none" : "auto"}>
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
      <Text style={styles.cardMeta}>
        Changing the amount type clears the input.{" "}
        {draft.isPercentage
          ? "Percentage applies to gross in this rule’s job/date scope; frequency does not multiply the percentage."
          : `Flat amounts use ${currency}. Global flat amounts always use your default currency.`}
      </Text>
      {effectiveGross > 0 && (
        <Text style={styles.cardMeta}>
          {data.payVisible
            ? `Reference gross ${money(effectiveGross, currency)}${draft.isPercentage ? ` · Percentage amount ${money((effectiveGross * (Number(amount) || 0)) / 100, currency)}` : ""}`
            : "Period amounts hidden"}
          {boundedEntries ? ` · ${boundedEntries.length} completed shifts` : ""}
        </Text>
      )}
      {draft.isPercentage ? (
        <Choices
          options={[
            { value: "ongoing", label: "Ongoing percentage" },
            { value: "one-time", label: "One-time percentage" },
          ]}
          value={draft.frequency === "one-time" ? "one-time" : "ongoing"}
          onChange={(value) =>
            update({ frequency: value === "one-time" ? "one-time" : "monthly" })
          }
        />
      ) : (
        <Choices
          options={deductionFrequencies}
          value={draft.frequency}
          onChange={(frequency) =>
            update({ frequency: frequency as Deduction["frequency"] })
          }
        />
      )}
      {lockedJobId ? (
        <Text style={styles.cardMeta}>
          Job:{" "}
          {data.jobs.find((job) => job.id === lockedJobId)?.name ??
            "Removed job"}{" "}
          · This deduction stays with this job.
        </Text>
      ) : (
        <Choices
          value={draft.jobId ?? ""}
          options={[
            { value: "", label: "All jobs" },
            ...data.jobs.map((job) => ({ value: job.id, label: job.name })),
          ]}
          onChange={(jobId) => {
            if (
              !draft.isPercentage &&
              (data.jobs.find((job) => job.id === jobId)?.currency ??
                data.preferences.currency) !== currency
            )
              changeAmount("");
            update({ jobId: jobId || null });
          }}
        />
      )}
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
        title={busy ? "Saving…" : "Save deduction"}
        disabled={busy}
        onPress={() => {
          const value = {
            ...draft,
            label: draft.label.trim(),
            amount: amount.trim() === "" ? NaN : Number(amount),
          };
          const validation = validateDeduction(value);
          if (validation) setError(validation);
          else void save(async () => (await onSave(value)) ?? null);
        }}
      />
      {onCancel && <Action title="Cancel" disabled={busy} onPress={onCancel} />}
    </View>
  );
}

export function ReceiptForm({
  data,
  jobId,
  currency,
  initialBounds,
  onSave,
}: {
  data: AppState;
  jobId: string;
  currency: string;
  initialBounds: Bounds;
  onSave: (record: MockPaycheck, markShifts: boolean) => Promise<string | null>;
}) {
  const { styles } = useThemeTokens();
  const [bounds, setBounds] = useState(initialBounds);
  const estimate = paycheckDraft(data, jobId, bounds, currency);
  const [date, setDate] = useState(localDate);
  const [gross, setGross] = useState("");
  const [deductions, setDeductions] = useState("");
  const [notes, setNotes] = useState("");
  const markShifts = true;
  const { busy, error, setError, save } = usePayForm();
  const changeBounds = (value: Bounds) => {
    if (value.start === bounds.start && value.end === bounds.end) return;
    setBounds(value);
    setGross("");
    setDeductions("");
    setError(null);
  };
  return (
    <View style={styles.card} pointerEvents={busy ? "none" : "auto"}>
      <Text style={styles.cardTitle}>Paycheck Received</Text>
      <Text style={styles.cardMeta}>
        {data.jobs.find((job) => job.id === jobId)?.name} · {currency}
      </Text>
      <DateField
        label="Period start"
        value={bounds.start}
        onChange={(start) => changeBounds({ ...bounds, start })}
      />
      <DateField
        label="Period end"
        value={bounds.end}
        onChange={(end) => changeBounds({ ...bounds, end })}
      />
      <Action
        title="Copy tracked estimate into actual amounts"
        disabled={!validBounds(bounds)}
        onPress={() => {
          const calculated = paycheckDraft(data, jobId, bounds, currency);
          setGross(calculated.gross.toFixed(2));
          setDeductions(calculated.deductions.toFixed(2));
        }}
      />
      <Text style={styles.cardMeta}>
        {estimate.entries.length} completed shifts · Tracked gross{" "}
        {data.payVisible ? money(estimate.gross, currency) : "•••••"}. Enter the
        amounts from your payslip; copied values are estimates. Changing dates
        clears the amount inputs.
      </Text>
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
        {!gross.trim() ||
        !deductions.trim() ||
        !Number.isFinite(Number(gross)) ||
        !Number.isFinite(Number(deductions)) ||
        Number(gross) < 0 ||
        Number(deductions) < 0 ||
        Number(deductions) > Number(gross)
          ? "—"
          : data.payVisible
            ? money(
                Math.max(0, (Number(gross) || 0) - (Number(deductions) || 0)),
                currency,
              )
            : "•••••"}
      </Text>
      <Field label="Notes" multiline value={notes} onChange={setNotes} />
      <Text style={styles.cardMeta}>
        Saving marks covered completed shifts as paid. Undo restores only
        payments made by this receipt and preserves earlier manual payments.
      </Text>
      <ErrorText error={error} />
      <Action
        title={busy ? "Saving…" : "Confirm received paycheck"}
        disabled={busy}
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
            hoursWorked: estimate.hours,
            shiftCount: estimate.entries.length,
            createdAt: new Date().toISOString(),
          };
          const validation = validateReceipt(record, localDate());
          if (validation) setError(validation);
          else void save(() => onSave(record, markShifts));
        }}
      />
    </View>
  );
}
