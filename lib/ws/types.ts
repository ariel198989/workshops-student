// Row types mirror architecture.md section 3.2 column for column.
// Unions are declared from const arrays so labels/tests can iterate every value.

export const WORKSHOP_STATUSES = ['draft', 'proposal', 'confirmed', 'live', 'completed', 'archived', 'cancelled'] as const;
export const SESSION_STATUSES = ['planned', 'scheduled', 'live', 'done', 'cancelled', 'postponed'] as const;
export const GROUP_STATUSES = ['forming', 'active', 'done'] as const;
export const DELIVERABLE_STATUSES = ['in_progress', 'submitted', 'approved', 'returned'] as const;
export const CERTIFICATE_STATUSES = ['issued', 'revoked'] as const;
export const ORG_STATUSES = ['lead', 'active', 'paused', 'archived'] as const;
export const MODULE_RUN_STATUSES = ['pending', 'done', 'partial', 'skipped'] as const;
export const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'excused'] as const;
export const PARTICIPANT_STATUSES = ['invited', 'active', 'withdrawn'] as const;
export const PROBLEM_STATUSES = ['draft', 'presented', 'decomposed', 'solved'] as const;
export const TASK_TYPES = ['detect', 'classify', 'count', 'other'] as const;
export const WORKSHOP_FORMATS = ['sessions', 'hackathon', 'custom'] as const;
export const STAFF_ROLES = ['owner', 'admin', 'instructor', 'guest'] as const;
export const WORKSHOP_ROLES = ['lead', 'instructor', 'assistant', 'observer'] as const;

export type WorkshopStatus = (typeof WORKSHOP_STATUSES)[number];
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export type GroupStatus = (typeof GROUP_STATUSES)[number];
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];
export type OrgStatus = (typeof ORG_STATUSES)[number];
export type ModuleRunStatus = (typeof MODULE_RUN_STATUSES)[number];
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];
export type ProblemStatus = (typeof PROBLEM_STATUSES)[number];
export type TaskType = (typeof TASK_TYPES)[number];
export type WorkshopFormat = (typeof WORKSHOP_FORMATS)[number];
export type StaffRole = (typeof STAFF_ROLES)[number];
export type WorkshopRole = (typeof WORKSHOP_ROLES)[number];

export type OrgKind = 'school' | 'company' | 'municipality' | 'ngo' | 'other';
export type ModuleType = 'theory' | 'practice' | 'demo' | 'mixed';
export type SessionKind = 'regular' | 'practical' | 'hackathon' | 'demo_day' | 'other';
export type DemoResult = 'pass' | 'partial' | 'fail';
export type FieldEntity = 'organization' | 'workshop' | 'group' | 'participant';
export type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect' | 'url';
export type DeviceMode = 'own_phones' | 'tablets_addon' | 'mixed';
export type Sector = 'education' | 'municipal' | 'industry' | 'ngo' | 'other';
export type Readiness = 'no_targets' | 'red' | 'ok' | 'strong';

export type JsonObject = Record<string, unknown>;
type Stamped = { created_at: string; updated_at: string };

