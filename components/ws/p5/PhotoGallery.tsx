'use client';
import { useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { publicUrl } from '@/lib/db';
import { fetchTeamPhotos } from '@/lib/ws/deliverables';
import type { Detection } from '@/lib/types';
import { useLoad } from './useLoad';
import styles from './p5.module.css';

export const GALLERY_PAGE_SIZE = 60;

interface PhotoGalleryProps {
  team: string;
  /** pick mode: each photo gets a button (used to attach a frame to a failure case) */
  pickLabel?: string;
  onPick?: (photo: Detection) => void;
}

/** Group photos from the Smart City bucket, 60 per page. */
export function PhotoGallery({ team, pickLabel, onPick }: PhotoGalleryProps) {
  const [page, setPage] = useState(0);
  const { data, error, loading } = useLoad(() => fetchTeamPhotos(team, page, GALLERY_PAGE_SIZE), [team, page]);

  if (error) return <p className="err" role="alert">{error}</p>;
  const photos = data ?? [];
  return (
    <div className="stack">
      {loading && !data ? <div className={styles.center}><Spinner /></div> : null}
      {!loading && photos.length === 0 ? (
        <p className="hint">{page === 0 ? 'אין עדיין תמונות לקבוצה.' : 'אין עוד תמונות.'}</p>
      ) : null}
      <div className={styles.gallery}>
        {photos.map((p) => (
          <figure key={p.id} className={styles.photo}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={publicUrl(p.frame_path ?? '')} alt={p.class_name} loading="lazy" />
            <figcaption dir="auto">{p.class_name}</figcaption>
            {onPick ? (
              <button type="button" className="sm primary" onClick={() => onPick(p)}>{pickLabel ?? 'בחירה'}</button>
            ) : null}
          </figure>
        ))}
      </div>
      <div className={styles.metaRow}>
        <button type="button" className="sm" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>הקודם</button>
        <span className="hint">עמוד {page + 1}</span>
        <button type="button" className="sm" disabled={photos.length < GALLERY_PAGE_SIZE || loading}
          onClick={() => setPage(page + 1)}>הבא</button>
      </div>
    </div>
  );
}
