/* Kernel, the site's AI helper. One ask() for the whole site. The site never pays for AI and never holds a key; the student brings the allowance:
   - 'puter' (default): Puter.js, the "user pays" model. The student signs in to their own free Puter account once,
     and their requests use that account's allowance. The script loads only when someone actually uses AI.
   - 'gemini': the student's own Google AI Studio key. It stays in this browser (localStorage) and is only ever sent
     to Google, straight from the browser.
   Nothing here talks to a server of ours, so the AI keeps working whether or not anyone is maintaining the site. */

import { store } from './util';

export type Provider = 'puter' | 'gemini';
export interface AISettings {
  provider: Provider;
  geminiKey: string;
  geminiModel: string; // chosen by the student; '' = pick automatically
  geminiAuto: string;  // the automatic pick for the saved key, remembered so we don't list models on every ask
}

export type AIErrorKind = 'signin' | 'key' | 'limit' | 'blocked' | 'model' | 'network' | 'aborted' | 'other';
export class AIError extends Error {
  kind: AIErrorKind;
  constructor(kind: AIErrorKind, message: string) { super(message); this.name = 'AIError'; this.kind = kind; }
}

/** A tool Kernel can use (OpenAI-style function: a JSON Schema for its arguments). */
export interface ToolDef { name: string; description: string; parameters: object }
export interface ToolCall { id: string; name: string; input: Record<string, unknown> }
/** What a tool hands back: text for the model, and optionally images it should now look at. */
export interface ToolResult { text: string; images?: string[] }

export interface AskOptions {
  prompt: string;
  system?: string;
  image?: Blob | null;              // a photo of a question or of working; see prepareImage()
  imageUrls?: string[];             // public images, e.g. past-paper crops (ignored by Puter when `image` is set)
  signal?: AbortSignal;
  onText?: (soFar: string) => void; // called as the answer streams in, with everything received so far
  tools?: ToolDef[];                // offered to the model
  runTool?: (call: ToolCall) => Promise<ToolResult>;
}

/* ---------- settings ---------- */

const KEY = 'ai';
const DEFAULTS: AISettings = { provider: 'puter', geminiKey: '', geminiModel: '', geminiAuto: '' };
let state: AISettings | null = null;
const subs = new Set<(s: AISettings) => void>();

export function getAI(): AISettings {
  if (!state) {
    const s = store.get<Partial<AISettings>>(KEY, {});
    state = { ...DEFAULTS, ...(s && typeof s === 'object' ? s : {}) };
    if (state.provider !== 'gemini') state.provider = 'puter';
    if (/latest/.test(state.geminiAuto)) state.geminiAuto = ''; // older builds auto-picked the alias; pick again
  }
  return state;
}
export function setAI(patch: Partial<AISettings>) {
  state = { ...getAI(), ...patch };
  store.set(KEY, state);
  for (const f of subs) f(state);
}
export function onAI(f: (s: AISettings) => void) { subs.add(f); return () => { subs.delete(f); }; }

/* ---------- ask ---------- */

export async function ask(o: AskOptions): Promise<string> {
  const s = getAI();
  try {
    return s.provider === 'gemini' ? await askGemini(s, o) : await askPuter(o);
  } catch (e) {
    throw toAIError(e, o.signal);
  }
}

/* ---------- Puter ---------- */

interface PuterUser { username?: string }
interface Puter {
  ai: { chat(...args: unknown[]): Promise<unknown> };
  auth: {
    isSignedIn(): boolean;
    signIn(opts?: object): Promise<unknown>;
    signOut(): Promise<void>;
    getUser(): Promise<PuterUser>;
    getMonthlyUsage(): Promise<unknown>;
  };
}
declare global { interface Window { puter?: Puter } }

const PUTER_SRC = 'https://js.puter.com/v2/';
/* A fast multimodal model: good at A-level maths and photos, and light on the student's free allowance.
   If Puter ever retires it, askPuter() falls back to Puter's own default model. */
const PUTER_MODEL = 'gemini-3-flash-preview';

