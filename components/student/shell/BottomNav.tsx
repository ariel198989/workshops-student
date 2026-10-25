'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  Home01Icon, Camera01Icon, Tag01Icon, AiBrain01Icon, ChartLineData01Icon,
} from '@hugeicons/core-free-icons';
import { STUDENT_NAV, isStudentNavActive, type StudentNavId } from '@/lib/student/nav';
import s from './shell.module.css';

const ICONS: Record<StudentNavId, IconSvgElement> = {
  home: Home01Icon,
  capture: Camera01Icon,
  tag: Tag01Icon,
  train: AiBrain01Icon,
  results: ChartLineData01Icon,
};

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className={s.nav} aria-label="ניווט תלמיד">
      {STUDENT_NAV.map((item) => {
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
