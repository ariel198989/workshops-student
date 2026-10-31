'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MouseEvent } from 'react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  Home01Icon, Camera01Icon, Tag01Icon, AiBrain01Icon, ChartLineData01Icon, Quiz01Icon,
} from '@hugeicons/core-free-icons';
import { toast } from '@/lib/store';
import type { StudentCaps } from '@/lib/student/caps';
import { liveAllows, liveBlockedReason, type LiveState } from '@/lib/student/live';
import { isStudentNavActive, studentNavFor, type StudentNavId } from '@/lib/student/nav';
import s from './shell.module.css';

const ICONS: Record<StudentNavId, IconSvgElement> = {
  home: Home01Icon,
  capture: Camera01Icon,
  tag: Tag01Icon,
  train: AiBrain01Icon,
  results: ChartLineData01Icon,
  check: Quiz01Icon,
};

interface Props {
  caps: StudentCaps;
  checksCount: number;
  /** the facilitator's live step; items it has not opened stay visible but dimmed */
  live: LiveState | null;
}

/** Only the steps this workshop opens to students (per caps), plus 'בדיקה' when there are concept checks. */
export function BottomNav({ caps, checksCount, live }: Props) {
  const pathname = usePathname();
  const items = studentNavFor(caps, checksCount);
  const hold = (e: MouseEvent) => {
    e.preventDefault();
    if (live) toast(liveBlockedReason(live), true);
  };
  return (
    <nav className={s.nav} aria-label="ניווט תלמיד">
      {items.map((item) => {
        const on = isStudentNavActive(pathname, item.href);
        const open = liveAllows(live, item.id);
        const cls = [s.navItem, on ? s.navOn : '', open ? '' : s.navOff].filter(Boolean).join(' ');
        return (
          <Link key={item.id} href={item.href} className={cls}
            aria-current={on ? 'page' : undefined}
            aria-disabled={open ? undefined : true}
            tabIndex={open ? undefined : -1}
            onClick={open ? undefined : hold}>
            <HugeiconsIcon icon={ICONS[item.id]} size={24} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