let puterLoading: Promise<Puter> | null = null;
export function loadPuter(): Promise<Puter> {
  if (typeof window === 'undefined') return Promise.reject(new AIError('other', 'AI runs in the browser only.'));
  if (window.puter) return Promise.resolve(window.puter);
  return (puterLoading ??= new Promise<Puter>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PUTER_SRC;
    s.async = true;
    s.onload = () => (window.puter ? resolve(window.puter) : fail());
    s.onerror = fail;
    document.head.append(s);
    function fail() {
      puterLoading = null;
      s.remove();
      reject(new AIError('network', "Couldn't load Puter. Check your connection (an ad-blocker can also block it) and try again."));
    }
  }));
}

/** Call from a click handler: browsers block sign-in popups that don't come straight from a click. */
export async function puterSignIn(): Promise<string | null> {
  const p = await loadPuter();
  try {
    await p.auth.signIn();
  } catch (e) {
    const code = (e as { error?: string })?.error;
    if (code === 'popup_blocked') throw new AIError('signin', 'Your browser blocked the sign-in window. Allow pop-ups for this site, or click the button again.');
    if (code === 'auth_window_closed') throw new AIError('signin', 'The sign-in window was closed before you finished.');
    throw toAIError(e);
  }
  return puterUser();
}
export async function puterUser(): Promise<string | null> {
  const p = await loadPuter();
  if (!p.auth.isSignedIn()) return null;
  try { return (await p.auth.getUser())?.username ?? ''; } catch { return ''; }
}
export async function puterSignOut() { const p = await loadPuter(); await p.auth.signOut(); }

/** The signed-in student's Puter allowance, in microcents ($0.01 = 1,000,000). It is monthly and doesn't roll over. */
export interface PuterUsage { allowance: number; remaining: number }
export async function puterUsage(): Promise<PuterUsage | null> {
  const p = await loadPuter();
  if (!p.auth.isSignedIn()) return null;
  try {
    const u = (await p.auth.getMonthlyUsage()) as { allowanceInfo?: { monthUsageAllowance?: number; remaining?: number } };
    const a = u?.allowanceInfo;
    if (typeof a?.monthUsageAllowance !== 'number' || typeof a.remaining !== 'number') return null;
    return { allowance: a.monthUsageAllowance, remaining: Math.max(0, a.remaining) };
  } catch {
    return null;
  }
}

async function askPuter(o: AskOptions): Promise<string> {
  const p = await loadPuter();
  if (!p.auth.isSignedIn()) throw new AIError('signin', 'Sign in to Puter first. It is free, and your questions use your own Puter allowance.');
  // Puter's prompt-with-media forms take no separate system prompt, so there it leads the prompt instead.
  const folded = (text: string) => (o.system ? `${o.system}\n\n---\n\n${text}` : text);
  const file = o.image ? (o.image instanceof File ? o.image : new File([o.image], 'image.jpg', { type: o.image.type || 'image/jpeg' })) : null;
  const tools = o.tools?.length ? o.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })) : undefined;
  let model: string | undefined = PUTER_MODEL;

  /** One request; falls back to Puter's default model once if ours has been retired. */
  const call = async (make: (opts: object) => Promise<unknown>) => {
    const opts = () => ({ stream: true, signal: o.signal, ...(model ? { model } : {}), ...(tools ? { tools } : {}) });
    try { return await make(opts()); } catch (e) {
      if (o.signal?.aborted || !model || !/model/i.test(errText(e))) throw e;
      model = undefined;
      return await make(opts());
    }
  };

  let shown = ''; // text already shown from earlier rounds, so each round's stream continues it
  const show = (t: string) => o.onText?.(shown + t);

  // Round 1: with the question's images if there are any, otherwise as a proper conversation with a system message.
  const base: object[] = [...(o.system ? [{ role: 'system', content: o.system }] : []), { role: 'user', content: o.prompt }];
  let resp = await call((opts) =>
    file ? p.ai.chat(folded(o.prompt), file, false, opts)
    : o.imageUrls?.length ? p.ai.chat(folded(o.prompt), o.imageUrls, false, opts)
    : p.ai.chat(base, opts));

  // Rounds of tool use: run what the model asked for, hand back the results, let it continue. If it runs out of
  // rounds, or stops without a word, ask once more without tools so the student always gets an answer.
  let history = base;
  const notes: string[] = [];
  for (let round = 0; ; round++) {
    const { text, calls } = await collectPuter(resp, show);
    if (round === 0 && !calls.length && o.runTool && tools && CLAIMS.test(text)) {
      // it claimed an action without taking it: once, tell it so and let it actually call the tool
      history = [...history, { role: 'assistant', content: text }, { role: 'user', content: NUDGE }];
      const h = history;
      show('');
      resp = await call((opts) => p.ai.chat(h, opts));
      continue;
    }
    if (!o.runTool || (!calls.length && (text.trim() || !notes.length))) return shown + text;
    if (!calls.length || round >= MAX_ROUNDS) {
      if (text) shown += text + '\n\n';
      const ask = [...(o.system ? [{ role: 'system', content: o.system }] : []), { role: 'user', content: wrapUp(o.prompt, notes, calls.length > 0) }];
      resp = await call((opts) => p.ai.chat(ask, { ...opts, tools: undefined }));
      return shown + (await collectPuter(resp, show)).text;
    }
    const results = [];
    for (const c of calls) {
      let r: ToolResult;
      try { r = await o.runTool(c); } catch (e) { r = { text: `Error: ${(e as Error).message}` }; }
      results.push({ c, r });
      notes.push(toolNote(c.name, r.text));
    }
    if (text) shown += text + '\n\n';
    const images = results.flatMap(({ r }) => r.images ?? []);
    if (images.length) {
      // A tool put new images in front of Kernel (it opened a question). Media can't ride in a tool result, so
      // ask once more with the images attached and the tool results spelled out, and finish there.
      resp = await call((opts) => p.ai.chat(folded(`${o.prompt}\n\n---\n\nYou used your tools:\n${notes.slice(-12).join('\n')}\n\nThe attached images are what the tools loaded. Now answer the student's message.`), images, false, { ...opts, tools: undefined }));
      const { text: t2 } = await collectPuter(resp, show);
      return shown + t2;
    }
    history = [
      ...history,
      { role: 'assistant', content: text || '', tool_calls: calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.input) } })) },
      ...results.map(({ c, r }) => ({ role: 'tool', tool_call_id: c.id, content: r.text })),
    ];
    const h = history;
    resp = await call((opts) => p.ai.chat(h, opts));
  }
}

