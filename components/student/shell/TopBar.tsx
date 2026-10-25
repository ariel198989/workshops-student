'use client';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { Logout01Icon, DashboardSquare01Icon } from '@hugeicons/core-free-icons';
import { logout } from '@/lib/auth';
import s from './shell.module.css';

interface TopBarProps {
  title: string;
  chip: string;
  /** staff previewing the student area get a way back to the console */
  isStaff: boolean;
}

export function TopBar({ title, chip, isStaff }: TopBarProps) {
  return (
    <header className={s.top}>
      <div className={s.topText}>
        <span className={s.title}>{title}</span>
        {chip ? <span className={s.chip}>{chip}</span> : null}
      </div>
      {isStaff ? (
        <Link href="/" className={s.topAction} aria-label="חזרה לקונסולה">
          <HugeiconsIcon icon={DashboardSquare01Icon} size={22} />
        </Link>
      ) : null}
      <button type="button" className={s.topAction} onClick={() => void logout()} aria-label="התנתקות">
        <HugeiconsIcon icon={Logout01Icon} size={22} />
      </button>
    </header>
  );
}
