import type { ReactNode } from 'react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';

interface EmptyStateProps {
  icon: IconSvgElement;
  title: string;
  text?: string;
  actions?: ReactNode;
}

export function EmptyState({ icon, title, text, actions }: EmptyStateProps) {
  return (
    <section className="hud empty">
      <span className="empty-icon">
        <HugeiconsIcon icon={icon} size={26} />
      </span>
      <h3>{title}</h3>
      {text ? <p>{text}</p> : null}
      {actions ? <div className="page-actions">{actions}</div> : null}
    </section>
  );
}