async function collectPuter(resp: unknown, onText?: (s: string) => void): Promise<{ text: string; calls: ToolCall[] }> {
  const calls: ToolCall[] = [];
  if (resp && typeof (resp as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    let out = '';
    for await (const raw of resp as AsyncIterable<{ type?: string; text?: string; message?: string; id?: string; name?: string; input?: unknown }>) {
      if (raw?.type === 'error') throw new AIError('other', raw.message || 'The AI sent back an error.');
      if (raw?.type === 'tool_use' && raw.name) { calls.push({ id: raw.id || `call_${calls.length}`, name: raw.name, input: parseArgs(raw.input) }); continue; }
      if (typeof raw?.text === 'string' && (!raw.type || raw.type === 'text')) { out += raw.text; onText?.(out); }
    }
    return { text: out, calls };
  }
  // not streamed (older SDK or a model without streaming): { message: { content, tool_calls } }
  const msg = (resp as { message?: { content?: unknown; tool_calls?: { id?: string; function?: { name?: string; arguments?: unknown } }[] } })?.message;
  const c = msg?.content;
  const out = typeof c === 'string' ? c
    : Array.isArray(c) ? c.map((b) => (b as { text?: string })?.text ?? '').join('')
    : msg ? '' : String(resp ?? '');
  for (const t of msg?.tool_calls ?? []) if (t.function?.name) calls.push({ id: t.id || `call_${calls.length}`, name: t.function.name, input: parseArgs(t.function.arguments) });
  if (out) onText?.(out);
  return { text: out, calls };
}

/** An answer that says it did something on the site ("I have generated your mock") although no tool ran. */
const CLAIMS = /\b(?:I(?:'ve| have)?|I've just|I just)\s+(?:now\s+)?(?:generated|built|created|opened|loaded|made|set up|added|switched|started|taken you)\b/i;
const NUDGE = 'You said you did that, but you did not call any tool, so nothing happened on the site. Call the right tool now to actually do it (or, if no tool can, say so plainly).';

/** How many times one message may go back to the tools before Kernel must answer with what it has. */
const MAX_ROUNDS = 8;
/** What the tools did this message, for a closing answer asked without tools. */
const toolNote = (name: string, text: string) => `[${name}] ${text.length > 1500 ? text.slice(0, 1500) + ' …' : text}`;
const wrapUp = (prompt: string, notes: string[], outOfSteps: boolean) =>
  `${prompt}\n\n---\n\nYou used your tools:\n${notes.slice(-12).join('\n')}\n\n` +
  (outOfSteps ? 'You have used all your tool steps for this message. ' : '') +
  'Now reply to the student in words: say what you did and what it shows, and if something is not finished or did not work, say so plainly and what they can ask you to try next.';

function parseArgs(x: unknown): Record<string, unknown> {
  if (x && typeof x === 'object') return x as Record<string, unknown>;
  if (typeof x === 'string') { try { const v = JSON.parse(x); return v && typeof v === 'object' ? v : {}; } catch { return {}; } }
  return {};
}

/* ---------- Gemini (the student's own key) ---------- */

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
export const GEMINI_KEY_URL = 'https://aistudio.google.com/apikey';
export interface GeminiModel { id: string; label: string }

/** Lists the text+vision models this key can use. Doubles as the "does this key work?" check. */
export async function listGeminiModels(key: string, signal?: AbortSignal): Promise<GeminiModel[]> {
  try {
    const res = await fetch(`${GEMINI}/models?pageSize=1000`, { headers: { 'x-goog-api-key': key }, signal });
    if (!res.ok) throw await geminiError(res);
    const j = (await res.json()) as { models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[] };
    return (j.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && /^models\/gemini-/.test(m.name)
        && !/(image|tts|audio|live|embed|robotics|computer-use|native)/i.test(m.name))
      .map((m) => ({ id: m.name.slice('models/'.length), label: m.displayName || m.name.slice('models/'.length) }));
  } catch (e) {
    throw toAIError(e, signal);
  }
}

/** Best first: the newest stable Flash (quick, reads photos well), then previews, then Lite, then the rest.
    The "-latest" aliases rank low: they can point at a busy preview model that answers 503. */
export function rankGeminiModels(models: GeminiModel[]): string[] {
  const rank = (id: string) => {
    const v = parseFloat(/gemini-(\d+(?:\.\d+)?)/.exec(id)?.[1] ?? '0');
    return (/flash/.test(id) ? 1000 : 0) - (/lite/.test(id) ? 500 : 0) - (/(preview|exp)/.test(id) ? 100 : 0)
      - (/latest/.test(id) ? 50 : 0) - (/-\d{3}$/.test(id) ? 1 : 0) + v * 10;
  };
  const sorted = models.map((m) => m.id).sort((a, b) => rank(b) - rank(a));
  /* Fallback order alternates Flash and Flash-Lite. When Google's free Flash models are overloaded they tend to be
     overloaded together (503 "high demand"), and Lite runs on separate capacity, so trying it second gets an answer
     far more often than walking down every Flash version. Models older than 3 come last: new keys can't use them. */
  const old = (id: string) => parseFloat(/gemini-(\d+(?:\.\d+)?)/.exec(id)?.[1] ?? '0') < 3;
  const flash = sorted.filter((id) => /flash/.test(id) && !/lite/.test(id) && !old(id));
  const lite = sorted.filter((id) => /flash/.test(id) && /lite/.test(id) && !old(id));
  const out: string[] = [];
  for (let i = 0; i < Math.max(flash.length, lite.length); i++) { if (flash[i]) out.push(flash[i]); if (lite[i]) out.push(lite[i]); }
  return [...out, ...sorted.filter((id) => !out.includes(id))];
}
export const pickGeminiModel = (models: GeminiModel[]) => rankGeminiModels(models)[0] ?? '';

async function askGemini(s: AISettings, o: AskOptions): Promise<string> {
  if (!s.geminiKey) throw new AIError('key', 'Add your Gemini key in the Kernel settings first.');
  // Interactions API (Google's replacement for generateContent, which new keys can no longer use).
  const firstInput = await withImages(o.prompt, o.imageUrls ?? [], o.image ?? null, o.signal);
  const tools = o.tools?.length && o.runTool
    ? o.tools.map((t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters }))
    : undefined;
  /* With tools, Google keeps the conversation for the tool rounds (store: true, then previous_interaction_id), so the
     model's own reasoning state carries over without us rebuilding it; Google keeps it for a day on the free tier.
     Without tools nothing is stored. */
  const post = (model: string, body: object) => fetch(`${GEMINI}/interactions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': s.geminiKey },
    body: JSON.stringify({ model, stream: true, ...(o.system ? { system_instruction: o.system } : {}), ...(tools ? { tools } : {}), ...body }),
    signal: o.signal,
  });

  /* Try the chosen (or remembered automatic) model first. If it is retired (404), busy (5xx) or out of free quota
     (429; free quotas are per model, so Flash-Lite often still has room when Flash is used up), move down the list. */
  const first = s.geminiModel || s.geminiAuto;
  let tried: string[] = [];
  let res: Response | null = null;
  let ranked: string[] | null = null;
  let retired = false;
  let model = '';
  const fails: { model: string; status: number; err: AIError }[] = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    // after two busy answers in a row, give Google a moment before the next try
    if (fails.length >= 2 && fails.slice(-2).every((f) => f.status >= 500)) await wait(1500, o.signal);
    let m = attempt === 0 ? first : '';
    if (!m) {
      ranked ??= rankGeminiModels(await listGeminiModels(s.geminiKey, o.signal));
      m = ranked.find((id) => !tried.includes(id)) ?? '';
      if (!m) break;
    }
    tried = [...tried, m];
    res = await post(m, { input: firstInput, store: !!tools });
    if (res.ok && res.body) {
      // Remember a new automatic pick only when there was none or the old one was retired, not when it was just
      // busy or used up for today (it will be back).
      if (!s.geminiModel && (!first || retired)) setAI({ geminiAuto: m });
      model = m;
      break;
    }
    const err = await geminiError(res);
    fails.push({ model: m, status: res.status, err });
    if (!(res.status === 404 || res.status === 429 || res.status >= 500)) break;
    if (res.status === 404 && attempt === 0) retired = true;
  }
  if (!model || !res) {
    if (!fails.length) throw new AIError('model', "This key can't use any Gemini text models. Try making a new key in Google AI Studio.");
    const last = fails[fails.length - 1].err;
    if (fails.length === 1) throw last;
    // say what every model answered, so a failure can actually be diagnosed
    const why = (f: (typeof fails)[number]) => f.status >= 500 ? 'busy (Google says high demand)' : f.status === 429 ? 'free allowance used up for now' : f.err.message;
    const allBusy = fails.every((f) => f.status >= 500 || f.status === 429 || f.status === 404);
    throw new AIError(last.kind, `${allBusy ? "Google's free Gemini models are all busy right now. Try again in a minute, or switch to Puter in settings." : 'None of the Gemini models Kernel tried worked.'}\n${fails.map((f) => `• ${f.model}: ${why(f)}`).join('\n')}`);
  }

  let shown = ''; // text from earlier rounds, so each round's stream continues it
  const show = (t: string) => o.onText?.(shown + t);
  let r = await readInteraction(res, show);
  const notes: string[] = [];
  for (let round = 0; ; round++) {
    if (round === 0 && !r.calls.length && o.runTool && tools && r.id && CLAIMS.test(r.text)) {
      // it claimed an action without taking it: once, tell it so and let it actually call the tool
      show('');
      const again = await post(model, { previous_interaction_id: r.id, store: true, input: NUDGE });
      if (!again.ok || !again.body) throw await geminiError(again);
      r = await readInteraction(again, show);
      continue;
    }
    if (!o.runTool || (!r.calls.length && (r.text.trim() || !notes.length))) return shown + r.text;
    const outOfSteps = r.calls.length > 0 && round >= MAX_ROUNDS;
    const results: { c: ToolCall; out: ToolResult }[] = [];
    if (!outOfSteps) for (const c of r.calls) {
      let out: ToolResult;
      try { out = await o.runTool(c); } catch (e) { out = { text: `Error: ${(e as Error).message}` }; }
      results.push({ c, out });
      notes.push(toolNote(c.name, out.text));
    }
    if (r.text) shown += r.text + '\n\n';
    const images = results.flatMap(({ out }) => out.images ?? []);
    let next: Response;
    if (images.length || !r.id || !results.length) {
      // A tool put new images in front of Kernel (it opened a question), there's no stored conversation to continue,
      // or Kernel ran out of steps or stopped without a word: ask afresh without tools, the tool results spelled
      // out (and the images attached), and finish there.
      const text = images.length
        ? `${o.prompt}\n\n---\n\nYou used your tools:\n${notes.slice(-12).join('\n')}\n\nThe attached images are what the tools loaded. Now answer the student's message.`
        : wrapUp(o.prompt, notes, outOfSteps);
      next = await post(model, { input: await withImages(text, images, null, o.signal), store: false, tools: undefined });
      if (!next.ok || !next.body) throw await geminiError(next);
      return shown + (await readInteraction(next, show)).text;
    }
    next = await post(model, {
      previous_interaction_id: r.id,
      store: true,
      input: results.map(({ c, out }) => ({ type: 'function_result', name: c.name, call_id: c.id, result: [{ type: 'text', text: out.text }] })),
    });
    if (!next.ok || !next.body) throw await geminiError(next);
    r = await readInteraction(next, show);
  }
}

