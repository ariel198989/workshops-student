'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Certificate01Icon, PrinterIcon, Link01Icon } from '@hugeicons/core-free-icons';
import { Spinner } from '@/components/ui/Spinner';
import { CertificatePreview } from '@/components/student/certificate/CertificatePreview';
import { PrintHost } from '@/components/student/certificate/PrintHost';
import { fetchMyCertificate } from '@/lib/student/certificate';
import { useStudentContext } from '@/lib/student/context';
import { certificateVariantFor } from '@/lib/student/labels';
import { buildCertificateModel } from '@/lib/ws/certificate-templates';
import type { WsCertificate } from '@/lib/ws/types';
import k from './kit.module.css';
import c from './certificate-view.module.css';

const SHEET_PX = 1123; // A4 landscape (297mm) at 96dpi

type Load = { state: 'loading' } | { state: 'error' } | { state: 'done'; cert: WsCertificate | null };

/** Scales the fixed-size A4 sheet down to the width of the phone column. */
function useFitZoom() {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.3);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setZoom(Math.min(1, el.clientWidth / SHEET_PX));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, zoom };
}

function Empty() {
  return (
    <div className={`${k.card} ${k.center} ${k.stack}`}>
      <span className={c.emptyIcon}><HugeiconsIcon icon={Certificate01Icon} size={30} /></span>
      <h1 className={k.h2}>התעודה תופיע כאן בסיום הסדנה</h1>
      <p className={k.lead}>ממשיכים לצלם, לתייג ולאמן, והמדריך יפיק את התעודה.</p>
      <Link href="/" className={`${k.btn} ${k.btnPrimary}`}>חזרה לבית</Link>
    </div>
  );
}

export function CertificateView() {
  const { ctx, loaded } = useStudentContext();
  const participantId = ctx?.me.participant_id;
  const format = ctx?.workshop.format ?? '';
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [printing, setPrinting] = useState(false);
  const { ref, zoom } = useFitZoom();

  useEffect(() => {
    if (!loaded) return;
    if (!participantId) { setLoad({ state: 'done', cert: null }); return; }
    let current = true;
    fetchMyCertificate(participantId)
      .then((cert) => { if (current) setLoad({ state: 'done', cert }); })
      .catch(() => { if (current) setLoad({ state: 'error' }); });
    return () => { current = false; };
  }, [loaded, participantId]);

  const cert = load.state === 'done' ? load.cert : null;
  const model = useMemo(
    () => (cert ? buildCertificateModel(cert, certificateVariantFor(format), window.location.origin) : null),
    [cert, format],
  );

  if (load.state === 'loading') return <div className={k.spin}><Spinner large /></div>;
  if (load.state === 'error') {
    return <p className={k.error} role="alert">לא הצלחנו לטעון את התעודה. נסו לרענן את הדף</p>;
  }
  if (!cert || !model) return <Empty />;

  return (
    <div className={k.stack}>
      <h1 className={k.h1}>התעודה שלי</h1>
      <div ref={ref} className={c.frame} aria-label="תצוגה מקדימה של התעודה">
        <CertificatePreview model={model} zoom={zoom} />
      </div>
      <button type="button" className={`${k.btn} ${k.btnPrimary}`} onClick={() => setPrinting(true)}>
        <HugeiconsIcon icon={PrinterIcon} size={22} />הדפסה או שמירה כ-PDF
      </button>
      <Link href={`/verify/${encodeURIComponent(cert.verify_code)}`} className={k.btn}>
        <HugeiconsIcon icon={Link01Icon} size={22} />דף האימות של התעודה
      </Link>
      <p className={`${k.small} ${k.center}`}>
        מספר תעודה <span dir="ltr">{cert.certificate_no}</span>. בחלון ההדפסה בוחרים ״שמירה כ-PDF״.
      </p>
      {printing ? <PrintHost models={[model]} onDone={() => setPrinting(false)} /> : null}
    </div>
  );
}
