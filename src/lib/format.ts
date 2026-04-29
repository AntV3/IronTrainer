import { format, parseISO } from 'date-fns';
import type { Intensity, Phase, Sport } from './types';

export const phaseLabel: Record<Phase, string> = {
  BASE: 'Base',
  BUILD1: 'Build 1',
  BUILD2: 'Build 2',
  PEAK: 'Peak',
  TAPER: 'Taper',
};

export const phaseColor: Record<Phase, string> = {
  BASE: 'text-phase-base',
  BUILD1: 'text-phase-build1',
  BUILD2: 'text-phase-build2',
  PEAK: 'text-phase-peak',
  TAPER: 'text-phase-taper',
};

export const phaseBg: Record<Phase, string> = {
  BASE: 'bg-phase-base/15 border-phase-base/40',
  BUILD1: 'bg-phase-build1/15 border-phase-build1/40',
  BUILD2: 'bg-phase-build2/15 border-phase-build2/40',
  PEAK: 'bg-phase-peak/15 border-phase-peak/40',
  TAPER: 'bg-phase-taper/15 border-phase-taper/40',
};

export const sportLabel: Record<Sport, string> = {
  SWIM: 'Swim',
  BIKE: 'Bike',
  RUN: 'Run',
  BRICK: 'Brick',
  STRENGTH: 'Strength',
  CROSS: 'Cross-train',
  REST: 'Rest',
};

export const sportColor: Record<Sport, string> = {
  SWIM: 'text-sport-swim',
  BIKE: 'text-sport-bike',
  RUN: 'text-sport-run',
  BRICK: 'text-sport-brick',
  STRENGTH: 'text-sport-strength',
  CROSS: 'text-sport-cross',
  REST: 'text-sport-rest',
};

export const sportDot: Record<Sport, string> = {
  SWIM: 'bg-sport-swim',
  BIKE: 'bg-sport-bike',
  RUN: 'bg-sport-run',
  BRICK: 'bg-sport-brick',
  STRENGTH: 'bg-sport-strength',
  CROSS: 'bg-sport-cross',
  REST: 'bg-sport-rest',
};

export const intensityLabel: Record<Intensity, string> = {
  RECOVERY: 'Recovery · Z1',
  ENDURANCE: 'Endurance · Z2',
  TEMPO: 'Tempo · Z3',
  THRESHOLD: 'Threshold · Z4',
  VO2: 'VO2 · Z5',
  MIXED: 'Mixed',
};

export function fmtDuration(min: number): string {
  if (!min) return '0';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function fmtDate(iso: string, pattern = 'EEE MMM d'): string {
  return format(parseISO(iso), pattern);
}
