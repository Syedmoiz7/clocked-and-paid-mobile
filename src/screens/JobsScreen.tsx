import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppState, Deduction, MockJob } from "../types";
import { useThemeTokens } from "../providers/ThemeProvider";
import { Action, Toggle } from "../components/FormControls";
import { JobForm } from "../features/jobs/JobForm";
import {
  jobBadges,
  jobInProgress,
  jobPayDelay,
  jobReferenced,
  newJobFromDefaults,
  nextJobPayDate,
  workInProgress,
} from "../features/jobs/model";
import { DeductionForm } from "../features/pay/Forms";
import { money } from "../features/history/model";
import { entitlementsFor } from "../services/entitlements";
import { FormModal } from "../components/FormModal";
import { PayVisibilityButton } from "../components/PayVisibilityButton";

type Props = {
  data: AppState;
  saving: boolean;
  onSave: (job: MockJob, existing: boolean) => Promise<string | null>;
  onDefault: (id: string) => Promise<string | null>;
  onSelect: (id: string) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
  onDeduction: (deduction: Deduction, jobId: string) => Promise<string | null>;
  onDeleteDeduction: (id: string, jobId: string) => Promise<string | null>;
  onPayVisibility: () => void;
  onPremium: () => void;
};
export function JobsScreen({
  data,
  saving,
  onSave,
  onDefault,
  onSelect,
  onDelete,
  onDeduction,
  onDeleteDeduction,
  onPremium,
  onPayVisibility,
}: Props) {
  const { colors, styles } = useThemeTokens();
  const [editing, setEditing] = useState<{
    job: MockJob;
    existing: boolean;
  } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deduction, setDeduction] = useState<{
    jobId: string;
    initial?: Deduction;
  } | null>(null);
  const [feedback, setFeedback] = useState("");
  const jobs = data.jobs.filter((job) => !job.archived);
  const entitlements = entitlementsFor(data);
  const limitReached = jobs.length >= entitlements.jobLimit;
  const busy = workInProgress(data);
  const report = (operation: Promise<string | null>, success?: string) => {
    void operation.then((error) => {
      if (error) Alert.alert("Jobs unchanged", error);
      else if (success) setFeedback(success);
    });
  };
  const save = async (job: MockJob) => {
    const error = await onSave(job, editing?.existing ?? false);
    if (error) return error;
    setEditing(null);
    setExpanded(job.id);
    setFeedback(
      "Job saved on this device. Existing work keeps its recorded pay rules.",
    );
    return null;
  };
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.eyebrow}>WORK PROFILES</Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Text style={[styles.title, { flexGrow: 1 }]}>Jobs</Text>
          <PayVisibilityButton
            visible={data.payVisible}
            onToggle={onPayVisibility}
          />
        </View>
        <Text style={styles.subtitle}>
          Manage your jobs, pay rates, schedules, reminders, and deductions.
        </Text>
        <Text style={styles.cardMeta}>
          Selected is the profile Tracker will use next. Default is your
          fallback profile.
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
            disabled={saving}
            onPress={() => {
              if (limitReached) {
                onPremium();
                return;
              }
              setEditing({
                job: newJobFromDefaults(
                  data,
                  `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                ),
                existing: false,
              });
              setFeedback("");
              setDeduction(null);
            }}
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
                `${data.payVisible ? money(job.hourlyRate, job.currency ?? data.preferences.currency) : "•••••"} / hr`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {jobBadges(data, job).length > 0 && (
              <Text
                style={{
                  color: colors.warning,
                  fontWeight: "700",
                  marginTop: 6,
                }}
              >
                {jobBadges(data, job).join(" · ")}
              </Text>
            )}
            {job.id !== data.selectedJobId && (
              <Action
                title="Use for Tracker"
                disabled={busy || saving}
                onPress={() => {
                  report(
                    onSelect(job.id),
                    `${job.name} is selected for Tracker. Its defaults are loaded.`,
                  );
                }}
              />
            )}
            {!job.isDefault && (
              <Action
                title="Make default & select"
                disabled={busy || saving}
                onPress={() =>
                  report(
                    onDefault(job.id),
                    `${job.name} is now the default and selected profile.`,
                  )
                }
              />
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Action
                  title="Edit job"
                  disabled={saving}
                  onPress={() => {
                    setEditing({ job, existing: true });
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
                {nextJobPayDate(job) && (
                  <Text style={styles.cardMeta}>
                    Next expected pay date: {nextJobPayDate(job)} ·{" "}
                    {jobPayDelay(job)} days after the period ends
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
                            title={`${item.label} · ${data.payVisible ? `${item.amount}${item.isPercentage ? "%" : ` ${job.currency ?? data.preferences.currency}`}` : "•••••"}${item.isPercentage ? " of matching gross" : ` / ${item.frequency}`}`}
                            value={item.enabled}
                            disabled={saving}
                            onChange={(enabled) =>
                              report(onDeduction({ ...item, enabled }, job.id))
                            }
                          />
                          <Action
                            title={`Edit ${item.label}`}
                            disabled={saving}
                            onPress={() =>
                              setDeduction({ jobId: job.id, initial: item })
                            }
                          />
                          <Action
                            title={`Delete ${item.label}`}
                            disabled={saving}
                            onPress={() =>
                              Alert.alert("Delete deduction?", item.label, [
                                { text: "Cancel", style: "cancel" },
                                {
                                  text: "Delete",
                                  style: "destructive",
                                  onPress: () =>
                                    report(onDeleteDeduction(item.id, job.id)),
                                },
                              ])
                            }
                          />
                        </View>
                      ))}
                    <Action
                      title="+ Add job deduction"
                      disabled={saving}
                      onPress={() => setDeduction({ jobId: job.id })}
                    />
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
              disabled={saving || jobInProgress(data, job.id)}
              onPress={() => {
                if (jobInProgress(data, job.id)) {
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
                      onPress: () =>
                        report(
                          onDelete(job.id),
                          "Job removed from active profiles. Existing work and payments are retained.",
                        ),
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
      {busy && (
        <Text
          style={[styles.cardMeta, { paddingHorizontal: 20, paddingBottom: 8 }]}
        >
          Finish or resolve running/recoverable shifts before switching
          profiles. You can still edit notes and reminders.
        </Text>
      )}
      {editing && (
        <FormModal
          title={editing.existing ? "Edit job" : "Add job"}
          busy={saving}
          onClose={() => setEditing(null)}
        >
          <JobForm
            key={editing.job.id}
            initial={editing.job}
            data={data}
            busy={saving}
            onSave={save}
          />
        </FormModal>
      )}
      {deduction && (
        <FormModal
          title="Job deduction"
          busy={saving}
          onClose={() => setDeduction(null)}
        >
          <DeductionForm
            key={deduction.initial?.id ?? deduction.jobId}
            initial={deduction.initial}
            defaultJobId={deduction.jobId}
            lockedJobId={deduction.jobId}
            data={data}
            onSave={async (item) => {
              const error = await onDeduction(item, deduction.jobId);
              if (!error) setDeduction(null);
              return error;
            }}
          />
        </FormModal>
      )}
    </SafeAreaView>
  );
}
