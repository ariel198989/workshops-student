'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  Home01Icon, Camera01Icon, Tag01Icon, AiBrain01Icon, ChartLineData01Icon, Quiz01Icon,
} from '@hugeicons/core-free-icons';
import type { StudentCaps } from '@/lib/student/caps';
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
}

/** Only the steps this workshop opens to students (per caps), plus 'בדיקה' when there are concept checks. */
export function BottomNav({ caps, checksCount }: Props) {
  const pathname = usePathname();
  const items = studentNavFor(caps, checksCount);
  return (
    <nav className={s.nav} aria-label="ניווט תלמיד">
      {items.map((item) => {
        const on = isStudentNavActive(pathname, item.href);
        return (
          <Link key={item.id} href={item.href} className={on ? `${s.navItem} ${s.navOn}` : s.navItem}
            aria-current={on ? 'page' : undefined}>
            <HugeiconsIcon icon={ICONS[item.id]} size={24} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
