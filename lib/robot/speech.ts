// Web Speech wrapper for רובי. Everything is guarded: no window, no API, no
// Hebrew voice, or a browser that refuses, all end as "did not speak".

export const SPEECH_RATE = 0.95;
export const SPEECH_PITCH = 1.1;

export interface SpeakHandlers { onStart?: () => void; onEnd?: () => void }

function synth(): SpeechSynthesis | null {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    return window.speechSynthesis ?? null;
  } catch {
    return null;
  }
}

export function voiceAvailable(): boolean {
  return !!synth() && typeof SpeechSynthesisUtterance !== 'undefined';
}

const isHebrew = (v: SpeechSynthesisVoice): boolean => /^(he|iw)\b/i.test(v.lang);

/** A Hebrew voice when the browser has one; null falls back to the engine default for lang he-IL. */
export function pickVoice(voices: readonly SpeechSynthesisVoice[] = synth()?.getVoices() ?? []): SpeechSynthesisVoice | null {
  const he = voices.filter(isHebrew);
  return he.find((v) => v.default) ?? he.find((v) => v.localService) ?? he[0] ?? null;
}

/** Chrome drops voices until `voiceschanged`; asking once early warms the list. */
export function warmVoices(): void {
  try {
    synth()?.getVoices();
  } catch {
    /* ignore */
  }
}

// Chrome garbage-collects an utterance that nothing references and never fires onend.
let current: SpeechSynthesisUtterance | null = null;

/** Cancels whatever is playing and speaks `text`. Returns false when nothing could be spoken. */
export function speak(text: string, handlers: SpeakHandlers = {}): boolean {
  const s = synth();
  if (!s || typeof SpeechSynthesisUtterance === 'undefined' || !text.trim()) return false;
  try {
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'he-IL';
    u.rate = SPEECH_RATE;
    u.pitch = SPEECH_PITCH;
    const voice = pickVoice();
    if (voice) u.voice = voice;
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      if (current === u) current = null;
      handlers.onEnd?.();
    };
    u.onstart = () => handlers.onStart?.();
    u.onend = end;
    u.onerror = end;
    current = u;
    s.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking(): void {
  try {
    synth()?.cancel();
  } catch {
    /* ignore */
  }
  current = null;
}
