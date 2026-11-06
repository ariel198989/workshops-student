'use client';
// Top of המפגש: the template story's 3-minute opener for this session (staff only: this whole step
// lives in מצב מדריך). Hidden when the template has no story for the session.
import { OPENER_TITLE, type StoryOpener } from '@/lib/facilitator/story';
import g from './guide.module.css';

export function OpenerBox({ opener }: { opener: StoryOpener }) {
  return (
    <section className={g.opener} aria-label={OPENER_TITLE}>
      <h2 className={g.openerTitle}>{OPENER_TITLE}</h2>
      {opener.hero ? <p className={g.openerHero}>{opener.hero}</p> : null}
      {opener.beat ? <p className={g.openerBeat}>{opener.beat}</p> : null}
      <p className={g.openerText}>{opener.opener}</p>
      {opener.materials ? <p className={g.openerMaterials}><b>מה צריך:</b> {opener.materials}</p> : null}
    </section>
  );
}
