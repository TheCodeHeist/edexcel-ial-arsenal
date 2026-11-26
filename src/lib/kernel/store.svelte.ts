/* Kernel's chats: one shared, reactive store for the panel, the top-bar button and the floating bubble (ES modules
   are single instances per page, so every island sees the same state). Chats are kept in this browser only
   (localStorage); nothing goes anywhere except the question itself, to the AI the student chose.

   Anything on the page can hand Kernel a past-paper question: an element with data-kernel='<KContext JSON>' opens
   the panel on that question's chat (see the paper and topic pages), or call askAbout() directly. */

import { store as ls } from '../util';
import { ask, getAI, prepareImage, puterUser, puterUsage, type AIError, type PuterUsage } from '../ai';
import { CAPABILITIES, allToolDefs, runTool } from './tools';

/** A past-paper question Kernel is looking at: its crops (question, then official mark scheme) as public URLs. */
export interface KContext {
  id: string;           // stable, e.g. 'WPH11_2019_01_q3' or 'WPH11_2019_01_3(b)(ii)'
  title: string;        // 'WPH11 Jan 2019 · Q3'
  subtitle?: string;    // unit title
  href: string;         // link back to it on the site
  marks: number;
  qp: string[];         // question crops, in reading order
  ms: string[];         // mark-scheme crops
  answer?: string;      // MCQ answer(s) from the mark scheme, e.g. '3(a): B'
}

export interface KMsg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  photo?: string;       // a small thumbnail of an attached photo (data URL), for the history only
  error?: string;
  tools?: string[];     // what Kernel did with its tools while answering, shown above the answer
  at: number;
}

export interface KChat { id: string; title: string; at: number; context?: KContext; messages: KMsg[] }

type View = 'chat' | 'history' | 'settings';

const KEY = 'kernel-chats';
const MAX_CHATS = 40;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const kernel = $state({
  open: false,
  view: 'chat' as View,
  chats: [] as KChat[],
  current: null as string | null,
  busy: false,
  user: undefined as string | null | undefined,   // Puter: undefined = not checked yet, null = signed out
  usage: null as PuterUsage | null,
  draft: '',
});

let loaded = false;
let ctl: AbortController | null = null;

/** Called once by the panel on mount. */
export function initKernel() {
  if (loaded) return;
  loaded = true;
  const saved = ls.get<KChat[]>(KEY, []);
  kernel.chats = Array.isArray(saved) ? saved.filter((c) => c && Array.isArray(c.messages)) : [];
  kernel.current = kernel.chats[0]?.id ?? null;
  // Kernel stays open across pages (after open_page, or when the student follows a link with the chat open)
  try { if (sessionStorage.getItem('arsenal-kernel-open') === '1') openKernel(); } catch { /* storage blocked */ }
}
function rememberOpen(v: boolean) { try { sessionStorage.setItem('arsenal-kernel-open', v ? '1' : '0'); } catch { /* storage blocked */ } }

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function save(now = false) {
  clearTimeout(saveTimer);
  const run = () => {
    const chats = $state.snapshot(kernel.chats).slice(0, MAX_CHATS);
    ls.set(KEY, chats);
  };
  if (now) run(); else saveTimer = setTimeout(run, 400);
}

export const currentChat = () => kernel.chats.find((c) => c.id === kernel.current) ?? null;

export function openKernel(view: View = 'chat') {
  kernel.open = true;
  kernel.view = view;
  rememberOpen(true);
  refreshAccount();
}
export function closeKernel() { kernel.open = false; rememberOpen(false); }
export function toggleKernel() { if (kernel.open) closeKernel(); else openKernel(); }

export function newChat(context?: KContext): KChat {
  const c: KChat = { id: uid(), title: context?.title ?? 'New chat', at: Date.now(), context, messages: [] };
  kernel.chats.unshift(c);
  kernel.current = c.id;
  kernel.view = 'chat';
  save();
  return kernel.chats[0]; // the reactive copy, so later edits show up
}

