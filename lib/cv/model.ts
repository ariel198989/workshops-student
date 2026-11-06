'use client';
// The group's trained model: find the newest approved one in ws_models, download
// its ZIP from the ws-models bucket cache-first (ZIPs are immutable per path), and
// hot-swap the live engine when a newer zip_path appears.
import { sb, modelUrl } from '../db';
import { MODEL_CACHE } from './config';
import { pickScopedModels, type ModelPick } from './dataset';
import { createEngineSlot } from './engine-slot';
import { createEngine, type Engine } from './infer';

export interface TeamModel {
  id: string;
  owner: string | null;
  team_name: string;
  name: string | null;
  classes: string[] | null;
  zip_path: string;
  approved: boolean;
  scope: string | null;
  accuracy: number | null;
  image_count: number | null;
  honest_val: boolean | null;
  class_stats: unknown;
  created_at: string;
}

/** The group's models (mine included: RLS shows a student only their own group's), newest first. */
export async function fetchTeamModels(team: string): Promise<TeamModel[]> {
  const { data, error } = await sb.from('ws_models').select('*').eq('team_name', team)
    .order('created_at', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as TeamModel[];
}

/** The model(s) the results screen shows: mine (plus the group's, quieter) in personal scope, the group's otherwise. */
export async function fetchModelPick(userId: string, team: string, personal: boolean): Promise<ModelPick<TeamModel>> {
  return pickScopedModels(await fetchTeamModels(team), userId, team, personal);
}

async function downloadZip(zipPath: string): Promise<Blob> {
  const url = modelUrl(zipPath);
  let cache: Cache | null = null;
  try {
    cache = await caches.open(MODEL_CACHE);
    const hit = await cache.match(url);
    if (hit) return await hit.blob();
  } catch { /* no Cache API (old webview): plain fetch below */ }
  const res = await fetch(url);
  if (!res.ok) throw new Error('הורדת המודל נכשלה. בדקו את החיבור ונסו שוב.');
  try {
    if (cache) {
      const old = await cache.keys();
      await Promise.all(old.map((k) => cache!.delete(k))); // keep only the newest version
      await cache.put(url, res.clone());
    }
  } catch { /* cache full: the model still loads */ }
  return res.blob();
}

// classes per zip path, for the slot's loader (a zip_path is immutable, so are its classes)
const classesOf = new Map<string, string[]>();
const slot = createEngineSlot<Engine>(
  async (path) => createEngine(await downloadZip(path), classesOf.get(path) ?? []),
  (engine) => engine.dispose(),
);

/**
 * The engine for this zip. Only the newest request becomes live (and disposes the previous engine);
 * an older load that lands later is disposed and rejects with StaleLoadError (see engine-slot.ts).
 */
export function loadEngineFromPath(zipPath: string, classes: readonly string[]): Promise<Engine> {
  classesOf.set(zipPath, [...classes]);
  return slot.get(zipPath);
}

export const loadEngine = (model: TeamModel): Promise<Engine> => loadEngineFromPath(model.zip_path, model.classes ?? []);

export function disposeEngine(): void {
  slot.drop();
}