/** Interactions input: plain text, or image blocks followed by the text. */
async function withImages(text: string, urls: string[], extra: Blob | null, signal?: AbortSignal) {
  const blobs: Blob[] = [];
  for (const u of urls) {
    try { const r = await fetch(u, { signal }); if (r.ok) blobs.push(await r.blob()); } catch (e) { if (signal?.aborted) throw e; }
  }
  if (extra) blobs.push(extra);
  if (!blobs.length) return text;
  return [
    ...(await Promise.all(blobs.map(async (b) => ({ type: 'image', data: await toBase64(b), mime_type: b.type || 'image/jpeg' })))),
    { type: 'text', text },
  ];
}

type Part = { type?: string; text?: string };
type Step = { type?: string; content?: Part[]; id?: string; call_id?: string; name?: string; arguments?: unknown; _args?: string };
type InteractionEvent = {
  event_type?: string;
  index?: number;
  step?: Step;
  delta?: Part & { partial_arguments?: unknown; arguments?: unknown };
  error?: { message?: string; code?: string };
  steps?: Step[];
  interaction?: { id?: string; steps?: Step[] };
  interaction_id?: string;
  id?: string;
  status?: string;
};

/** Reads an interaction: streamed (server-sent events; text arrives as step.delta text deltas, function calls as
    function_call steps whose arguments may come in pieces) or a plain JSON reply. Thought steps are skipped. */
