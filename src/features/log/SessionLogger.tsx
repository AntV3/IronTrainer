import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { db, logSession } from '@/lib/db';
import { intensityLabel, sportColor, sportDot, sportLabel } from '@/lib/format';
import type { Sport } from '@/lib/types';

const SPORTS: Sport[] = ['SWIM', 'BIKE', 'RUN', 'BRICK', 'STRENGTH', 'CROSS'];

function uid() {
  return `l_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export default function SessionLogger() {
  const navigate = useNavigate();
  const { date: dateParam } = useParams<{ date?: string }>();
  const [search] = useSearchParams();
  const plannedId = search.get('planned') ?? undefined;
  const date = dateParam ?? format(new Date(), 'yyyy-MM-dd');

  const planned = useLiveQuery(
    async () => (plannedId ? await db.plannedSessions.get(plannedId) : undefined),
    [plannedId],
  );

  const [sport, setSport] = useState<Sport>('RUN');
  const [duration, setDuration] = useState<number>(45);
  const [rpe, setRpe] = useState<number>(6);
  const [showOptional, setShowOptional] = useState(false);
  const [distance, setDistance] = useState('');
  const [avgHr, setAvgHr] = useState('');
  const [maxHr, setMaxHr] = useState('');
  const [avgPower, setAvgPower] = useState('');
  const [avgPace, setAvgPace] = useState('');
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (planned) {
      if (planned.sport !== 'REST') setSport(planned.sport);
      if (planned.duration_min > 0) setDuration(planned.duration_min);
    }
  }, [planned]);

  const matchHint = useMemo(() => {
    if (!planned || planned.sport === 'REST' || planned.duration_min === 0) return null;
    const ratio = duration / planned.duration_min;
    const sameSport = planned.sport === sport;
    if (sameSport && ratio >= 0.8 && ratio <= 1.2) {
      return { tone: 'good', text: 'Matches the plan — will be marked Completed.' };
    }
    return { tone: 'warn', text: 'Differs from the plan — will be marked Modified.' };
  }, [planned, duration, sport]);

  const onSave = async () => {
    setSaving(true);
    try {
      await logSession({
        id: uid(),
        planned_session_id: plannedId,
        date,
        sport,
        duration_min: duration,
        rpe,
        distance: distance ? parseFloat(distance) : undefined,
        avg_hr: avgHr ? parseInt(avgHr, 10) : undefined,
        max_hr: maxHr ? parseInt(maxHr, 10) : undefined,
        avg_power: avgPower ? parseInt(avgPower, 10) : undefined,
        avg_pace: avgPace || undefined,
        calories: calories ? parseInt(calories, 10) : undefined,
        notes: notes || undefined,
        logged_at: new Date().toISOString(),
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
        <span className="label">{format(new Date(date), 'EEE MMM d')}</span>
      </div>

      <h1 className="display mt-4 text-4xl text-bone">Log workout</h1>
      {planned && planned.sport !== 'REST' && (
        <div className="mt-2 text-sm text-bone-dim">
          Plan: {sportLabel[planned.sport]} · {planned.duration_min} min · {intensityLabel[planned.intensity]}
        </div>
      )}

      <div className="mt-6 space-y-5">
        <div>
          <span className="label">Sport</span>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {SPORTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSport(s)}
                className={
                  'flex items-center justify-center gap-2 rounded-lg border px-3 py-3 font-mono text-[11px] uppercase tracking-wider2 transition ' +
                  (sport === s
                    ? 'border-phase-taper/60 bg-phase-taper/10 ' + sportColor[s]
                    : 'border-white/10 text-bone-dim hover:border-white/30')
                }
              >
                <span className={'h-2 w-2 rounded-full ' + sportDot[s]} />
                {sportLabel[s]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <span className="label">Duration</span>
            <span className="font-mono text-sm text-bone">{duration} min</span>
          </div>
          <input
            type="range"
            min={5}
            max={420}
            step={5}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-phase-taper"
          />
          <div className="mt-2 grid grid-cols-5 gap-1">
            {[15, 30, 45, 60, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className="rounded-md border border-white/10 py-2 font-mono text-[11px] uppercase tracking-wider2 text-bone-dim hover:border-white/30 hover:text-bone"
              >
                {d}m
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <span className="label">Effort · RPE</span>
            <span className="font-mono text-sm text-bone">{rpe} / 10</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={rpe}
            onChange={(e) => setRpe(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-phase-taper"
          />
          <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-wider2 text-bone-mute">
            <span>recovery</span>
            <span>endurance</span>
            <span>threshold</span>
            <span>max</span>
          </div>
        </div>

        {matchHint && (
          <div
            className={
              'rounded-lg border px-3 py-2 font-mono text-[11px] uppercase tracking-wider2 ' +
              (matchHint.tone === 'good'
                ? 'border-signal-green/40 bg-signal-green/10 text-signal-green'
                : 'border-signal-yellow/40 bg-signal-yellow/10 text-signal-yellow')
            }
          >
            {matchHint.text}
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={() => setShowOptional((v) => !v)}
            className="label flex w-full items-center justify-between hover:text-bone"
          >
            <span>Details</span>
            <span>{showOptional ? '−' : '+'}</span>
          </button>
          {showOptional && (
            <div className="mt-3 space-y-3">
              <Row>
                <NumField label="Distance" value={distance} set={setDistance} placeholder="mi / km" />
                <NumField label="Calories" value={calories} set={setCalories} placeholder="kcal" />
              </Row>
              <Row>
                <NumField label="Avg HR" value={avgHr} set={setAvgHr} />
                <NumField label="Max HR" value={maxHr} set={setMaxHr} />
              </Row>
              <Row>
                <NumField label="Avg Power" value={avgPower} set={setAvgPower} placeholder="watts" />
                <TextField label="Avg Pace" value={avgPace} set={setAvgPace} placeholder="6:55" />
              </Row>
              <label className="block">
                <span className="label">Notes</span>
                <textarea
                  className="field mt-2 min-h-[80px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="How it went, fueling, conditions…"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 mt-6 pt-4">
        <button
          className="btn-primary w-full"
          onClick={onSave}
          disabled={saving || duration <= 0}
        >
          {saving ? 'Saving…' : 'Save workout'}
        </button>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
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

function TextField({
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
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
