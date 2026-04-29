import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import { db } from '@/lib/db';
import { weekRangeDates } from '@/lib/feedback';
import {
  fmtDuration,
  intensityLabel,
  phaseColor,
  phaseLabel,
  sportColor,
  sportDot,
  sportLabel,
} from '@/lib/format';
import WeekSummaryCard from './WeekSummaryCard';

export default function WeekDetail() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const weekDates = weekRangeDates(today);

  const planned = useLiveQuery(
    () => db.plannedSessions.where('date').anyOf(weekDates).sortBy('date'),
    [weekDates.join(',')],
  );
  const logs = useLiveQuery(
    () => db.sessionLogs.where('date').anyOf(weekDates).toArray(),
    [weekDates.join(',')],
  );

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 px-5 pb-20 pt-8">
      <div>
        <div className="label">Week of</div>
        <h1 className="display mt-1 text-3xl text-bone">
          {format(parseISO(weekDates[0]!), 'MMM d')} – {format(parseISO(weekDates[6]!), 'MMM d')}
        </h1>
      </div>

      <WeekSummaryCard date={today} />

      <div className="space-y-3">
        {weekDates.map((d) => {
          const days = (planned ?? []).filter((p) => p.date === d);
          const dayLogs = (logs ?? []).filter((l) => l.date === d);
          const isToday = d === today;
          return (
            <div
              key={d}
              className={
                'card ' + (isToday ? 'ring-1 ring-phase-taper/40' : '')
              }
            >
              <div className="flex items-center justify-between">
                <div className="font-display uppercase tracking-display text-bone">
                  {format(parseISO(d), 'EEE · MMM d')}
                </div>
                {days[0] && (
                  <span className={'label ' + phaseColor[days[0].phase]}>
                    {phaseLabel[days[0].phase]}
                  </span>
                )}
              </div>
              {days.length === 0 ? (
                <p className="mt-2 text-sm text-bone-dim">Open day.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {days.map((s) => {
                    const log = dayLogs.find((l) => l.planned_session_id === s.id);
                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className={'h-2 w-2 rounded-full ' + sportDot[s.sport]} />
                          <span className={'font-mono text-xs uppercase tracking-wider2 ' + sportColor[s.sport]}>
                            {sportLabel[s.sport]}
                          </span>
                          <span className="font-mono text-[11px] uppercase tracking-wider2 text-bone-mute">
                            {intensityLabel[s.intensity]}
                          </span>
                        </div>
                        <div className="text-right font-mono text-xs text-bone">
                          {fmtDuration(s.duration_min)}
                          {log && (
                            <span className="ml-2 text-bone-dim">
                              · logged {fmtDuration(log.duration_min)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
