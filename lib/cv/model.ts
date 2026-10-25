'use client';
// The group's trained model: find the newest approved one, download it
// cache-first (ZIPs are immutable per path), and hot-swap the live engine when
// a newer zip_path appears. Ported from Smart City lib/patrol.ts ensureCityModel.
import { sb, publicUrl } from '../db';
import { MODEL_CACHE } from './config';
import { pickTeamModel, teamScope } from './dataset';
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

/** The group's models plus mine, newest first (not the global newest-N window). */
export async function fetchTeamModels(userId: string, team: string): Promise<TeamModel[]> {
  const q = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  const [t, personal] = teamScope(team);
  const filter = [`owner.eq.${userId}`, `team_name.in.(${q(t)},${q(personal)})`].join(',');
  const { data, error } = await sb.from('sc_models').select('*').or(filter)
    .order('created_at', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as TeamModel[];
}

export async function fetchBestTeamModel(userId: string, team: string): Promise<TeamModel | null> {
  return pickTeamModel(await fetchTeamModels(userId, team), userId, team);
}

async function downloadZip(zipPath: string): Promise<Blob> {
  const url = publicUrl(zipPath);
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

let live: { path: string; engine: Engine } | null = null;
let inflight: { path: string; promise: Promise<Engine> } | null = null;

/** Returns the engine for this model; a new zip_path replaces (and disposes) the running one. */
export function loadEngine(model: TeamModel): Promise<Engine> {
  if (live?.path === model.zip_path) return Promise.resolve(live.engine);
  if (inflight?.path === model.zip_path) return inflight.promise;
  const promise = (async () => {
    const engine = await createEngine(await downloadZip(model.zip_path), model.classes ?? []);
    live?.engine.dispose();
    live = { path: model.zip_path, engine };
    return engine;
  })().finally(() => { inflight = null; });
  inflight = { path: model.zip_path, promise };
  return promise;
}

export function disposeEngine(): void {
  live?.engine.dispose();
  live = null;
}
