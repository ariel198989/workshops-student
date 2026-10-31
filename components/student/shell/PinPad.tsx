'use client';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { PIN_LENGTH, type PinAction, type PinState } from '@/lib/student/device-login';
import gl from './group-login.module.css';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

interface Props {
  pin: PinState;
  dispatch: (action: PinAction) => void;
  disabled?: boolean;
  /** how many places to draw (the reducer caps the input at PIN_LENGTH) */
  digits?: number;
  /** show the typed digits in boxes instead of hiding them as dots (a workshop number is not a secret) */
  reveal?: boolean;
  /** 72px keys for a child holding a phone at arm's length */
  large?: boolean;
}

/** Four dots (or four boxes) and a 3x4 keypad with 64px+ keys. A hidden PIN is never rendered as text. */
export function PinPad({ pin, dispatch, disabled = false, digits = PIN_LENGTH, reveal = false, large = false }: Props) {
  const filled = pin.digits.length;
  const keyClass = large ? `${gl.key} ${gl.keyLarge}` : gl.key;
  const ghostClass = `${keyClass} ${gl.keyGhost}`;
  return (
    <div className={gl.pad}>
      {reveal ? (
        <div className={gl.boxes} dir="ltr" role="status" aria-live="polite" aria-label={filled ? `הוקלד ${pin.digits}` : 'עוד לא הוקלדו ספרות'}>
          {Array.from({ length: digits }, (_, i) => (
            <span key={i} className={i < filled ? `${gl.box} ${gl.boxOn}` : gl.box} aria-hidden="true">{pin.digits[i] ?? ''}</span>
          ))}
        </div>
      ) : (
        <div className={gl.dots} role="status" aria-live="polite" aria-label={`הוקלדו ${filled} מתוך ${digits} ספרות`}>
          {Array.from({ length: digits }, (_, i) => (
            <span key={i} className={i < filled ? `${gl.dot} ${gl.dotOn}` : gl.dot} aria-hidden="true" />
          ))}
        </div>
      )}
      <div className={large ? `${gl.keys} ${gl.keysLarge}` : gl.keys} dir="ltr" role="group" aria-label="לוח ספרות">
        {KEYS.map((k) => (
          <button key={k} type="button" className={keyClass} disabled={disabled} onClick={() => dispatch({ type: 'digit', value: k })}>{k}</button>
        ))}
        <button type="button" className={ghostClass} disabled={disabled || filled === 0} onClick={() => dispatch({ type: 'clear' })}
          aria-label="ניקוי">נקו</button>
        <button type="button" className={keyClass} disabled={disabled} onClick={() => dispatch({ type: 'digit', value: '0' })}>0</button>
        <button type="button" className={ghostClass} disabled={disabled || filled === 0} onClick={() => dispatch({ type: 'back' })}
          aria-label="מחיקת הספרה האחרונה">
          <HugeiconsIcon icon={ArrowLeft01Icon} size={26} />
        </button>
      </div>
    </div>
  );
}
