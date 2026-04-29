import type { GoalType, RaceDistance, Sex, Units, UserProfile } from '@/lib/types';

export interface OnboardingDraft {
  // identity
  name: string;
  dob: string;
  sex: Sex;
  units: Units;
  height_in: string;
  height_cm: string;
  weight_lb: string;
  weight_kg: string;
  bf_pct: string;
  lbm_lb: string;
  // race
  race_name: string;
  race_date: string;
  race_distance: RaceDistance;
  goal_type: GoalType;
  goal_time: string;
  // experience
  years: string;
  first_at_distance: 'yes' | 'no';
  weekly_hours_baseline: number;
  swim_pace: string;
  bike_ftp: string;
  run_pace: string;
  // constraints
  days_per_week: number;
  max_weekday_hr: number;
  max_weekend_hr: number;
  equipment: string[];
  other_sports: string;
  // health
  conditions: string;
  supplements: string;
  sleep_avg: string;
  rhr_baseline: string;
}

export const EQUIPMENT_OPTIONS = [
  'Pool',
  'Gym',
  'Bike trainer',
  'Road bike',
  'GPS watch',
  'HRV device',
  'Smart scale',
];

export const initialDraft: OnboardingDraft = {
  name: '',
  dob: '',
  sex: 'M',
  units: 'imperial',
  height_in: '',
  height_cm: '',
  weight_lb: '',
  weight_kg: '',
  bf_pct: '',
  lbm_lb: '',
  race_name: '',
  race_date: '',
  race_distance: 'IM',
  goal_type: 'finish',
  goal_time: '',
  years: '',
  first_at_distance: 'yes',
  weekly_hours_baseline: 8,
  swim_pace: '',
  bike_ftp: '',
  run_pace: '',
  days_per_week: 6,
  max_weekday_hr: 1.5,
  max_weekend_hr: 6,
  equipment: ['Pool', 'Bike trainer', 'GPS watch'],
  other_sports: '',
  conditions: '',
  supplements: '',
  sleep_avg: '',
  rhr_baseline: '',
};

function lbToKg(lb: number) {
  return lb / 2.20462;
}
function kgToLb(kg: number) {
  return kg * 2.20462;
}
function inToCm(inches: number) {
  return inches * 2.54;
}

export function draftToProfile(d: OnboardingDraft): UserProfile {
  const weight_lb = d.units === 'imperial'
    ? parseFloat(d.weight_lb) || 0
    : kgToLb(parseFloat(d.weight_kg) || 0);
  const height_cm = d.units === 'metric'
    ? parseFloat(d.height_cm) || 0
    : inToCm(parseFloat(d.height_in) || 0);

  const bf = d.bf_pct ? parseFloat(d.bf_pct) : undefined;
  const lbm =
    d.lbm_lb && parseFloat(d.lbm_lb) > 0
      ? parseFloat(d.lbm_lb)
      : weight_lb && bf !== undefined
      ? weight_lb * (1 - bf / 100)
      : undefined;

  return {
    id: 'me',
    name: d.name.trim() || 'Athlete',
    dob: d.dob,
    sex: d.sex,
    height_cm: Math.round(height_cm),
    units: d.units,
    baseline: {
      weight_lb: Math.round(weight_lb * 10) / 10,
      bf_pct: bf,
      lbm_lb: lbm ? Math.round(lbm * 10) / 10 : undefined,
    },
    race: {
      name: d.race_name.trim() || 'Race',
      date: d.race_date,
      distance: d.race_distance,
      goal_type: d.goal_type,
      goal_time: d.goal_time || undefined,
    },
    experience: {
      years: parseInt(d.years, 10) || 0,
      first_at_distance: d.first_at_distance === 'yes',
      weekly_hours_baseline: d.weekly_hours_baseline,
    },
    thresholds: {
      swim_pace_per_100: d.swim_pace || undefined,
      bike_ftp_w: d.bike_ftp ? parseInt(d.bike_ftp, 10) : undefined,
      run_pace_per_mi: d.run_pace || undefined,
    },
    constraints: {
      days_per_week: d.days_per_week,
      max_weekday_hr: d.max_weekday_hr,
      max_weekend_hr: d.max_weekend_hr,
      equipment: d.equipment,
      other_sports: d.other_sports
        ? d.other_sports.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    },
    context: {
      conditions: d.conditions
        ? d.conditions.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      supplements: d.supplements
        ? d.supplements.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      sleep_avg: d.sleep_avg ? parseFloat(d.sleep_avg) : undefined,
      rhr_baseline: d.rhr_baseline ? parseInt(d.rhr_baseline, 10) : undefined,
    },
    created_at: new Date().toISOString(),
  };
}

export { lbToKg, kgToLb, inToCm };
