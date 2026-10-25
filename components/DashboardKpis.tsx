'use client';
import { useEffect, useState } from 'react';
import {
  UserGroupIcon, Brain02Icon, Task01Icon, Image02Icon,
} from '@hugeicons/core-free-icons';
import { fetchQuickCounts, type QuickCounts } from '@/lib/dashboard';
import { KpiTile } from '@/components/ui/KpiTile';

type Loadable = { [K in keyof QuickCounts]: number | null | undefined };
const LOADING: Loadable = { classes: null, models: null, pendingJobs: null, detectionsToday: null };

export function DashboardKpis() {
  const [counts, setCounts] = useState<Loadable>(LOADING);

  useEffect(() => {
    let alive = true;
    void fetchQuickCounts().then((c) => { if (alive) setCounts(c); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="kpi-grid">
      <KpiTile label="קבוצות וכיתות" value={counts.classes} icon={UserGroupIcon} note="רשומות במערכת" />
      <KpiTile label="מודלים" value={counts.models} icon={Brain02Icon} note="מודלים שאומנו" />
      <KpiTile label="אימונים בהמתנה" value={counts.pendingJobs} icon={Task01Icon} tone="gold" note="ממתינים בתור" />
      <KpiTile label="זיהויים היום" value={counts.detectionsToday} icon={Image02Icon} note="מאז חצות" />
    </div>
  );
}
