'use client';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/store';
import { instantiateCurriculum, listTemplates } from '@/lib/ws/curriculum';
import { listOrganizations } from '@/lib/ws/orgs';
import type { DeviceMode, WorkshopFormat, WsCurriculumTemplate, WsOrganization } from '@/lib/ws/types';
import { createWorkshop } from '@/lib/ws/workshops';
import { dbErrorMessage } from './db-errors';
import { validateWorkshopForm } from './form-utils';
import { OrgPicker } from './OrgPicker';
import { DEVICE_OPTIONS, FORMAT_LABELS, FORMAT_OPTIONS } from './options';
import { TeamPrefixField } from './TeamPrefixField';
import { firstSessionIso, normalizeCode, pickDefaultTemplate, suggestCode } from './workshop-utils';
import styles from './p3.module.css';

interface FormState {
  orgId: string; title: string; code: string; codeTouched: boolean; prefix: string;
  format: WorkshopFormat; templateId: string | null; groupSize: string | null;
  startsOn: string; endsOn: string; grade: string; classLabel: string; audience: string;
  device: DeviceMode; location: string; notes: string;
}

const INITIAL: FormState = {
  orgId: '', title: '', code: '', codeTouched: false, prefix: '', format: 'sessions', templateId: null,
  groupSize: null, startsOn: '', endsOn: '', grade: '', classLabel: '', audience: '', device: 'own_phones',
  location: '', notes: '',
};

const FALLBACK_GROUP_SIZE = 4;
const orNull = (s: string): string | null => s.trim() || null;

function Field({ label, htmlFor, error, className, children }: {
  label: string; htmlFor?: string; error?: string; className?: string; children: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="lbl" htmlFor={htmlFor}>{label}</label>
      {children}
      {error === undefined ? null : <p className={styles.fieldErr} role={error ? 'alert' : undefined}>{error}</p>}
    </div>
  );
}

