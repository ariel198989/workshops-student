import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { Certificate01Icon, ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import h from './home.module.css';

export function CertificateTeaser() {
  return (
    <Link href="/student/certificate" className={h.cert}>
      <HugeiconsIcon icon={Certificate01Icon} size={30} />
      <span style={{ flex: 1 }}>
        <b>התעודה שלכם מוכנה</b>
        <span>לצפייה, הדפסה ושמירה</span>
      </span>
      <HugeiconsIcon icon={ArrowLeft01Icon} size={22} />
    </Link>
  );
}