export interface WsStaff extends Stamped {
  user_id: string; email: string; full_name: string; phone: string | null; role: StaffRole; active: boolean;
}
export interface WsOrganization extends Stamped {
  id: string; name: string; kind: OrgKind; city: string | null; address: string | null;
  external_ref: string | null; website: string | null; status: OrgStatus; notes: string | null;
  custom_fields: JsonObject; created_by: string | null;
}
export interface WsContact extends Stamped {
  id: string; organization_id: string; full_name: string; role_title: string | null;
  email: string | null; phone: string | null; is_primary: boolean; notes: string | null;
}
export interface WsFieldDefinition {
  id: string; entity: FieldEntity; organization_id: string | null; key: string; label: string;
  field_type: FieldType; options: unknown[]; required: boolean; position: number;
  is_archived: boolean; created_at: string;
}
export interface WsModule extends Stamped {
  id: string; slug: string | null; title: string; summary: string | null; module_type: ModuleType;
  pipeline_stage: string | null; duration_minutes: number; objectives: string[];
  exercises: JsonObject[]; materials: JsonObject[]; facilitator_notes: string | null; tags: string[];
  requires_app: boolean; version: number; parent_module_id: string | null; is_archived: boolean;
  created_by: string | null;
}
export interface WsCurriculumTemplate extends Stamped {
  id: string; slug: string | null; title: string; description: string | null; format: WorkshopFormat;
  default_group_size: number; is_default: boolean; is_archived: boolean;
  parent_template_id: string | null; created_by: string | null;
}
export interface WsTemplateModule {
  id: string; template_id: string; module_id: string; session_no: number; position: number;
  session_title: string | null; session_kind: SessionKind | null; duration_override: number | null;
  notes: string | null; created_at: string;
}
export interface WsWorkshop extends Stamped {
  id: string; organization_id: string; code: string; team_prefix: string; title: string;
  format: WorkshopFormat; template_id: string | null; status: WorkshopStatus;
  starts_on: string | null; ends_on: string | null; timezone: string; sector: Sector;
  grade_level: string | null; class_label: string | null; homeroom_teacher: string | null;
  audience_size: number | null; group_size: number; location: string | null; device_mode: DeviceMode;
  tablets_count: number | null; sc_campaign_id: string | null; custom_fields: JsonObject;
  notes: string | null; created_by: string | null;
}
export interface WsWorkshopStaff { workshop_id: string; user_id: string; role: WorkshopRole; created_at: string }
export interface WsSession extends Stamped {
  id: string; workshop_id: string; session_no: number; title: string; kind: SessionKind;
  scheduled_at: string | null; duration_minutes: number; location: string | null;
  status: SessionStatus; started_at: string | null; ended_at: string | null;
  lead_user_id: string | null; facilitator_log: string | null; recap: string | null;
  attendance_taken: boolean;
}
export interface WsSessionModule extends Stamped {
  id: string; session_id: string; workshop_id: string; module_id: string | null;
  module_version: number | null; position: number; title: string; module_type: ModuleType;
  duration_minutes: number; pipeline_stage: string | null; content: JsonObject;
  status: ModuleRunStatus; notes: string | null;
}
export interface WsProblem extends Stamped {
  id: string; workshop_id: string; client_org_id: string | null; client_name: string | null;
  client_contact: string | null; title: string; statement: string; context: string | null;
  success_criteria: string | null; media: unknown[]; is_primary: boolean; status: ProblemStatus;
  presented_session_id: string | null; solution_notes: string | null; solution_model_id: string | null;
}
export interface WsSubproblem extends Stamped {
  id: string; workshop_id: string; problem_id: string; position: number; title: string;
  statement: string | null; task_type: TaskType; target_classes: string[];
  success_metric: string | null; target_accuracy: number | null; data_plan: string | null;
  notes: string | null;
}
export interface WsGroup extends Stamped {
  id: string; workshop_id: string; number: number; display_name: string | null; team_name: string;
  sc_class_id: string | null; subproblem_id: string | null; capacity: number | null;
  color: string | null; status: GroupStatus; activated_at: string | null; notes: string | null;
}
export interface WsParticipant extends Stamped {
  id: string; workshop_id: string; group_id: string | null; user_id: string | null; full_name: string;
  grade: string | null; roles: string[]; status: ParticipantStatus;
  source: 'roster' | 'signup' | 'manual'; media_consent: boolean | null; joined_at: string | null;
  notes: string | null; custom_fields: JsonObject;
}
export interface WsAttendance {
  session_id: string; participant_id: string; workshop_id: string; status: AttendanceStatus;
  arrived_at: string | null; note: string | null; marked_by: string | null; marked_at: string;
}
export interface WsDeliverable extends Stamped {
  id: string; workshop_id: string; group_id: string; model_id: string | null;
  training_job_id: string | null; dataset_snapshot: JsonObject | null; model_snapshot: JsonObject | null;
  presentation_url: string | null; presentation_path: string | null; demo_result: DemoResult | null;
  demo_score: number | null; demo_notes: string | null; failure_cases: unknown[]; extras: JsonObject;
  status: DeliverableStatus; submitted_at: string | null; locked_at: string | null;
  reviewed_by: string | null; reviewed_at: string | null;
}
export interface WsCertificate {
  id: string; workshop_id: string; participant_id: string; certificate_no: string; verify_code: string;
  recipient_name: string; group_name: string | null; data: JsonObject; status: CertificateStatus;
  issued_at: string; issued_by: string | null; pdf_path: string | null; revoked_at: string | null;
  revoke_reason: string | null;
}
export interface WsEvent {
  id: number; workshop_id: string | null; actor: string | null; action: string; entity: string | null;
  entity_id: string | null; payload: JsonObject; created_at: string;
}

