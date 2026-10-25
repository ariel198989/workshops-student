import { createClient } from '@supabase/supabase-js';
import { SB_URL, SB_KEY, BUCKET } from './config';

export const sb = createClient(SB_URL, SB_KEY);

export const publicUrl = (path: string, bucket = BUCKET) =>
  sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;

export async function uploadBlob(path: string, blob: Blob, contentType: string, bucket = BUCKET) {
  const up = await sb.storage.from(bucket).upload(path, blob, { contentType, upsert: false });
  if (up.error) throw up.error;
  return path;
}
