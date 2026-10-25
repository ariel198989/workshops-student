'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addTemplateModule, getTemplate, removeTemplateModule, reorderTemplateModules, type TemplateWithModules,
} from '@/lib/ws/curriculum';
import { toast } from '@/lib/store';
import {
  buildColumns, changedSession, effectiveMinutes, flattenIds, moveItem, type BoardItem, type Column,
} from './board';
import { templateErrorText } from './errors';
import { setRowSession } from './template-data';

export type TemplateRow = TemplateWithModules['modules'][number];

const toItem = (r: TemplateRow): BoardItem =>
  ({ id: r.id, session_no: r.session_no, position: r.position, minutes: effectiveMinutes(r, r.module) });

/**
 * Loads one template and owns the board state. Every mutation updates the columns optimistically,
 * persists (session_no first, then the COMPLETE id list), and refetches so the UI shows server order.
 */
export function useTemplateBoard(id: string) {
  const [tpl, setTpl] = useState<TemplateWithModules | null | undefined>(undefined);
  const [columns, setColumns] = useState<Column[]>([]);
  const saving = useRef(false);

  const load = useCallback(async () => {
    try {
      const t = await getTemplate(id);
      setTpl(t);
      setColumns((prev) => buildColumns(t.modules.map(toItem), prev.length));
    } catch (err) {
      setTpl((cur) => cur ?? null);
      toast(templateErrorText(err, 'הטעינה נכשלה'));
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => new Map((tpl?.modules ?? []).map((r) => [r.id, r])), [tpl]);
  const items = useMemo(() => (tpl?.modules ?? []).map(toItem), [tpl]);

  const persist = useCallback(async (next: Column[], movedId: string | null, before: Column[]) => {
    try {
      const session = movedId ? changedSession(before, next, movedId) : null;
      if (movedId && session !== null) await setRowSession(movedId, session);
      await reorderTemplateModules(id, flattenIds(next));
    } catch (err) {
      toast(templateErrorText(err, 'השמירה נכשלה'));
    }
    await load();
  }, [id, load]);

  const move = useCallback(async (itemId: string, toSession: number, beforeId: string | null) => {
    if (saving.current) return; // one write at a time: a second drag mid-save would race the refetch
    const next = moveItem(columns, itemId, toSession, beforeId);
    if (flattenIds(next).join() === flattenIds(columns).join() && changedSession(columns, next, itemId) === null) return;
    saving.current = true;
    setColumns(next);
    try {
      await persist(next, itemId, columns);
    } finally {
      saving.current = false;
    }
  }, [columns, persist]);

  const remove = useCallback(async (rowId: string) => {
    try {
      await removeTemplateModule(rowId);
    } catch (err) {
      toast(templateErrorText(err, 'ההסרה נכשלה'));
    }
    await load();
  }, [load]);

  const add = useCallback(async (sessionNo: number, moduleId: string) => {
    const position = Math.max(0, ...(tpl?.modules ?? []).map((r) => r.position)) + 1;
    try {
      const row = await addTemplateModule({ template_id: id, module_id: moduleId, session_no: sessionNo, position });
      const withRow = buildColumns([...items, { id: row.id, session_no: sessionNo, position, minutes: 0 }], columns.length);
      await reorderTemplateModules(id, flattenIds(moveItem(withRow, row.id, sessionNo, null)));
    } catch (err) {
      toast(templateErrorText(err, 'ההוספה נכשלה'));
    }
    await load();
  }, [id, tpl, items, columns.length, load]);

  const addSession = useCallback(() => {
    setColumns((c) => [...c, { session_no: c.length + 1, ids: [] }]);
  }, []);

  return { tpl, setTpl, columns, items, rows, move, remove, add, addSession, reload: load };
}
