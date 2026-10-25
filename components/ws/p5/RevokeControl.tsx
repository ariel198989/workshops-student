'use client';
import { useState } from 'react';
import { ConfirmButton } from '../ConfirmButton';
import { revokeCertificate } from '@/lib/ws/certificates';
import { hebrewDbError } from './validation';

interface RevokeControlProps {
  certificateId: string;
  onRevoked: () => void;
}

/** Admin only. A reason is required, then a two-step confirm. */
export function RevokeControl({ certificateId, onRevoked }: RevokeControlProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (!open) return <button type="button" className="danger sm" onClick={() => setOpen(true)}>ביטול תעודה</button>;
  return (
    <span className="row">
      <input type="text" value={reason} placeholder="סיבת הביטול" aria-label="סיבת הביטול" maxLength={200}
        onChange={(e) => setReason(e.target.value)} style={{ width: 180 }} />
      <ConfirmButton small tone="danger" label="בטלו" confirmText="לבטל את התעודה?" disabled={reason.trim() === ''}
        onConfirm={async () => {
          try {
            await revokeCertificate(certificateId, reason.trim());
          } catch (err) {
            throw new Error(hebrewDbError(err));
          }
          setOpen(false);
          onRevoked();
        }} />
      <button type="button" className="ghost sm" onClick={() => setOpen(false)}>סגירה</button>
    </span>
  );
}
