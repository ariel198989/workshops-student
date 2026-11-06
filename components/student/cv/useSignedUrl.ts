'use client';
import { useCallback, useEffect, useState } from 'react';
import { friendlyError } from '@/lib/cv/capture-utils';
import { forgetSignedUrl, peekSignedUrl, PHOTO_ERROR, signedUrl } from '@/lib/cv/signed-url';

interface State { path: string | null; url: string | null; error: string }

export interface SignedPhoto {
  /** null while the link is being signed, or after it failed */
  url: string | null;
  /** our Hebrew message, '' when there is nothing to report */
  error: string;
  /** sign again (the "try again" button) */
  retry: () => void;
  /** for <img onError>: the link did not load, so it is dropped and the error is shown */
  onLoadError: () => void;
}

/** The <img src> of one photo in the private bucket. A cached link shows at once; an expired one is signed again. */
export function useSignedUrl(path: string | null): SignedPhoto {
  const [state, setState] = useState<State>({ path: null, url: null, error: '' });
  const [turn, setTurn] = useState(0);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    signedUrl(path)
      .then((url) => { if (alive) setState({ path, url, error: '' }); })
      .catch((e) => { if (alive) setState({ path, url: null, error: friendlyError(e, PHOTO_ERROR) }); });
    return () => { alive = false; };
  }, [path, turn]);

  const retry = useCallback(() => {
    if (!path) return;
    forgetSignedUrl(path);
    setState({ path, url: null, error: '' });
    setTurn((n) => n + 1);
  }, [path]);

  const onLoadError = useCallback(() => {
    if (!path) return;
    forgetSignedUrl(path);
    setState({ path, url: null, error: PHOTO_ERROR });
  }, [path]);

  // the path changed and the effect has not answered yet: a cached link avoids a blank frame between photos
  const current = state.path === path ? state : { url: path ? peekSignedUrl(path) : null, error: '' };
  return { url: current.url, error: current.error, retry, onLoadError };
}