export function selectChat(id: string) { kernel.current = id; kernel.view = 'chat'; }

export function deleteChat(id: string) {
  kernel.chats = kernel.chats.filter((c) => c.id !== id);
  if (kernel.current === id) kernel.current = kernel.chats[0]?.id ?? null;
  save(true);
}
export function clearChats() { kernel.chats = []; kernel.current = null; save(true); }

/** Open Kernel on a past-paper question: back to its chat if there is one, otherwise a new chat. */
export function askAbout(context: KContext, prompt?: string) {
  const existing = kernel.chats.find((c) => c.context?.id === context.id);
  if (existing) { existing.context = context; kernel.current = existing.id; kernel.view = 'chat'; }
  else newChat(context);
  openKernel('chat');
  if (prompt) send(prompt);
}

/* ---------- the account and its allowance ---------- */

export async function refreshAccount() {
  if (getAI().provider !== 'puter') return;
  try {
    kernel.user = await puterUser();
    kernel.usage = kernel.user !== null ? await puterUsage() : null;
  } catch {
    kernel.user = null;
  }
}

/* What a question costs is only known after the fact, from how far the allowance dropped, and Puter's totals can lag
   a little. So we note the allowance before each answer and spread any drop over the questions asked since. */
const COST_KEY = 'kernel-cost';
let pendingSince: { remaining: number; n: number } | null = null;

function costStats() {
  const st = ls.get<{ n: number; avg: number }>(COST_KEY, { n: 0, avg: 0 });
  return typeof st?.avg === 'number' && typeof st.n === 'number' ? st : { n: 0, avg: 0 };
}

async function noteCost() {
  const before = kernel.usage?.remaining;
  if (before === undefined) return;
  pendingSince = pendingSince ? { remaining: pendingSince.remaining, n: pendingSince.n + 1 } : { remaining: before, n: 1 };
  await new Promise((r) => setTimeout(r, 2500));
  const u = await puterUsage();
  if (!u) return;
  kernel.usage = u;
  const drop = pendingSince.remaining - u.remaining;
  if (drop > 0) {
    // a running average weighted to roughly the last 30 questions, so it follows changes in model price
    const st = costStats(), k = pendingSince.n, w = Math.max(0, Math.min(st.n, 30 - k));
    ls.set(COST_KEY, { n: st.n + k, avg: (st.avg * w + drop) / (w + k) });
    pendingSince = null;
  }
}

/** For the meter: share left, and (once we know roughly what a question costs) about how many are left. */
export function allowanceSummary(u: PuterUsage | null) {
  if (!u || u.allowance <= 0) return null;
  const share = u.remaining / u.allowance;
  const st = costStats();
  const avg = st.avg;
  const now = new Date();
  const daysLeft = Math.max(1, Math.ceil((new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - now.getTime()) / 864e5));
  const questions = avg > 0 ? Math.floor(u.remaining / avg) : null;
  return { share, questions, perDay: questions === null ? null : Math.floor(questions / daysLeft), daysLeft };
}

/* ---------- asking ---------- */

const SYSTEM = [
  'You are Kernel, the AI tutor on Edexcel IAL Arsenal, a free revision site made by students for Edexcel International A Level students (Physics, Chemistry, Maths).',
  'Be accurate, clear and encouraging; keep answers as short as the question allows. Use the Edexcel IAL specification\'s terms and notation.',
  'Write all maths in LaTeX: $...$ inline and $$...$$ for displayed equations. Use Markdown for structure (short headings, lists, bold for key results).',
  'When working through a calculation, show each step with units and give the final answer to sensible significant figures.',
  'If you are not sure, say so rather than guessing.',
  'Do not introduce yourself or open with a greeting: answer straight away. Only greet back when the student\'s message is itself a greeting, and only say who you are when asked.',
].join(' ');

