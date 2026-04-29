import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { db, markSessionSkipped } from '@/lib/db';
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
import type { DailyCheckin, PlannedSession, SessionLog } from '@/lib/types';

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
  const todaysLogs = useLiveQuery(
    () => db.sessionLogs.where('date').equals(today).toArray(),
    [today],
  );
  const checkin = useLiveQuery(() => db.checkins.get(today), [today]);

  if (!profile) return null;

  const raceDate = parseISO(profile.race.date);
  const daysToRace = Math.max(0, differenceInCalendarDays(raceDate, startOfDay(new Date())));
  const phase = todays?.[0]?.phase ?? tomorrows?.[0]?.phase;
  const weekNumber = todays?.[0]?.week_number ?? tomorrows?.[0]?.week_number;

  const hasPlannedToday = (todays ?? []).some((s) => s.sport !== 'REST');

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 px-5 pb-20 pt-8">
      <RaceBanner race={profile.race} days={daysToRace} phase={phase} week={weekNumber} />

      <SectionHeader title="Today" subtitle={fmtDate(today, 'EEEE · MMM d')} />
      {todays && todays.length > 0 ? (
        <div className="space-y-3">
          {todays.map((s) => (
            <SessionCard
              key={s.id}
              s={s}
              log={todaysLogs?.find((l) => l.planned_session_id === s.id)}
              primary
            />
          ))}
        </div>
      ) : (
        <EmptyCard message="No planned session today. Active recovery — walk, mobility, sleep." />
      )}

      {hasPlannedToday && (
        <UnplannedLogs
          logs={(todaysLogs ?? []).filter(
            (l) => !todays?.some((s) => s.id === l.planned_session_id),
          )}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link
          to={`/log/${today}${
            todays?.find((s) => s.sport !== 'REST' && s.status === 'PLANNED')?.id
              ? `?planned=${todays.find((s) => s.sport !== 'REST' && s.status === 'PLANNED')!.id}`
              : ''
          }`}
          className="btn-primary"
        >
          Log workout
        </Link>
        <Link to="/checkin" className="btn-ghost">
          {checkin ? 'Update check-in' : 'Daily check-in'}
        </Link>
      </div>

      <CheckinSummary checkin={checkin} />

      <SectionHeader title="Tomorrow" subtitle={fmtDate(tomorrow, 'EEEE')} />
      {tomorrows && tomorrows.length > 0 ? (
        <div className="space-y-3">
          {tomorrows.map((s) => (
            <SessionCard key={s.id} s={s} compact />
          ))}
        </div>
      ) : (
        <EmptyCard message="Open." />
      )}
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

function StatusBadge({ status }: { status: PlannedSession['status'] }) {
  const map: Record<PlannedSession['status'], { cls: string; label: string }> = {
    PLANNED: { cls: 'border-white/10 text-bone-dim', label: 'Planned' },
    COMPLETED: { cls: 'border-signal-green/40 bg-signal-green/10 text-signal-green', label: 'Done' },
    MODIFIED: { cls: 'border-signal-yellow/40 bg-signal-yellow/10 text-signal-yellow', label: 'Modified' },
    SKIPPED: { cls: 'border-signal-red/40 bg-signal-red/10 text-signal-red', label: 'Skipped' },
  };
  const v = map[status];
  return (
    <span
      className={
        'rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider2 ' + v.cls
      }
    >
      {v.label}
    </span>
  );
}

function SessionCard({
  s,
  log,
  primary = false,
  compact = false,
}: {
  s: PlannedSession;
  log?: SessionLog;
  primary?: boolean;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div className={'card ' + (primary ? 'ring-1 ring-phase-taper/30' : '')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={'h-2 w-2 rounded-full ' + sportDot[s.sport]} />
          <span className={'display text-lg ' + sportColor[s.sport]}>
            {sportLabel[s.sport]}
          </span>
          <StatusBadge status={s.status} />
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

      {!compact && (
        <>
          <div className="divider my-3" />
          <p className="text-sm text-bone-dim">{s.description}</p>
        </>
      )}

      {log && (
        <div className="mt-3 rounded-lg border border-white/5 bg-ink-200 p-3">
          <div className="label mb-2">Logged</div>
          <div className="grid grid-cols-3 gap-2 font-mono text-xs text-bone">
            <Stat label="Duration" value={`${log.duration_min}m`} />
            <Stat label="RPE" value={`${log.rpe}/10`} />
            {log.distance != null && <Stat label="Distance" value={`${log.distance}`} />}
            {log.avg_hr != null && <Stat label="Avg HR" value={`${log.avg_hr}`} />}
            {log.avg_power != null && <Stat label="Avg W" value={`${log.avg_power}`} />}
            {log.avg_pace && <Stat label="Pace" value={log.avg_pace} />}
          </div>
          {log.notes && (
            <p className="mt-2 text-xs text-bone-dim">{log.notes}</p>
          )}
        </div>
      )}

      {!log && s.status === 'PLANNED' && s.sport !== 'REST' && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => navigate(`/log/${s.date}?planned=${s.id}`)}
            className="flex-1 rounded-lg border border-phase-taper/40 bg-phase-taper/10 py-2 font-mono text-[11px] uppercase tracking-wider2 text-phase-taper hover:bg-phase-taper/20"
          >
            Log it
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('Mark this session as skipped?')) {
                void markSessionSkipped(s.id);
              }
            }}
            className="flex-1 rounded-lg border border-white/10 py-2 font-mono text-[11px] uppercase tracking-wider2 text-bone-dim hover:border-white/30"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-0.5 text-bone">{value}</div>
    </div>
  );
}

