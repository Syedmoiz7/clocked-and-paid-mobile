import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppState, Deduction, MockPaycheck, PaySchedule } from "../types";
import { useThemeTokens } from "../providers/ThemeProvider";
import { Action, Choices, DateField, Toggle } from "../components/FormControls";
import {
  currencies,
  duration,
  localDate,
  money,
} from "../features/history/model";
import { addDays, payPeriod } from "../features/history/payPeriods";
import { DeductionForm, ScheduleForm } from "../features/pay/Forms";
import { Estimator } from "../features/pay/Estimator";
import { Paychecks } from "../features/pay/Paychecks";
import { PayTrends, Progress } from "../features/pay/Trends";
import { Metric, PaySection } from "../features/pay/Section";
import {
  daysBetween,
  financialSummary,
  ranges,
  rangeBounds,
  projectedDeductions,
  scheduleFor,
  validBounds,
  type Bounds,
  type Range,
} from "../features/pay/model";
import { PaywallCard } from "../components/PaywallCard";

type Props = {
  data: AppState;
  onPremium: () => void;
  onEndPreview: () => void;
  onPayVisible: (value: boolean) => void;
  onSchedule: (
    scope: string,
    schedule: PaySchedule,
    applyToJob: boolean,
  ) => void;
  onDeduction: (deduction: Deduction) => void;
  onDeleteDeduction: (id: string) => void;
  onReceipt: (record: MockPaycheck, markShifts: boolean) => string | null;
  onUndoReceipt: (id: string) => void;
  onMarkPaid: (ids: string[]) => void;
};

