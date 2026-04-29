import { NavLink, Outlet } from 'react-router-dom';
import { useApp } from '@/lib/store';

export default function AppShell() {
  const reset = useApp((s) => s.reset);
  const profile = useApp((s) => s.profile);

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-10 border-b border-white/5 bg-ink/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between px-5 py-3">
          <div>
            <div className="display text-lg leading-none text-bone">Iron Trainer</div>
            <div className="label mt-0.5">{profile?.name}</div>
          </div>
          <button
            className="label hover:text-bone"
            onClick={() => {
              if (confirm('Wipe all local data and restart onboarding?')) {
                void reset();
              }
            }}
          >
            Reset
          </button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <NavBar />
    </div>
  );
}

function NavBar() {
  const tabs: { to: string; label: string; disabled?: boolean }[] = [
    { to: '/today', label: 'Today' },
    { to: '/plan', label: 'Plan', disabled: true },
    { to: '/trends', label: 'Trends', disabled: true },
    { to: '/race', label: 'Race', disabled: true },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-white/5 bg-ink/95 backdrop-blur">
      <div className="mx-auto grid w-full max-w-xl grid-cols-4">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            onClick={(e) => t.disabled && e.preventDefault()}
            className={({ isActive }) =>
              'flex flex-col items-center gap-0.5 py-3 font-mono text-[11px] uppercase tracking-wider2 ' +
              (t.disabled
                ? 'text-bone-mute/40'
                : isActive
                ? 'text-phase-taper'
                : 'text-bone-dim hover:text-bone')
            }
          >
            <span>{t.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
