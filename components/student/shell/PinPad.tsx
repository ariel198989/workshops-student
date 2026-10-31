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
}

/** Four dots and a 3x4 keypad with 56px+ keys. The PIN itself is never rendered as text. */
export function PinPad({ pin, dispatch, disabled = false }: Props) {
  const filled = pin.digits.length;
  return (
    <div className={gl.pad}>
      <div className={gl.dots} role="status" aria-live="polite" aria-label={`הוקלדו ${filled} מתוך ${PIN_LENGTH} ספרות`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={i < filled ? `${gl.dot} ${gl.dotOn}` : gl.dot} aria-hidden="true" />
        ))}
      </div>
      <div className={gl.keys} dir="ltr" role="group" aria-label="לוח ספרות">
        {KEYS.map((k) => (
          <button key={k} type="button" className={gl.key} disabled={disabled} onClick={() => dispatch({ type: 'digit', value: k })}>{k}</button>
        ))}
        <button type="button" className={`${gl.key} ${gl.keyGhost}`} disabled={disabled || filled === 0} onClick={() => dispatch({ type: 'clear' })}
          aria-label="ניקוי">נקו</button>
        <button type="button" className={gl.key} disabled={disabled} onClick={() => dispatch({ type: 'digit', value: '0' })}>0</button>
        <button type="button" className={`${gl.key} ${gl.keyGhost}`} disabled={disabled || filled === 0} onClick={() => dispatch({ type: 'back' })}
          aria-label="מחיקת הספרה האחרונה">
          <HugeiconsIcon icon={ArrowLeft01Icon} size={26} />
        </button>
      </div>
    </div>
  );
}
