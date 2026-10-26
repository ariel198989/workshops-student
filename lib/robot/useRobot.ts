'use client';
// רובי's one hook: a reducer for mood + line, a 'קול' toggle remembered on the
// device, and the speech side effect. Speaking happens only when (1) the toggle
// is on, (2) the browser has speechSynthesis, and (3) the reducer bumped
// `speakId`, which it does on a real mood change or a deliberate event, at most
// once per SPEAK_GAP_MS.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { LineCtx, Mood, RobotEvent } from './mood.ts';
import { speak, stopSpeaking, voiceAvailable, warmVoices } from './speech.ts';
import { HOLD_MS, initialRobot, robotReducer } from './state.ts';
import { loadVoicePref, saveVoicePref } from './voicePref.ts';

const EVENTS: ReadonlySet<string> = new Set<RobotEvent>(['shot', 'learned', 'reset', 'right', 'wrong', 'class_added']);
const isEvent = (k: Mood | RobotEvent): k is RobotEvent => EVENTS.has(k);

export interface RobotApi {
  mood: Mood;
  line: string;
  speaking: boolean;
  /** An event (shutter, learned, right/wrong...) or a live mood; stable identity. */
  say: (what: Mood | RobotEvent, ctx?: LineCtx) => void;
  voiceOn: boolean;
  setVoiceOn: (on: boolean) => void;
  /** False until the browser confirms speechSynthesis exists (always false during SSR). */
  voiceSupported: boolean;
}

export function useRobot(): RobotApi {
  const [state, dispatch] = useReducer(robotReducer, undefined, () => initialRobot());
  const [speaking, setSpeaking] = useState(false);
  const [voiceOn, setVoice] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const voiceOnRef = useRef(false);
  const lineRef = useRef(state.line);
  lineRef.current = state.line;
  const release = useRef<ReturnType<typeof setTimeout> | null>(null);

  // the toggle and the capability are read after mount so SSR and client agree
  useEffect(() => {
    const supported = voiceAvailable();
    setVoiceSupported(supported);
    if (supported) warmVoices();
    const on = supported && loadVoicePref();
    voiceOnRef.current = on;
    setVoice(on);
  }, []);

  const say = useCallback((what: Mood | RobotEvent, ctx?: LineCtx) => {
    const now = Date.now();
    if (isEvent(what)) {
      dispatch({ type: 'event', event: what, ctx, now });
      if (release.current) clearTimeout(release.current);
      release.current = setTimeout(() => { release.current = null; dispatch({ type: 'release', now: Date.now() }); }, HOLD_MS);
    } else {
      dispatch({ type: 'mood', mood: what, ctx, now });
    }
  }, []);

  // speak when the reducer asks; the line it asks for is the one on screen
  const lastSpoken = useRef(0);
  useEffect(() => {
    if (state.speakId === lastSpoken.current) return;
    lastSpoken.current = state.speakId;
    if (!voiceOnRef.current) return;
    const started = speak(state.line, { onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false) });
    if (!started) setSpeaking(false);
  }, [state.speakId, state.line]);

  useEffect(() => () => {
    if (release.current) clearTimeout(release.current);
    stopSpeaking();
  }, []);

  // the toggle click is the user gesture browsers want; say the current line so the room hears it works
  const setVoiceOn = useCallback((on: boolean) => {
    voiceOnRef.current = on;
    setVoice(on);
    saveVoicePref(on);
    if (!on) { stopSpeaking(); setSpeaking(false); return; }
    const started = speak(lineRef.current, { onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false) });
    if (!started) setSpeaking(false);
  }, []);

  return { mood: state.mood, line: state.line, speaking, say, voiceOn, setVoiceOn, voiceSupported };
}
