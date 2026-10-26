'use client';
// רובי's face: inline SVG, no images, no emoji. Two big eyes that follow `gaze`,
// brows and mouth per mood, an antenna lamp in the bar colour. A calm round robot.
import { lightTone, type Mood } from '@/lib/robot/mood';
import r from './robot.module.css';

export interface RobotFaceProps {
  mood: Mood;
  /** -1 looks to the screen's left, 1 to its right. */
  gaze?: number;
  size?: 'sm' | 'lg';
  speaking?: boolean;
  className?: string;
}

const LAMP: Record<ReturnType<typeof lightTone>, string> = {
  teal: '#17948C',
  amber: '#F59E0B',
  red: '#DC2626',
  off: '#CBD5E1',
};

const INK = '#0F1C2E';
const SHELL = '#FFFFFF';
const EDGE = '#CBD5E1';

/** Pupil vertical offset: thinking looks up, sleep/oops look down. */
const EYE_Y: Partial<Record<Mood, number>> = { thinking: -4, oops: 3, sleep: 2, curious: -2 };

/** Each brow is a short line; we move its two ends. [outerY, innerY] relative to resting. */
const BROWS: Record<Mood, { l: [number, number]; r: [number, number] }> = {
  sleep: { l: [2, 2], r: [2, 2] },
  idle: { l: [0, 0], r: [0, 0] },
  curious: { l: [-5, -2], r: [0, 0] },
  thinking: { l: [1, -3], r: [-3, 1] },
  sure: { l: [-2, -2], r: [-2, -2] },
  unsure: { l: [-4, 0], r: [0, -4] },
  lost: { l: [-3, -6], r: [-6, -3] },
  happy: { l: [-4, -3], r: [-3, -4] },
  oops: { l: [-2, 2], r: [2, -2] },
};

/** Mouth paths in the 120x120 viewBox, centred on (60, 86). */
const MOUTH: Record<Mood, string> = {
  sleep: 'M52 88 H68',
  idle: 'M50 86 Q60 92 70 86',
  curious: 'M55 84 Q60 78 65 84 Q60 94 55 84 Z',
  thinking: 'M53 88 H67',
  sure: 'M46 84 Q60 98 74 84',
  unsure: 'M50 88 Q55 83 60 88 Q65 93 70 88',
  lost: 'M54 86 A6 6 0 1 0 66 86 A6 6 0 1 0 54 86 Z',
  happy: 'M44 82 Q60 104 76 82 Z',
  oops: 'M50 92 Q60 82 70 92',
};

const FILLED_MOUTH: ReadonlySet<Mood> = new Set<Mood>(['happy', 'curious', 'lost']);

const MOOD_HE: Record<Mood, string> = {
  sleep: 'ישן', idle: 'מחכה', curious: 'סקרן', thinking: 'חושב', sure: 'בטוח', unsure: 'לא בטוח', lost: 'לא מכיר', happy: 'שמח', oops: 'טעה',
};

export function RobotFace({ mood, gaze = 0, size = 'sm', speaking = false, className }: RobotFaceProps) {
  const g = Math.max(-1, Math.min(1, gaze));
  const dx = g * 5;
  const dy = EYE_Y[mood] ?? 0;
  const lamp = LAMP[lightTone(mood)];
  const brows = BROWS[mood];
  const asleep = mood === 'sleep';
  const filled = FILLED_MOUTH.has(mood);
  const talking = speaking && !asleep;

  return (
    <svg
      viewBox="0 0 120 120"
      className={`${r.face} ${size === 'lg' ? r.lg : r.sm} ${className ?? ''}`}
      role="img"
      aria-label={`רובי ${MOOD_HE[mood]}`}
      focusable="false"
    >
      <g className={r.body}>
        {/* antenna */}
        <line x1="60" y1="22" x2="60" y2="11" stroke={EDGE} strokeWidth="3" strokeLinecap="round" />
        <circle cx="60" cy="8" r="5.5" fill={lamp} className={`${r.lamp} ${lamp !== LAMP.off ? r.lampOn : ''}`} />

        {/* head */}
        <rect x="14" y="22" width="92" height="82" rx="28" fill={SHELL} stroke={EDGE} strokeWidth="2" />
        <rect x="22" y="30" width="76" height="66" rx="22" fill="#F6F8FA" />

        {/* ears */}
        <rect x="8" y="54" width="7" height="20" rx="3.5" fill={EDGE} />
        <rect x="105" y="54" width="7" height="20" rx="3.5" fill={EDGE} />

        {/* eyes */}
        <g className={`${r.lids} ${asleep ? r.lidsShut : ''}`}>
          <circle cx="42" cy="60" r="13" fill="#fff" stroke={EDGE} strokeWidth="1.5" />
          <circle cx="78" cy="60" r="13" fill="#fff" stroke={EDGE} strokeWidth="1.5" />
          <g className={r.pupil} style={{ transform: `translate(${dx}px, ${dy}px)` }}>
            <circle cx="42" cy="60" r="6.5" fill={INK} />
            <circle cx="78" cy="60" r="6.5" fill={INK} />
            <circle cx="44.5" cy="57.5" r="2" fill="#fff" />
            <circle cx="80.5" cy="57.5" r="2" fill="#fff" />
          </g>
        </g>

        {/* brows: outer end first, inner end second */}
        <line className={r.brow} x1="31" y1={42 + brows.l[0]} x2="52" y2={42 + brows.l[1]} stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
        <line className={r.brow} x1="68" y1={42 + brows.r[1]} x2="89" y2={42 + brows.r[0]} stroke={INK} strokeWidth="3.5" strokeLinecap="round" />

        {/* mouth */}
        <g className={talking ? r.talk : undefined}>
          <path
            className={r.mouth}
            d={MOUTH[mood]}
            fill={filled ? INK : 'none'}
            stroke={INK}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
    </svg>
  );
}
