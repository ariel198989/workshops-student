'use client';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Certificate01Icon } from '@hugeicons/core-free-icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Drawer } from '@/components/ws/Drawer';
import { CertificatePreview } from '@/components/ws/p5/CertificatePreview';
import { demoScoreFor, loadCertificatesData } from '@/components/ws/p5/certs-data';
import { EligibilityPanel } from '@/components/ws/p5/EligibilityPanel';
import { IssueResultTable } from '@/components/ws/p5/IssueResultTable';
import { IssuedList } from '@/components/ws/p5/IssuedList';
import { PrintHost } from '@/components/ws/p5/PrintHost';
import { useLoad } from '@/components/ws/p5/useLoad';
import { usePerm } from '@/components/ws/p5/usePerm';
import styles from '@/components/ws/p5/p5.module.css';
import { buildCertificateModel, pickVariant, type CertificateModel } from '@/lib/ws/certificate-templates';
import type { CertificateVariant } from '@/lib/ws/certificates';
import type { IssueResult, WsCertificate } from '@/lib/ws/types';

export default function CertificatesPage() {
  const { id } = useParams<{ id: string }>();
  const { editable, admin } = usePerm(id);
  const { data, error, loading, reload } = useLoad(() => loadCertificatesData(id), [id]);
  const [chosen, setChosen] = useState<Record<string, CertificateVariant>>({});
  const [result, setResult] = useState<IssueResult | null>(null);
  const [preview, setPreview] = useState<CertificateModel | null>(null);
  const [printing, setPrinting] = useState<CertificateModel[] | null>(null);

  const suggested = useMemo(() => {
    const out: Record<string, CertificateVariant> = {};
    for (const c of data?.certificates ?? []) {
      out[c.id] = pickVariant({
        format: data!.head.format, demoScore: demoScoreFor(data!, c.participant_id), stored: c.data.variant,
      });
    }
    return out;
  }, [data]);

  if (loading && !data) return <div className={styles.center}><Spinner large /></div>;
  if (error || !data) return <p className="err" role="alert">{error ?? 'הטעינה נכשלה'}</p>;

  const variants = { ...suggested, ...chosen };
  const model = (c: WsCertificate): CertificateModel =>
    buildCertificateModel(c, variants[c.id] ?? 'standard', window.location.origin);
  const active = data.certificates.filter((c) => c.status === 'issued');

  return (
    <div className={styles.page}>
      <EligibilityPanel workshopId={id} data={data} editable={editable}
        onIssued={(r) => { setResult(r); reload(); }} />
      {result ? <IssueResultTable result={result} onClose={() => setResult(null)} /> : null}
      <div className={styles.sectionHead}>
        <h2>תעודות שהונפקו</h2>
        <button type="button" className="primary" disabled={active.length === 0}
          onClick={() => setPrinting(active.map(model))}>
          הדפס את כולם
        </button>
      </div>
      {data.certificates.length === 0 ? (
        <EmptyState icon={Certificate01Icon} title="עדיין לא הונפקו תעודות"
          text="קבעו סף נוכחות והנפיקו תעודות למשתתפים הזכאים." />
      ) : (
        <IssuedList certificates={data.certificates} variants={variants} suggested={suggested} admin={admin}
          onVariant={(cid, v) => setChosen({ ...chosen, [cid]: v })}
          onPreview={(c) => setPreview(model(c))} onPrint={(c) => setPrinting([model(c)])} onRevoked={reload} />
      )}
      <Drawer open={preview !== null} title="תצוגת תעודה" width="860px" onClose={() => setPreview(null)}>
        {preview ? (
          <div className="stack">
            <CertificatePreview model={preview} zoom={0.68} />
            <button type="button" className="primary" onClick={() => { setPrinting([preview]); setPreview(null); }}>
              הדפסה / שמירה כ-PDF
            </button>
          </div>
        ) : null}
      </Drawer>
      {printing ? <PrintHost models={printing} onDone={() => setPrinting(null)} /> : null}
    </div>
  );
}
