'use client';
import Link from 'next/link';
import { modelVerdict, type Verdict } from '@/lib/cv/readiness';
import type { TeamModel } from '@/lib/cv/model';
import type { MetricMode } from '@/lib/student/caps';
import { formatMetric, showsNumbers } from '@/lib/student/metric';
import { MetricView } from './MetricView';
import s from './cv.module.css';
import r from './results.module.css';

const VERDICT_STYLE: Record<Verdict, string> = {
  unknown: r.verdictBasic, weak: r.verdictWeak, basic: r.verdictBasic, strong: r.verdictStrong,
};

function verdictText(v: Verdict, images: number | null, honest: boolean | null): string {
  switch (v) {
    case 'weak':
      return `מודל ניסיוני. הוא אומן על ${images} תמונות${honest === false ? ', בלי סט בדיקה אמיתי' : ''}. סביר שהוא שינן את התמונות ולא באמת הבין. כדי שיהיה אמין, צלמו את האובייקטים במגוון: זוויות, רקעים ותאורה שונים.`;
    case 'basic':
      return `מודל בסיסי: ${images} תמונות. הוא עובד על מקרים דומים למה שצילמתם, ועוד תמונות מגוונות ישפרו אותו הרבה.`;
    case 'strong':
      return `מודל חזק: ${images} תמונות ובדיקה על תמונות שהוא לא ראה באימון.`;
    default:
      return 'איכות המודל לא נמדדה.';
  }
}

/** The yes_no band sees no numbers at all, so the verdict is told in words only. */
function verdictWords(v: Verdict): string {
  switch (v) {
    case 'weak': return 'המודל עוד לומד. צלמו את האובייקטים מזוויות, רקעים ותאורה שונים, וזה יעזור לו.';
    case 'basic': return 'המודל מזהה מקרים שדומים למה שצילמתם. עוד תמונות מגוונות ישפרו אותו.';
    case 'strong': return 'מודל חזק: הוא נבחן על תמונות שלא ראה באימון.';
    default: return 'איכות המודל לא נמדדה.';
  }
}

function honestNote(honest: boolean | null): string {
  if (honest === true) return 'הציון נמדד על תמונות שהמודל לא ראה באימון, אז אפשר לסמוך עליו יותר.';
  if (honest === false) return 'הציון אופטימי: לא היה סט בדיקה נפרד, אז המודל נבחן על תמונות שהוא כבר ראה.';
  return 'לא ידוע אם הציון נמדד על תמונות חדשות.';
}

const EXPLAIN: Record<MetricMode, string> = {
  yes_no: 'האם המודל מוצא את האובייקט בתמונות שהוא לא ראה.',
  x_of_10: 'מתוך 10 תמונות חדשות, בכמה המודל מוצא את האובייקט ומסמן אותו נכון.',
  score_1_10: 'ציון מ-1 עד 10 על תמונות שהמודל לא ראה באימון.',
  model_score: 'ציון מ-1 עד 10: כמה מהאובייקטים המודל מוצא ומסמן נכון בתמונות חדשות.',
  map_pr: 'דיוק (mAP50): כמה מהאובייקטים המודל מוצא ומסמן נכון.',
};

/** The group's model, said honestly and in the band's language: a weak model is called weak and sent back to capture. */
export function ModelCard({ model, mode, canCapture }: { model: TeamModel; mode: MetricMode; canCapture: boolean }) {
  const view = formatMetric(mode, model);
  const verdict = modelVerdict(model.image_count, model.honest_val);
  const day = new Date(model.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
  const numbers = showsNumbers(mode);
  return (
    <div className={s.card}>
      <div className={s.cardHead}>המודל של הקבוצה · אומן ב-{day}</div>
      <MetricView view={view} />
      <p className={s.small} style={{ marginTop: 10 }}>
        {EXPLAIN[mode]} {numbers ? honestNote(model.honest_val) : ''}
      </p>
      <div className={r.meta} style={{ margin: '12px 0' }}>
        {(model.classes ?? []).map((c) => <span key={c} className={s.chip}>{c}</span>)}
      </div>
      <p className={`${s.note} ${VERDICT_STYLE[verdict]}`}>
        {numbers ? verdictText(verdict, model.image_count, model.honest_val) : verdictWords(verdict)}
      </p>
      {canCapture && (verdict === 'weak' || verdict === 'basic') ? (
        <Link href="/capture" className={`${s.btn} ${s.btnWarn}`} style={{ marginTop: 12 }}>צלמו עוד תמונות לשיפור</Link>
      ) : null}
    </div>
  );
}