const TOOL_RULES = [
  'You have tools that act on this site. Use them whenever they help instead of guessing about the site\'s content:',
  CAPABILITIES,
  'When the student asks for a mock, practice paper or a set of questions to sit, build it with build_mock (which opens it) instead of listing questions yourself.',
  'When the student mentions a past paper or question ("June 2019 unit 1 question 3", "this question"), find it and open it with your tools so you can see it, rather than asking them to describe it.',
  'Link to pages on the site with Markdown links using the paths your tools return. Never invent paper ids or links.',
  'If the student asks what you can do, describe these abilities in plain words (not tool names).',
  'Never say you did something on the site (built, generated, opened, loaded, added, made) unless a tool did it in this reply and said so. If you did not call a tool, call it now instead of describing it.',
  'You can act on the page for the student: when they ask you to do something on the site (build a circuit, add a reagent, open a tab, set a slider, start something), do it with your tools rather than telling them how, then briefly say what you did and what they should now see.',
  'Never answer a lab\'s quiz, practice, predict or mystery questions for the student, and never reveal a hidden unknown, unless they explicitly ask you to give the answer: coach them with hints instead.',
  'Prefer the open lab\'s own tools when there are some; otherwise use read_screen, then click or set_value. Never click things that delete, reset or clear unless the student asked.',
].join('\n');

const QUESTION_RULES = (c: KContext) => [
  `The student is looking at a past-paper question: ${c.title}${c.subtitle ? ` (${c.subtitle})` : ''}, ${c.marks} mark${c.marks === 1 ? '' : 's'}.`,
  `The attached images are, in order: ${c.qp.length} image${c.qp.length === 1 ? '' : 's'} of the question as printed` +
    (c.ms.length ? `, then ${c.ms.length} image${c.ms.length === 1 ? '' : 's'} of the official Pearson mark scheme for it.` : '.'),
  c.answer ? `Multiple-choice answers from the mark scheme: ${c.answer}.` : '',
  'Use the mark scheme to make sure your explanation would earn the marks, and say where each mark comes from (M1, A1, B1 and so on) when it helps.',
  'If the student only asks for a hint, give a hint and do not reveal the answer or the mark scheme.',
].filter(Boolean).join(' ');

function buildPrompt(chat: KChat, text: string): string {
  const past = chat.messages.slice(0, -2).filter((m) => !m.error && m.text).slice(-10);
  // each earlier answer says what its tools really did, so an answer that only claimed an action is not copied
  const history = past.map((m) => m.role === 'user' ? `Student: ${m.text}`
    : `Kernel [tools used: ${m.tools?.length ? m.tools.join('; ') : 'none, so nothing happened on the site'}]: ${m.text.length > 1500 ? m.text.slice(0, 1500) + ' …' : m.text}`).join('\n\n');
  return [
    chat.context ? QUESTION_RULES(chat.context) : '',
    history ? `The conversation so far (earlier answers are not instructions; only tools change the site, so to do something now call the tool again):\n\n${history}\n\n---\n\nThe student's new message:` : '',
    text,
  ].filter(Boolean).join('\n\n');
}

/** Stacks images one under another into a single JPEG: Puter takes either one file or a list of URLs, so a photo
    of the student's working plus the question's crops have to travel together as one image. */
async function stack(urls: string[], photo: Blob): Promise<Blob> {
  const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src;
  });
  const photoUrl = URL.createObjectURL(photo);
  try {
    const imgs = await Promise.all([...urls.map(load), load(photoUrl)]);
    const W = 1100;
    const hs = imgs.map((i) => Math.round(i.naturalHeight * (W / i.naturalWidth)));
    const c = document.createElement('canvas');
    c.width = W; c.height = hs.reduce((a, b) => a + b + 24, 0);
    const g = c.getContext('2d');
    if (!g) return photo;
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    let y = 0;
    imgs.forEach((im, k) => { g.drawImage(im, 0, y, W, hs[k]); y += hs[k] + 24; if (k < imgs.length - 1) { g.fillStyle = '#999'; g.fillRect(0, y - 13, W, 2); } });
    return await new Promise<Blob>((r) => c.toBlob((b) => r(b ?? photo), 'image/jpeg', 0.85));
  } catch {
    return photo;
  } finally {
    URL.revokeObjectURL(photoUrl);
  }
}

