// One capture shot: frame -> privacy guard -> upload queue. Pure orchestration with injected steps, so the
// rules are unit tested under Node: a face, a check that threw, or a guard that is not ready never uploads.
import type { GuardStatus, GuardVerdict, UploadableVerdict } from './face-guard';

export type ShotOutcome =
  | 'queued'      // the frame is in the upload queue
  | 'face'        // a face: the frame never leaves the phone
  | 'retry'       // this frame could not be checked: not uploaded, shoot again
  | 'not-ready'   // the guard is still loading: nothing was taken
  | 'no-frame'    // the camera gave no frame
  | 'queue-full'; // too many photos wait for the network

export interface ShotSteps<I> {
  guardStatus: () => GuardStatus;
  /** draws the current frame (into the scratch canvas the check reads) and encodes it */
  grab: () => Promise<Blob | null>;
  /** the guard's verdict on the frame grab() just drew */
  check: () => Promise<GuardVerdict>;
  makeItem: (blob: Blob, verdict: UploadableVerdict) => I;
  submit: (item: I) => boolean;
}

export async function takeShot<I>(steps: ShotSteps<I>): Promise<{ outcome: ShotOutcome; verdict: GuardVerdict | null }> {
  const status = steps.guardStatus();
  if (status === 'idle' || status === 'loading') return { outcome: 'not-ready', verdict: null };
  const blob = await steps.grab();
  if (!blob) return { outcome: 'no-frame', verdict: null };
  let verdict: GuardVerdict;
  try { verdict = await steps.check(); } catch { verdict = 'error'; }
  if (verdict === 'face') return { outcome: 'face', verdict };
  if (verdict === 'not-ready') return { outcome: 'not-ready', verdict };
  if (verdict !== 'clear' && verdict !== 'skipped') return { outcome: 'retry', verdict };
  return { outcome: steps.submit(steps.makeItem(blob, verdict)) ? 'queued' : 'queue-full', verdict };
}
