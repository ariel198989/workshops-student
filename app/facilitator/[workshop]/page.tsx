'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Trainer } from '@/components/facilitator/Trainer';
import { sb } from '@/lib/db';
import { FREE_WORKSHOP } from '@/lib/pocket/store';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function FacilitatorWorkshopPage() {
  const raw = useParams<{ workshop: string }>().workshop;
  const workshopId = raw && raw !== FREE_WORKSHOP && UUID.test(raw) ? raw : null;
  const [title, setTitle] = useState(workshopId ? 'סדנה' : 'מצב חופשי');

  useEffect(() => {
    if (!workshopId) return;
    let alive = true;
    sb.from('ws_workshops').select('title').eq('id', workshopId).maybeSingle()
      .then(({ data }) => { if (alive && data?.title) setTitle(data.title); });
    return () => { alive = false; };
  }, [workshopId]);

  return <Trainer workshopId={workshopId} title={title} />;
}
