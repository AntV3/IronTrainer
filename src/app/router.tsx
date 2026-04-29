import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useApp } from '@/lib/store';
import Wizard from '@/features/onboarding/Wizard';
import Today from '@/features/today/Today';
import SessionLogger from '@/features/log/SessionLogger';
import DailyCheckinScreen from '@/features/checkin/DailyCheckin';
import AppShell from './AppShell';

function Root() {
  const load = useApp((s) => s.load);
  const loaded = useApp((s) => s.loaded);

  useEffect(() => {
    if (!loaded) void load();
  }, [load, loaded]);

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-bone-dim">
        <span className="label animate-pulse">Loading…</span>
      </div>
    );
  }
  return <Outlet />;
}

function RequireProfile() {
  const profile = useApp((s) => s.profile);
  const location = useLocation();
  if (!profile) {
    return <Navigate to="/onboarding" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

function RedirectIfOnboarded() {
  const profile = useApp((s) => s.profile);
  if (profile) return <Navigate to="/today" replace />;
  return <Wizard />;
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/onboarding', element: <RedirectIfOnboarded /> },
      {
        element: <RequireProfile />,
        children: [
          { path: '/log/:date?', element: <SessionLogger /> },
          { path: '/checkin', element: <DailyCheckinScreen /> },
          {
            element: <AppShell />,
            children: [
              { path: '/', element: <Navigate to="/today" replace /> },
              { path: '/today', element: <Today /> },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
]);
