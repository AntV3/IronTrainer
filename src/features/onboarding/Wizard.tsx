import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/lib/store';
import {
  EQUIPMENT_OPTIONS,
  draftToProfile,
  initialDraft,
  type OnboardingDraft,
} from './wizard-state';

interface StepProps {
  draft: OnboardingDraft;
  set: <K extends keyof OnboardingDraft>(k: K, v: OnboardingDraft[K]) => void;
}

interface StepDef {
  id: string;
  title: string;
  subtitle?: string;
  isValid: (d: OnboardingDraft) => boolean;
  render: (p: StepProps) => JSX.Element;
}

const steps: StepDef[] = [
  {
    id: 'welcome',
    title: 'Iron Trainer',
    subtitle: 'A 24-week journal that adapts when you do.',
    isValid: () => true,
    render: () => (
      <div className="space-y-4 text-bone-dim">
        <p>Logs are local to this device. No accounts. No cloud.</p>
        <p>This takes about 8 minutes. You can revise anything later.</p>
      </div>
    ),
  },
  {
    id: 'name',
    title: 'Who are you',
    isValid: (d) => d.name.trim().length > 0 && d.dob.length === 10,
    render: ({ draft, set }) => (
      <div className="space-y-4">
        <Field label="Name">
          <input
            className="field"
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Your name"
            autoFocus
          />
        </Field>
        <Field label="Date of birth">
          <input
            className="field"
            type="date"
            value={draft.dob}
            onChange={(e) => set('dob', e.target.value)}
          />
        </Field>
        <Field label="Sex">
          <Segmented
            value={draft.sex}
            onChange={(v) => set('sex', v as 'M' | 'F' | 'NB')}
            options={[
              { v: 'M', label: 'Male' },
              { v: 'F', label: 'Female' },
              { v: 'NB', label: 'Non-binary' },
            ]}
          />
        </Field>
      </div>
    ),
  },
  {
    id: 'body',
    title: 'Body baseline',
    isValid: (d) =>
      (d.units === 'imperial'
        ? !!d.weight_lb && !!d.height_in
        : !!d.weight_kg && !!d.height_cm),
    render: ({ draft, set }) => (
      <div className="space-y-4">
        <Field label="Units">
          <Segmented
            value={draft.units}
            onChange={(v) => set('units', v as 'metric' | 'imperial')}
            options={[
              { v: 'imperial', label: 'lb / in' },
              { v: 'metric', label: 'kg / cm' },
            ]}
          />
        </Field>
        {draft.units === 'imperial' ? (
          <>
            <Field label="Height (in)">
              <input
                className="field"
                type="number"
                inputMode="decimal"
                value={draft.height_in}
                onChange={(e) => set('height_in', e.target.value)}
                placeholder="70"
              />
            </Field>
            <Field label="Weight (lb)">
              <input
                className="field"
                type="number"
                inputMode="decimal"
                value={draft.weight_lb}
                onChange={(e) => set('weight_lb', e.target.value)}
                placeholder="170.0"
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Height (cm)">
              <input
                className="field"
                type="number"
                inputMode="decimal"
                value={draft.height_cm}
                onChange={(e) => set('height_cm', e.target.value)}
                placeholder="178"
              />
            </Field>
            <Field label="Weight (kg)">
              <input
                className="field"
                type="number"
                inputMode="decimal"
                value={draft.weight_kg}
                onChange={(e) => set('weight_kg', e.target.value)}
                placeholder="77.0"
              />
            </Field>
          </>
        )}
        <Field label="Body fat % (optional)">
          <input
            className="field"
            type="number"
            inputMode="decimal"
            value={draft.bf_pct}
            onChange={(e) => set('bf_pct', e.target.value)}
            placeholder="14"
          />
        </Field>
      </div>
    ),
  },
  {
    id: 'race',
    title: 'Target race',
    isValid: (d) => !!d.race_name && d.race_date.length === 10,
    render: ({ draft, set }) => (
      <div className="space-y-4">
        <Field label="Race name">
          <input
            className="field"
            value={draft.race_name}
            onChange={(e) => set('race_name', e.target.value)}
            placeholder="Ironman California 2026"
          />
        </Field>
        <Field label="Race date">
          <input
            className="field"
            type="date"
            value={draft.race_date}
            onChange={(e) => set('race_date', e.target.value)}
          />
        </Field>
        <Field label="Distance">
          <Segmented
            value={draft.race_distance}
            onChange={(v) =>
              set('race_distance', v as 'IM' | '70.3' | 'OLY' | 'SPRINT')
            }
            options={[
              { v: 'IM', label: 'Full IM' },
              { v: '70.3', label: '70.3' },
              { v: 'OLY', label: 'Oly' },
              { v: 'SPRINT', label: 'Sprint' },
            ]}
          />
        </Field>
        <Field label="Goal">
          <Segmented
            value={draft.goal_type}
            onChange={(v) => set('goal_type', v as 'finish' | 'time' | 'pr')}
            options={[
              { v: 'finish', label: 'Finish' },
              { v: 'time', label: 'Specific time' },
              { v: 'pr', label: 'PR' },
            ]}
          />
        </Field>
        {draft.goal_type !== 'finish' && (
          <Field label="Goal time (hh:mm)">
            <input
              className="field"
              value={draft.goal_time}
              onChange={(e) => set('goal_time', e.target.value)}
              placeholder="11:30"
            />
          </Field>
        )}
      </div>
    ),
  },
  {
    id: 'experience',
    title: 'Experience',
    isValid: (d) => !!d.years,
    render: ({ draft, set }) => (
      <div className="space-y-4">
        <Field label="Years of endurance training">
          <input
            className="field"
            type="number"
            inputMode="numeric"
            value={draft.years}
            onChange={(e) => set('years', e.target.value)}
            placeholder="3"
          />
        </Field>
        <Field label="First time at this distance?">
          <Segmented
            value={draft.first_at_distance}
            onChange={(v) => set('first_at_distance', v as 'yes' | 'no')}
            options={[
              { v: 'yes', label: 'Yes' },
              { v: 'no', label: 'No' },
            ]}
          />
        </Field>
        <Field label={`Current weekly training hours · ${draft.weekly_hours_baseline}`}>
          <input
            type="range"
            min={0}
            max={25}
            step={0.5}
            value={draft.weekly_hours_baseline}
            onChange={(e) => set('weekly_hours_baseline', parseFloat(e.target.value))}
            className="w-full accent-phase-taper"
          />
        </Field>
      </div>
    ),
  },
  {
    id: 'thresholds',
    title: 'Thresholds',
    subtitle: 'Optional — improves pacing targets.',
    isValid: () => true,
    render: ({ draft, set }) => (
      <div className="space-y-4">
        <Field label="Swim threshold pace (/100m)">
          <input
            className="field"
            value={draft.swim_pace}
            onChange={(e) => set('swim_pace', e.target.value)}
            placeholder="1:35"
          />
        </Field>
        <Field label="Bike FTP (watts)">
          <input
            className="field"
            type="number"
            inputMode="numeric"
            value={draft.bike_ftp}
            onChange={(e) => set('bike_ftp', e.target.value)}
            placeholder="240"
          />
        </Field>
        <Field label="Run threshold pace (/mi)">
          <input
            className="field"
            value={draft.run_pace}
            onChange={(e) => set('run_pace', e.target.value)}
            placeholder="6:55"
          />
        </Field>
      </div>
    ),
  },
  {
    id: 'constraints',
    title: 'Availability',
    isValid: () => true,
    render: ({ draft, set }) => (
      <div className="space-y-4">
        <Field label={`Days per week · ${draft.days_per_week}`}>
          <input
            type="range"
            min={1}
            max={7}
            step={1}
            value={draft.days_per_week}
            onChange={(e) => set('days_per_week', parseInt(e.target.value, 10))}
            className="w-full accent-phase-taper"
          />
        </Field>
        <Field label={`Max weekday session · ${draft.max_weekday_hr.toFixed(1)} hr`}>
          <input
            type="range"
            min={0.5}
            max={4}
            step={0.5}
            value={draft.max_weekday_hr}
            onChange={(e) => set('max_weekday_hr', parseFloat(e.target.value))}
            className="w-full accent-phase-taper"
          />
        </Field>
        <Field label={`Max weekend session · ${draft.max_weekend_hr.toFixed(1)} hr`}>
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={draft.max_weekend_hr}
            onChange={(e) => set('max_weekend_hr', parseFloat(e.target.value))}
            className="w-full accent-phase-taper"
          />
        </Field>
        <Field label="Equipment access">
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT_OPTIONS.map((opt) => {
              const active = draft.equipment.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() =>
                    set(
                      'equipment',
                      active
                        ? draft.equipment.filter((e) => e !== opt)
                        : [...draft.equipment, opt],
                    )
                  }
                  className={
                    'chip cursor-pointer transition ' +
                    (active
                      ? 'border-phase-taper/70 text-phase-taper bg-phase-taper/10'
                      : 'hover:border-white/30')
                  }
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Other sports (comma-separated)">
          <input
            className="field"
            value={draft.other_sports}
            onChange={(e) => set('other_sports', e.target.value)}
            placeholder="soccer, basketball"
          />
        </Field>
      </div>
    ),
  },
  {
    id: 'health',
    title: 'Health context',
    subtitle: 'Optional but helps the coach engine.',
    isValid: () => true,
    render: ({ draft, set }) => (
      <div className="space-y-4">
        <Field label="Conditions / injuries (comma-separated)">
          <input
            className="field"
            value={draft.conditions}
            onChange={(e) => set('conditions', e.target.value)}
            placeholder="left achilles, mild asthma"
          />
        </Field>
        <Field label="Supplement stack">
          <input
            className="field"
            value={draft.supplements}
            onChange={(e) => set('supplements', e.target.value)}
            placeholder="creatine, omega-3, vit D"
          />
        </Field>
        <Field label="Sleep average (hr/night)">
          <input
            className="field"
            type="number"
            inputMode="decimal"
            value={draft.sleep_avg}
            onChange={(e) => set('sleep_avg', e.target.value)}
            placeholder="7.5"
          />
        </Field>
        <Field label="Resting HR baseline">
          <input
            className="field"
            type="number"
            inputMode="numeric"
            value={draft.rhr_baseline}
            onChange={(e) => set('rhr_baseline', e.target.value)}
            placeholder="48"
          />
        </Field>
      </div>
    ),
  },
];

export default function Wizard() {
  const navigate = useNavigate();
  const saveProfileAndPlan = useApp((s) => s.saveProfileAndPlan);
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;
  const canAdvance = step.isValid(draft);

  const set = <K extends keyof OnboardingDraft>(k: K, v: OnboardingDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
  };

  const progress = useMemo(
    () => Math.round((stepIdx / (steps.length - 1)) * 100),
    [stepIdx],
  );

  const onNext = async () => {
    if (!canAdvance) return;
    if (!isLast) {
      setStepIdx((i) => i + 1);
      return;
    }
    setSaving(true);
    try {
      const profile = draftToProfile(draft);
      await saveProfileAndPlan(profile);
      navigate('/today', { replace: true });
    } finally {
      setSaving(false);
    }
  };

  const onBack = () => {
    if (stepIdx > 0) setStepIdx((i) => i - 1);
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-6 pt-10">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <span className="label">
            Step {stepIdx + 1} / {steps.length}
          </span>
          {stepIdx > 0 && (
            <button onClick={onBack} className="label hover:text-bone">
              Back
            </button>
          )}
        </div>
        <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full bg-phase-taper transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex-1">
        <h1 className="display text-4xl text-bone">{step.title}</h1>
        {step.subtitle && (
          <p className="mt-2 text-sm text-bone-dim">{step.subtitle}</p>
        )}
        <div className="mt-8">{step.render({ draft, set })}</div>
      </div>

      <div className="sticky bottom-0 mt-6 pt-4">
        <button
          className="btn-primary w-full"
          disabled={!canAdvance || saving}
          onClick={onNext}
        >
          {saving ? 'Generating plan…' : isLast ? 'Generate plan' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string }[];
}) {
  return (
    <div className="grid grid-flow-col auto-cols-fr gap-1 rounded-lg border border-white/10 bg-ink-200 p-1">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={
            'rounded-md px-3 py-2 font-mono text-[11px] uppercase tracking-wider2 transition ' +
            (value === o.v
              ? 'bg-phase-taper text-ink'
              : 'text-bone-dim hover:text-bone')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
