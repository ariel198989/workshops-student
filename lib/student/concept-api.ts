'use client';
// Submitting a concept check and remembering, on this device only, that a phase was already answered.
// The database stores no participant id; neither does this file.
import { sb } from '../db';
import { ALREADY_SUBMITTED_CODE, lockKey, submitErrorMessage, type CheckPhase } from './concept';

export interface SubmitOutcome {
  /** true when the server said this phase was already answered (23505): treated as done, not as a failure */
  already: boolean;
}

export async function submitConceptCheck(
  sessionModuleId: string, phase: CheckPhase, answers: Record<string, number>,
): Promise<SubmitOutcome> {
  const { error } = await sb.rpc('ws_submit_concept_check', {
    p_session_module: sessionModuleId, p_phase: phase, p_answers: answers,
  });
  if (!error) {
    lockPhase(sessionModuleId, phase);
    return { already: false };
  }
  if (error.code === ALREADY_SUBMITTED_CODE) {
    lockPhase(sessionModuleId, phase);
    return { already: true };
  }
  throw new Error(submitErrorMessage(error));
}

export function isPhaseLocked(sessionModuleId: string, phase: CheckPhase): boolean {
  try {
    return window.localStorage.getItem(lockKey(sessionModuleId, phase)) === '1';
  } catch {
    return false;
  }
}

export function lockPhase(sessionModuleId: string, phase: CheckPhase): void {
  try {
    window.localStorage.setItem(lockKey(sessionModuleId, phase), '1');
  } catch { /* private mode: the server still has the answers, only the local guard is lost */ }
}
