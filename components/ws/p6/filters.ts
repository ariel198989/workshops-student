import type { WsModule } from '@/lib/ws/types';

export interface ModuleFilters {
  stage: string;
  type: string;
  /** 'school' | 'adult' | '' */
  audience: string;
  requiresApp: boolean;
  search: string;
}

export const EMPTY_FILTERS: ModuleFilters = { stage: '', type: '', audience: '', requiresApp: false, search: '' };

export const hasActiveFilters = (f: ModuleFilters): boolean =>
  f.stage !== '' || f.type !== '' || f.audience !== '' || f.requiresApp || f.search.trim() !== '';

/** audience:school / audience:adult come from the seed tags; a module may carry both. */
export const hasAudience = (m: Pick<WsModule, 'tags'>, audience: string): boolean =>
  m.tags.includes(`audience:${audience}`);

export function filterModules(modules: readonly WsModule[], f: ModuleFilters): WsModule[] {
  const q = f.search.trim().toLowerCase();
  return modules.filter((m) => {
    if (f.stage && m.pipeline_stage !== f.stage) return false;
    if (f.type && m.module_type !== f.type) return false;
    if (f.audience && !hasAudience(m, f.audience)) return false;
    if (f.requiresApp && !m.requires_app) return false;
    if (!q) return true;
    return [m.title, m.summary ?? '', ...m.tags].some((s) => s.toLowerCase().includes(q));
  });
}
