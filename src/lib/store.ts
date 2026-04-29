import { create } from 'zustand';
import { db, getProfile, replacePlan, saveProfile } from './db';
import { generatePlan } from './periodization';
import type { UserProfile } from './types';

interface AppState {
  profile?: UserProfile;
  loaded: boolean;
  load: () => Promise<void>;
  saveProfileAndPlan: (profile: UserProfile) => Promise<{ warning?: string }>;
  reset: () => Promise<void>;
}

export const useApp = create<AppState>((set) => ({
  profile: undefined,
  loaded: false,
  load: async () => {
    const profile = await getProfile();
    set({ profile, loaded: true });
  },
  saveProfileAndPlan: async (profile) => {
    await saveProfile(profile);
    const { sessions, warning } = generatePlan({ profile });
    await replacePlan(sessions);
    set({ profile });
    return { warning };
  },
  reset: async () => {
    await db.profile.clear();
    await db.plannedSessions.clear();
    await db.sessionLogs.clear();
    await db.checkins.clear();
    await db.feedback.clear();
    set({ profile: undefined });
  },
}));
