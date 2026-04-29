import Dexie, { type Table } from 'dexie';
import type {
  DailyCheckin,
  FeedbackEvent,
  PlannedSession,
  SessionLog,
  UserProfile,
} from './types';

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
  return db.transaction('rw', [db.sessionLogs, db.plannedSessions], async () => {
    let matched = log.planned_session_id
      ? await db.plannedSessions.get(log.planned_session_id)
      : undefined;

    if (!matched) {
      const sameDay = await db.plannedSessions.where('date').equals(log.date).toArray();
      matched = sameDay.find((p) => p.sport === log.sport && p.status === 'PLANNED')
        ?? sameDay.find((p) => p.status === 'PLANNED');
    }

    let status: PlannedSession['status'] | null = null;
    if (matched && matched.duration_min > 0) {
      const ratio = log.duration_min / matched.duration_min;
      const sameSport = matched.sport === log.sport;
      status = sameSport && ratio >= 0.8 && ratio <= 1.2 ? 'COMPLETED' : 'MODIFIED';
      await db.plannedSessions.update(matched.id, { status });
    } else if (matched) {
      // matched a rest day or 0-duration plan — anything counts as MODIFIED
      status = 'MODIFIED';
      await db.plannedSessions.update(matched.id, { status });
    }

    await db.sessionLogs.put({
      ...log,
      planned_session_id: matched?.id,
    });

    return { status, matchedPlannedId: matched?.id };
  });
}

export async function markSessionSkipped(plannedId: string): Promise<void> {
  await db.plannedSessions.update(plannedId, { status: 'SKIPPED' });
}

export async function saveCheckin(checkin: DailyCheckin): Promise<void> {
  await db.checkins.put(checkin);
}

export async function getCheckin(date: string): Promise<DailyCheckin | undefined> {
  return db.checkins.get(date);
}
