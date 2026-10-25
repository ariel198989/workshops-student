import { sb } from '../db';
import type { FieldEntity, OrgKind, OrgStatus, WsContact, WsFieldDefinition, WsOrganization } from './types';

export interface OrgFilter { status?: OrgStatus; kind?: OrgKind; q?: string }
export type OrgInput = Pick<WsOrganization, 'name' | 'kind' | 'city' | 'website' | 'notes' | 'custom_fields'>;
export type OrgPatch = Partial<Omit<WsOrganization, 'id' | 'created_by' | 'created_at' | 'updated_at'>>;
export type OrgWithContacts = WsOrganization & { contacts: WsContact[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listOrganizations(filter: OrgFilter = {}): Promise<WsOrganization[]> {
  let q = sb.from('ws_organizations').select('*').order('name');
  if (filter.status) q = q.eq('status', filter.status);
  if (filter.kind) q = q.eq('kind', filter.kind);
  const term = filter.q?.replace(/[%_\\,()]/g, ' ').trim();
  if (term) q = q.ilike('name', `%${term}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data as WsOrganization[];
}

export async function getOrganization(id: string): Promise<OrgWithContacts> {
  const { data, error } = await sb.from('ws_organizations').select('*, contacts:ws_contacts(*)').eq('id', id).single();
  if (error) throw error;
  return data as OrgWithContacts;
}

export async function createOrganization(input: Partial<OrgInput> & Pick<OrgInput, 'name'>): Promise<WsOrganization> {
  const { data, error } = await sb.from('ws_organizations').insert(input).select().single();
  if (error) throw error;
  return data as WsOrganization;
}

export async function updateOrganization(id: string, patch: OrgPatch): Promise<WsOrganization> {
  const { data, error } = await sb.from('ws_organizations').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as WsOrganization;
}

export async function upsertContact(input: Partial<WsContact> & { organization_id: string }): Promise<WsContact> {
  const { data, error } = await sb.from('ws_contacts').upsert(input).select().single();
  if (error) throw error;
  return data as WsContact;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await sb.from('ws_contacts').delete().eq('id', id);
  if (error) throw error;
}

// global definitions plus, when given, the organization's own
export async function listFieldDefinitions(entity: FieldEntity, organizationId?: string): Promise<WsFieldDefinition[]> {
  let q = sb.from('ws_field_definitions').select('*').eq('entity', entity).eq('is_archived', false).order('position');
  if (organizationId) {
    if (!UUID.test(organizationId)) throw new Error('invalid organization id');
    q = q.or(`organization_id.is.null,organization_id.eq.${organizationId}`);
  } else {
    q = q.is('organization_id', null);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data as WsFieldDefinition[];
}

export type FieldDefinitionInput = Partial<WsFieldDefinition> & Pick<WsFieldDefinition, 'entity' | 'key' | 'label' | 'field_type'>;

export async function saveFieldDefinition(input: FieldDefinitionInput): Promise<WsFieldDefinition> {
  const { data, error } = await sb.from('ws_field_definitions').upsert(input).select().single();
  if (error) throw error;
  return data as WsFieldDefinition;
}

export async function archiveFieldDefinition(id: string): Promise<void> {
  const { error } = await sb.from('ws_field_definitions').update({ is_archived: true }).eq('id', id);
  if (error) throw error;
}
