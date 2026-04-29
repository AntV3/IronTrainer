import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import type {
  DailyCheckin,
  PlannedSession,
  SessionLog,
  Sport,
} from './types';
import { weekStart } from './feedback';

export interface SportTotals {
  sport: Sport;
  planned_min: number;
  actual_min: number;
}

export interface WeekSummary {
  weekStart: string;
  weekNumber?: number;
  planned_min: number;
  actual_min: number;
  delta_pct: number;            // (actual - planned) / planned, >0 = over
  sessions_planned: number;
  sessions_completed: number;
  sessions_modified: number;
  sessions_skipped: number;
  by_sport: SportTotals[];
  avg_sleep?: number;
  avg_hrv?: number;
  avg_hrv_prev?: number;
  hrv_trend?: 'up' | 'down' | 'flat';
  callout?: { tone: 'good' | 'warn' | 'flag'; message: string };
}

export function computeWeekSummary(opts: {
  date: string;
  planned: PlannedSession[];
  logs: SessionLog[];
  checkins: DailyCheckin[];
  prevWeekCheckins?: DailyCheckin[];
}): WeekSummary {
  const start = weekStart(opts.date);
  const end = addDays(start, 6);
  const startIso = isoDate(start);
  const inWeek = (d: string) => {
    const dt = parseISO(d);
    return dt >= start && dt <= end;
  };

  const planned = opts.planned.filter((p) => inWeek(p.date));
  const logs = opts.logs.filter((l) => inWeek(l.date));
  const checkins = opts.checkins.filter((c) => inWeek(c.date));

  const planned_min = sum(planned.map((p) => p.duration_min));
  const actual_min = sum(logs.map((l) => l.duration_min));

  const sportSet = new Set<Sport>();
  planned.forEach((p) => p.sport !== 'REST' && sportSet.add(p.sport));
  logs.forEach((l) => sportSet.add(l.sport));
  const by_sport: SportTotals[] = [...sportSet].map((sport) => ({
    sport,
    planned_min: sum(planned.filter((p) => p.sport === sport).map((p) => p.duration_min)),
    actual_min: sum(logs.filter((l) => l.sport === sport).map((l) => l.duration_min)),
  }));

  const sessions_planned = planned.filter((p) => p.sport !== 'REST').length;
  const sessions_completed = planned.filter((p) => p.status === 'COMPLETED').length;
  const sessions_modified = planned.filter((p) => p.status === 'MODIFIED').length;
  const sessions_skipped = planned.filter((p) => p.status === 'SKIPPED').length;

  const sleeps = checkins.map((c) => c.sleep_hr).filter((n): n is number => n != null);
  const avg_sleep = sleeps.length ? round1(mean(sleeps)) : undefined;
  const hrvs = checkins.map((c) => c.hrv).filter((n): n is number => n != null);
  const avg_hrv = hrvs.length ? round1(mean(hrvs)) : undefined;
  const prevHrvs = (opts.prevWeekCheckins ?? [])
    .map((c) => c.hrv)
    .filter((n): n is number => n != null);
  const avg_hrv_prev = prevHrvs.length ? round1(mean(prevHrvs)) : undefined;
  const hrv_trend =
    avg_hrv != null && avg_hrv_prev != null
      ? avg_hrv - avg_hrv_prev > 1
        ? 'up'
        : avg_hrv_prev - avg_hrv > 1
        ? 'down'
        : 'flat'
      : undefined;

  const delta_pct = planned_min > 0 ? (actual_min - planned_min) / planned_min : 0;

  const weekNumber = planned[0]?.week_number;

  let callout: WeekSummary['callout'];
  if (planned_min > 0) {
    if (delta_pct >= 0.2) {
      callout = {
        tone: 'warn',
        message:
          "Pulled forward — you're +20% over planned hours. Consider an easy Monday.",
      };
    } else if (delta_pct <= -0.3) {
      callout = {
        tone: 'flag',
        message:
          "Behind plan by 30%+. Adjust the next two weeks rather than cramming the rest of this one.",
      };
    } else if (sessions_skipped >= 3) {
      callout = {
        tone: 'flag',
        message: `${sessions_skipped} skipped sessions this week — consolidate, don't cram.`,
      };
    } else if (sessions_completed >= sessions_planned * 0.8) {
      callout = {
        tone: 'good',
        message: 'On plan. Recovery is the rate-limiter — protect sleep.',
      };
    }
  }

  return {
    weekStart: startIso,
    weekNumber,
    planned_min,
    actual_min,
    delta_pct,
    sessions_planned,
    sessions_completed,
    sessions_modified,
    sessions_skipped,
    by_sport,
    avg_sleep,
    avg_hrv,
    avg_hrv_prev,
    hrv_trend,
    callout,
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}
function mean(arr: number[]): number {
  return sum(arr) / arr.length;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Whether to show the Sunday auto-summary banner (Sun = day 0). */
export function shouldShowSundayDigest(date: string): boolean {
  return parseISO(date).getDay() === 0;
}

/** Days since the user's plan started (for context). */
export function daysSince(startIso: string, todayIso: string): number {
  return Math.max(0, differenceInCalendarDays(parseISO(todayIso), parseISO(startIso)));
}
