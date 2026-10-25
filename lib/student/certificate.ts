import { sb } from '../db';
import type { WsCertificate } from '../ws/types';

/**
 * The student's own certificate. RLS already limits students to their rows; the participant filter
 * keeps a staff member previewing this page from seeing somebody else's. Newest issued wins.
 */
export async function fetchMyCertificate(participantId: string): Promise<WsCertificate | null> {
  const { data, error } = await sb.from('ws_certificates')
    .select('*').eq('participant_id', participantId)
    .order('issued_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return (data as WsCertificate | null) ?? null;
}
