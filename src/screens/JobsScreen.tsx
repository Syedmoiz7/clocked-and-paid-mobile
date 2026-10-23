import { useEffect, useRef, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppState, Deduction, MockJob } from "../types";
import { useThemeTokens } from "../providers/ThemeProvider";
import { Action, Toggle } from "../components/FormControls";
import { JobForm } from "../features/jobs/JobForm";
import { jobEditError, jobReferenced, newJob } from "../features/jobs/model";
import { DeductionForm } from "../features/pay/Forms";
import { money } from "../features/history/model";
import { entitlementsFor } from "../services/entitlements";

type Props = {
  data: AppState;
  onSave: (job: MockJob) => void;
  onDefault: (id: string) => void;
  onDelete: (id: string) => void;
  onDeduction: (deduction: Deduction) => void;
  onDeleteDeduction: (id: string) => void;
  onPremium: () => void;
};
export function JobsScreen({
  data,
  onSave,
  onDefault,
  onDelete,
  onDeduction,
  onDeleteDeduction,
  onPremium,
}: Props) {
  const { colors, styles } = useThemeTokens();
  const [editing, setEditing] = useState<MockJob | null>(null);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    if (editing)
      requestAnimationFrame(() =>
        scroll.current?.scrollTo({ y: 0, animated: true }),
      );
  }, [editing?.id]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deduction, setDeduction] = useState<{
    jobId: string;
    initial?: Deduction;
  } | null>(null);
  const [feedback, setFeedback] = useState("");
  const jobs = data.jobs.filter((job) => !job.archived);
  const entitlements = entitlementsFor(data);
  const limitReached = jobs.length >= entitlements.jobLimit;
  const busy = Boolean(data.activeShift);
  const save = (job: MockJob) => {
    const error = jobEditError(data, job);
    if (error) {
      Alert.alert("Cannot save job", error);
      return;
    }
    onSave(job);
    setEditing(null);
    setExpanded(job.id);
    setFeedback(
      "Job saved locally. Tracker defaults, History and Pay use this profile.",
    );
  };
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        ref={scroll}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.eyebrow}>WORK PROFILES</Text>
        <Text style={styles.title}>Jobs</Text>
        <Text style={styles.subtitle}>
          Manage your jobs, pay rates, schedules, reminders, and deductions.
        </Text>
        <Text style={styles.cardMeta}>
          Local mock data · no backend required
        </Text>
        {feedback !== "" && (
          <Text
            accessibilityRole="alert"
            style={{ color: colors.success, marginTop: 12 }}
          >
            {feedback}
          </Text>
        )}
        {!editing && (
          <Action
            title={limitReached ? "+ Add job · Premium" : "+ Add job"}
            onPress={() => {
              if (limitReached) {
                onPremium();
                return;
              }
              setEditing(
                newJob(`job-${Date.now()}`, data.defaultPlan.hourlyRate),
              );
              setFeedback("");
              setDeduction(null);
            }}
          />
        )}
        {editing && (
          <JobForm
            key={editing.id}
            initial={editing}
            busy={busy}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        )}
        {jobs.length === 0 && !editing && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Add your first job to start tracking
            </Text>
            <Text style={styles.cardMeta}>
              Set a name and hourly rate above. You can add more jobs later.
            </Text>
          </View>
        )}
        {jobs.map((job) => (
          <View
            key={job.id}
            style={[
              styles.card,
              {
                borderColor:
                  job.isDefault ||
                  (!jobs.some((item) => item.isDefault) &&
                    data.selectedJobId === job.id)
                    ? colors.warning
                    : colors.border,
              },
            ]}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: job.color,
                }}
              />
              <Text style={[styles.cardTitle, { flex: 1 }]}>{job.name}</Text>
            </View>
            <Text style={styles.cardMeta}>
              {[
                job.title,
                `${money(job.hourlyRate, job.currency ?? "USD")} / hr`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {(job.isDefault ||
              (!jobs.some((item) => item.isDefault) &&
                data.selectedJobId === job.id)) && (
              <Text
                style={{
                  color: colors.warning,
                  fontWeight: "700",
                  marginTop: 6,
                }}
              >
                ACTIVE / DEFAULT
              </Text>
            )}
            {job.id !==
              (jobs.find((item) => item.isDefault)?.id ??
                data.selectedJobId) && (
              <Action
                title="Set active"
                disabled={busy}
                onPress={() => {
                  onDefault(job.id);
                  setFeedback(`${job.name} is now the active job.`);
                }}
              />
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Action
                  title="Edit job"
                  onPress={() => {
                    setEditing(job);
                    setDeduction(null);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Action
                  title={expanded === job.id ? "Hide details ▴" : "Details ▾"}
                  onPress={() => {
                    setExpanded((value) => (value === job.id ? null : job.id));
                    setDeduction(null);
                  }}
                />
              </View>
            </View>
            {expanded === job.id && (
              <View>
                {job.notes ? (
                  <Text style={styles.cardMeta}>{job.notes}</Text>
                ) : null}
                {job.createdAt && (
                  <Text style={styles.cardMeta}>
                    Added {new Date(job.createdAt).toLocaleDateString()}
                  </Text>
                )}
                <Text style={styles.cardMeta}>
                  OT after{" "}
                  {job.overtimeThreshold ?? data.defaultPlan.overtimeThreshold}{" "}
                  hrs ·{" "}
                  {job.overtimeMultiplier ??
                    data.defaultPlan.overtimeMultiplier}
                  ×
                </Text>
                <Text style={styles.cardMeta}>
                  Lunch:{" "}
                  {(job.lunchEnabled ?? true)
                    ? `${job.lunchMinutes ?? 30} minutes`
                    : "Not included by default"}{" "}
                  · Tips: {job.enableTips ? "On" : "Off"}
                </Text>
                <Text style={styles.cardMeta}>
                  Pay schedule: {job.payFrequency ?? "Not set"}
                  {job.payPeriodStart
                    ? ` · anchored ${job.payPeriodStart}`
                    : ""}
                </Text>
                {job.nextPayDate && (
                  <Text style={styles.cardMeta}>
                    Next pay date: {job.nextPayDate}
                  </Text>
                )}
                <Text style={styles.cardMeta}>
                  Custom reminders:{" "}
                  {job.reminderSettings?.custom.filter((item) => item.enabled)
                    .length ?? 0}{" "}
                  enabled
                </Text>
                <Text style={[styles.cardTitle, { marginTop: 18 }]}>
                  Deductions for this Job
                </Text>
                {entitlements.deductionsManager ? (
                  <View>
                    {data.deductions
                      .filter((item) => item.jobId === job.id)
                      .map((item) => (
                        <View key={item.id} style={{ marginTop: 10 }}>
                          <Toggle
                            title={`${item.label} · ${item.amount}${item.isPercentage ? "%" : ` ${job.currency ?? "USD"}`} / ${item.frequency}`}
                            value={item.enabled}
                            onChange={(enabled) =>
                              onDeduction({ ...item, enabled })
                            }
                          />
                          <Action
                            title={`Edit ${item.label}`}
                            onPress={() =>
                              setDeduction({ jobId: job.id, initial: item })
                            }
                          />
                          <Action
                            title={`Delete ${item.label}`}
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
                    {deduction?.jobId === job.id ? (
                      <DeductionForm
                        key={deduction.initial?.id ?? "new"}
                        initial={deduction.initial}
                        defaultJobId={job.id}
                        data={{ ...data, jobs: [job] }}
                        onSave={(item) => {
                          onDeduction({ ...item, jobId: job.id });
                          setDeduction(null);
                        }}
                        onCancel={() => setDeduction(null)}
                      />
                    ) : (
                      <Action
                        title="+ Add job deduction"
                        onPress={() => setDeduction({ jobId: job.id })}
                      />
                    )}
                  </View>
                ) : (
                  <View>
                    <Text style={styles.cardMeta}>
                      Advanced deductions use the same Premium entitlement as
                      Pay.
                    </Text>
                    <Action
                      title="Preview Premium (no charge)"
                      onPress={onPremium}
                    />
                  </View>
                )}
              </View>
            )}
            <Action
              title="Delete job"
              onPress={() => {
                if (
                  data.activeShift?.jobId === job.id ||
                  data.extraShifts.some((item) => item.jobId === job.id)
                ) {
                  Alert.alert(
                    "Shift in progress",
                    "Clock out this job before deleting it.",
                  );
                  return;
                }
                const referenced = jobReferenced(data, job.id);
                Alert.alert(
                  "Delete job?",
                  referenced
                    ? "This job will be removed from Tracker choices. Its profile, shifts, deductions and received paychecks are retained for historical calculations."
                    : `Remove ${job.name}? This cannot be undone.`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => {
                        onDelete(job.id);
                        if (editing?.id === job.id) setEditing(null);
                        setFeedback(
                          "Job removed from active profiles. Existing records were not deleted.",
                        );
                      },
                    },
                  ],
                );
              }}
            />
          </View>
        ))}
        {data.jobs.some((item) => item.archived) && (
          <Text style={styles.cardMeta}>
            Removed job profiles remain available to historical records; they
            cannot start new shifts.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
