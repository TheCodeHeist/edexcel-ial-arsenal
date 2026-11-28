/* Cross-lab revision progress aggregator + JSON backup/restore for localStorage (arsenal-*). */

import { TOOLS } from '../data/tools';
import type { SubjectId } from '../data/subjects';
import { store } from './util';

export interface LabProgress {
  slug: string;
  title: string;
  subject: SubjectId;
  href: string;
  right: number;
  total: number;
  best: number;
  extra?: string;
}

export interface ProgressSummary {
  labs: LabProgress[];
  totalRight: number;
  totalAttempted: number;
  practised: number;
  bestStreak: number;
}

const KEY_FOR: Record<string, string> = {
  'd-block-colour-bench': 'dblock-score',
  'carbon-alchemy': 'carbon-score',
  'kinetics-lab': 'kinetics-score',
  'atoms-bonding-lab': 'atoms-score',
  'energetics-lab': 'energetics-score',
  'acid-base-lab': 'acidbase-score',
  'circuit-builder': 'circuit-score',
  'projectile-lab': 'projectile-score',
  'star-lab': 'stars-score',
  'particle-lab': 'particles-score',
  'waves-lab': 'waves-score',
  'fields-lab': 'fields-score',
  'decision-lab': 'decision-score',
  'graph-lab': 'graph-score',
  'stats-lab': 'stats-score',
};

export function readProgress(): ProgressSummary {
  const labs: LabProgress[] = TOOLS.map((tool) => {
    const key = KEY_FOR[tool.slug];
    const raw = key ? store.get<Record<string, number> | null>(key, null) : null;
    let right = 0, total = 0, best = 0;
    let extra: string | undefined;

    if (raw) {
      if (tool.slug === 'd-block-colour-bench') {
        right = (raw.pRight || 0) + (raw.uSolved || 0) + (raw.aRight || 0);
        total = (raw.pTotal || 0) + (raw.uTotal || 0) + (raw.aTotal || 0);
        best = raw.best || 0;
      } else if (tool.slug === 'carbon-alchemy') {
        right = (raw.synSolved || 0) + (raw.idSolved || 0) + (raw.cxRight || 0);
        total = (raw.synSolved || 0) + (raw.idTotal || 0) + (raw.cxTotal || 0);
        best = raw.synBest || 0;
        const prog = store.get<{ found?: string[]; foundRx?: number[] } | null>('carbon-progress', null);
        if (prog?.foundRx?.length) extra = `${prog.foundRx.length} reactions discovered`;
      } else if (tool.slug === 'projectile-lab') {
        const ts = store.get<{ hits?: number; shots?: number; best?: number } | null>('projectile-tscore', null);
        right = (raw.right || 0) + (ts?.hits || 0);
        total = (raw.total || 0) + (ts?.shots || 0);
        best = Math.max(raw.best || 0, ts?.best || 0);
      } else {
        right = raw.right || 0;
        total = raw.total || 0;
        best = raw.best || 0;
      }
    }

    return { slug: tool.slug, title: tool.title, subject: tool.subject, href: tool.href, right, total, best, extra };
  });

  let totalRight = 0, totalAttempted = 0, practised = 0, bestStreak = 0;
  for (const l of labs) {
    totalRight += l.right;
    totalAttempted += l.total;
    if (l.total > 0 || l.extra) practised++;
    if (l.best > bestStreak) bestStreak = l.best;
  }
  return { labs, totalRight, totalAttempted, practised, bestStreak };
}

export function exportArsenalData(): string {
  const data: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('arsenal-')) {
        const v = localStorage.getItem(k);
        if (v !== null) data[k] = v;
      }
    }
  } catch { /* storage blocked */ }
  return JSON.stringify({ app: 'edexcel-ial-arsenal', version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
}

export function importArsenalData(jsonText: string): { ok: boolean; count: number; error?: string } {
  try {
    const parsed = JSON.parse(jsonText);
    const data = parsed?.data;
    if (!data || typeof data !== 'object') return { ok: false, count: 0, error: 'Not a valid IAL Arsenal backup file.' };
    let count = 0;
    for (const [k, v] of Object.entries(data)) {
      if (k.startsWith('arsenal-') && typeof v === 'string') {
        localStorage.setItem(k, v);
        count++;
      }
    }
    return { ok: true, count };
  } catch {
    return { ok: false, count: 0, error: 'Could not parse JSON file.' };
  }
}

export function clearAllProgress() {
  try {
    const keep = new Set(['arsenal-palette', 'arsenal-mode', 'arsenal-perf']);
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('arsenal-') && !keep.has(k)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch { /* storage blocked */ }
}
