import Dexie, { type Table } from 'dexie';
import { addDays, format, subDays } from 'date-fns';
import type {
  DailyCheckin,
  FeedbackEvent,
  PlannedSession,
  SessionLog,
  UserProfile,
} from './types';
import { evaluateFeedback, weekRangeDates, type FeedbackContext } from './feedback';

export class IronTrainerDB extends Dexie {
  profile!: Table<UserProfile, string>;
  plannedSessions!: Table<PlannedSession, string>;
  sessionLogs!: Table<SessionLog, string>;
  checkins!: Table<DailyCheckin, string>;
  feedback!: Table<FeedbackEvent, string>;

  constructor() {
    super('iron_trainer');
    this.version(1).stores({
      profile: 'id, created_at',
      plannedSessions: 'id, date, week_number, phase, sport, status',
      sessionLogs: 'id, date, planned_session_id, sport, logged_at',
      checkins: 'date',
      feedback: 'id, date, type, acknowledged',
    });
  }
}

export const db = new IronTrainerDB();

export async function getProfile(): Promise<UserProfile | undefined> {
  return db.profile.toCollection().first();
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await db.profile.put(profile);
}

export async function clearAll(): Promise<void> {
  await db.transaction(
    'rw',
    [db.profile, db.plannedSessions, db.sessionLogs, db.checkins, db.feedback],
    async () => {
      await Promise.all([
        db.profile.clear(),
        db.plannedSessions.clear(),
        db.sessionLogs.clear(),
        db.checkins.clear(),
        db.feedback.clear(),
      ]);
    },
  );
}

export async function replacePlan(sessions: PlannedSession[]): Promise<void> {
  await db.transaction('rw', db.plannedSessions, async () => {
    await db.plannedSessions.clear();
    await db.plannedSessions.bulkPut(sessions);
  });
}

/**
 * Persist a SessionLog and reconcile the matching planned session's status.
 * Match rule per spec: if duration is within ±20% of plan → COMPLETED, else MODIFIED.
 * If there is no plan match, the log is still saved but no plan row updates.
 */
export async function logSession(
  log: SessionLog,
): Promise<{ status: PlannedSession['status'] | null; matchedPlannedId?: string }> {
  const result = await db.transaction(
    'rw',
    [db.sessionLogs, db.plannedSessions],
    async () => {
      let matched = log.planned_session_id
        ? await db.plannedSessions.get(log.planned_session_id)
        : undefined;

      if (!matched) {
        const sameDay = await db.plannedSessions.where('date').equals(log.date).toArray();
        matched =
          sameDay.find((p) => p.sport === log.sport && p.status === 'PLANNED') ??
          sameDay.find((p) => p.status === 'PLANNED');
      }

      let status: PlannedSession['status'] | null = null;
      if (matched && matched.duration_min > 0) {
        const ratio = log.duration_min / matched.duration_min;
        const sameSport = matched.sport === log.sport;
        status = sameSport && ratio >= 0.8 && ratio <= 1.2 ? 'COMPLETED' : 'MODIFIED';
        await db.plannedSessions.update(matched.id, { status });
      } else if (matched) {
        status = 'MODIFIED';
        await db.plannedSessions.update(matched.id, { status });
      }

      await db.sessionLogs.put({
        ...log,
        planned_session_id: matched?.id,
      });

      return { status, matchedPlannedId: matched?.id };
    },
  );

  await refreshFeedback(log.date);
  return result;
}

export async function markSessionSkipped(plannedId: string): Promise<void> {
  await db.plannedSessions.update(plannedId, { status: 'SKIPPED' });
  await refreshFeedback(format(new Date(), 'yyyy-MM-dd'));
}

export async function saveCheckin(checkin: DailyCheckin): Promise<void> {
  await db.checkins.put(checkin);
  await refreshFeedback(checkin.date);
}

export async function getCheckin(date: string): Promise<DailyCheckin | undefined> {
  return db.checkins.get(date);
}

/** Build a fresh FeedbackContext for `today` from the database. */
export async function buildFeedbackContext(today: string): Promise<FeedbackContext | null> {
  const profile = await getProfile();
  if (!profile) return null;

  const weekDates = weekRangeDates(today);
  const since = format(subDays(new Date(today), 14), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(today), 1), 'yyyy-MM-dd');

  const [todayCheckin, recentCheckins, recentLogs, weekPlanned, todaysSessions, tomorrowsSessions] =
    await Promise.all([
      db.checkins.get(today),
      db.checkins.where('date').between(since, today, true, false).sortBy('date'),
      db.sessionLogs.where('date').between(since, today, true, true).sortBy('logged_at'),
      db.plannedSessions.where('date').anyOf(weekDates).toArray(),
      db.plannedSessions.where('date').equals(today).toArray(),
      db.plannedSessions.where('date').equals(tomorrow).toArray(),
    ]);

  const thisWeekLogs = await db.sessionLogs
    .where('date')
    .anyOf(weekDates)
    .toArray();

  const raceDate = profile.race.date;
  const daysToRace = Math.max(
    0,
    Math.ceil((new Date(raceDate).getTime() - new Date(today).getTime()) / 86_400_000),
  );

  return {
    today,
    todayCheckin,
    recentCheckins,
    recentLogs,
    thisWeekPlanned: weekPlanned,
    thisWeekLogs,
    todaysSessions,
    tomorrowsSessions,
    raceDate,
    daysToRace,
  };
}

/**
 * Evaluate all feedback rules for `today` and persist any new events.
 * Existing events with the same id are preserved (and their acknowledged state).
 */
export async function refreshFeedback(today: string): Promise<FeedbackEvent[]> {
  const ctx = await buildFeedbackContext(today);
  if (!ctx) return [];
  const fresh = evaluateFeedback(ctx);
  if (!fresh.length) return [];

  const existing = await db.feedback.bulkGet(fresh.map((f) => f.id));
  const toWrite = fresh.map((f, i) => existing[i] ?? f);
  await db.feedback.bulkPut(toWrite);
  return toWrite;
}

export async function ackFeedback(id: string): Promise<void> {
  await db.feedback.update(id, { acknowledged: true });
}

export async function activeFeedback(): Promise<FeedbackEvent[]> {
  const all = await db.feedback.orderBy('date').reverse().toArray();
  return all.filter((f) => !f.acknowledged);
}
