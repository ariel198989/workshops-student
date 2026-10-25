'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CertificateModel } from '@/lib/ws/certificate-templates';
import { CertificatePreview } from './CertificatePreview';

// Everything except the print root is hidden while printing; one certificate per A4 landscape page.
const PRINT_CSS = `
.p5-print-root{display:none}
@media print{
  @page{size:A4 landscape;margin:0}
  html,body{margin:0!important;padding:0!important;background:#fff!important;overflow:visible!important}
  body > *:not(.p5-print-root){display:none!important}
  .p5-print-root{display:block}
  .p5-print-page{width:297mm;height:210mm;overflow:hidden;break-after:page;page-break-after:always}
  .p5-print-page:last-child{break-after:auto;page-break-after:auto}
}`;

interface PrintHostProps {
  models: readonly CertificateModel[];
  onDone: () => void;
}

/** Mount to print: renders the certificates into document.body, opens the print dialog, unmounts after. */
export function PrintHost({ models, onDone }: PrintHostProps) {
  useEffect(() => {
    let cancelled = false;
    const finish = () => { if (!cancelled) onDone(); };
    window.addEventListener('afterprint', finish);
    const ready = document.fonts ? document.fonts.ready : Promise.resolve();
    void ready.then(() => {
      if (!cancelled) requestAnimationFrame(() => { if (!cancelled) window.print(); });
    });
    return () => {
      cancelled = true;
      window.removeEventListener('afterprint', finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="p5-print-root">
      <style>{PRINT_CSS}</style>
      {models.map((m) => (
        <div key={m.id} className="p5-print-page"><CertificatePreview model={m} /></div>
      ))}
    </div>,
    document.body,
  );
}
