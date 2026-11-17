/* persisted(key, initial) — a reactive object saved to localStorage (arsenal-<key>) whenever it changes.
   Use for scores and progress:   const score = persisted('dblock-score', { right: 0, total: 0 });
                                  score.right++;   // saved automatically
   Call it from component setup (it needs an effect root) and only on the client. */

import { store } from './util';

export function persisted<T extends object>(key: string, initial: T): T {
  const saved = store.get<Partial<T>>(key, {});
  const value = $state<T>({ ...initial, ...(saved && typeof saved === 'object' ? saved : {}) });
  $effect(() => { store.set(key, $state.snapshot(value)); });
  return value;
}
