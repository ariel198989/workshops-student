'use client';
import { useEffect, useState } from 'react';
import { toastStore, useStore } from '@/lib/store';

const TOAST_MS = 4000;

export function ToastHost() {
  const { msg, info, at } = useStore(toastStore);
  const [visibleAt, setVisibleAt] = useState(0);

  useEffect(() => {
    if (!at) return;
    setVisibleAt(at);
    const timer = setTimeout(() => setVisibleAt(0), TOAST_MS);
    return () => clearTimeout(timer);
  }, [at]);

  if (!msg || visibleAt !== at) return null;
  return (
    <div className={info ? 'toast info' : 'toast'} role="status" aria-live="polite">
      {msg}
    </div>
  );
}
