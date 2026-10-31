'use client';
import { HugeiconsIcon } from '@hugeicons/react';
import { Megaphone01Icon } from '@hugeicons/core-free-icons';
import { liveBanner, type LiveState } from '@/lib/student/live';
import s from './shell.module.css';

/** Slim bar under the top bar: the facilitator's current step. The key re-mounts it on change, so the pulse replays. */
export function LiveBar({ live }: { live: LiveState | null }) {
  const banner = liveBanner(live);
  if (!banner || !live) return null;
  return (
    <div key={`${live.updated_at}|${banner.label}`} className={s.live} role="status" aria-live="polite">
      <HugeiconsIcon icon={Megaphone01Icon} size={18} />
      <span className={s.liveText}>
        <span className={s.liveLabel}>עכשיו: {banner.label}</span>
        {banner.message ? <span className={s.liveMsg}>{banner.message}</span> : null}
      </span>
    </div>
  );
}
