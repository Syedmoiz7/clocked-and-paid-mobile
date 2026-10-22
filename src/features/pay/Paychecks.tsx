import { useState } from "react";
import { Alert, Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppState, MockPaycheck, PaySchedule } from "../../types";
import { Action, Choices } from "../../components/FormControls";
import { localDate, money, selectable } from "../history/model";
import { addDays, payPeriod } from "../history/payPeriods";
import { styles } from "../../theme";
import { paycheckDraft, scheduleFor, type Bounds } from "./model";
import { ReceiptForm, ScheduleForm } from "./Forms";

export function Paychecks({
  data,
  onRecord,
  onDelete,
  onMarkPaid,
  onSchedule,
}: {
  data: AppState;
  onRecord: (record: MockPaycheck, markShifts: boolean) => string | null;
  onDelete: (id: string) => void;
  onMarkPaid: (ids: string[]) => void;
  onSchedule: (
    scope: string,
    schedule: PaySchedule,
    applyToJob: boolean,
  ) => void;
}) {
  const [receipt, setReceipt] = useState<{
    jobId: string;
    bounds: Bounds;
  } | null>(null);
  const [manualJob, setManualJob] = useState(data.jobs[0]?.id ?? "");
  const [setupJobId, setSetupJobId] = useState<string | null>(null);
  const scheduled = data.jobs.filter(
    (job) => job.payFrequency && job.payPeriodStart,
  );
  const fmt = (value: number, currency = "USD") =>
    data.payVisible ? money(value, currency) : "•••••";
  return (
    <View>
      {!scheduled.length && (
        <>
          <Text style={styles.cardMeta}>
            Set a pay schedule for a job to see current and overdue paychecks.
          </Text>
          {data.jobs.map((job) => (
            <Action
              key={job.id}
              title={`Set up ${job.name}`}
              onPress={() => setSetupJobId(job.id)}
            />
          ))}
        </>
      )}
      {setupJobId && (
        <ScheduleForm
          key={setupJobId}
          initial={
            data.paySchedules[setupJobId] ??
            scheduleFor("biweekly", localDate())
          }
          jobId={setupJobId}
          onSave={(schedule, apply) => {
            onSchedule(setupJobId, schedule, apply);
            setSetupJobId(null);
          }}
          onCancel={() => setSetupJobId(null)}
        />
      )}
      {scheduled.flatMap((job) => {
        const current = payPeriod(localDate(), job)!;
        const previous = payPeriod(addDays(current.start, -1), job)!;
        return [previous, current].map((bounds, index) => {
          const received = data.paychecks.find(
            (record) =>
              record.jobId === job.id &&
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
                    onPress={() => setReceipt({ jobId: job.id, bounds })}
                  />
                  <Action
                    title="Quick mark unpaid shifts as paid"
                    disabled={!unpaid.length}
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
      <Choices
        options={data.jobs.map((job) => ({ value: job.id, label: job.name }))}
        value={manualJob}
        onChange={setManualJob}
      />
      <Action
        title="Record a received paycheck"
        disabled={!manualJob}
        onPress={() => {
          const job = data.jobs.find((job) => job.id === manualJob);
          const bounds = job ? payPeriod(localDate(), job) : null;
          setReceipt({
            jobId: manualJob,
            bounds: bounds ?? {
              start: `${localDate().slice(0, 7)}-01`,
              end: localDate(),
            },
          });
        }}
      />
      <Modal
        visible={Boolean(receipt)}
        animationType="slide"
        onRequestClose={() => setReceipt(null)}
      >
        <SafeAreaView style={styles.screen}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            {receipt && (
              <ReceiptForm
                key={`${receipt.jobId}-${receipt.bounds.start}`}
                data={data}
                jobId={receipt.jobId}
                initialBounds={receipt.bounds}
                onCancel={() => setReceipt(null)}
                onSave={(record, markShifts) => {
                  const error = onRecord(record, markShifts);
                  if (!error) setReceipt(null);
                  return error;
                }}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Text style={[styles.cardTitle, { marginTop: 20 }]}>
        Received Paychecks
      </Text>
      {!data.paychecks.length && (
        <Text style={styles.cardMeta}>No received paychecks recorded yet.</Text>
      )}
      {[...data.paychecks]
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
