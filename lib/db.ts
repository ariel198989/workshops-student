import { createClient } from '@supabase/supabase-js';
import { SB_URL, SB_KEY, MEDIA_BUCKET, MODELS_BUCKET } from './config';

export const sb = createClient(SB_URL, SB_KEY);

/** A model ZIP's address. Only ws-models has public URLs; photos go through lib/cv/signed-url. */
export const modelUrl = (path: string) =>
  sb.storage.from(MODELS_BUCKET).getPublicUrl(path).data.publicUrl;

/** Upload a photo or a dataset ZIP into the group's folder of the private bucket. */
export async function uploadMedia(path: string, blob: Blob, contentType: 'image/jpeg' | 'application/zip') {
  const up = await sb.storage.from(MEDIA_BUCKET).upload(path, blob, { contentType, upsert: false });
  if (up.error) throw up.error;
  return path;
}

/** The bytes of a file in the private bucket (the signed-in member's own group only). */
export async function downloadMedia(path: string): Promise<Blob> {
  const { data, error } = await sb.storage.from(MEDIA_BUCKET).download(path);
  if (error || !data) throw error ?? new Error('download failed');
  return data;
}
