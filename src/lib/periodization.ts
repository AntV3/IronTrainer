import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type {
  Intensity,
  Phase,
  PlannedSession,
  Sport,
  UserProfile,
} from './types';

const MIN_RANDOM_ID = (): string =>
  `s_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

interface PhaseAllocation {
  base: number;
  build1: number;
  build2: number;
  peak: number;
  taper: number;
}

interface PhaseSpan {
  phase: Phase;
  weeks: number;
}

export function allocatePhases(weeksToRace: number): PhaseAllocation {
  if (weeksToRace >= 24) {
    return { base: 8, build1: 6, build2: 5, peak: 2, taper: 3 };
  }
  if (weeksToRace >= 16) {
    return { base: 5, build1: 5, build2: 4, peak: 2, taper: 3 };
  }
  if (weeksToRace >= 12) {
    return { base: 3, build1: 3, build2: 3, peak: 1, taper: 2 };
  }
  if (weeksToRace >= 8) {
    return { base: 0, build1: 3, build2: 3, peak: 1, taper: 2 };
  }
  // < 8 weeks: minimal finish-only plan, weighted toward taper safety
  const taper = Math.max(1, Math.min(2, weeksToRace - 1));
  return { base: 0, build1: 0, build2: 0, peak: 0, taper };
}

function spansFromAllocation(alloc: PhaseAllocation, weeksToRace: number): PhaseSpan[] {
  const spans: PhaseSpan[] = [];
  if (alloc.base) spans.push({ phase: 'BASE', weeks: alloc.base });
  if (alloc.build1) spans.push({ phase: 'BUILD1', weeks: alloc.build1 });
  if (alloc.build2) spans.push({ phase: 'BUILD2', weeks: alloc.build2 });
  if (alloc.peak) spans.push({ phase: 'PEAK', weeks: alloc.peak });
  if (alloc.taper) spans.push({ phase: 'TAPER', weeks: alloc.taper });

  // Truncate or pad if rounding diverges from weeksToRace
  let total = spans.reduce((acc, s) => acc + s.weeks, 0);
  while (total > weeksToRace && spans.length) {
    const front = spans[0];
    front.weeks -= 1;
    if (front.weeks <= 0) spans.shift();
    total -= 1;
  }
  while (total < weeksToRace) {
    // Pad onto the front (more base-like time) so the race anchor stays fixed
    if (spans[0]) {
      spans[0].weeks += 1;
    } else {
      spans.unshift({ phase: 'TAPER', weeks: 1 });
    }
    total += 1;
  }
  return spans;
}

/** Volume multiplier for a given phase week (1-indexed within the phase) using a 3:1 loading pattern. */
function loadingMultiplier(weekIndexInPhase: number): number {
  // every 4th week is recovery at -25%
  return weekIndexInPhase % 4 === 0 ? 0.75 : 1;
}

/**
 * Linear ramp from baseline to peak across the build of the plan.
 * Peak hits at the start of PEAK phase; TAPER phase descends.
 */
function weeklyHoursTarget(opts: {
  weekIndexFromStart: number;
  totalWeeks: number;
  phase: Phase;
  baselineHours: number;
  peakHours: number;
  weekIndexInPhase: number;
  phaseWeeks: number;
}): number {
  const { weekIndexFromStart, totalWeeks, phase, baselineHours, peakHours } = opts;
  const range = peakHours - baselineHours;

  if (phase === 'TAPER') {
    // taper: 0.7 -> 0.5 -> 0.35 of peak
    const ratios = [0.7, 0.5, 0.35];
    const r = ratios[Math.min(opts.weekIndexInPhase - 1, ratios.length - 1)] ?? 0.5;
    return peakHours * r;
  }
  if (phase === 'PEAK') {
    return peakHours;
  }
  // base/build: linear ramp
  const denom = Math.max(1, totalWeeks - 1);
  const t = weekIndexFromStart / denom;
  const ramp = baselineHours + range * t;
  return ramp * loadingMultiplier(opts.weekIndexInPhase);
}

interface DayTemplate {
  sport: Sport;
  intensity: Intensity;
  /** fraction of weekly hours; templates are normalized, not absolute. */
  share: number;
  description: (ctx: { phase: Phase; weeklyHours: number }) => string;
  weekday: number; // 0=Sun, 1=Mon, ...
}

/**
 * Day template for a 6-day Ironman week. Mon rest, Sat long ride, Sun long run.
 * Shares are normalized to total ~1 for the active days; rest day skipped.
 */
function buildWeekTemplate(daysPerWeek: number): DayTemplate[] {
  const ride = (ctx: { phase: Phase; weeklyHours: number }) => {
    if (ctx.phase === 'TAPER') return 'Easy spin Z2 — keep legs moving, no intensity.';
    if (ctx.phase === 'PEAK') return 'Race-simulation long ride Z2 + 30-min run brick.';
    if (ctx.phase === 'BUILD2') return 'Long ride Z2 + 20-min run brick at race pace.';
    if (ctx.phase === 'BUILD1') return 'Long ride mostly Z2 with 2x20 tempo block.';
    return 'Long aerobic ride Z2. Fuel like a race.';
  };

  const longRun = (ctx: { phase: Phase; weeklyHours: number }) => {
    if (ctx.phase === 'TAPER') return 'Short shakeout Z2 — turnover only.';
    if (ctx.phase === 'PEAK') return 'Long run Z2 with race-pace finish.';
    if (ctx.phase === 'BUILD2') return 'Long run Z2 with progression to race pace.';
    return 'Long aerobic run Z2. Negative split second half.';
  };

  const all: DayTemplate[] = [
    {
      weekday: 1, // Mon
      sport: 'REST',
      intensity: 'RECOVERY',
      share: 0,
      description: () => 'Rest day. Mobility + sleep priority.',
    },
    {
      weekday: 2, // Tue
      sport: 'BIKE',
      intensity: 'THRESHOLD',
      share: 0.13,
      description: ({ phase }) =>
        phase === 'BASE'
          ? 'Bike Z2 with 4x5 tempo intervals.'
          : phase === 'TAPER'
          ? 'Easy spin Z2 30 min.'
          : 'Bike intervals: 4x8 at threshold, 4 min rest.',
    },
    {
      weekday: 3, // Wed
      sport: 'SWIM',
      intensity: 'TEMPO',
      share: 0.1,
      description: ({ phase }) =>
        phase === 'BASE'
          ? 'Swim technique + 8x100 build.'
          : 'Swim threshold set: 6x200 strong, 20s rest.',
    },
    {
      weekday: 4, // Thu
      sport: 'RUN',
      intensity: 'TEMPO',
      share: 0.12,
      description: ({ phase }) =>
        phase === 'BASE'
          ? 'Run Z2 with 4 strides.'
          : phase === 'TAPER'
          ? 'Easy run Z2 30 min, 4 strides.'
          : 'Run tempo: 3x10 at half-IM pace, 3 min jog.',
    },
    {
      weekday: 5, // Fri
      sport: 'STRENGTH',
      intensity: 'ENDURANCE',
      share: 0.08,
      description: ({ phase }) =>
        phase === 'TAPER'
          ? 'Light mobility + activation only.'
          : 'Strength: posterior chain, single-leg, core. 45 min.',
    },
    {
      weekday: 6, // Sat — long ride
      sport: 'BIKE',
      intensity: 'ENDURANCE',
      share: 0.32,
      description: ride,
    },
    {
      weekday: 0, // Sun — long run / brick
      sport: 'RUN',
      intensity: 'ENDURANCE',
      share: 0.25,
      description: longRun,
    },
  ];

  // If user trains <6 days/week, drop strength first, then Wed swim, then Thu run.
  const dropOrder: number[] = [5, 3, 4, 2];
  const active = [...all];
  let days = active.filter((d) => d.sport !== 'REST').length;
  for (const wkday of dropOrder) {
    if (days <= daysPerWeek) break;
    const idx = active.findIndex((d) => d.weekday === wkday);
    if (idx >= 0) {
      // convert to rest
      active[idx] = {
        ...active[idx],
        sport: 'REST',
        intensity: 'RECOVERY',
        share: 0,
        description: () => 'Optional rest / mobility.',
      };
      days -= 1;
    }
  }

  // Renormalize shares to 1.0 across active days
  const sum = active.reduce((acc, d) => acc + d.share, 0);
  if (sum > 0) {
    return active.map((d) => ({ ...d, share: d.share / sum }));
  }
  return active;
}

function toIntensityForPhase(base: Intensity, phase: Phase): Intensity {
  if (phase === 'TAPER') return base === 'ENDURANCE' ? 'RECOVERY' : 'ENDURANCE';
  if (phase === 'PEAK' && base === 'TEMPO') return 'THRESHOLD';
  if (phase === 'BASE' && (base === 'THRESHOLD' || base === 'VO2')) return 'TEMPO';
  return base;
}

function pickSportForPhase(template: DayTemplate, phase: Phase): Sport {
  // Inject a brick on Saturday during PEAK and BUILD2 (already in description).
  if (template.sport === 'BIKE' && (phase === 'PEAK' || phase === 'BUILD2') && template.weekday === 6) {
    return 'BRICK';
  }
  return template.sport;
}

function roundDuration(min: number): number {
  if (min < 20) return 0;
  return Math.round(min / 5) * 5;
}

export interface GeneratePlanInput {
  profile: UserProfile;
  startDate?: string; // YYYY-MM-DD; defaults to today
}

export interface GeneratePlanResult {
  sessions: PlannedSession[];
  weeksToRace: number;
  phaseSpans: PhaseSpan[];
  warning?: string;
}

export function generatePlan({ profile, startDate }: GeneratePlanInput): GeneratePlanResult {
  const today = startDate ? parseISO(startDate) : new Date();
  const race = parseISO(profile.race.date);
  const rawDays = differenceInCalendarDays(race, today);
  const weeksToRace = Math.max(0, Math.ceil(rawDays / 7));

  const alloc = allocatePhases(weeksToRace);
  const spans = spansFromAllocation(alloc, weeksToRace);

  const baselineHours = Math.max(3, profile.experience.weekly_hours_baseline || 6);
  const peakHours = Math.min(
    profile.constraints.max_weekday_hr * 5 + profile.constraints.max_weekend_hr * 2,
    Math.round(baselineHours * 1.6 * 10) / 10,
  );

  const template = buildWeekTemplate(profile.constraints.days_per_week);
  const sessions: PlannedSession[] = [];

  // Compute the start of week 1: align to Monday on or after `today`.
  const dow = today.getDay(); // 0=Sun
  const daysToMonday = ((1 - dow + 7) % 7);
  const week1Start = addDays(today, daysToMonday);

  let weekIndex = 0;
  for (const span of spans) {
    for (let phaseWeek = 1; phaseWeek <= span.weeks; phaseWeek++) {
      weekIndex++;
      const weeklyHours = weeklyHoursTarget({
        weekIndexFromStart: weekIndex - 1,
        totalWeeks: weeksToRace,
        phase: span.phase,
        baselineHours,
        peakHours,
        weekIndexInPhase: phaseWeek,
        phaseWeeks: span.weeks,
      });

      const weekStart = addDays(week1Start, (weekIndex - 1) * 7);
      for (const t of template) {
        // weekday 0=Sun in template means the next Sunday (end of training week, our Mon-anchored week)
        const offset = (t.weekday + 6) % 7; // Mon=0, Tue=1, ... Sun=6
        const date = addDays(weekStart, offset);
        if (date < today) continue; // don't emit past dates

        const sport = pickSportForPhase(t, span.phase);
        const intensity = toIntensityForPhase(t.intensity, span.phase);
        const minutes = sport === 'REST' ? 0 : roundDuration(weeklyHours * 60 * t.share);
        const isRest = sport === 'REST' || minutes === 0;

        sessions.push({
          id: MIN_RANDOM_ID(),
          date: format(date, 'yyyy-MM-dd'),
          day_of_week: date.getDay(),
          phase: span.phase,
          week_number: weekIndex,
          sport: isRest ? 'REST' : sport,
          duration_min: isRest ? 0 : minutes,
          intensity: isRest ? 'RECOVERY' : intensity,
          description: t.description({ phase: span.phase, weeklyHours }),
          targets: buildTargets({ profile, sport, intensity }),
          status: 'PLANNED',
        });
      }
    }
  }

  // Race day session
  if (rawDays >= 0) {
    sessions.push({
      id: MIN_RANDOM_ID(),
      date: profile.race.date,
      day_of_week: race.getDay(),
      phase: 'TAPER',
      week_number: weekIndex + 1,
      sport: distanceToRaceSport(profile.race.distance),
      duration_min: estimateRaceMinutes(profile),
      intensity: 'ENDURANCE',
      description: `RACE DAY · ${profile.race.name}`,
      status: 'PLANNED',
    });
  }

  // Sort by date
  sessions.sort((a, b) => a.date.localeCompare(b.date));

  let warning: string | undefined;
  if (weeksToRace < 8) {
    warning =
      'Less than 8 weeks to race — generated a finish-focused minimal plan. Consider deferring the race if you can.';
  } else if (weeksToRace < 12) {
    warning = 'Compressed timeline. Skipped extended base — manage intensity carefully.';
  }

  return { sessions, weeksToRace, phaseSpans: spans, warning };
}

function distanceToRaceSport(_d: string): Sport {
  return 'BRICK';
}

function estimateRaceMinutes(profile: UserProfile): number {
  switch (profile.race.distance) {
    case 'IM':
      return 660; // ~11h
    case '70.3':
      return 330;
    case 'OLY':
      return 165;
    case 'SPRINT':
      return 80;
    default:
      return 600;
  }
}

function buildTargets(opts: {
  profile: UserProfile;
  sport: Sport;
  intensity: Intensity;
}): PlannedSession['targets'] {
  const { profile, sport, intensity } = opts;
  if (sport === 'BIKE' || sport === 'BRICK') {
    const ftp = profile.thresholds.bike_ftp_w;
    if (!ftp) return undefined;
    const ranges: Record<Intensity, [number, number]> = {
      RECOVERY: [0.45, 0.55],
      ENDURANCE: [0.65, 0.75],
      TEMPO: [0.76, 0.88],
      THRESHOLD: [0.95, 1.05],
      VO2: [1.06, 1.2],
      MIXED: [0.65, 0.95],
    };
    const [lo, hi] = ranges[intensity];
    return { watts_low: Math.round(ftp * lo), watts_high: Math.round(ftp * hi) };
  }
  if (sport === 'RUN' && profile.thresholds.run_pace_per_mi) {
    return { pace: profile.thresholds.run_pace_per_mi };
  }
  if (sport === 'SWIM' && profile.thresholds.swim_pace_per_100) {
    return { pace: profile.thresholds.swim_pace_per_100 };
  }
  return undefined;
}
