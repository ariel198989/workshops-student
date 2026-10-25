'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import styles from './ws.module.css';

interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  /** CSS width, default 440px */
  width?: string;
  children: ReactNode;
}

/** Detail panel that slides in from the LEFT edge (the far side in RTL). Esc and backdrop close it. */
export function Drawer({ open, title, onClose, width = '440px', children }: DrawerProps) {
  const panel = useRef<HTMLElement>(null);
  const opener = useRef<Element | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <aside ref={panel} className={styles.drawer} style={{ width }} role="dialog" aria-modal="true"
        aria-label={title} tabIndex={-1}>
        <header className={styles.drawerHead}>
          <h2>{title}</h2>
          <button type="button" className="ghost sm" onClick={onClose} aria-label="סגירה">סגירה</button>
        </header>
        <div className={styles.drawerBody}>{children}</div>
      </aside>
    </>
  );
}
