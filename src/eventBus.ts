import type { PostedFlower } from "./types";

// -------------------------------------------------------------
// Shared Event Bus
// -------------------------------------------------------------
const listeners = new Set<(f: PostedFlower) => void>();

export function broadcastFlower(f: PostedFlower) {
  listeners.forEach((l) => l(f));
}

export function onFlower(cb: (f: PostedFlower) => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
