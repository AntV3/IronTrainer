import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { db, saveCheckin } from '@/lib/db';
import type { DailyCheckin as Checkin } from '@/lib/types';

const MOODS: { v: NonNullable<Checkin['mood']>; label: string }[] = [
  { v: 'great', label: 'Strong' },
  { v: 'good', label: 'Good' },
  { v: 'okay', label: 'Okay' },
  { v: 'low', label: 'Low' },
  { v: 'bad', label: 'Bad' },
];

export default function DailyCheckinScreen() {
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');
  const existing = useLiveQuery(() => db.checkins.get(today), [today]);

  const [sleepHr, setSleepHr] = useState(7.5);
  const [sleepQ, setSleepQ] = useState(3);
  const [hrv, setHrv] = useState('');
  const [rhr, setRhr] = useState('');
  const [weight, setWeight] = useState('');
  const [energy, setEnergy] = useState(6);
  const [soreness, setSoreness] = useState(3);
  const [mood, setMood] = useState<Checkin['mood']>('good');
  const [nutrition, setNutrition] = useState(3);
  const [hydration, setHydration] = useState(3);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      if (existing.sleep_hr != null) setSleepHr(existing.sleep_hr);
      if (existing.sleep_quality != null) setSleepQ(existing.sleep_quality);
      if (existing.hrv != null) setHrv(String(existing.hrv));
      if (existing.rhr != null) setRhr(String(existing.rhr));
      if (existing.weight_lb != null) setWeight(String(existing.weight_lb));
      if (existing.energy != null) setEnergy(existing.energy);
      if (existing.soreness != null) setSoreness(existing.soreness);
      if (existing.mood) setMood(existing.mood);
      if (existing.nutrition_adherence != null) setNutrition(existing.nutrition_adherence);
      if (existing.hydration != null) setHydration(existing.hydration);
      if (existing.notes) setNotes(existing.notes);
    }
  }, [existing]);

  const onSave = async () => {
    setSaving(true);
    try {
      await saveCheckin({
        date: today,
        sleep_hr: sleepHr,
        sleep_quality: sleepQ,
        hrv: hrv ? parseFloat(hrv) : undefined,
        rhr: rhr ? parseInt(rhr, 10) : undefined,
        weight_lb: weight ? parseFloat(weight) : undefined,
        energy,
        soreness,
        mood,
        nutrition_adherence: nutrition,
        hydration,
        notes: notes || undefined,
      });
      navigate('/today');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-6 pt-8">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="label hover:text-bone">
          Cancel
        </button>
        <span className="label">{format(new Date(), 'EEE MMM d')}</span>
      </div>

      <h1 className="display mt-4 text-4xl text-bone">Check-in</h1>
      <p className="mt-1 text-sm text-bone-dim">30 seconds. Skip what you don't track.</p>

      <div className="mt-6 space-y-6">
        <Slider
          label="Sleep last night"
          value={sleepHr}
          set={setSleepHr}
          min={0}
          max={12}
          step={0.25}
          unit="hr"
        />
        <Stars label="Sleep quality" value={sleepQ} set={setSleepQ} />
        <Row>
          <NumField label="HRV" value={hrv} set={setHrv} placeholder="ms" />
          <NumField label="Resting HR" value={rhr} set={setRhr} placeholder="bpm" />
        </Row>
        <NumField label="Morning weight (lb)" value={weight} set={setWeight} placeholder="170.5" />
        <Slider
          label="Energy today"
          value={energy}
          set={setEnergy}
          min={1}
          max={10}
          step={1}
          unit="/10"
        />
        <Slider
          label="Soreness"
          value={soreness}
          set={setSoreness}
          min={1}
          max={10}
          step={1}
          unit="/10"
        />

        <div>
          <span className="label">Mood</span>
          <div className="mt-2 grid grid-cols-5 gap-1">
            {MOODS.map((m) => (
              <button
                key={m.v}
                type="button"
                onClick={() => setMood(m.v)}
                className={
                  'rounded-md border px-2 py-3 font-mono text-[11px] uppercase tracking-wider2 transition ' +
                  (mood === m.v
                    ? 'border-phase-taper/60 bg-phase-taper/10 text-phase-taper'
                    : 'border-white/10 text-bone-dim hover:border-white/30')
                }
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <Stars label="Nutrition adherence" value={nutrition} set={setNutrition} />
        <Stars label="Hydration" value={hydration} set={setHydration} />

        <label className="block">
          <span className="label">Notes</span>
          <textarea
            className="field mt-2 min-h-[80px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything worth remembering tomorrow."
          />
        </label>
      </div>

      <div className="sticky bottom-0 mt-6 pt-4">
        <button className="btn-primary w-full" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : existing ? 'Update check-in' : 'Save check-in'}
        </button>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Slider({
  label,
  value,
  set,
  min,
  max,
  step,
  unit,
}: {
  label: string;
  value: number;
  set: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="font-mono text-sm text-bone">
          {Number.isInteger(step) ? value : value.toFixed(2).replace(/\.?0+$/, '')}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(parseFloat(e.target.value))}
        className="mt-2 w-full accent-phase-taper"
      />
    </div>
  );
}

function Stars({
  label,
  value,
  set,
}: {
  label: string;
  value: number;
  set: (v: number) => void;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="mt-2 grid grid-cols-5 gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => set(n)}
            className={
              'rounded-md border py-3 font-mono text-sm transition ' +
              (value >= n
                ? 'border-phase-taper/60 bg-phase-taper/15 text-phase-taper'
                : 'border-white/10 text-bone-mute hover:border-white/30')
            }
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  set,
  placeholder,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className="field mt-2"
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
