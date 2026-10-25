'use client';
import { useParams } from 'next/navigation';
import { Target02Icon } from '@hugeicons/core-free-icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { NewProblemForm } from '@/components/ws/p5/NewProblemForm';
import { ProblemCard } from '@/components/ws/p5/ProblemCard';
import { SubproblemEditor } from '@/components/ws/p5/SubproblemEditor';
import { useLoad } from '@/components/ws/p5/useLoad';
import { usePerm } from '@/components/ws/p5/usePerm';
import { hebrewDbError } from '@/components/ws/p5/validation';
import styles from '@/components/ws/p5/p5.module.css';
import { toast } from '@/lib/store';
import { listGroups } from '@/lib/ws/groups';
import { listProblems, listSubproblems, saveSubproblem } from '@/lib/ws/workshops';

export default function ProblemsPage() {
  const { id } = useParams<{ id: string }>();
  const { editable } = usePerm(id);
  const { data, error, loading, reload } = useLoad(
    () => Promise.all([listProblems(id), listSubproblems(id), listGroups(id)]), [id],
  );

  if (loading && !data) return <div className={styles.center}><Spinner large /></div>;
  if (error || !data) return <p className="err" role="alert">{error ?? 'הטעינה נכשלה'}</p>;

  const [problems, subs, groups] = data;
  const primary = problems.find((p) => p.is_primary) ?? problems[0];

  if (!primary) {
    return editable ? <NewProblemForm workshopId={id} onCreated={reload} /> : (
      <EmptyState icon={Target02Icon} title="אין עדיין בעיית-על" text="מדריך הסדנה יגדיר אותה כאן." />
    );
  }

  const mine = subs.filter((s) => s.problem_id === primary.id);
  const addSub = async () => {
    try {
      const position = mine.reduce((max, s) => Math.max(max, s.position), 0) + 1;
      await saveSubproblem({
        workshop_id: id, problem_id: primary.id, position, title: `תת-בעיה ${position}`, task_type: 'detect',
      });
      reload();
    } catch (err) {
      toast(`יצירת תת-בעיה נכשלה: ${hebrewDbError(err)}`);
    }
  };

  return (
    <div className={styles.page}>
      <ProblemCard problem={primary} editable={editable} onChanged={reload} />
      <div className={styles.sectionHead}>
        <h2>תת-בעיות</h2>
        {editable ? <button type="button" className="primary" onClick={() => void addSub()}>תת-בעיה חדשה</button> : null}
      </div>
      {mine.length === 0 ? (
        <EmptyState icon={Target02Icon} title="אין עדיין תת-בעיות"
          text="פרקו את בעיית-העל למשימות, אחת לכל קבוצה." />
      ) : mine.map((s) => (
        <SubproblemEditor key={s.id} sub={s} groups={groups} editable={editable} onChanged={reload} />
      ))}
    </div>
  );
}
