import { entitlementsFor } from "../services/entitlements";
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
import { addDays } from "../features/history/payPeriods";
import { DeductionForm, ScheduleForm } from "../features/pay/Forms";
import { PayModal } from "../features/pay/PayModal";
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
  payViewSchedule,
  moveSchedule,
  deductionCurrencyMatches,
  currentPaySchedule,
  validBounds,
  type Bounds,
  type Range,
} from "../features/pay/model";
import { PaywallCard } from "../components/PaywallCard";

type Props = {
  data: AppState;
  busy: boolean;
  onPremium: () => void;
  onEndPreview: () => void;
  onPayVisible: (value: boolean) => void;
  onSchedule: (
    scope: string,
    schedule: PaySchedule,
    applyToJob: boolean,
  ) => Promise<string | null>;
  onDeduction: (deduction: Deduction) => Promise<string | null>;
  onDeductionMany: (deductions: Deduction[]) => Promise<string | null>;
  onDeleteDeduction: (id: string) => void;
  onReceipt: (
    record: MockPaycheck,
    markShifts: boolean,
  ) => Promise<string | null>;
  onUndoReceipt: (id: string) => void;
  onMarkPaid: (ids: string[]) => void;
};

export function PayScreen({
  data,
  busy,
  onPremium,
  onEndPreview,
  onPayVisible,
  onSchedule,
  onDeduction,
  onDeductionMany,
  onDeleteDeduction,
  onReceipt,
  onUndoReceipt,
  onMarkPaid,
}: Props) {
  const { colors, styles } = useThemeTokens();
  const premium = entitlementsFor(data).advancedPay;
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
  const [showCurrent, setShowCurrent] = useState(true);
  const [setupScope, setSetupScope] = useState<string | null>(null);
  const [deductionForm, setDeductionForm] = useState<{
    initial?: Deduction;
  } | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!premium) {
      setMode("payPeriod");
      setOffset(0);
    }
  }, [premium]);
  useEffect(() => {
    const timer = setInterval(
      () => setNow(Date.now()),
      data.activeShift || data.extraShifts.length ? 1000 : 30000,
    );
    return () => clearInterval(timer);
  }, [data.activeShift, data.extraShifts.length]);
  const jobId = scope || null;
  useEffect(() => {
    if (scope && !data.jobs.some((job) => job.id === scope)) {
      setScope("");
      setOffset(0);
      setShowCurrent(true);
      setCurrency(data.preferences.currency);
    }
  }, [scope, data.jobs, data.preferences.currency]);
  const code = currency;
  const availableCurrencies = [
    ...new Set([
      data.preferences.currency,
      ...(data.activeShift?.currency ? [data.activeShift.currency] : []),
      ...data.extraShifts.map(
        (entry) =>
          entry.currency ??
          data.jobs.find((job) => job.id === entry.jobId)?.currency ??
          data.preferences.currency,
      ),
      ...data.paychecks.map(
        (record) =>
          record.currency ??
          data.jobs.find((job) => job.id === record.jobId)?.currency ??
          data.preferences.currency,
      ),
      ...data.jobs.map((item) => item.currency ?? data.preferences.currency),
      ...data.history.map(
        (entry) =>
          entry.currency ??
          data.jobs.find((item) => item.id === entry.jobId)?.currency ??
          data.preferences.currency,
      ),
    ]),
  ].filter((value) => currencies.includes(value));
  let schedule = payViewSchedule(data, jobId, localDate(new Date(now)));
  if (schedule && (showCurrent || !premium))
    schedule = currentPaySchedule(schedule, localDate(new Date(now)));
  if (schedule)
    for (let i = 0; i < Math.abs(premium ? offset : 0); i++)
      schedule = moveSchedule(schedule, offset > 0 ? 1 : -1);
  const period = schedule
    ? { start: schedule.periodStart, end: schedule.periodEnd }
    : null;
  const bounds: Bounds =
    mode === "custom" && premium
      ? { start: customStart, end: customEnd }
      : mode === "preset" && premium
        ? rangeBounds(range, data.history)
        : (period ??
          rangeBounds("thisMonth", data.history, localDate(new Date(now))));
  const summary = financialSummary(data, bounds, jobId, code, now);
  const fmt = (value: number) =>
    data.payVisible ? money(value, code) : "•••••";
  const setupJob = data.jobs.find((job) => job.id === setupScope);
  const initialSchedule = setupScope
    ? (schedule ?? scheduleFor("biweekly", localDate()))
    : null;
  const visibleDeductions = data.deductions.filter(
    (item) =>
      (!jobId || !item.jobId || item.jobId === jobId) &&
      deductionCurrencyMatches(item, data, code),
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
    setShowCurrent(true);
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
          options={[
            { value: "", label: "All jobs" },
            ...data.jobs.map((job) => ({ value: job.id, label: job.name })),
          ]}
          value={scope}
          onChange={changeScope}
        />
        {availableCurrencies.length > 1 && (
          <>
            <Text style={styles.cardMeta}>Currency filter</Text>
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
            {premium ? "Financial Summary" : "Current Period Pay"}
          </Text>
          <Choices
            options={[
              { value: "payPeriod", label: "Pay period" },
              { value: "preset", label: "Presets" },
              { value: "custom", label: "Custom" },
            ]}
            value={mode}
            onChange={(value) => {
              if (!premium && value !== "payPeriod") onPremium();
              else setMode(value);
            }}
          />
          {mode === "preset" && premium && (
            <Choices
              options={ranges}
              value={range}
              onChange={(value) => setRange(value as Range)}
            />
          )}
          {mode === "custom" && premium && (
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
                        premium ? setOffset((value) => value - 1) : onPremium()
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Action
                      title="Next period →"
                      onPress={() =>
                        premium ? setOffset((value) => value + 1) : onPremium()
                      }
                    />
                  </View>
                </View>
              )}
              {!period && (
                <Text style={styles.cardMeta}>
                  No pay schedule for this scope. Showing this month until you
                  set one. All jobs uses its own summary schedule.
                </Text>
              )}
              {period && (
                <Action
                  title="Current period"
                  disabled={busy || (showCurrent && offset === 0)}
                  onPress={() => {
                    setOffset(0);
                    setShowCurrent(true);
                  }}
                />
              )}
              <Action
                title={period ? "Edit pay schedule" : "Set up pay schedule"}
                disabled={busy}
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
                <Metric
                  label="Tracked gross (paycheck tips included)"
                  value={fmt(summary.gross)}
                />
                <Metric label="Net pay" value={fmt(summary.net)} />
                <Metric label="Deductions" value={fmt(summary.deductions)} />
                <Metric
                  label="Tips paid separately"
                  value={fmt(summary.cashTips)}
                />
                <Metric
                  label="Tracked gross marked paid"
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
                  ? `Includes ${summary.confirmedCount} confirmed receipt(s); remaining work uses an estimate.`
                  : summary.estimate.label}
              </Text>
              <Text style={styles.cardMeta}>
                Take-home excludes tips paid separately. Receipt amounts can
                differ from tracked work; actual amounts appear under Received
                Paychecks.
                {summary.liveCount
                  ? ` Includes ${summary.liveCount} running shift(s).`
                  : ""}
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
          <PayModal
            title="Pay schedule"
            busy={busy}
            onClose={() => setSetupScope(null)}
          >
            <ScheduleForm
              key={setupScope}
              initial={initialSchedule}
              jobId={setupJob?.id ?? null}
              onSave={async (schedule, apply) => {
                const error = await onSchedule(setupScope, schedule, apply);
                if (!error) {
                  setSetupScope(null);
                  setOffset(0);
                  setShowCurrent(false);
                }
                return error;
              }}
            />
          </PayModal>
        )}

        <PaySection
          title="Upcoming Paychecks"
          subtitle="Overdue, in-progress & received pay periods"
        >
          {premium ? (
            <Paychecks
              data={data}
              busy={busy}
              jobId={jobId}
              currency={code}
              bounds={bounds}
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
          title="Progress · selected dates"
          subtitle="Completed work only · same dates as the summary"
        >
          <Progress data={data} bounds={bounds} jobId={jobId} currency={code} />
        </PaySection>
        <PaySection
          title="Trends"
          subtitle="Completed work only · earnings, hours & jobs for the selected dates"
        >
          {premium ? (
            <PayTrends
              data={data}
              bounds={bounds}
              jobId={jobId}
              currency={code}
            />
          ) : (
            locked("Earnings & hours trends")
          )}
        </PaySection>
        <PaySection
          title="Estimator & Deductions"
          subtitle={`${visibleDeductions.filter((item) => item.enabled).length} active deduction(s) in this scope`}
        >
          {premium ? (
            <>
              {validBounds(bounds) && (
                <Estimator
                  key={`${jobId ?? "all"}-${code}-${bounds.start}-${bounds.end}`}
                  data={data}
                  currency={code}
                  jobId={jobId}
                  bounds={bounds}
                />
              )}
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
                disabled={busy}
                onPress={() => setDeductionForm({})}
              />
              {deductionForm && (
                <PayModal
                  title={
                    deductionForm.initial ? "Edit deduction" : "Add deduction"
                  }
                  busy={busy}
                  onClose={() => setDeductionForm(null)}
                >
                  <DeductionForm
                    key={deductionForm.initial?.id ?? "new"}
                    initial={deductionForm.initial}
                    data={data}
                    defaultJobId={jobId}
                    referenceBounds={bounds}
                    onSave={async (value) => {
                      const error = await onDeduction(value);
                      if (!error) setDeductionForm(null);
                      return error;
                    }}
                  />
                </PayModal>
              )}
              {!visibleDeductions.length && (
                <Text style={styles.cardMeta}>
                  No saved deductions for this scope. Add taxes, insurance,
                  retirement, or other deductions.
                </Text>
              )}
              {!visibleDeductions.length &&
                !jobId &&
                code === data.preferences.currency && (
                  <Action
                    title="Add Common Tax Defaults"
                    disabled={busy}
                    onPress={() =>
                      Alert.alert(
                        "Add example deductions?",
                        "These are the client app’s sample amounts. Edit them to match your own payslip; they are not calculated tax rates.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Add examples",
                            onPress: () => {
                              void onDeductionMany(
                                [
                                  ["Federal Tax", 200],
                                  ["State Tax", 75],
                                  ["Social Security", 85],
                                  ["Medicare", 20],
                                ].map(([label, amount], index) => ({
                                  id: `example-${Date.now()}-${index}`,
                                  label: String(label),
                                  amount: Number(amount),
                                  frequency: "per-pay-period",
                                  enabled: true,
                                  jobId: null,
                                  notes:
                                    "Example amount — replace with your actual withholding.",
                                })),
                              ).then((error) => {
                                if (error)
                                  Alert.alert("Could not add examples", error);
                              });
                            },
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
                    onChange={(enabled) => {
                      if (!busy)
                        void onDeduction({ ...item, enabled }).then((error) => {
                          if (error)
                            Alert.alert("Could not update deduction", error);
                        });
                    }}
                  />
                  <Action
                    title="Edit deduction"
                    disabled={busy}
                    onPress={() => setDeductionForm({ initial: item })}
                  />
                  <Action
                    title="Delete deduction"
                    disabled={busy}
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
        {premium && (
          <Action
            title="End Premium preview"
            disabled={busy}
            onPress={onEndPreview}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
