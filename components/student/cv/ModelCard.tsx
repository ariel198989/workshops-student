'use client';
import Link from 'next/link';
import { accuracyPercent, modelVerdict, type Verdict } from '@/lib/cv/readiness';
import type { TeamModel } from '@/lib/cv/model';
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

function honestNote(honest: boolean | null): string {
  if (honest === true) return 'הציון נמדד על תמונות שהמודל לא ראה באימון, אז אפשר לסמוך עליו יותר.';
  if (honest === false) return 'הציון אופטימי: לא היה סט בדיקה נפרד, אז המודל נבחן על תמונות שהוא כבר ראה.';
  return 'לא ידוע אם הציון נמדד על תמונות חדשות.';
}

/** The group's model, said honestly: a weak model is called weak and sent back to capture. */
export function ModelCard({ model }: { model: TeamModel }) {
  const pct = accuracyPercent(model.accuracy);
  const verdict = modelVerdict(model.image_count, model.honest_val);
  const day = new Date(model.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
  return (
    <div className={s.card}>
      <div className={s.cardHead}>המודל של הקבוצה · אומן ב-{day}</div>
      {pct !== null ? (
        <>
          <div className={s.bigNum}>{pct}<small>%</small></div>
          <div className={r.bar} aria-hidden><i style={{ inlineSize: `${Math.min(100, pct)}%` }} /></div>
          <p className={s.small}>דיוק (mAP50): כמה מהאובייקטים המודל מוצא ומסמן נכון. {honestNote(model.honest_val)}</p>
        </>
      ) : <p className={s.lead}>הדיוק לא נמדד במודל הזה.</p>}
      <div className={r.meta} style={{ margin: '12px 0' }}>
        {(model.classes ?? []).map((c) => <span key={c} className={s.chip}>{c}</span>)}
      </div>
      <p className={`${s.note} ${VERDICT_STYLE[verdict]}`}>{verdictText(verdict, model.image_count, model.honest_val)}</p>
      {verdict === 'weak' || verdict === 'basic' ? (
        <Link href="/capture" className={`${s.btn} ${s.btnWarn}`} style={{ marginTop: 12 }}>צלמו עוד תמונות לשיפור</Link>
      ) : null}
    </div>
  );
}