async function readInteraction(res: Response, onText?: (s: string) => void): Promise<{ text: string; calls: ToolCall[]; id: string }> {
  let out = '', id = '';
  const steps: Step[] = [];
  let final: Step[] | null = null;
  const textOf = (list: Step[]) => list.filter((st) => st.type === 'model_output')
    .flatMap((st) => st.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
  const handle = (j: InteractionEvent) => {
    if (j.event_type === 'error' || (j.error && !j.event_type)) {
      const m = j.error?.message || 'Gemini sent back an error.';
      throw new AIError(/quota|rate|exhaust/i.test(m) ? 'limit' : 'other', m);
    }
    id ||= j.interaction?.id || j.interaction_id || (j.event_type ? '' : j.id || '') || '';
    if (j.interaction?.steps?.length) final = j.interaction.steps;
    const i = j.index ?? -1;
    if (j.event_type === 'step.start' && j.step && i >= 0) { steps[i] = { ...j.step }; return; }
    if (j.event_type === 'step.delta' && j.delta) {
      const d = j.delta;
      if (d.type === 'text' && d.text && steps[i]?.type !== 'thought') { out += d.text; onText?.(out); return; }
      if (/argument/.test(d.type ?? '') && i >= 0) {
        steps[i] ??= { type: 'function_call' };
        const piece = d.partial_arguments ?? d.arguments;
        if (typeof piece === 'string') steps[i]._args = (steps[i]._args ?? '') + piece;
        else if (piece && typeof piece === 'object') steps[i].arguments = piece;
      }
      return;
    }
    if (!j.event_type && j.steps) { final = j.steps; const t = textOf(j.steps); if (t && !out) { out = t; onText?.(out); } }
  };

  // localStorage 'kernel-debug' = '1' logs every raw event to the console, to see what Google really sends
  let debug = false;
  try { debug = localStorage.getItem('kernel-debug') === '1'; } catch { /* storage blocked */ }
  if (!/event-stream/.test(res.headers.get('content-type') ?? '')) {
    const j = (await res.json()) as InteractionEvent;
    if (debug) console.debug('[kernel gemini]', JSON.stringify(j));
    handle(j);
  } else {
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const line = (l: string) => {
      if (!l.startsWith('data:')) return;
      const d = l.slice(5).trim();
      if (!d || d === '[DONE]') return;
      let j: InteractionEvent;
      try { j = JSON.parse(d); } catch { return; }
      if (debug) console.debug('[kernel gemini]', d);
      handle(j);
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let k;
      while ((k = buf.indexOf('\n')) >= 0) { line(buf.slice(0, k).trim()); buf = buf.slice(k + 1); }
    }
    line(buf.trim());
  }
  const list: Step[] = final ?? steps.filter(Boolean);
  if (!out) { const t = textOf(list); if (t) { out = t; onText?.(out); } }
  const calls = list.filter((st) => st?.type === 'function_call' && st.name).map((st, n) => ({
    id: st.id || st.call_id || `call_${n}`,
    name: st.name!,
    // step.start carries an empty `arguments: {}` and the real ones stream in as text deltas, so those win
    input: st._args ? parseArgs(st._args) : parseArgs(st.arguments),
  }));
  if (debug) console.debug('[kernel gemini] read', { id, text: out, calls });
  return { text: out, calls, id };
}

async function geminiError(res: Response): Promise<AIError> {
  let msg = '';
  try {
    let j = (await res.json()) as unknown;
    if (Array.isArray(j)) j = j[0]; // the Interactions API wraps errors in an array
    msg = (j as { error?: { message?: string } })?.error?.message ?? '';
  } catch { /* not JSON */ }
  if (res.status === 429) return new AIError('limit', "This key has used its free Gemini allowance for now. It refills over time (the daily part resets at midnight Pacific time), or switch to Puter in the Kernel settings.");
  if (res.status === 401 || res.status === 403 || /api key/i.test(msg)) return new AIError('key', "Google didn't accept that key. Check you copied all of it, or make a new one in Google AI Studio.");
  if (res.status === 404) return new AIError('model', msg || 'That Gemini model is no longer available.');
  if (res.status >= 500) return new AIError('network', `Gemini is busy or having trouble right now (${res.status}${msg ? `: ${msg}` : ''}). Try again in a minute, or pick another model.`);
  return new AIError('other', msg || `Gemini returned an error (${res.status}).`);
}

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); rej(new AIError('aborted', 'Stopped.')); }, { once: true });
  });
}

