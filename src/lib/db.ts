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