// Insert/patch shapes follow the column-level grants in section 3.7.
export type WorkshopInsert = Pick<WsWorkshop, 'organization_id' | 'code' | 'team_prefix' | 'title'> &
  Partial<Pick<WsWorkshop, 'format' | 'template_id' | 'starts_on' | 'ends_on' | 'timezone' | 'sector'
    | 'grade_level' | 'class_label' | 'homeroom_teacher' | 'audience_size' | 'group_size' | 'location'
    | 'device_mode' | 'tablets_count' | 'sc_campaign_id' | 'custom_fields' | 'notes'>>;
export type WorkshopPatch = Partial<WorkshopInsert>;
export type GroupPatch = Partial<Pick<WsGroup, 'display_name' | 'subproblem_id' | 'capacity' | 'color' | 'notes' | 'status'>>;
export type ParticipantPatch = Partial<Pick<WsParticipant, 'full_name' | 'grade' | 'roles' | 'status'
  | 'media_consent' | 'joined_at' | 'notes' | 'custom_fields'>>;
export type DeliverablePatch = Partial<Pick<WsDeliverable, 'demo_result' | 'demo_score' | 'demo_notes' | 'status' | 'extras'>>;

// RPC result shapes (architecture.md section 3.6)
export interface Whoami {
  user_id: string | null;
  staff: { role: StaffRole; full_name: string } | null;
  workshops: { workshop_id: string; role: WorkshopRole }[];
  participations: { workshop_id: string; participant_id: string; group_id: string | null }[];
}
export interface ClassCoverage { name: string; tagged: number }
export interface OverviewGroup {
  group_id: string; number: number; display_name: string | null; team_name: string;
  status: GroupStatus; activated: boolean;
  subproblem: { id: string; title: string; task_type: TaskType; target_classes: string[]; target_accuracy: number | null } | null;
  members: number; linked_accounts: number; photos: number; tagged: number; untagged: number;
  today: number; contributors: number; last_photo_at: string | null;
  coverage: ClassCoverage[]; off_target_classes: ClassCoverage[]; readiness: Readiness;
  jobs: { pending: number; running: number; done: number; last: JsonObject | null };
  model: { id: string; name: string; accuracy: number | null; approved: boolean; scope: string;
    image_count: number | null; honest_val: boolean | null; class_stats: unknown; personal: boolean;
    created_at: string } | null;
  models_count: number; attendance_rate: number | null;
  deliverable: { status: DeliverableStatus; final_model_id: string | null; presentation_url: string | null;
    demo_result: DemoResult | null; demo_score: number | null; locked: boolean } | null;
}
export interface Overview {
  workshop: { id: string; title: string; code: string; status: WorkshopStatus; format: WorkshopFormat;
    starts_on: string | null; ends_on: string | null; group_size: number; organization: string };
  generated_at: string;
  groups: OverviewGroup[];
  totals: { groups: number; members: number; photos: number; tagged: number; groups_with_model: number };
  unassigned_participants: number;
  sessions: { id: string; session_no: number; title: string; status: SessionStatus; scheduled_at: string | null }[];
}
export interface DriftEntry { participant_id: string; full_name: string; expected_team: string; app_team: string | null }
export interface ReconcileResult { added: number; drift: DriftEntry[] }
export type SkipReason = 'already_issued' | 'attendance' | 'deliverable';
export interface IssueResult {
  issued: number;
  skipped: { participant_id: string; full_name: string; reason: SkipReason; attendance: number }[];
}
export interface VerifyResult {
  valid: boolean; certificate_no: string; recipient: string; workshop: string | null;
  organization: string | null; issued_at: string;
}
export interface MyContext {
  workshop: { id: string; title: string; format: WorkshopFormat; starts_on: string | null; ends_on: string | null; status: WorkshopStatus };
  me: { participant_id: string; full_name: string; roles: string[] };
  group: { id: string; number: number; display_name: string | null; team_name: string } | null;
  teammates: { full_name: string; roles: string[] }[];
  problem: { title: string; statement: string; client_name: string | null } | null;
  subproblem: { title: string; statement: string | null; task_type: TaskType; target_classes: string[]; success_metric: string | null } | null;
  sessions: { session_no: number; title: string; kind: SessionKind; scheduled_at: string | null; status: SessionStatus }[];
  progress: OverviewGroup | null;
  certificate: { certificate_no: string; issued_at: string; pdf_path: string | null; status: CertificateStatus } | null;
}