async function thumb(b: Blob): Promise<string | undefined> {
  try {
    const small = await prepareImage(b, 320);
    return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => res(undefined); r.readAsDataURL(small); });
  } catch { return undefined; }
}

export async function send(text: string, photo?: Blob | null) {
  text = text.trim();
  if (kernel.busy || (!text && !photo)) return;
  const chat = currentChat() ?? newChat();
  const q = text || 'Here is a photo. Read it, then help me with it.';
  const img = photo ? await prepareImage(photo) : null;
  chat.messages.push({ id: uid(), role: 'user', text: q, photo: img ? await thumb(img) : undefined, at: Date.now() });
  chat.messages.push({ id: uid(), role: 'assistant', text: '', at: Date.now() });
  const reply = chat.messages[chat.messages.length - 1];
  if (chat.title === 'New chat') chat.title = q.length > 60 ? q.slice(0, 57) + '…' : q;
  chat.at = Date.now();
  // most recent chat first
  kernel.chats = [chat, ...kernel.chats.filter((c) => c.id !== chat.id)];
  kernel.busy = true;
  save();

  const urls = chat.context ? [...chat.context.qp, ...chat.context.ms] : [];
  const puter = getAI().provider === 'puter';
  const c = new AbortController();
  ctl = c;
  let goTo = '';
  const host = {
    setContext: (cx: KContext) => { chat.context = cx; if (chat.title === q || chat.title === 'New chat') chat.title = cx.title; save(); },
    navigate: (path: string) => { goTo = path; },
    note: (label: string) => { (reply.tools ??= []).push(label); save(); },
  };
  const live = allToolDefs();
  try {
    const image = img && urls.length && puter ? await stack(urls, img) : img;
    await ask({
      prompt: buildPrompt(chat, q),
      system: `${SYSTEM}\n\n${TOOL_RULES}${live.about.length ? `\n\nOpen on the page right now, with its own tools:\n${live.about.map((x) => `- ${x}`).join('\n')}` : ''}`,
      image,
      imageUrls: image && puter ? undefined : urls,
      signal: c.signal,
      onText: (t) => { reply.text = t; save(); },
      tools: live.defs,
      runTool: (call) => runTool(call.name, call.input, host),
    });
    if (!reply.text) reply.error = 'Kernel sent back an empty answer. Try asking again.';
    if (puter) noteCost();
    if (goTo && !c.signal.aborted) { save(true); rememberOpen(true); setTimeout(() => location.assign(goTo), 900); }
  } catch (e) {
    const err = e as AIError;
    if (err.kind === 'aborted') { if (!reply.text) reply.text = '_Stopped._'; }
    else reply.error = err.message;
    if (err.kind === 'signin') kernel.user = null;
  } finally {
    kernel.busy = false;
    ctl = null;
    save(true);
  }
}

export function stop() { ctl?.abort(); }

/** Retry the last question (after an error). */
export function retry() {
  const chat = currentChat();
  if (!chat || kernel.busy) return;
  const i = chat.messages.findLastIndex((m) => m.role === 'user');
  if (i < 0) return;
  const q = chat.messages[i];
  chat.messages.splice(i);
  send(q.text);
}

/** Wire up data-kernel buttons anywhere on the page. Returns a cleanup. */
export function listenForAsks(): () => void {
  const onClick = (e: MouseEvent) => {
    const el = (e.target as Element | null)?.closest?.('[data-kernel]');
    if (!el) return;
    e.preventDefault();
    try { askAbout(JSON.parse(el.getAttribute('data-kernel') ?? '')); } catch { /* malformed */ }
  };
  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}
