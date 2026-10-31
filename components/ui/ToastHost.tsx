'use client';
import { useEffect, useState } from 'react';
import { toastStore, useStore } from '@/lib/store';

export function ToastHost() {
  const { msg, info, at, action, ms } = useStore(toastStore);
  const [visibleAt, setVisibleAt] = useState(0);

  useEffect(() => {
    if (!at) return;
    setVisibleAt(at);
    const timer = setTimeout(() => setVisibleAt(0), ms);
    return () => clearTimeout(timer);
  }, [at, ms]);

  if (!msg || visibleAt !== at) return null;
  const act = () => {
    setVisibleAt(0);
    action?.onClick();
  };
  return (
    <div className={info ? 'toast info' : 'toast'} role="status" aria-live="polite">
      <span>{msg}</span>
      {action ? <button type="button" className="toast-action" onClick={act}>{action.label}</button> : null}
    </div>
  );
}
