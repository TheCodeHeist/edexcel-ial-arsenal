/* A unit's mock-paper pool: every checked question, in the compact shape the mock page picks from. */
import type { APIRoute } from 'astro';
import { PAPER_SUBJECTS } from '../../../../data/paperSubjects';
import { papersForUnit, isPublished } from '../../../../lib/papers/registry';
import { pool } from '../../../../lib/papers/mockPool';
import type { Subject } from '../../../../lib/papers/types';

export function getStaticPaths() {
  return PAPER_SUBJECTS.flatMap((s) => s.units
    .filter((u) => papersForUnit(s.id, u.code).some((p) => p.questions.some(isPublished)))
    .map((u) => ({ params: { subject: s.id, unit: u.code } })));
}

export const GET: APIRoute = ({ params }) =>
  new Response(JSON.stringify(pool(params.subject as Subject, params.unit!)), {
    headers: { 'Content-Type': 'application/json' },
  });
