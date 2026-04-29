import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';
import { db } from '@/lib/db';
import { useApp } from '@/lib/store';
import {
  fmtDate,
  fmtDuration,
  intensityLabel,
  phaseBg,
  phaseColor,
  phaseLabel,
  sportColor,
  sportDot,
  sportLabel,
} from '@/lib/format';
import type { PlannedSession } from '@/lib/types';

export default function Today() {
  const profile = useApp((s) => s.profile);
  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const todays = useLiveQuery(
    () => db.plannedSessions.where('date').equals(today).toArray(),
    [today],
  );
  const tomorrows = useLiveQuery(
    () => db.plannedSessions.where('date').equals(tomorrow).toArray(),
    [tomorrow],
  );

  if (!profile) return null;

  const raceDate = parseISO(profile.race.date);
  const daysToRace = Math.max(0, differenceInCalendarDays(raceDate, startOfDay(new Date())));
  const phase = todays?.[0]?.phase ?? tomorrows?.[0]?.phase;
  const weekNumber = todays?.[0]?.week_number ?? tomorrows?.[0]?.week_number;

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 px-5 pb-20 pt-8">
      <RaceBanner
        race={profile.race}
        days={daysToRace}
        phase={phase}
        week={weekNumber}
      />

      <SectionHeader title="Today" subtitle={fmtDate(today, 'EEEE · MMM d')} />
      {todays && todays.length > 0 ? (
        <div className="space-y-3">
          {todays.map((s) => (
            <SessionCard key={s.id} s={s} primary />
          ))}
        </div>
      ) : (
        <EmptyCard message="No planned session today. Active recovery — walk, mobility, sleep." />
      )}

      <button className="btn-primary w-full" disabled>
        Log workout · coming next milestone
      </button>

      <SectionHeader title="Tomorrow" subtitle={fmtDate(tomorrow, 'EEEE')} />
      {tomorrows && tomorrows.length > 0 ? (
        <div className="space-y-3">
          {tomorrows.map((s) => (
            <SessionCard key={s.id} s={s} />
          ))}
        </div>
      ) : (
        <EmptyCard message="Open." />
      )}

      <SectionHeader title="Recovery" subtitle="Self-reported" />
      <div className="card flex items-center justify-between">
        <div>
          <div className="label">Status</div>
          <div className="display mt-1 text-2xl text-signal-yellow">Pending check-in</div>
        </div>
        <div className="h-3 w-3 animate-pulse rounded-full bg-signal-yellow" />
      </div>
    </div>
  );
}

function RaceBanner({
  race,
  days,
  phase,
  week,
}: {
  race: { name: string; date: string };
  days: number;
  phase?: PlannedSession['phase'];
  week?: number;
}) {
  return (
    <div
      className={
        'card relative overflow-hidden border ' +
        (phase ? phaseBg[phase] : 'border-white/10 bg-ink-100')
      }
    >
      <div className="label">{race.name.toUpperCase()}</div>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <div className="display text-7xl leading-none text-bone">{days}</div>
          <div className="label mt-1">days to race</div>
        </div>
        <div className="text-right">
          <div className="label">Phase</div>
          <div className={'display mt-1 text-2xl ' + (phase ? phaseColor[phase] : '')}>
            {phase ? phaseLabel[phase] : '—'}
          </div>
          <div className="label mt-2">Week</div>
          <div className="font-mono text-sm text-bone">{week ?? '—'}</div>
        </div>
      </div>
      <div className="label mt-4">Race day · {fmtDate(race.date, 'EEE MMM d, yyyy')}</div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline justify-between pt-2">
      <h2 className="display text-2xl text-bone">{title}</h2>
      {subtitle && <span className="label">{subtitle}</span>}
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="card text-bone-dim">
      <div className="label mb-1">Plan</div>
      <div>{message}</div>
    </div>
  );
}

function SessionCard({ s, primary = false }: { s: PlannedSession; primary?: boolean }) {
  return (
    <div className={'card ' + (primary ? 'ring-1 ring-phase-taper/30' : '')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={'h-2 w-2 rounded-full ' + sportDot[s.sport]} />
          <span className={'display text-lg ' + sportColor[s.sport]}>
            {sportLabel[s.sport]}
          </span>
        </div>
        <div className="font-mono text-xs uppercase tracking-wider2 text-bone-mute">
          {intensityLabel[s.intensity]}
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div className="stat">{fmtDuration(s.duration_min)}</div>
        {s.targets?.watts_low && s.targets.watts_high && (
          <div className="text-right">
            <div className="label">Watts</div>
            <div className="font-mono text-sm text-bone">
              {s.targets.watts_low}–{s.targets.watts_high}
            </div>
          </div>
        )}
        {s.targets?.pace && (
          <div className="text-right">
            <div className="label">Pace</div>
            <div className="font-mono text-sm text-bone">{s.targets.pace}</div>
          </div>
        )}
      </div>

      <div className="divider my-3" />
      <p className="text-sm text-bone-dim">{s.description}</p>
    </div>
  );
}
