import { HugeiconsIcon } from '@hugeicons/react';
import { Target01Icon } from '@hugeicons/core-free-icons';
import type { StudentContext } from '@/lib/student/context';
import { taskTypeLabel } from '@/lib/student/labels';
import k from './kit.module.css';
import h from './home.module.css';

const NO_TASK = 'המדריך עוד לא הגדיר משימה לקבוצה, אפשר כבר להתחיל לצלם';

/** The group's mission: the client problem, the sub-problem the group solves, what to detect, how success is judged. */
export function MissionCard({ ctx }: { ctx: StudentContext }) {
  const { problem, subproblem } = ctx;
  return (
    <section className={`${k.card} ${h.mission}`}>
      <div className={k.cardHead}><HugeiconsIcon icon={Target01Icon} size={18} />המשימה שלנו</div>
      {problem ? (
        <>
          <h2 className={k.h2}>{problem.title}</h2>
          {problem.client_name ? <p className={h.client}>הלקוח: {problem.client_name}</p> : null}
        </>
      ) : null}
      {subproblem ? (
        <div className={problem ? h.sub : undefined}>
          <div className={h.subRow}>
            <b className={k.h2}>{subproblem.title}</b>
            <span className={k.chip}>{taskTypeLabel(subproblem.task_type)}</span>
          </div>
          {subproblem.statement ? <p className={k.lead}>{subproblem.statement}</p> : null}
          {subproblem.target_classes.length > 0 ? (
            <div className={k.chips} style={{ marginTop: 10 }} aria-label="מה מחפשים">
              {subproblem.target_classes.map((c) => <span key={c} className={`${k.chip} ${k.chipMuted}`}>{c}</span>)}
            </div>
          ) : null}
          {subproblem.success_metric ? (
            <p className={h.metric}><b>מה נחשב הצלחה: </b>{subproblem.success_metric}</p>
          ) : null}
        </div>
      ) : (
        <p className={h.empty}>{NO_TASK}</p>
      )}
    </section>
  );
}
