import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfWeek,
} from 'date-fns';
import type {
  DailyCheckin,
  FeedbackEvent,
  FeedbackType,
  PlannedSession,
  SessionLog,
} from './types';

export interface FeedbackContext {
  today: string;                    // YYYY-MM-DD
  todayCheckin?: DailyCheckin;
  recentCheckins: DailyCheckin[];   // last 14 days, ascending by date
  recentLogs: SessionLog[];         // last 14 days, ascending by logged_at
  thisWeekPlanned: PlannedSession[];
  thisWeekLogs: SessionLog[];
  todaysSessions: PlannedSession[];
  tomorrowsSessions: PlannedSession[];
  raceDate: string;
  daysToRace: number;
}

/** Stable id keeps a same-day rule from duplicating. */
function idFor(type: FeedbackType, date: string, key = ''): string {
  return `${type.toLowerCase()}_${date}${key ? `_${key}` : ''}`;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sevenDayMean(values: { date: string; v: number | undefined }[], beforeDate: string): number | undefined {
  const cutoff = parseISO(beforeDate);
  const window = values
    .filter((x) => x.v != null)
    .filter((x) => {
      const days = differenceInCalendarDays(cutoff, parseISO(x.date));
      return days > 0 && days <= 7;
    })
    .map((x) => x.v as number);
  return window.length ? avg(window) : undefined;
}

interface Rule {
  evaluate: (ctx: FeedbackContext) => FeedbackEvent | null;
}

const ruleHrvDownPoorSleep: Rule = {
  evaluate: (ctx) => {
    const c = ctx.todayCheckin;
    if (!c || c.hrv == null) return null;
    const baseline = sevenDayMean(
      ctx.recentCheckins.map((x) => ({ date: x.date, v: x.hrv })),
      ctx.today,
    );
    if (!baseline) return null;
    const drop = (baseline - c.hrv) / baseline;
    const poorSleep =
      (c.sleep_hr != null && c.sleep_hr < 6.5) ||
      (c.sleep_quality != null && c.sleep_quality <= 2);
    if (drop >= 0.07 && poorSleep) {
      return {
        id: idFor('RECOVERY_WATCH', ctx.today, 'hrv'),
        date: ctx.today,
        type: 'RECOVERY_WATCH',
        message: `HRV is ${Math.round(drop * 100)}% below your 7-day average and sleep was light.`,
        recommended_action:
          "Swap tomorrow's hard session for Z2 endurance. Sleep before training.",
        acknowledged: false,
      };
    }
    return null;
  },
};

const ruleLowEnergyStreak: Rule = {
  evaluate: (ctx) => {
    const recent = [...ctx.recentCheckins, ctx.todayCheckin].filter(Boolean) as DailyCheckin[];
    const last2 = recent.slice(-2);
    if (last2.length < 2) return null;
    if (last2.every((c) => c.energy != null && c.energy <= 4)) {
      return {
        id: idFor('RECOVERY_WATCH', ctx.today, 'energy'),
        date: ctx.today,
        type: 'RECOVERY_WATCH',
        message: 'Two days of low energy. Recovery debt is real.',
        recommended_action:
          'Convert tomorrow to recovery: easy spin or full rest. Add a meal and an extra hour of sleep.',
        acknowledged: false,
      };
    }
    return null;
  },
};

const ruleWeightDropFast: Rule = {
  evaluate: (ctx) => {
    const series = ctx.recentCheckins
      .filter((c) => c.weight_lb != null)
      .slice(-4);
    const todayW = ctx.todayCheckin?.weight_lb;
    if (todayW == null || series.length < 2) return null;
    const threeDaysAgo = series.find(
      (c) => differenceInCalendarDays(parseISO(ctx.today), parseISO(c.date)) >= 2,
    );
    if (!threeDaysAgo || threeDaysAgo.weight_lb == null) return null;
    const drop = (threeDaysAgo.weight_lb - todayW) / threeDaysAgo.weight_lb;
    if (drop >= 0.01) {
      return {
        id: idFor('RED_FLAG', ctx.today, 'wdrop'),
        date: ctx.today,
        type: 'RED_FLAG',
        message: `Weight down ${(drop * 100).toFixed(1)}% in three days — likely fluid loss.`,
        recommended_action:
          'Front-load fluids today. 1 g sodium per liter. Check tomorrow morning before training.',
        acknowledged: false,
      };
    }
    return null;
  },
};

const ruleWeightCreepDeficit: Rule = {
  evaluate: (ctx) => {
    const series = ctx.recentCheckins
      .filter((c) => c.weight_lb != null)
      .slice(-7);
    const todayW = ctx.todayCheckin?.weight_lb;
    if (todayW == null || series.length < 4) return null;
    const fiveDaysAgo = series.find(
      (c) => differenceInCalendarDays(parseISO(ctx.today), parseISO(c.date)) >= 4,
    );
    if (!fiveDaysAgo || fiveDaysAgo.weight_lb == null) return null;
    const gain = todayW - fiveDaysAgo.weight_lb;
    if (gain >= 2) {
      return {
        id: idFor('PLAN_ADJUST', ctx.today, 'wgain'),
        date: ctx.today,
        type: 'PLAN_ADJUST',
        message: `Weight up ${gain.toFixed(1)} lb sustained over five days.`,
        recommended_action:
          "If you're in a deficit, re-evaluate intake — sodium, carbs, or unintended overshoot.",
        acknowledged: false,
      };
    }
    return null;
  },
};

const ruleSkippedSessions: Rule = {
  evaluate: (ctx) => {
    const skipped = ctx.thisWeekPlanned.filter((s) => s.status === 'SKIPPED').length;
    if (skipped >= 3) {
      return {
        id: idFor('PLAN_ADJUST', ctx.today, 'skips'),
        date: ctx.today,
        type: 'PLAN_ADJUST',
        message: `${skipped} skipped sessions this week.`,
        recommended_action:
          "Consolidate the rest of the week — don't cram. Keep the long ride and one quality session, drop the rest.",
        acknowledged: false,
      };
    }
    return null;
  },
};

const ruleHighRpe: Rule = {
  evaluate: (ctx) => {
    const todayLog = ctx.recentLogs
      .slice()
      .reverse()
      .find((l) => l.date === ctx.today);
    if (!todayLog || todayLog.rpe == null) return null;
    const planned = ctx.todaysSessions.find((s) => s.id === todayLog.planned_session_id);
    if (!planned) return null;
    const expected: Record<string, number> = {
      RECOVERY: 3,
      ENDURANCE: 5,
      TEMPO: 7,
      THRESHOLD: 8,
      VO2: 9,
      MIXED: 7,
    };
    const exp = expected[planned.intensity];
    if (exp == null) return null;
    if (todayLog.rpe - exp >= 2) {
      return {
        id: idFor('RECOVERY_WATCH', ctx.today, 'rpe'),
        date: ctx.today,
        type: 'RECOVERY_WATCH',
        message: `Today felt RPE ${todayLog.rpe} on a Z${exp} day.`,
        recommended_action:
          'Treat the next 48 hr as recovery emphasis: easy spin, sleep, real food.',
        acknowledged: false,
      };
    }
    return null;
  },
};

const ruleLongRideExecuted: Rule = {
  evaluate: (ctx) => {
    const today = ctx.todaysSessions.find(
      (s) => (s.sport === 'BIKE' || s.sport === 'BRICK') && s.duration_min >= 180,
    );
    if (!today) return null;
    const log = ctx.recentLogs.find((l) => l.planned_session_id === today.id);
    if (!log) return null;
    const ratio = log.duration_min / today.duration_min;
    if (ratio >= 0.95 && ratio <= 1.1 && (log.rpe ?? 0) <= 7) {
      return {
        id: idFor('POSITIVE', ctx.today, 'longride'),
        date: ctx.today,
        type: 'POSITIVE',
        message: 'Long ride executed at planned duration with controlled effort.',
        recommended_action: 'Refuel within the hour. 1.2 g/kg carb + 25 g protein.',
        acknowledged: false,
      };
    }
    return null;
  },
};

const ruleBrickRacePace: Rule = {
  evaluate: (ctx) => {
    const today = ctx.todaysSessions.find((s) => s.sport === 'BRICK');
    if (!today) return null;
    const log = ctx.recentLogs.find((l) => l.planned_session_id === today.id);
    if (!log || log.rpe == null) return null;
    if (log.rpe >= 6 && log.rpe <= 8) {
      return {
        id: idFor('POSITIVE', ctx.today, 'brick'),
        date: ctx.today,
        type: 'POSITIVE',
        message: 'Brick run executed in race-pace zone.',
        recommended_action: 'Log the fueling protocol that worked — repeat it on race day.',
        acknowledged: false,
      };
    }
    return null;
  },
};

const RULES: Rule[] = [
  ruleHrvDownPoorSleep,
  ruleLowEnergyStreak,
  ruleWeightDropFast,
  ruleWeightCreepDeficit,
  ruleSkippedSessions,
  ruleHighRpe,
  ruleLongRideExecuted,
  ruleBrickRacePace,
];

export function evaluateFeedback(ctx: FeedbackContext): FeedbackEvent[] {
  const out: FeedbackEvent[] = [];
  for (const r of RULES) {
    try {
      const f = r.evaluate(ctx);
      if (f) out.push(f);
    } catch (err) {
      console.warn('feedback rule failed', err);
    }
  }
  return out;
}

/** Recovery traffic light from current check-in + last 7 days. */
export function recoveryStatus(ctx: {
  todayCheckin?: DailyCheckin;
  recentCheckins: DailyCheckin[];
}): { tone: 'green' | 'yellow' | 'red'; reason: string } {
  const c = ctx.todayCheckin;
  if (!c) return { tone: 'yellow', reason: 'No check-in yet today.' };

  let score = 0;
  const reasons: string[] = [];

  if (c.sleep_hr != null) {
    if (c.sleep_hr >= 7.5) score += 1;
    else if (c.sleep_hr < 6.5) {
      score -= 1;
      reasons.push('low sleep');
    }
  }
  if (c.sleep_quality != null) {
    if (c.sleep_quality >= 4) score += 1;
    else if (c.sleep_quality <= 2) {
      score -= 1;
      reasons.push('poor sleep quality');
    }
  }
  if (c.energy != null) {
    if (c.energy >= 7) score += 1;
    else if (c.energy <= 4) {
      score -= 1;
      reasons.push('low energy');
    }
  }
  if (c.soreness != null) {
    if (c.soreness <= 3) score += 1;
    else if (c.soreness >= 7) {
      score -= 1;
      reasons.push('high soreness');
    }
  }
  if (c.hrv != null) {
    const baseline = sevenDayMean(
      ctx.recentCheckins.map((x) => ({ date: x.date, v: x.hrv })),
      c.date,
    );
    if (baseline) {
      const delta = (c.hrv - baseline) / baseline;
      if (delta <= -0.07) {
        score -= 1;
        reasons.push('HRV depressed');
      } else if (delta >= 0.05) {
        score += 1;
      }
    }
  }

  if (score >= 2) return { tone: 'green', reason: 'Sleep, energy, and HRV trending well.' };
  if (score <= -1) return { tone: 'red', reason: reasons.join(', ') || 'Recovery markers depressed.' };
  return { tone: 'yellow', reason: reasons.join(', ') || 'Mixed signals — train conservatively.' };
}

/** Get the Monday of the week containing `date`. */
export function weekStart(date: string): Date {
  return startOfWeek(parseISO(date), { weekStartsOn: 1 });
}

export function weekRangeDates(date: string): string[] {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
}
