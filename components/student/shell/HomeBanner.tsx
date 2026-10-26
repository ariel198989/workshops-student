'use client';
import { useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, InformationCircleIcon } from '@hugeicons/core-free-icons';
import { useStore } from '@/lib/store';
import { clearHomeNotice, noticeStore } from '@/lib/student/notice';
import h from './home.module.css';

/** The guard's explanation after a redirect home: who does this step instead of the students. Gone once they leave home. */
export function HomeBanner() {
  const { notice } = useStore(noticeStore);
  useEffect(() => clearHomeNotice, []);
  if (!notice) return null;
  return (
    <div className={h.banner} role="status">
      <HugeiconsIcon icon={InformationCircleIcon} size={22} />
      <p className={h.bannerText}>{notice.text}</p>
      <button type="button" className={h.bannerClose} onClick={clearHomeNotice} aria-label="סגירה">
        <HugeiconsIcon icon={Cancel01Icon} size={18} />
      </button>
    </div>
  );
}
