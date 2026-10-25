// The slice of the shared ws_* schema the student app reads. The database is owned by the
// workshops-os console repo; these shapes mirror its RPC and row results.

export const CERTIFICATE_STATUSES = ['issued', 'revoked'] as const;
export const STAFF_ROLES = ['owner', 'admin', 'instructor', 'guest'] as const;
export const WORKSHOP_ROLES = ['lead', 'instructor', 'assistant', 'observer'] as const;
export const WORKSHOP_FORMATS = ['sessions', 'hackathon', 'custom'] as const;

export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];
export type StaffRole = (typeof STAFF_ROLES)[number];
export type WorkshopRole = (typeof WORKSHOP_ROLES)[number];
export type WorkshopFormat = (typeof WORKSHOP_FORMATS)[number];

export type JsonObject = Record<string, unknown>;

export interface WsCertificate {
  id: string; workshop_id: string; participant_id: string; certificate_no: string; verify_code: string;
  recipient_name: string; group_name: string | null; data: JsonObject; status: CertificateStatus;
  issued_at: string; issued_by: string | null; pdf_path: string | null; revoked_at: string | null;
  revoke_reason: string | null;
}

/** ws_whoami(): staff is null for everyone who is not active staff. */
export interface Whoami {
  user_id: string | null;
  staff: { role: StaffRole; full_name: string } | null;
  workshops: { workshop_id: string; role: WorkshopRole }[];
  participations: { workshop_id: string; participant_id: string; group_id: string | null }[];
}

/** ws_verify_certificate(code), callable by anon. */
export interface VerifyResult {
  valid: boolean; certificate_no: string; recipient: string; workshop: string | null;
  organization: string | null; issued_at: string;
}
