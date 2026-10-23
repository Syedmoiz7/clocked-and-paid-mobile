import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { Action, Choices, Field } from "../components/FormControls";
import {
  AuthLayout,
  FlowMessage,
  PrimaryAction,
} from "../features/auth/Controls";
import {
  canReuseStarter,
  type OnboardingJobDraft,
} from "../features/auth/model";
import { currencies } from "../features/jobs/model";
import { money } from "../features/history/model";
import { entitlementsFor } from "../services/entitlements";
import type { AppState } from "../types";
import { useThemeTokens } from "../providers/ThemeProvider";

export type OnboardingActions = {
  onName: (name: string) => void;
  onBack: () => void;
  onSaveJob: (draft: OnboardingJobDraft) => string | null;
  onAnother: () => void;
  onFinish: (name: string) => void;
  onPremium: () => void;
};
export function OnboardingScreen({
  data,
  actions,
  review,
}: {
  data: AppState;
  actions: OnboardingActions;
  review: boolean;
}) {
  const { colors, styles } = useThemeTokens();
  const step = data.auth.onboarding.step;
  const [name, setName] = useState(data.account.name),
    [draft, setDraft] = useState<OnboardingJobDraft>({
      name: "",
      title: "",
      rate: "",
      currency: data.preferences.currency,
    });
  const [error, setError] = useState("");
  const saving = useRef(false);
  const existing = data.jobs.filter((job) => !job.archived),
    reusable = canReuseStarter(data);
  const limited =
    !reusable && existing.length >= entitlementsFor(data).jobLimit;
  const saved = data.jobs.find(
    (job) => job.id === data.auth.onboarding.lastSavedJobId,
  );
  const update = (changes: Partial<OnboardingJobDraft>) => {
    setDraft((value) => ({ ...value, ...changes }));
    setError("");
  };
  return (
    <AuthLayout>
      <Text style={styles.eyebrow}>
        {review ? "Review setup" : "Welcome"} · Step {step} of 2
      </Text>
      <View
        style={{
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          marginVertical: 14,
        }}
      >
        <View
          style={{
            width: step === 1 ? "50%" : "100%",
            height: 4,
            backgroundColor: colors.accent,
          }}
        />
      </View>
      {step === 1 ? (
        <>
          <Text style={styles.title}>What should we call you?</Text>
          <Text style={styles.subtitle}>
            Just your name to personalise the app.
          </Text>
          <Field
            label="Your name"
            value={name}
            onChange={(value) => {
              setName(value);
              setError("");
            }}
          />
          <PrimaryAction
            title="Next — set up your first job"
            disabled={!name.trim()}
            onPress={() => actions.onName(name)}
          />
          <Action
            title="Skip for now — go straight to the app"
            onPress={() => actions.onFinish(name)}
          />
        </>
      ) : (
        <>
          <Text style={styles.title}>
            {saved
              ? "Your job is ready"
              : existing.length && !reusable
                ? "Your work profiles"
                : "Where do you work?"}
          </Text>
          <Text style={styles.subtitle}>
            Set your job, rate and currency. Existing work is kept; nothing is
            uploaded or merged with a server.
          </Text>
          {!reusable && existing.length > 0 && (
            <View style={[styles.card, { borderColor: colors.border }]}>
              <Text style={styles.cardTitle}>Existing jobs retained</Text>
              {existing.map((job) => (
                <Text key={job.id} style={styles.cardMeta}>
                  {job.name} ·{" "}
                  {money(
                    job.hourlyRate,
                    job.currency ?? data.preferences.currency,
                  )}{" "}
                  / hr
                </Text>
              ))}
              <Action
                title="Keep existing jobs & continue"
                onPress={() => actions.onFinish(name)}
              />
            </View>
          )}
          {saved ? (
            <>
              <FlowMessage message={`“${saved.name}” saved on this device.`} />
              <Action
                title={
                  limited ? "Add another job · Premium" : "+ Add another job"
                }
                onPress={() => {
                  if (limited) {
                    actions.onPremium();
                    return;
                  }
                  saving.current = false;
                  setDraft({
                    name: "",
                    title: "",
                    rate: "",
                    currency: data.preferences.currency,
                  });
                  actions.onAnother();
                }}
              />
              <PrimaryAction
                title="Continue to app"
                onPress={() => actions.onFinish(name)}
              />
            </>
          ) : limited ? (
            <>
              <Text style={styles.cardMeta}>
                Free already has its job profile. Keep it, or preview Premium to
                add more.
              </Text>
              <Action
                title="Preview Premium for more jobs"
                onPress={actions.onPremium}
              />
            </>
          ) : (
            <>
              {reusable && (
                <Text style={styles.cardMeta}>
                  Saving here replaces only the unused starter profile. It will
                  not create a second Free job.
                </Text>
              )}
              <Field
                label="Company / job name"
                value={draft.name}
                onChange={(name) => update({ name })}
              />
              <Field
                label="Role / title (optional)"
                value={draft.title}
                onChange={(title) => update({ title })}
              />
              <Field
                label="Base pay rate / hr (optional)"
                numeric
                value={draft.rate}
                onChange={(rate) => update({ rate })}
              />
              <Text style={styles.cardMeta}>
                Blank uses the saved global rate of{" "}
                {money(data.defaultPlan.hourlyRate, draft.currency)} / hr.
              </Text>
              <Choices
                value={draft.currency}
                options={currencies.map((value) => ({ value, label: value }))}
                onChange={(currency) => update({ currency })}
              />
              <FlowMessage message={error} error />
              <PrimaryAction
                title="Save this job"
                disabled={!draft.name.trim()}
                onPress={() => {
                  if (saving.current) return;
                  saving.current = true;
                  const error = actions.onSaveJob(draft);
                  if (error) {
                    setError(error);
                    saving.current = false;
                  }
                }}
              />
            </>
          )}
          <Action title="← Back" onPress={actions.onBack} />
          {!saved && (
            <Action
              title="Skip — go to app"
              onPress={() => actions.onFinish(name)}
            />
          )}
        </>
      )}
      <Text style={[styles.cardMeta, { marginTop: 18 }]}>
        You can update your profile in Settings and your jobs in Jobs.
      </Text>
    </AuthLayout>
  );
}
