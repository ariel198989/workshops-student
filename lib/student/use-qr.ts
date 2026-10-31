'use client';
import { useEffect, useState } from 'react';
import { toDataURL } from 'qrcode';

const QR_PX = 256;

/** A PNG data URL of `text` as a QR, or null while rendering, when text is null, or when the library fails. */
export function useQrDataUrl(text: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!text) { setUrl(null); return; }
    let alive = true;
    toDataURL(text, { width: QR_PX, margin: 0, errorCorrectionLevel: 'M' })
      .then((u) => { if (alive) setUrl(u); })
      .catch(() => { if (alive) setUrl(null); });
    return () => { alive = false; };
  }, [text]);
  return url;
}
