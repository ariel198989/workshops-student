import { HugeiconsIcon } from '@hugeicons/react';
import { UserGroupIcon } from '@hugeicons/core-free-icons';
import type { StudentContext } from '@/lib/student/context';
import k from './kit.module.css';
import h from './home.module.css';

/** Teammates with their roles; the signed-in student is marked. */
export function TeamCard({ ctx }: { ctx: StudentContext }) {
  const { teammates, me } = ctx;
  return (
    <section className={k.card}>
      <div className={k.cardHead}><HugeiconsIcon icon={UserGroupIcon} size={18} />הצוות</div>
      {teammates.length === 0 ? (
        <p className={k.small}>עוד אין חברים בקבוצה. אפשר לבקש מחברים להצטרף עם אותו קוד.</p>
      ) : (
        <div>
          {teammates.map((t, i) => (
            <div key={`${t.full_name}-${i}`} className={h.person}>
              <span className={h.avatar} aria-hidden="true">{t.full_name.charAt(0)}</span>
              <span className={h.personName}>
                {t.full_name}{t.full_name === me.full_name ? <> <span className={h.me}>(אני)</span></> : null}
              </span>
              <span className={k.chips}>
                {t.roles.map((r) => <span key={r} className={`${k.chip} ${k.chipMuted}`}>{r}</span>)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