function UnplannedLogs({ logs }: { logs: SessionLog[] }) {
  if (!logs.length) return null;
  return (
    <div className="card">
      <div className="label mb-2">Off-plan logs</div>
      <div className="space-y-2">
        {logs.map((l) => (
          <div key={l.id} className="flex items-center justify-between font-mono text-xs">
            <span className={sportColor[l.sport]}>{sportLabel[l.sport]}</span>
            <span className="text-bone">
              {l.duration_min}m · RPE {l.rpe}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckinSummary({ checkin }: { checkin?: DailyCheckin }) {
  if (!checkin) {
    return (
      <div className="card flex items-center justify-between">
        <div>
          <div className="label">Recovery</div>
          <div className="display mt-1 text-2xl text-signal-yellow">Pending check-in</div>
        </div>
        <div className="h-3 w-3 animate-pulse rounded-full bg-signal-yellow" />
      </div>
    );
  }
  const tone = recoveryTone(checkin);
  const toneColor =
    tone === 'green' ? 'text-signal-green' : tone === 'yellow' ? 'text-signal-yellow' : 'text-signal-red';
  const dot =
    tone === 'green' ? 'bg-signal-green' : tone === 'yellow' ? 'bg-signal-yellow' : 'bg-signal-red';
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <div className="label">Recovery</div>
          <div className={'display mt-1 text-2xl ' + toneColor}>
            {tone === 'green' ? 'Ready' : tone === 'yellow' ? 'Caution' : 'Recover'}
          </div>
        </div>
        <div className={'h-3 w-3 rounded-full ' + dot} />
      </div>
      <div className="divider my-3" />
      <div className="grid grid-cols-3 gap-2 font-mono text-xs text-bone">
        {checkin.sleep_hr != null && <Stat label="Sleep" value={`${checkin.sleep_hr}h`} />}
        {checkin.energy != null && <Stat label="Energy" value={`${checkin.energy}/10`} />}
        {checkin.soreness != null && <Stat label="Soreness" value={`${checkin.soreness}/10`} />}
        {checkin.hrv != null && <Stat label="HRV" value={`${checkin.hrv}`} />}
        {checkin.rhr != null && <Stat label="RHR" value={`${checkin.rhr}`} />}
        {checkin.weight_lb != null && <Stat label="Weight" value={`${checkin.weight_lb}`} />}
      </div>
    </div>
  );
}

function recoveryTone(c: DailyCheckin): 'green' | 'yellow' | 'red' {
  let score = 0;
  if (c.sleep_hr != null) {
    score += c.sleep_hr >= 7.5 ? 1 : c.sleep_hr >= 6.5 ? 0 : -1;
  }
  if (c.sleep_quality != null) {
    score += c.sleep_quality >= 4 ? 1 : c.sleep_quality <= 2 ? -1 : 0;
  }
  if (c.energy != null) {
    score += c.energy >= 7 ? 1 : c.energy <= 4 ? -1 : 0;
  }
  if (c.soreness != null) {
    score += c.soreness >= 7 ? -1 : c.soreness <= 3 ? 1 : 0;
  }
  if (score >= 2) return 'green';
  if (score <= -1) return 'red';
  return 'yellow';
}