/* ---------- images ---------- */

/** Shrinks a photo to at most `max` px on its long side (JPEG). Phone photos are 4000px+, which wastes the student's
    allowance and upload time without helping the model read it. Returns the original if the browser can't decode it. */
export async function prepareImage(file: Blob, max = 1600): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 1.5e6) { bmp.close(); return file; }
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    const g = c.getContext('2d');
    if (!g) { bmp.close(); return file; }
    g.fillStyle = '#fff'; // transparent PNGs would otherwise turn black in a JPEG
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    return await new Promise<Blob>((r) => c.toBlob((b) => r(b ?? file), 'image/jpeg', 0.85));
  } catch {
    return file;
  }
}

function toBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(new AIError('other', "Couldn't read that image."));
    r.readAsDataURL(b);
  });
}

/* ---------- errors ---------- */

function errText(e: unknown): string {
  if (typeof e === 'string') return e;
  const o = e as { message?: unknown; msg?: unknown; error?: unknown; code?: unknown } | null;
  if (!o) return '';
  const inner = o.error && typeof o.error === 'object' ? errText(o.error) : typeof o.error === 'string' ? o.error : '';
  return [o.message, o.msg, inner, o.code].filter((x) => typeof x === 'string' && x).join(' · ');
}

function toAIError(e: unknown, signal?: AbortSignal): AIError {
  if (e instanceof AIError) return e;
  if (signal?.aborted || (e as { name?: string })?.name === 'AbortError') return new AIError('aborted', 'Stopped.');
  if (e instanceof TypeError) return new AIError('network', "Couldn't reach the AI. Check your connection and try again.");
  const t = errText(e);
  if (/rate.?limit|quota|insufficient|funds|credit|usage.?limit|exceeded/i.test(t))
    return new AIError('limit', "You've used your free Puter allowance for now. Try again later, or add your own Gemini key in the Kernel settings.");
  if (/sign.?in|auth|token|unauthori[sz]ed/i.test(t)) return new AIError('signin', 'Your Puter sign-in has expired. Sign in again in the Kernel settings.');
  return new AIError('other', t || 'Something went wrong talking to the AI.');
}
