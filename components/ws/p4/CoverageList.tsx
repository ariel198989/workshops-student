import type { ClassCoverage } from '@/lib/ws/types';
import styles from './board.module.css';

interface CoverageListProps {
  offTarget: readonly ClassCoverage[];
}

/** Classes that appear in the data but are not targets (typos, scope creep) as amber chips. */
export function CoverageList({ offTarget }: CoverageListProps) {
  if (offTarget.length === 0) return null;
  return (
    <div className={styles.off} aria-label="מחלקות מחוץ ליעד">
      {offTarget.map((c) => (
        <span key={c.name} className={styles.offChip} title="המחלקה הזאת לא ברשימת היעד של הקבוצה">
          {c.name} <small>{c.tagged}</small> <small>לא ביעד</small>
        </span>
      ))}
    </div>
  );
}
