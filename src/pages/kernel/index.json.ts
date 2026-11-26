/* Kernel's map of the site, fetched only when Kernel uses a tool (see src/lib/kernel/tools.ts): every past paper,
   every spec topic with the newest questions tagged with it, the units, and the labs and drills. */
import type { APIRoute } from 'astro';
import { PAPER_SUBJECTS } from '../../data/paperSubjects';
import { TOOLS } from '../../data/tools';
import { papersFor, isPublished, seriesName, paperSlug, topicList, partsByTopic } from '../../lib/papers/registry';

export const GET: APIRoute = () => {
  const papers = PAPER_SUBJECTS.flatMap((s) => papersFor(s.id).map((p) => ({
    id: p.id, subject: s.id, unit: p.unit, series: seriesName(p), year: +p.series.slice(0, 4),
    href: `/papers/${s.id}/${paperSlug(p)}/`, questions: p.questions.length, checked: p.questions.filter(isPublished).length,
  })));
  const topics = PAPER_SUBJECTS.flatMap((s) => {
    const parts = partsByTopic(s.id);
    return (topicList(s.id)?.units ?? []).flatMap((u) => u.groups.flatMap((g) => g.points.map((pt) => {
      const tagged = parts.get(pt.id) ?? [];
      return {
        subject: s.id, id: pt.id, unit: u.code, group: g.title, short: pt.short, text: pt.text,
        href: tagged.length ? `/papers/${s.id}/topics/${pt.id}/` : null, parts: tagged.length,
        // newest first: 'WPH11_2019_01 Q3 3(b)'
        recent: tagged.slice(0, 8).map((x) => `${x.paper.id} Q${x.question.number} ${x.part.label}`),
      };
    })));
  });
  const units = PAPER_SUBJECTS.flatMap((s) => s.units.map((u) => ({ subject: s.id, code: u.code, badge: u.badge, title: u.title })));
  const tools = TOOLS.map((t) => ({ title: t.title, subject: t.subject, kind: t.kind, blurb: t.blurb, href: t.href, units: t.units, topics: t.topics }));
  return new Response(JSON.stringify({ papers, topics, units, tools }), { headers: { 'Content-Type': 'application/json' } });
};
