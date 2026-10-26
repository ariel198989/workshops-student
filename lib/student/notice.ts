'use client';
// One short banner on the home screen, set by the route guard when a student opens a step this workshop
// leaves to the facilitator. Read once, then dismissed.
import { createStore } from '../store';

export interface HomeNotice { text: string; at: number }

export const noticeStore = createStore<{ notice: HomeNotice | null }>({ notice: null });

export const showHomeNotice = (text: string): void => noticeStore.set({ notice: { text, at: Date.now() } });
export const clearHomeNotice = (): void => noticeStore.set({ notice: null });
