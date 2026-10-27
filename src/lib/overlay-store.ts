"use client";

import { useSyncExternalStore } from "react";

/** Counts open modal surfaces so the page-level toast region can step aside for the one inside a dialog. */
let overlayCount = 0;
const listeners = new Set<() => void>();

export const overlayStore = {
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot: (): number => overlayCount,
  getServerSnapshot: (): number => 0,
};

export function bumpOverlay(delta: number): void {
  overlayCount += delta;
  for (const l of listeners) l();
}

export function useOverlayCount(): number {
  return useSyncExternalStore(overlayStore.subscribe, overlayStore.getSnapshot, overlayStore.getServerSnapshot);
}
