import type { CSSProperties } from 'react';
import { TAKE_HOME_QR_CAPTION } from '@/lib/student/share';
import type { CertificateModel } from '@/lib/ws/certificate-templates';
import styles from './certificate.module.css';

interface CertificatePreviewProps {
  model: CertificateModel;
  /** screen preview scale; print always renders at 1 */
  zoom?: number;
}

interface Detail { label: string; value: string }

function detailsOf(m: CertificateModel): Detail[] {
  const items: Array<Detail | null> = [
    m.datesRange ? { label: 'תאריכי הסדנה', value: m.datesRange } : null,
    m.hours ? { label: 'שעות לימוד', value: String(m.hours) } : null,
    m.groupName ? { label: 'קבוצה', value: m.groupName } : null,
    m.subproblem ? { label: 'משימה', value: m.subproblem } : null,
  ];
  return items.filter((d): d is Detail => d !== null);
}

/**
 * A4 landscape, print-ready certificate. The verify URL is printed as text; the take-home page (the group's
 * model on a family phone) is a 22 mm QR in the corner when the group has a share token.
 */
export function CertificatePreview({ model, zoom = 1 }: CertificatePreviewProps) {
  const style: CSSProperties | undefined = zoom === 1 ? undefined : { zoom };
  const details = detailsOf(model);
  return (
    <div className={styles.sheet} style={style} dir="rtl" lang="he">
      {model.share ? (
        <figure className={styles.share}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={model.share.qr} alt={`ברקוד לקישור ${model.share.url}`} className={styles.shareQr} />
          <figcaption className={styles.shareCaption}>{TAKE_HOME_QR_CAPTION}</figcaption>
        </figure>
      ) : null}
      <span className={styles.brand}>Corewise</span>
      <h1 className={styles.title}>{model.title}</h1>
      <p className={styles.intro}>{model.intro}</p>
      <p className={styles.student} dir="auto">{model.student}</p>
      <p className={styles.summary}>{model.summary}</p>
      <p className={styles.description}>{model.description}</p>
      {model.learned ? <p className={styles.learned}>{model.learned}</p> : null}
      {details.length > 0 ? (
        <div className={styles.details}>
          {details.map((d) => <span key={d.label}><b>{d.label}</b>{d.value}</span>)}
        </div>
      ) : null}
      <span className={styles.date}>{model.dateText}</span>
      <div className={styles.sigs}>
        {model.signatures.map((s) => <div key={s} className={styles.sig}>{s}</div>)}
      </div>
      <div className={styles.verify}>
        <span>מספר תעודה <span className={styles.no} dir="ltr">{model.certificateNo}</span></span>
        <span>אימות: <code dir="ltr">{model.verifyUrl}</code></span>
      </div>
      {model.revoked ? <div className={styles.revoked} aria-hidden="true">בוטלה</div> : null}
    </div>
  );
}
