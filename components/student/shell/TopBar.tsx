'use client';
import { HugeiconsIcon } from '@hugeicons/react';
import { Logout01Icon, DashboardSquare01Icon } from '@hugeicons/core-free-icons';
import { logout } from '@/lib/auth';
import { CONSOLE_URL } from '@/lib/config';
import s from './shell.module.css';

interface TopBarProps {
  /** workshop title, empty until the student has joined one */
  workshop: string;
  chip: string;
  /** staff previewing the student app get a way back to the console */
  isStaff: boolean;
}

export function TopBar({ workshop, chip, isStaff }: TopBarProps) {
  return (
    <header className={s.top}>
      <div className={s.topText}>
        <span className={s.brandLine}>
          <span className={s.wordmark}>Workshops</span>
          <span className={s.by}>by Corewise</span>
        </span>
        {workshop || chip ? (
          <span className={s.sub}>
            {workshop ? <span className={s.title}>{workshop}</span> : null}
            {chip ? <span className={s.chip}>{chip}</span> : null}
          </span>
        ) : null}
      </div>
      {isStaff ? (
        <a href={CONSOLE_URL} className={s.topAction} aria-label="לקונסולת הצוות">
          <HugeiconsIcon icon={DashboardSquare01Icon} size={22} />
        </a>
      ) : null}
      <button type="button" className={s.topAction} onClick={() => void logout()} aria-label="התנתקות">
        <HugeiconsIcon icon={Logout01Icon} size={22} />
      </button>
    </header>
  );
}
