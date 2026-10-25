// Single entry point for the shared Smart City constants. The values live in
// lib/config.ts (same Supabase project, bucket and Colab trainer as Smart City).
export { BUCKET, COLAB, DEFAULT_CITY } from '../config';
export { MIN_TRAIN_IMAGES, RED_BELOW, STRONG_FROM } from './readiness';

/** Cache API bucket for model ZIPs (immutable per path, so cache-first is safe). */
export const MODEL_CACHE = 'sc-models-v1';
/** Training job status refresh. */
export const JOB_POLL_MS = 15000;
/** Pool size ceiling: the dataset ZIP is assembled in phone memory. */
export const POOL_LIMIT = 1500;
