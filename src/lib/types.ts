export type Sex = 'M' | 'F' | 'NB';
export type Units = 'metric' | 'imperial';
export type RaceDistance = 'IM' | '70.3' | 'OLY' | 'SPRINT';
export type GoalType = 'finish' | 'time' | 'pr';

export type Phase = 'BASE' | 'BUILD1' | 'BUILD2' | 'PEAK' | 'TAPER';

export type Sport =
  | 'SWIM'
  | 'BIKE'
  | 'RUN'
  | 'BRICK'
  | 'STRENGTH'
  | 'CROSS'
  | 'REST';

export type Intensity =
  | 'RECOVERY'
  | 'ENDURANCE'
  | 'TEMPO'
  | 'THRESHOLD'
  | 'VO2'
  | 'MIXED';

export type SessionStatus = 'PLANNED' | 'COMPLETED' | 'SKIPPED' | 'MODIFIED';

export interface UserProfile {
  id: string;
  name: string;
  dob: string;
  sex: Sex;
  height_cm: number;
  units: Units;
  baseline: { weight_lb: number; bf_pct?: number; lbm_lb?: number };
  race: { name: string; date: string; distance: RaceDistance; goal_type: GoalType; goal_time?: string };
  experience: { years: number; first_at_distance: boolean; weekly_hours_baseline: number };
  thresholds: {
    swim_pace_per_100?: string;
    bike_ftp_w?: number;
    run_pace_per_mi?: string;
  };
  constraints: {
    days_per_week: number;
    max_weekday_hr: number;
    max_weekend_hr: number;
    equipment: string[];
    other_sports: string[];
  };
  context?: {
    conditions?: string[];
    supplements?: string[];
    sleep_avg?: number;
    rhr_baseline?: number;
  };
  created_at: string;
}

export interface SessionTargets {
  distance?: number;
  watts_low?: number;
  watts_high?: number;
  pace?: string;
}

export interface PlannedSession {
  id: string;
  date: string;
  day_of_week: number;
  phase: Phase;
  week_number: number;
  sport: Sport;
  duration_min: number;
  intensity: Intensity;
  description: string;
  targets?: SessionTargets;
  status: SessionStatus;
}

export interface SessionLog {
  id: string;
  planned_session_id?: string;
  date: string;
  sport: Sport;
  duration_min: number;
  rpe: number;
  distance?: number;
  avg_hr?: number;
  max_hr?: number;
  avg_power?: number;
  avg_pace?: string;
  calories?: number;
  notes?: string;
  photo_uri?: string;
  logged_at: string;
}

export interface DailyCheckin {
  date: string;
  sleep_hr?: number;
  sleep_quality?: number;
  hrv?: number;
  rhr?: number;
  weight_lb?: number;
  energy?: number;
  soreness?: number;
  mood?: 'great' | 'good' | 'okay' | 'low' | 'bad';
  nutrition_adherence?: number;
  hydration?: number;
  notes?: string;
}

export type FeedbackType =
  | 'RECOVERY_WATCH'
  | 'POSITIVE'
  | 'PLAN_ADJUST'
  | 'RED_FLAG'
  | 'RACE_WEEK';

export interface FeedbackEvent {
  id: string;
  date: string;
  type: FeedbackType;
  message: string;
  recommended_action?: string;
  acknowledged: boolean;
}