export function PayScreen({
  data,
  onPremium,
  onEndPreview,
  onPayVisible,
  onSchedule,
  onDeduction,
  onDeleteDeduction,
  onReceipt,
  onUndoReceipt,
  onMarkPaid,
}: Props) {
  const { colors, styles } = useThemeTokens();
  const [range, setRange] = useState<Range>("last30");
  const [scope, setScope] = useState("");
  const [currency, setCurrency] = useState(data.preferences.currency);
  useEffect(
    () => setCurrency(data.preferences.currency),
    [data.preferences.currency],
  );
  const [mode, setMode] = useState("payPeriod");
  const [customStart, setCustomStart] = useState(addDays(localDate(), -29));
  const [customEnd, setCustomEnd] = useState(localDate());
  const [offset, setOffset] = useState(0);
  const [setupScope, setSetupScope] = useState<string | null>(null);
  const [deductionForm, setDeductionForm] = useState<{
    initial?: Deduction;
  } | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!data.isPremium) {
      setMode("payPeriod");
      setOffset(0);
    }
  }, [data.isPremium]);
  useEffect(() => {
    if (!data.activeShift) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [data.activeShift]);
  const jobId = scope || null;
  const job = data.jobs.find((job) => job.id === jobId);
  const code = job?.currency ?? currency;
  const availableCurrencies = [
    ...new Set([
      data.preferences.currency,
      ...(data.activeShift?.currency ? [data.activeShift.currency] : []),
      ...data.jobs.map((item) => item.currency ?? data.preferences.currency),
      ...data.history.map(
        (entry) =>
          entry.currency ??
          data.jobs.find((item) => item.id === entry.jobId)?.currency ??
          data.preferences.currency,
      ),
    ]),
  ].filter((value) => currencies.includes(value));
  const scheduledJob =
    job?.payFrequency && job.payPeriodStart
      ? job
      : !jobId
        ? data.jobs.find((job) => job.payFrequency && job.payPeriodStart)
        : undefined;
  const quick = data.paySchedules[jobId ?? "__fs__"];
  const periodJob =
    scheduledJob ??
    (quick
      ? {
          id: "quick",
          name: "Quick schedule",
          hourlyRate: 0,
          color: colors.accent,
          payFrequency: quick.frequency,
          payPeriodStart: quick.anchorDate ?? quick.periodStart,
        }
      : null);
  let period = periodJob ? payPeriod(localDate(), periodJob) : null;
  if (period && periodJob)
    for (let i = 0; i < Math.abs(offset); i++)
      period = payPeriod(
        offset > 0 ? addDays(period.end, 1) : addDays(period.start, -1),
        periodJob,
      )!;
  const rangeWindow = rangeBounds(
    data.isPremium ? range : "last7",
    data.history,
  );
  const bounds: Bounds =
    mode === "custom" && data.isPremium
      ? { start: customStart, end: customEnd }
      : mode === "preset" && data.isPremium
        ? rangeBounds(range, data.history)
        : (period ??
          rangeBounds(data.isPremium ? range : "thisMonth", data.history));
  const summary = financialSummary(data, bounds, jobId, code, now);
  const fmt = (value: number) =>
    data.payVisible ? money(value, code) : "•••••";
  const setupJob = data.jobs.find((job) => job.id === setupScope);
  const initialSchedule = setupScope
    ? (data.paySchedules[setupScope] ??
      (setupJob?.payFrequency && setupJob.payPeriodStart
        ? scheduleFor(
            setupJob.payFrequency,
            setupJob.payPeriodStart,
            setupJob.payDelayDays ?? 7,
          )
        : scheduleFor("biweekly", localDate())))
    : null;
  const visibleDeductions = data.deductions.filter(
    (item) =>
      (!jobId || !item.jobId || item.jobId === jobId) &&
      (!item.jobId ||
        (data.jobs.find((job) => job.id === item.jobId)?.currency ??
          data.preferences.currency) === code),
  );
  const projection = projectedDeductions(
    { ...data, deductions: visibleDeductions },
    jobId,
    (summary.gross * 365) /
      Math.max(1, daysBetween(bounds.start, bounds.end) + 1),
    localDate(),
    new Map(
      summary.rows.map((row) => [
        row.jobId,
        (row.gross * 365) /
          Math.max(1, daysBetween(bounds.start, bounds.end) + 1),
      ]),
    ),
  );
  const changeScope = (value: string) => {
    setScope(value);
    setOffset(0);
    setCurrency(
      data.jobs.find((job) => job.id === value)?.currency ?? currency,
    );
  };
  const locked = (title: string) => (
    <PaywallCard
      title={title}
      description="Preview Premium to explore this feature with your saved data."
      onPress={onPremium}
    />
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Pay</Text>
        <Text style={styles.subtitle}>
          Earnings, pay periods & take-home estimate
        </Text>
        <Toggle
          title="Show Pay"
          value={data.payVisible}
          onChange={onPayVisible}
        />
        <Choices
          options={ranges}
          value={data.isPremium ? range : "last7"}
          onChange={(value) =>
            data.isPremium ? setRange(value as Range) : onPremium()
          }
        />
        <Choices
          options={[
            { value: "", label: "All jobs" },
            ...data.jobs.map((job) => ({ value: job.id, label: job.name })),
          ]}
          value={scope}
          onChange={changeScope}
        />
        {!jobId && availableCurrencies.length > 1 && (
          <>
            <Text style={styles.cardMeta}>Display currency</Text>
            <Choices
              options={availableCurrencies.map((value) => ({
                value,
                label: value,
              }))}
              value={currency}
              onChange={setCurrency}
            />
          </>
        )}
        {availableCurrencies.length > 1 && (
          <Text style={styles.cardMeta}>
            Showing {code} entries only. Currencies are not converted or
            combined.
          </Text>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {data.isPremium ? "Financial Summary" : "Current Period Pay"}
          </Text>
          <Choices
            options={[
              { value: "payPeriod", label: "Pay period" },
              { value: "preset", label: "Presets" },
              { value: "custom", label: "Custom" },
            ]}
            value={mode}
            onChange={(value) => {
              if (!data.isPremium && value !== "payPeriod") onPremium();
              else setMode(value);
            }}
          />
          {mode === "custom" && data.isPremium && (
            <>
              <DateField
                label="From"
                value={customStart}
                onChange={setCustomStart}
              />
              <DateField label="To" value={customEnd} onChange={setCustomEnd} />
            </>
          )}
          <Text style={styles.cardMeta}>
            {bounds.start} → {bounds.end}
            {summary.live ? " · Live pay accruing" : ""}
          </Text>
          {mode === "payPeriod" && (
            <>
              {period && (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Action
                      title="← Previous period"
                      onPress={() =>
                        data.isPremium
                          ? setOffset((value) => value - 1)
                          : onPremium()
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Action
                      title="Next period →"
                      onPress={() =>
                        data.isPremium
                          ? setOffset((value) => value + 1)
                          : onPremium()
                      }
                    />
                  </View>
                </View>
              )}
              {!period && (
                <Text style={styles.cardMeta}>
                  No pay schedule configured. Showing{" "}
                  {data.isPremium
                    ? ranges
                        .find((item) => item.value === range)
                        ?.label.toLowerCase()
                    : "this month"}{" "}
                  until you set one.
                </Text>
              )}
              <Action
                title={period ? "Edit pay schedule" : "Set up pay schedule"}
                onPress={() => setSetupScope(jobId ?? "__fs__")}
              />
            </>
          )}
          {!validBounds(bounds) ? (
            <Text style={[styles.cardMeta, { color: colors.warning }]}>
              Choose a valid date range.
            </Text>
          ) : (
            <>
              <Text
                style={{
                  color: colors.success,
                  fontSize: 36,
                  fontWeight: "900",
                  marginTop: 16,
                }}
              >
                {fmt(summary.takeHome)}
              </Text>
              <Text style={styles.cardMeta}>
                Take-home estimate · {summary.count}{" "}
                {summary.count === 1 ? "entry" : "entries"} ·{" "}
                {duration(summary.minutes)}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <Metric label="Gross earned" value={fmt(summary.gross)} />
                <Metric label="Net pay" value={fmt(summary.net)} />
                <Metric label="Deductions" value={fmt(summary.deductions)} />
                <Metric
                  label="Cash tips (separate)"
                  value={fmt(summary.cashTips)}
                />
                <Metric
                  label="Received gross"
                  value={fmt(summary.paid)}
                  color={colors.success}
                />
                <Metric
                  label="Outstanding gross"
                  value={fmt(summary.outstanding)}
                  color={
                    summary.outstanding > 0 ? colors.warning : colors.muted
                  }
                />
              </View>
              <Text style={styles.cardMeta}>
                {summary.confirmedCount
                  ? `Deductions from ${summary.confirmedCount} confirmed paycheck(s)`
                  : summary.estimate.label}
              </Text>
              {summary.taxSetAside > 0 && (
                <Text style={styles.cardMeta}>
                  Tax set-aside included: {fmt(summary.taxSetAside)}
                </Text>
              )}
              {!summary.count && (
                <Text style={styles.cardMeta}>
                  No recorded work in this period. Add time in Tracker or
                  History.
                </Text>
              )}
            </>
          )}
        </View>
        {setupScope && initialSchedule && (
          <ScheduleForm
            key={setupScope}
            initial={initialSchedule}
            jobId={setupJob?.id ?? null}
            onSave={(schedule, apply) => {
              onSchedule(setupScope, schedule, apply);
              setSetupScope(null);
              setOffset(0);
            }}
            onCancel={() => setSetupScope(null)}
          />
        )}

        <PaySection
          title="Upcoming Paychecks"
          subtitle="Overdue, in-progress & received pay periods"
        >
          {data.isPremium ? (
            <Paychecks
              data={data}
              onRecord={onReceipt}
              onDelete={onUndoReceipt}
              onMarkPaid={onMarkPaid}
              onSchedule={onSchedule}
            />
          ) : (
            locked("Paycheck schedules & receipts")
          )}
        </PaySection>
        <PaySection
          title={`Progress · ${data.isPremium ? ranges.find((item) => item.value === range)?.label : "Last 7 days"}`}
        >
          <Progress
            data={data}
            bounds={rangeWindow}
            jobId={jobId}
            currency={code}
          />
        </PaySection>
        <PaySection
          title="Trends"
          subtitle="Earnings over time, hours worked & earnings by job"
        >
          {data.isPremium ? (
            <PayTrends
              data={data}
              bounds={rangeWindow}
              jobId={jobId}
              currency={code}
            />
          ) : (
            locked("Earnings & hours trends")
          )}
        </PaySection>
        <PaySection
          title="Estimator & Deductions"
          subtitle={`${data.deductions.filter((item) => item.enabled).length} active deduction(s)`}
        >
          {data.isPremium ? (
            <>
              <Estimator
                data={data}
                currency={code}
                onSaveSchedule={onSchedule}
              />
              <Text style={[styles.cardTitle, { marginTop: 24 }]}>
                Taxes & Deductions
              </Text>
              <Text style={styles.cardMeta}>
                Projected monthly: {fmt(projection.monthly)} · Annual:{" "}
                {fmt(projection.annual)}
              </Text>
              <Text style={styles.cardMeta}>
                Percentage projections use annualized earnings from the summary
                range. Pre-tax labels describe the rule; no tax bracket
                calculation is performed.
              </Text>
              <Action
                title="+ Add deduction"
                onPress={() => setDeductionForm({})}
              />
              {deductionForm && (
                <DeductionForm
                  key={deductionForm.initial?.id ?? "new"}
                  initial={deductionForm.initial}
                  data={data}
                  defaultJobId={jobId}
                  grossPay={summary.gross}
                  onCancel={() => setDeductionForm(null)}
                  onSave={(value) => {
                    onDeduction(value);
                    setDeductionForm(null);
                  }}
                />
              )}
              {!visibleDeductions.length && (
                <Text style={styles.cardMeta}>
                  No saved deductions for this scope. Add taxes, insurance,
                  retirement, or other deductions.
                </Text>
              )}
              {!visibleDeductions.length && !jobId && (
                <Action
                  title="Add Common Tax Defaults"
                  onPress={() =>
                    Alert.alert(
                      "Add example deductions?",
                      "These are the client app’s sample amounts. Edit them to match your own payslip; they are not calculated tax rates.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Add examples",
                          onPress: () =>
                            [
                              ["Federal Tax", 200],
                              ["State Tax", 75],
                              ["Social Security", 85],
                              ["Medicare", 20],
                            ].forEach(([label, amount], index) =>
                              onDeduction({
                                id: `example-${Date.now()}-${index}`,
                                label: String(label),
                                amount: Number(amount),
                                frequency: "per-pay-period",
                                enabled: true,
                                jobId: null,
                                notes:
                                  "Example amount — replace with your actual withholding.",
                              }),
                            ),
                        },
                      ],
                    )
                  }
                />
              )}
              {visibleDeductions.map((item) => (
                <View key={item.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{item.label}</Text>
                  <Text style={styles.cardMeta}>
                    {item.isPercentage
                      ? data.payVisible
                        ? `${item.amount}%`
                        : "•••%"
                      : fmt(item.amount)}{" "}
                    · {item.frequency} ·{" "}
                    {data.jobs.find((job) => job.id === item.jobId)?.name ??
                      "All jobs"}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {item.beforeTax ? "Pre-tax · " : ""}
                    {item.taxSetAside ? "Tax set-aside · " : ""}
                    {item.applicableFromDate ?? "Any start"} →{" "}
                    {item.applicableToDate ?? "Any end"}
                  </Text>
                  {item.consumedByPaycheckId && (
                    <Text style={[styles.cardMeta, { color: colors.warning }]}>
                      Applied to a received paycheck
                    </Text>
                  )}
                  {item.notes && (
                    <Text style={styles.cardMeta}>{item.notes}</Text>
                  )}
                  <Toggle
                    title="Enabled"
                    value={item.enabled}
                    onChange={(enabled) => onDeduction({ ...item, enabled })}
                  />
                  <Action
                    title="Edit deduction"
                    onPress={() => setDeductionForm({ initial: item })}
                  />
                  <Action
                    title="Delete deduction"
                    onPress={() =>
                      Alert.alert("Delete deduction?", item.label, [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () => onDeleteDeduction(item.id),
                        },
                      ])
                    }
                  />
                </View>
              ))}
            </>
          ) : (
            locked("Estimator, taxes & deductions")
          )}
        </PaySection>
        <Text style={[styles.cardMeta, { marginTop: 20 }]}>
          Estimate only. Recorded amounts, taxes, benefits and employer policies
          can change actual take-home pay. This app is not a payroll system.
        </Text>
        {data.isPremium && (
          <Action title="End Premium preview" onPress={onEndPreview} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
