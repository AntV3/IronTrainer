import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { ackFeedback, db, refreshFeedback } from '@/lib/db';
import type { FeedbackEvent, FeedbackType } from '@/lib/types';

const STYLE: Record<FeedbackType, { border: string; bg: string; text: string; tag: string }> = {
  RECOVERY_WATCH: {
    border: 'border-signal-yellow/50',
    bg: 'bg-signal-yellow/10',
    text: 'text-signal-yellow',
    tag: 'Recovery Watch',
  },
  POSITIVE: {
    border: 'border-signal-green/50',
    bg: 'bg-signal-green/10',
    text: 'text-signal-green',
    tag: 'Win',
  },
  PLAN_ADJUST: {
    border: 'border-phase-base/50',
    bg: 'bg-phase-base/10',
    text: 'text-phase-base',
    tag: 'Plan Adjust',
  },
  RED_FLAG: {
    border: 'border-signal-red/60',
    bg: 'bg-signal-red/10',
    text: 'text-signal-red',
    tag: 'Red Flag',
  },
  RACE_WEEK: {
    border: 'border-phase-taper/60',
    bg: 'bg-phase-taper/10',
    text: 'text-phase-taper',
    tag: 'Race Week',
  },
};

export default function FeedbackStack() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const feedback = useLiveQuery(
    async () => {
      const all = await db.feedback.orderBy('date').reverse().toArray();
      return all.filter((f) => !f.acknowledged).slice(0, 5);
    },
    [],
  );

  useEffect(() => {
    void refreshFeedback(today);
  }, [today]);

  if (!feedback || feedback.length === 0) return null;

  return (
    <div className="space-y-3">
      {feedback.map((f) => (
        <FeedbackCard key={f.id} f={f} />
      ))}
    </div>
  );
}

function FeedbackCard({ f }: { f: FeedbackEvent }) {
  const s = STYLE[f.type];
  return (
    <div className={`rounded-xl border p-4 ${s.border} ${s.bg}`}>
      <div className="flex items-center justify-between">
        <span className={`font-mono text-[10px] uppercase tracking-wider2 ${s.text}`}>{s.tag}</span>
        <button
          type="button"
          onClick={() => void ackFeedback(f.id)}
          className="font-mono text-[10px] uppercase tracking-wider2 text-bone-mute hover:text-bone"
        >
          Got it
        </button>
      </div>
      <p className="mt-2 text-sm text-bone">{f.message}</p>
      {f.recommended_action && (
        <p className="mt-2 text-sm text-bone-dim">{f.recommended_action}</p>
      )}
    </div>
  );
}
