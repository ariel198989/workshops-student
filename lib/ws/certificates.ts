import { sb } from '../db';
import type { VerifyResult } from './types';

// anon-callable; null = unknown / malformed code
export async function verifyCertificate(code: string): Promise<VerifyResult | null> {
  const { data, error } = await sb.rpc('ws_verify_certificate', { p_code: code });
  if (error) throw error;
  return (data as VerifyResult | null) ?? null;
}

export interface CertificateData { student: string; workshop: string; date: string; org: string }
export const CERTIFICATE_VARIANTS = ['standard', 'distinction', 'corporate'] as const;
export type CertificateVariant = (typeof CERTIFICATE_VARIANTS)[number];
