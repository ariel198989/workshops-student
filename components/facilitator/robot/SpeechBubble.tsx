'use client';
// What רובי is saying, big enough for the back row. Not a live region: the
// header line in Trainer already announces every change once.
import r from './robot.module.css';

export function SpeechBubble({ line, size = 'lg', className }: { line: string; size?: 'sm' | 'lg'; className?: string }) {
  return (
    <p className={`${r.bubble} ${size === 'sm' ? r.bubbleSm : ''} ${className ?? ''}`}>
      {line}
    </p>
  );
}