export function NewWorkshopForm() {
  const router = useRouter();
  const [f, setF] = useState<FormState>(INITIAL);
  const [orgs, setOrgs] = useState<WsOrganization[]>([]);
  const [templates, setTemplates] = useState<WsCurriculumTemplate[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get('org');
    listOrganizations().then((rows) => {
      setOrgs(rows);
      if (fromQuery && rows.some((o) => o.id === fromQuery)) set('orgId', fromQuery);
    }).catch(() => toast('טעינת הארגונים נכשלה'));
    listTemplates().then(setTemplates).catch(() => toast('טעינת התבניות נכשלה'));
  }, []);

  // everything below is derived from the form, so a format change re-picks the template and group size
  const formatTemplates = useMemo(() => templates.filter((t) => t.format === f.format), [templates, f.format]);
  const template = formatTemplates.find((t) => t.id === f.templateId) ?? pickDefaultTemplate(templates, f.format);
  const groupSize = f.groupSize ?? String(template?.default_group_size ?? FALLBACK_GROUP_SIZE);
  const org = orgs.find((o) => o.id === f.orgId);
  const code = f.codeTouched ? f.code : org ? suggestCode(org.name, f.startsOn) : '';
  const values = { orgId: f.orgId, title: f.title, code, prefix: f.prefix, startsOn: f.startsOn, endsOn: f.endsOn,
    audience: f.audience, groupSize };
  const errors = showErrors ? validateWorkshopForm(values) : {};

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (Object.keys(validateWorkshopForm(values)).length > 0) return;
    setBusy(true);
    try {
      const w = await createWorkshop({
        organization_id: f.orgId, title: f.title.trim(), code, team_prefix: f.prefix.trim(), format: f.format,
        template_id: template?.id ?? null, starts_on: orNull(f.startsOn), ends_on: orNull(f.endsOn),
        grade_level: orNull(f.grade), class_label: orNull(f.classLabel),
        audience_size: f.audience.trim() ? Number(f.audience) : null, group_size: Number(groupSize),
        device_mode: f.device, location: orNull(f.location), notes: orNull(f.notes),
      });
      if (template) {
        try {
          await instantiateCurriculum(w.id, template.id, firstSessionIso(f.startsOn) ?? undefined);
        } catch (err) {
          toast(`הסדנה נוצרה, טעינת התבנית נכשלה: ${dbErrorMessage(err)}`);
        }
      }
      router.push(`/workshops/${w.id}/overview`);
    } catch (err) {
      toast(dbErrorMessage(err, 'יצירת הסדנה נכשלה'));
      setBusy(false);
    }
  };

  return (
    <form className={`hud ${styles.card}`} onSubmit={(e) => void submit(e)} noValidate>
      <div className={styles.formGrid}>
        <Field label="ארגון" htmlFor="ws-org" className={styles.spanAll}>
          <OrgPicker orgs={orgs} value={f.orgId} error={errors.org} onChange={(id) => set('orgId', id)}
            onCreated={(o) => setOrgs((prev) => [...prev, o])} />
        </Field>
        <Field label="כותרת" htmlFor="ws-title" error={errors.title ?? ''} className={styles.span2}>
          <input id="ws-title" type="text" value={f.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="קוד" htmlFor="ws-code" error={errors.code ?? ''}>
          <input id="ws-code" type="text" dir="ltr" value={code}
            onChange={(e) => setF((p) => ({ ...p, code: normalizeCode(e.target.value), codeTouched: true }))} />
        </Field>
        <Field label="קידומת קבוצות" htmlFor="ws-prefix" className={styles.span2}>
          <TeamPrefixField value={f.prefix} onChange={(v) => set('prefix', v)} error={errors.prefix} />
        </Field>
        <Field label="פורמט" htmlFor="ws-format">
          <select id="ws-format" value={f.format}
            onChange={(e) => setF((p) => ({ ...p, format: e.target.value as WorkshopFormat, templateId: null, groupSize: null }))}>
            {FORMAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="תבנית" htmlFor="ws-template" error={formatTemplates.length === 0 ? `אין תבנית לפורמט ${FORMAT_LABELS[f.format]}` : ''}>
          <select id="ws-template" value={template?.id ?? ''} disabled={formatTemplates.length === 0}
            onChange={(e) => setF((p) => ({ ...p, templateId: e.target.value, groupSize: null }))}>
            {formatTemplates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </Field>
        <Field label="גודל קבוצה" htmlFor="ws-gsize" error={errors.groupSize ?? ''}>
          <input id="ws-gsize" type="number" min={2} max={8} value={groupSize} onChange={(e) => set('groupSize', e.target.value)} />
        </Field>
        <Field label="תאריך התחלה" htmlFor="ws-start">
          <input id="ws-start" type="date" value={f.startsOn} onChange={(e) => set('startsOn', e.target.value)} />
        </Field>
        <Field label="תאריך סיום" htmlFor="ws-end" error={errors.endsOn ?? ''}>
          <input id="ws-end" type="date" value={f.endsOn} onChange={(e) => set('endsOn', e.target.value)} />
        </Field>
        <Field label="מספר משתתפים" htmlFor="ws-audience" error={errors.audience ?? ''}>
          <input id="ws-audience" type="number" min={1} max={500} value={f.audience} onChange={(e) => set('audience', e.target.value)} />
        </Field>
        <Field label="שכבה" htmlFor="ws-grade">
          <input id="ws-grade" type="text" value={f.grade} onChange={(e) => set('grade', e.target.value)} />
        </Field>
        <Field label="כיתה" htmlFor="ws-class">
          <input id="ws-class" type="text" value={f.classLabel} onChange={(e) => set('classLabel', e.target.value)} />
        </Field>
        <Field label="מכשירים" htmlFor="ws-device">
          <select id="ws-device" value={f.device} onChange={(e) => set('device', e.target.value as DeviceMode)}>
            {DEVICE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="מיקום" htmlFor="ws-location" className={styles.span2}>
          <input id="ws-location" type="text" value={f.location} onChange={(e) => set('location', e.target.value)} />
        </Field>
        <Field label="הערות" htmlFor="ws-notes" className={styles.spanAll}>
          <textarea id="ws-notes" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
      <div className={styles.formActions}>
        <button type="submit" className="primary" disabled={busy}>יצירת סדנה</button>
        <button type="button" className="ghost" disabled={busy} onClick={() => router.push('/workshops')}>ביטול</button>
      </div>
    </form>
  );
}
