import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import type { AppState, MockPaycheck, PaySchedule } from "../../types";
import { Action, Choices } from "../../components/FormControls";
import { localDate, money, selectable } from "../history/model";
import { addDays, payPeriod } from "../history/payPeriods";
import { useThemeTokens } from "../../providers/ThemeProvider";
import { paycheckDraft, scheduleFor, type Bounds } from "./model";
import { ReceiptForm, ScheduleForm } from "./Forms";
import { PayModal } from "./PayModal";

export function Paychecks({
  data,
  busy,
  jobId,
  currency,
  bounds: selectedBounds,
  onRecord,
  onDelete,
  onMarkPaid,
  onSchedule,
}: {
  data: AppState;
  busy: boolean;
  jobId: string | null;
  currency: string;
  bounds: Bounds;
  onRecord: (
    record: MockPaycheck,
    markShifts: boolean,
  ) => Promise<string | null>;
  onDelete: (id: string) => void;
  onMarkPaid: (ids: string[]) => void;
  onSchedule: (
    scope: string,
    schedule: PaySchedule,
    applyToJob: boolean,
  ) => Promise<string | null>;
}) {
  const { styles } = useThemeTokens();
  const [receipt, setReceipt] = useState<{
    jobId: string;
    bounds: Bounds;
  } | null>(null);
  const [manualJob, setManualJob] = useState(jobId ?? data.jobs[0]?.id ?? "");
  useEffect(
    () => setManualJob(jobId ?? data.jobs[0]?.id ?? ""),
    [jobId, data.jobs],
  );
  const [setupJobId, setSetupJobId] = useState<string | null>(null);
  const scheduled = data.jobs.filter(
    (job) =>
      !job.archived &&
      (!jobId || job.id === jobId) &&
      (job.currency ?? data.preferences.currency) === currency &&
      job.payFrequency &&
      job.payPeriodStart,
  );
  const receipts = data.paychecks.filter(
    (record) =>
      record.paid &&
      (!jobId || record.jobId === jobId) &&
      (record.currency ??
        data.jobs.find((job) => job.id === record.jobId)?.currency ??
        data.preferences.currency) === currency &&
      record.startDate <= selectedBounds.end &&
      record.endDate >= selectedBounds.start,
  );
  const fmt = (value: number, code = currency) =>
    data.payVisible ? money(value, code) : "•••••";
  return (
    <View>
      <Text style={styles.cardMeta}>
        Scheduled cards show the current and previous periods for the selected
        job/currency. Received receipts below use the selected dates.
      </Text>
      {!scheduled.length && (
        <>
          <Text style={styles.cardMeta}>
            Set a pay schedule for a job to see current and overdue paychecks.
          </Text>
          {data.jobs
            .filter(
              (job) =>
                !job.archived &&
                (!jobId || job.id === jobId) &&
                (job.currency ?? data.preferences.currency) === currency,
            )
            .map((job) => (
              <Action
                key={job.id}
                title={`Set up ${job.name}`}
                onPress={() => setSetupJobId(job.id)}
              />
            ))}
        </>
      )}
      {setupJobId && (
        <PayModal
          title="Job pay schedule"
          busy={busy}
          onClose={() => setSetupJobId(null)}
        >
          <ScheduleForm
            key={setupJobId}
            initial={
              data.paySchedules[setupJobId] ??
              scheduleFor("biweekly", localDate())
            }
            jobId={setupJobId}
            onSave={async (schedule, apply) => {
              const error = await onSchedule(setupJobId, schedule, apply);
              if (!error) setSetupJobId(null);
              return error;
            }}
          />
        </PayModal>
      )}
      {scheduled.flatMap((job) => {
        const current = payPeriod(localDate(), job)!;
        const previous = payPeriod(addDays(current.start, -1), job)!;
        return [previous, current].map((bounds, index) => {
          const received = data.paychecks.find(
            (record) =>
              record.jobId === job.id &&
              (record.currency ?? job.currency ?? data.preferences.currency) ===
                currency &&
              record.startDate === bounds.start &&
              record.endDate === bounds.end &&
              record.paid,
          );
          if (index === 0 && received) return null;
          const calculated = paycheckDraft(data, job.id, bounds);
          const unpaid = calculated.entries.filter((entry) =>
            selectable(entry, data.paychecks, data.jobs),
          );
          const expected = addDays(bounds.end, job.payDelayDays ?? 7);
          return (
            <View key={`${job.id}-${bounds.start}`} style={styles.card}>
              <Text style={styles.cardTitle}>
                {job.name} ·{" "}
                {received
                  ? "Received"
                  : index === 0
                    ? "Previous period"
                    : "In progress"}
              </Text>
              <Text style={styles.cardMeta}>
                {bounds.start} → {bounds.end}
              </Text>
              <Text style={styles.cardMeta}>
                {!received && expected < localDate() ? "Overdue · " : ""}
                Expected pay date: {expected}
              </Text>
              <Text style={styles.cardMeta}>
                {calculated.entries.length} shifts ·{" "}
                {calculated.hours.toFixed(1)}h · {unpaid.length} unpaid
              </Text>
              <Text style={styles.cardMeta}>
                {received ? "Gross" : "Est. gross"}:{" "}
                {fmt(received?.grossPay ?? calculated.gross, job.currency)}
              </Text>
              <Text style={styles.cardMeta}>
                Deductions:{" "}
                {fmt(
                  received?.totalDeductions ?? calculated.deductions,
                  job.currency,
                )}
              </Text>
              <Text style={styles.cardTitle}>
                Net:{" "}
                {fmt(
                  received?.netPay ??
                    Math.max(0, calculated.gross - calculated.deductions),
                  job.currency,
                )}
              </Text>
              {!received && (
                <>
                  <Text style={styles.cardMeta}>
                    {calculated.estimate.label}
                  </Text>
                  <Action
                    title="Mark paycheck received"
                    disabled={busy}
                    onPress={() => setReceipt({ jobId: job.id, bounds })}
                  />
                  <Action
                    title="Quick mark unpaid shifts as paid"
                    disabled={busy || !unpaid.length}
                    onPress={() =>
                      Alert.alert(
                        "Mark these shifts paid?",
                        "This updates payment status without creating a received paycheck.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Mark paid",
                            onPress: () =>
                              onMarkPaid(unpaid.map((entry) => entry.id)),
                          },
                        ],
                      )
                    }
                  />
                </>
              )}
            </View>
          );
        });
      })}
      {!jobId && (
        <Choices
          options={data.jobs.map((job) => ({ value: job.id, label: job.name }))}
          value={manualJob}
          onChange={setManualJob}
        />
      )}
      <Action
        title="Record a received paycheck"
        disabled={busy || !manualJob}
        onPress={() => {
          setReceipt({
            jobId: manualJob,
            bounds: selectedBounds,
          });
        }}
      />
      {receipt && (
        <PayModal
          title="Received paycheck"
          busy={busy}
          onClose={() => setReceipt(null)}
        >
          <ReceiptForm
            key={`${receipt.jobId}-${receipt.bounds.start}`}
            data={data}
            jobId={receipt.jobId}
            currency={currency}
            initialBounds={receipt.bounds}
            onSave={async (record, markShifts) => {
              const error = await onRecord(record, markShifts);
              if (!error) setReceipt(null);
              return error;
            }}
          />
        </PayModal>
      )}
      <Text style={[styles.cardTitle, { marginTop: 20 }]}>
        Received Paychecks
      </Text>
      {!receipts.length && (
        <Text style={styles.cardMeta}>
          No received paychecks match these dates, job and currency.
        </Text>
      )}
      {[...receipts]
        .sort((a, b) => (b.payDate ?? "").localeCompare(a.payDate ?? ""))
        .map((record) => (
          <View key={record.id} style={styles.card}>
            <Text style={styles.cardTitle}>
              {data.jobs.find((job) => job.id === record.jobId)?.name ?? "Job"}
            </Text>
            <Text style={styles.cardMeta}>
              {record.startDate} → {record.endDate} · Received{" "}
              {record.payDate ?? "—"}
            </Text>
            <Text style={styles.cardMeta}>
              Gross {fmt(record.grossPay ?? 0, record.currency)} · Deductions{" "}
              {fmt(record.totalDeductions ?? 0, record.currency)}
            </Text>
            <Text style={styles.cardTitle}>
              Net {fmt(record.netPay ?? 0, record.currency)}
            </Text>
            {record.notes && (
              <Text style={styles.cardMeta}>{record.notes}</Text>
            )}
            <Action
              title="Undo received paycheck"
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  "Undo paycheck?",
                  "This removes the receipt, releases its one-time deductions, and restores unpaid status only for shifts marked by this receipt.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Undo",
                      style: "destructive",
                      onPress: () => onDelete(record.id),
                    },
                  ],
                )
              }
            />
          </View>
        ))}
    </View>
  );
}
