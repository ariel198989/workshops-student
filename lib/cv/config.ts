// Single entry point for the constants of the capture, tag, train and results cycle.
export { MIN_TRAIN_IMAGES, RED_BELOW, STRONG_FROM } from './readiness';

/** Cache API bucket for model ZIPs (immutable per path, so cache-first is safe). */
export const MODEL_CACHE = 'ws-models-v1';
/** Training job status refresh. */
export const JOB_POLL_MS = 15000;
/** Pool size ceiling: the dataset ZIP is assembled in phone memory. */
export const POOL_LIMIT = 1500;
