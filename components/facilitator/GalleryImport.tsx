'use client';
// L1 flow: the groups photographed on school tablets; the facilitator picks
// which gallery classes become trainer classes and the frames are embedded
// here, in the browser. Downloads only; nothing is written anywhere.
import { useEffect, useState } from 'react';
import { addExample, imageFromUrl } from '@/lib/pocket/engine';
import {
  fetchGalleryRows, fetchWorkshopGroups, frameUrl, GALLERY_CAP_PER_CLASS, galleryClasses,
  type GalleryClass, type GalleryGroup, type GalleryRow,
} from '@/lib/pocket/gallery';
import { capPerClass, MAX_CLASSES } from '@/lib/pocket/score';
import { Spinner } from '@/components/ui/Spinner';
import f from './facilitator.module.css';

interface Props {
  workshopId: string;
  classes: string[];
  onImported: (classes: string[]) => void;
  onClose: () => void;
}

interface Loaded { groups: GalleryGroup[]; rows: GalleryRow[]; classes: GalleryClass[] }

export function GalleryImport({ workshopId, classes, onImported, onClose }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const groups = await fetchWorkshopGroups(workshopId);
        const rows = await fetchGalleryRows(groups.map((g) => g.team_name));
        if (!alive) return;
        const gc = galleryClasses(rows);
        setLoaded({ groups, rows, classes: gc });
        // classes the trainer already has are preselected; otherwise the most photographed ones
        const existing = gc.filter((c) => classes.includes(c.name)).map((c) => c.name);
        const room = MAX_CLASSES - classes.filter((c) => !existing.includes(c)).length;
        const extra = gc.filter((c) => !classes.includes(c.name)).slice(0, Math.max(0, room - existing.length)).map((c) => c.name);
        setPicked([...existing, ...extra]);
      } catch (e) {
        if (alive) setError(e instanceof Error && /[֐-׿]/.test(e.message) ? e.message : 'הגלריה לא נטענה. בדקו את החיבור ונסו שוב.');
      }
    })();
    return () => { alive = false; };
  }, [workshopId, classes]);

  // picked gallery classes + trainer classes that are not in the gallery must stay within three
  const outsideGallery = classes.filter((c) => !loaded?.classes.some((g) => g.name === c));
  const total = outsideGallery.length + picked.length;
  const toggle = (name: string) => {
    setPicked((p) => {
      if (p.includes(name)) return p.filter((x) => x !== name);
      if (outsideGallery.length + p.length >= MAX_CLASSES) return p;
      return [...p, name];
    });
  };

  const run = async () => {
    if (!loaded || picked.length === 0) return;
    const rows = capPerClass(loaded.rows, picked, GALLERY_CAP_PER_CLASS);
    setProgress({ done: 0, total: rows.length, failed: 0 });
    let failed = 0;
    for (let i = 0; i < rows.length; i++) {
      try {
        const img = await imageFromUrl(frameUrl(rows[i]));
        await addExample(img, rows[i].class_name);
      } catch {
        failed += 1;
      }
      setProgress({ done: i + 1, total: rows.length, failed });
    }
    onImported(picked);
  };

  return (
    <div className={f.sheet} role="dialog" aria-modal="true" aria-label="ייבוא מהגלריה של הקבוצות">
      <div className={f.sheetBox}>
        <div className={f.tallyHead}>
          <span className={f.sheetTitle}>מהגלריה של הקבוצות</span>
          <button type="button" onClick={onClose} disabled={!!progress && progress.done < progress.total}>סגירה</button>
        </div>
        {error ? <p className={f.err} role="alert">{error}</p> : null}
        {!loaded && !error ? <Spinner large /> : null}
        {loaded ? (
          <>
            <div className={f.groups}>
              {loaded.groups.length === 0 ? <span className={f.sub}>לסדנה הזאת עוד אין קבוצות.</span> : null}
              {loaded.groups.map((g) => (
                <span key={g.id} className={f.tag}>{g.display_name ?? `קבוצה ${g.number}`}</span>
              ))}
            </div>
            {loaded.classes.length === 0 ? <p className={f.sub}>הקבוצות עוד לא צילמו.</p> : (
              <>
                <p className={f.sub}>בחרו עד {MAX_CLASSES} מחלקות. עד {GALLERY_CAP_PER_CLASS} תמונות מכל מחלקה.</p>
                <div className={f.pickList}>
                  {loaded.classes.map((c) => {
                    const on = picked.includes(c.name);
                    return (
                      <button key={c.name} type="button" className={`${f.pick} ${on ? f.pickOn : ''}`} aria-pressed={on}
                        disabled={!!progress || (!on && total >= MAX_CLASSES)} onClick={() => toggle(c.name)}>
                        <span>{c.name}</span>
                        <span className={f.count}>{Math.min(c.count, GALLERY_CAP_PER_CLASS)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {progress ? (
              <div className={f.counter} aria-live="polite">
                <span className={f.counterNum}>{progress.done}</span>
                <span className={f.counterText}>
                  מתוך {progress.total}{progress.failed ? `, ${progress.failed} לא נפתחו` : ''}
                </span>
              </div>
            ) : (
              <div className={f.actions}>
                <button type="button" className={`primary ${f.bigBtn}`} disabled={picked.length === 0} onClick={() => void run()}>
                  למד מהגלריה
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
