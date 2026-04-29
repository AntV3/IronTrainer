import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, format, subDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { db } from '@/lib/db';
import { weekRangeDates } from '@/lib/feedback';
import { computeWeekSummary } from '@/lib/weeklySummary';
import { fmtDuration, sportColor, sportDot, sportLabel } from '@/lib/format';
import type { Sport } from '@/lib/types';

export default function WeekSummaryCard({ date }: { date: string }) {
  const summary = useLiveQuery(async () => {
    const weekDates = weekRangeDates(date);
    const prevWeekDates = weekRangeDates(format(subDays(new Date(date), 7), 'yyyy-MM-dd'));
    const since = format(subDays(new Date(date), 14), 'yyyy-MM-dd');
    const until = format(addDays(new Date(date), 7), 'yyyy-MM-dd');

    const [planned, logs, checkins, prevWeekCheckins] = await Promise.all([
      db.plannedSessions.where('date').between(since, until, true, true).toArray(),
      db.sessionLogs.where('date').between(since, until, true, true).toArray(),
      db.checkins.where('date').anyOf(weekDates).toArray(),
      db.checkins.where('date').anyOf(prevWeekDates).toArray(),
    ]);

    return computeWeekSummary({ date, planned, logs, checkins, prevWeekCheckins });
  }, [date]);

  if (!summary) return null;

  const completion =
    summary.sessions_planned > 0
      ? Math.round(
          ((summary.sessions_completed + summary.sessions_modified) /
            summary.sessions_planned) *
            100,
        )
      : 0;
  const deltaSign = summary.delta_pct >= 0 ? '+' : '−';
  const deltaPct = Math.round(Math.abs(summary.delta_pct * 100));

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <div className="label">This week</div>
          {summary.weekNumber && (
            <div className="font-mono text-xs text-bone-dim">Week {summary.weekNumber}</div>
          )}
        </div>
        <Link to="/week" className="label hover:text-bone">
          Detail →
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="Planned" value={fmtDuration(summary.planned_min)} />
        <Stat label="Done" value={fmtDuration(summary.actual_min)} />
        <Stat
          label="Delta"
          value={summary.planned_min ? `${deltaSign}${deltaPct}%` : '—'}
        />
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider2 text-bone-mute">
          <span>Sessions</span>
          <span className="text-bone-dim">
            {summary.sessions_completed + summary.sessions_modified}/{summary.sessions_planned} · {completion}%
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full bg-phase-taper transition-all"
            style={{ width: `${Math.min(100, completion)}%` }}
          />
        </div>
        <div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-bone-mute">
          <span className="text-signal-green">{summary.sessions_completed} done</span>
          <span className="text-signal-yellow">{summary.sessions_modified} mod</span>
          <span className="text-signal-red">{summary.sessions_skipped} skip</span>
        </div>
      </div>

      {summary.by_sport.length > 0 && (
        <div className="mt-4">
          <div className="label mb-2">By sport</div>
          <div className="space-y-2">
            {summary.by_sport.map((row) => (
              <SportRow key={row.sport} row={row} />
            ))}
          </div>
        </div>
      )}

      {(summary.avg_sleep != null || summary.avg_hrv != null) && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {summary.avg_sleep != null && (
            <Stat label="Avg sleep" value={`${summary.avg_sleep} h`} />
          )}
          {summary.avg_hrv != null && (
            <Stat
              label="Avg HRV"
              value={`${summary.avg_hrv}${
                summary.hrv_trend === 'up' ? ' ↑' : summary.hrv_trend === 'down' ? ' ↓' : ''
              }`}
            />
          )}
        </div>
      )}

      {summary.callout && (
        <div
          className={
            'mt-4 rounded-lg border px-3 py-2 text-sm ' +
            (summary.callout.tone === 'good'
              ? 'border-signal-green/40 bg-signal-green/10 text-signal-green'
              : summary.callout.tone === 'warn'
              ? 'border-signal-yellow/40 bg-signal-yellow/10 text-signal-yellow'
              : 'border-signal-red/40 bg-signal-red/10 text-signal-red')
          }
        >
          {summary.callout.message}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="display mt-1 text-2xl text-bone">{value}</div>
    </div>
  );
}

function SportRow({ row }: { row: { sport: Sport; planned_min: number; actual_min: number } }) {
  const denom = Math.max(row.planned_min, row.actual_min, 1);
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-[11px]">
        <span className="flex items-center gap-2">
          <span className={'h-1.5 w-1.5 rounded-full ' + sportDot[row.sport]} />
          <span className={sportColor[row.sport]}>{sportLabel[row.sport]}</span>
        </span>
        <span className="text-bone-dim">
          {fmtDuration(row.actual_min)} / {fmtDuration(row.planned_min)}
        </span>
      </div>
      <div className="mt-1 flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-white/5">
        <div
          className={'h-full ' + sportDot[row.sport]}
          style={{ width: `${Math.min(100, (row.actual_min / denom) * 100)}%` }}
        />
        <div
          className="h-full bg-white/15"
          style={{
            width: `${Math.max(0, ((row.planned_min - row.actual_min) / denom) * 100)}%`,
          }}
        />
      </div>
    </div>
  );
}
