'use client';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, Quiz01Icon } from '@hugeicons/core-free-icons';
import type { ConceptCheck } from '@/lib/student/concept';
import k from '@/components/student/shell/kit.module.css';
import c from './check.module.css';

const questionsLabel = (n: number): string => (n === 1 ? 'שאלה אחת' : `${n} שאלות`);

/** The workshop's concept checks, one tap each. The facilitator says which one, and whether it is before or after. */
export function CheckList({ checks, onOpen }: { checks: ConceptCheck[]; onOpen: (check: ConceptCheck) => void }) {
  return (
    <div className={k.stack}>
      <h1 className={k.h1}>בדיקת מושגים</h1>
      <p className={k.lead}>כמה שאלות קצרות, בלי שם ובלי ציון. המדריך אומר מתי לענות: לפני הפעילות או אחריה.</p>
      <ul className={c.list}>
        {checks.map((check) => (
          <li key={check.session_module_id}>
            <button type="button" className={c.item} onClick={() => onOpen(check)}>
              <span className={c.itemIcon}><HugeiconsIcon icon={Quiz01Icon} size={26} /></span>
              <span className={c.itemText}>
                <span className={c.itemTitle}>{check.module_title}</span>
                <span className={c.itemMeta}>{questionsLabel(check.questions.length)}</span>
              </span>
              <HugeiconsIcon icon={ArrowLeft01Icon} size={22} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
