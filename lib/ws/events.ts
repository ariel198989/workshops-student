import { sb } from '../db';
import { labelOf } from './labels';
import type { WsEvent } from './types';

export async function listEvents(workshopId: string, limit = 50): Promise<WsEvent[]> {
  const { data, error } = await sb.from('ws_events').select('*')
    .eq('workshop_id', workshopId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data as WsEvent[];
}

const text = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');

type Describe = (p: WsEvent['payload']) => string;

// one entry per `action` written by the ws_* RPCs
const DESCRIBE: Record<string, Describe> = {
  'workshop.status': (p) => `סטטוס הסדנה שונה: ${labelOf('workshop', text(p.from))} ← ${labelOf('workshop', text(p.to))}`,
  'group.activated': (p) => `קבוצה הופעלה${text(p.team_name) ? `: ${text(p.team_name)}` : ''}`,
  'participant.linked': () => 'משתתף קושר לחשבון',
  'participant.moved': (p) => `משתתף הועבר${text(p.from) ? ` מ-${text(p.from)}` : ''}${text(p.to) ? ` ל-${text(p.to)}` : ''}`,
  'curriculum.instantiated': (p) => `נטענה תבנית: ${text(p.sessions)} מפגשים`,
  'deliverable.locked': () => 'תוצר נעול ואושר',
  'certificates.issued': (p) => `הונפקו ${text(p.issued)} תעודות, דולגו ${text(p.skipped)}`,
  'certificate.revoked': (p) => `תעודה בוטלה${text(p.reason) ? `: ${text(p.reason)}` : ''}`,
};

export function eventLabel(e: WsEvent): string {
  const describe = Object.hasOwn(DESCRIBE, e.action) ? DESCRIBE[e.action] : undefined;
  return describe ? describe(e.payload) : e.action;
}
