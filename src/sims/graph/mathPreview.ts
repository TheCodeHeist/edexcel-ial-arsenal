/* Instant client-side KaTeX expression preview for Graph Lab.
   Parses GeoGebra / Edexcel ASCII math (fractions, powers, roots, modulus bars, trig/hyperbolic names,
   Curve/Integral/Derivative commands, inequalities, and coordinate tuples) into clean LaTeX on every keystroke,
   gracefully handling incomplete expressions while the student is still typing. */

type KatexApi = typeof import('katex').default;

let katexMod: KatexApi | null = null;
let katexPromise: Promise<void> | null = null;

export function isKatexReady(): boolean {
  return katexMod !== null;
}

export function loadKatex(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (katexMod) return Promise.resolve();
  return (katexPromise ??= Promise.all([
    import('katex'),
    import('katex/dist/katex.min.css'),
  ]).then(([mod]) => {
    katexMod = mod.default ?? (mod as unknown as KatexApi);
  }).catch((e) => {
    katexPromise = null;
    throw e;
  }));
}

/* ---------- Tokenizer ---------- */

type TokKind = 'num' | 'id' | 'op' | 'lparen' | 'rparen' | 'lbrack' | 'rbrack' | 'lbrace' | 'rbrace' | 'bar' | 'comma' | 'prime';
interface Tok { kind: TokKind; val: string }

function normalizeForPreview(raw: string): string {
  let s = raw.trim();
  if (s.startsWith('$$') && s.endsWith('$$') && s.length > 4) s = s.slice(2, -2).trim();
  else if (s.startsWith('$') && s.endsWith('$') && s.length > 2) s = s.slice(1, -1).trim();

  return s
    .replace(/[−–—]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\u212f/g, 'e')
    .replace(/π/g, ' pi ')
    .replace(/θ/g, ' theta ')
    .replace(/λ/g, ' lambda ')
    .replace(/α/g, ' alpha ')
    .replace(/β/g, ' beta ')
    .replace(/γ/g, ' gamma ')
    .replace(/∞/g, ' inf ')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≠/g, '!=')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4')
    .trim();
}

function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }

    if (/\d/.test(ch) || (ch === '.' && /\d/.test(s[i + 1] ?? ''))) {
      const m = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(s.slice(i));
      if (m) { out.push({ kind: 'num', val: m[0] }); i += m[0].length; continue; }
    }

    if (/[a-zA-Z]/.test(ch)) {
      const m = /^[a-zA-Z]+(?:_[a-zA-Z0-9]+)?/.exec(s.slice(i));
      if (m) { out.push({ kind: 'id', val: m[0] }); i += m[0].length; continue; }
    }

    if (ch === "'") {
      let primes = "'";
      i++;
      while (s[i] === "'") { primes += "'"; i++; }
      out.push({ kind: 'prime', val: primes });
      continue;
    }

    if (ch === '(') { out.push({ kind: 'lparen', val: ch }); i++; continue; }
    if (ch === ')') { out.push({ kind: 'rparen', val: ch }); i++; continue; }
    if (ch === '[') { out.push({ kind: 'lbrack', val: ch }); i++; continue; }
    if (ch === ']') { out.push({ kind: 'rbrack', val: ch }); i++; continue; }
    if (ch === '{') { out.push({ kind: 'lbrace', val: ch }); i++; continue; }
    if (ch === '}') { out.push({ kind: 'rbrace', val: ch }); i++; continue; }
    if (ch === '|') { out.push({ kind: 'bar', val: ch }); i++; continue; }
    if (ch === ',') { out.push({ kind: 'comma', val: ch }); i++; continue; }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      out.push({ kind: 'op', val: ch });
      i++;
      continue;
    }

    i++;
  }
  return out;
}

/* ---------- AST & formatting ---------- */

type Node =
  | { t: 'empty' }
  | { t: 'num'; v: string }
  | { t: 'id'; v: string; primes?: string }
  | { t: 'paren'; items: Node[] }
  | { t: 'brack'; items: Node[] }
  | { t: 'abs'; inner: Node }
  | { t: 'call'; name: string; primes?: string; args: Node[] }
  | { t: 'unary'; op: string; arg: Node }
  | { t: 'pow'; base: Node; exp: Node }
  | { t: 'frac'; num: Node; den: Node }
  | { t: 'mul'; parts: Node[]; explicit: boolean[] }
  | { t: 'add'; head: Node; rest: { op: string; node: Node }[] };

const GREEK: Record<string, string> = {
  pi: '\\pi',
  theta: '\\theta',
  lambda: '\\lambda',
  alpha: '\\alpha',
  beta: '\\beta',
  gamma: '\\gamma',
  delta: '\\delta',
  phi: '\\phi',
  omega: '\\omega',
  inf: '\\infty',
  infinity: '\\infty',
};

const STD_FUNCS = new Set([
  'sin', 'cos', 'tan', 'sec', 'csc', 'cot',
  'sinh', 'cosh', 'tanh', 'ln', 'log',
  'arcsin', 'arccos', 'arctan',
]);

const TEXT_FUNCS: Record<string, string> = {
  cosec: '\\operatorname{cosec}',
  asin: '\\arcsin',
  acos: '\\arccos',
  atan: '\\arctan',
  arsinh: '\\operatorname{arsinh}',
  arcosh: '\\operatorname{arcosh}',
  artanh: '\\operatorname{artanh}',
  asinh: '\\operatorname{arsinh}',
  acosh: '\\operatorname{arcosh}',
  atanh: '\\operatorname{artanh}',
  coth: '\\coth',
  sech: '\\operatorname{sech}',
  csch: '\\operatorname{csch}',
};

function unwrapParens(n: Node): Node {
  let cur = n;
  while (cur.t === 'paren' && cur.items.length === 1) cur = cur.items[0];
  return cur;
}

function startsNumeric(n: Node): boolean {
  if (n.t === 'num') return true;
  if (n.t === 'pow') return startsNumeric(n.base);
  if (n.t === 'mul' && n.parts.length) return startsNumeric(n.parts[0]);
  return false;
}

function endsNumeric(n: Node): boolean {
  if (n.t === 'num') return true;
  if (n.t === 'mul' && n.parts.length) return endsNumeric(n.parts[n.parts.length - 1]);
  return false;
}

function parseExprTokens(toks: Tok[]): Node {
  let pos = 0;
  let barDepth = 0;

  const peek = () => toks[pos];
  const eat = (kind: TokKind, val?: string) => {
    const t = toks[pos];
    if (!t || t.kind !== kind || (val !== undefined && t.val !== val)) return null;
    pos++;
    return t;
  };

  const canStartPrimary = (t: Tok | undefined): boolean => {
    if (!t) return false;
    return t.kind === 'num' || t.kind === 'id' || t.kind === 'lparen' || t.kind === 'lbrack' || t.kind === 'lbrace';
  };

  const parseAdd = (): Node => {
    const head = parseMul();
    const rest: { op: string; node: Node }[] = [];
    while (peek()?.kind === 'op' && (peek()!.val === '+' || peek()!.val === '-')) {
      const op = toks[pos++].val;
      const node = parseMul();
      rest.push({ op, node });
    }
    return rest.length ? { t: 'add', head, rest } : head;
  };

  const parseMul = (): Node => {
    let cur = parseUnary();
    const parts: Node[] = [cur];
    const explicit: boolean[] = [];

    const flushMul = () => {
      if (parts.length === 1) return parts[0];
      return { t: 'mul', parts: [...parts], explicit: [...explicit] } as Node;
    };

    while (true) {
      const t = peek();
      if (!t) break;
      if (t.kind === 'op' && t.val === '/') {
        const left = flushMul();
        pos++;
        const right = parseUnary();
        cur = { t: 'frac', num: left, den: right };
        parts.length = 0;
        explicit.length = 0;
        parts.push(cur);
      } else if (t.kind === 'op' && t.val === '*') {
        pos++;
        const right = parseUnary();
        parts.push(right);
        explicit.push(true);
      } else if (canStartPrimary(t)) {
        const right = parseUnary();
        parts.push(right);
        explicit.push(false);
      } else {
        break;
      }
    }
    return flushMul();
  };

  const parseUnary = (): Node => {
    const t = peek();
    if (t && t.kind === 'op' && (t.val === '+' || t.val === '-')) {
      pos++;
      return { t: 'unary', op: t.val, arg: parseUnary() };
    }
    return parsePow();
  };

  const parsePow = (): Node => {
    const base = parsePrimary();
    if (eat('op', '^')) {
      const exp = parseUnary();
      return { t: 'pow', base, exp };
    }
    return base;
  };

  const parseCommaList = (stopKinds: TokKind[]): Node[] => {
    const items: Node[] = [];
    while (peek() && !stopKinds.includes(peek()!.kind)) {
      if (peek()!.kind === 'bar' && barDepth > 0) break;
      items.push(parseAdd());
      if (!eat('comma')) break;
    }
    return items.length ? items : [{ t: 'empty' }];
  };

  const parsePrimary = (): Node => {
    const t = peek();
    if (!t || t.kind === 'comma' || t.kind === 'rparen' || t.kind === 'rbrack' || t.kind === 'rbrace') {
      return { t: 'empty' };
    }
    if (t.kind === 'bar') {
      if (barDepth > 0) return { t: 'empty' };
      pos++;
      barDepth++;
      const inner = parseAdd();
      eat('bar');
      barDepth--;
      return { t: 'abs', inner };
    }
    if (t.kind === 'num') {
      pos++;
      return { t: 'num', v: t.val };
    }
    if (t.kind === 'id') {
      pos++;
      const primes = eat('prime')?.val;
      if (eat('lparen')) {
        const args = parseCommaList(['rparen']);
        eat('rparen');
        return { t: 'call', name: t.val, primes, args };
      }
      return { t: 'id', v: t.val, primes };
    }
    if (t.kind === 'lparen') {
      pos++;
      const items = parseCommaList(['rparen']);
      eat('rparen');
      return { t: 'paren', items };
    }
    if (t.kind === 'lbrack') {
      pos++;
      const items = parseCommaList(['rbrack']);
      eat('rbrack');
      return { t: 'brack', items };
    }
    if (t.kind === 'lbrace') {
      pos++;
      const items = parseCommaList(['rbrace']);
      eat('rbrace');
      return { t: 'brack', items };
    }
    return { t: 'empty' };
  };

  return parseAdd();
}

function nodeToLatex(n: Node): string {
  switch (n.t) {
    case 'empty':
      return '\\square';
    case 'num':
      return n.v;
    case 'id': {
      const pr = n.primes ?? '';
      const low = n.v.toLowerCase();
      if (GREEK[low]) return `${GREEK[low]}${pr}`;
      if (STD_FUNCS.has(low)) return `\\${low}${pr}`;
      if (TEXT_FUNCS[low]) return `${TEXT_FUNCS[low]}${pr}`;
      const sub = /^([a-zA-Z]+)_([a-zA-Z0-9]+)$/.exec(n.v);
      if (sub) return `${sub[1]}_{${sub[2]}}${pr}`;
      if (n.v.length > 2 && !pr) return `\\mathrm{${n.v}}`;
      return `${n.v}${pr}`;
    }
    case 'paren':
      return `\\left(${n.items.map(nodeToLatex).join(',\\; ')}\\right)`;
    case 'brack':
      return `\\left[${n.items.map(nodeToLatex).join(',\\; ')}\\right]`;
    case 'abs':
      return `\\left|${nodeToLatex(n.inner)}\\right|`;
    case 'unary':
      return `${n.op}${nodeToLatex(n.arg)}`;
    case 'pow': {
      const baseStr = n.base.t === 'pow' ? `\\left(${nodeToLatex(n.base)}\\right)` : nodeToLatex(n.base);
      const expStr = nodeToLatex(unwrapParens(n.exp));
      return `{${baseStr}}^{${expStr}}`;
    }
    case 'frac': {
      const numStr = nodeToLatex(unwrapParens(n.num));
      const denStr = nodeToLatex(unwrapParens(n.den));
      return `\\frac{${numStr}}{${denStr}}`;
    }
    case 'mul': {
      let out = nodeToLatex(n.parts[0]);
      for (let i = 1; i < n.parts.length; i++) {
        const prev = n.parts[i - 1], cur = n.parts[i];
        const curStr = nodeToLatex(cur);
        if (n.explicit[i - 1] && endsNumeric(prev) && startsNumeric(cur)) {
          out += ` \\times ${curStr}`;
        } else {
          out += (out.endsWith('}') || curStr.startsWith('\\') ? ' ' : '') + curStr;
        }
      }
      return out;
    }
    case 'add': {
      let out = nodeToLatex(n.head);
      for (const item of n.rest) {
        out += ` ${item.op} ${nodeToLatex(item.node)}`;
      }
      return out;
    }
    case 'call': {
      const low = n.name.toLowerCase();
      const args = n.args.map(nodeToLatex);
      if (low === 'sqrt') {
        return `\\sqrt{${args[0] ?? '\\square'}}`;
      }
      if (low === 'abs') {
        return `\\left|${args[0] ?? '\\square'}\\right|`;
      }
      if (low === 'integral' && (args.length === 1 || args.length === 3)) {
        if (args.length === 3) return `\\int_{${args[1]}}^{${args[2]}} ${args[0]}\\,dx`;
        return `\\int ${args[0]}\\,dx`;
      }
      if (low === 'integralbetween' && args.length >= 4) {
        return `\\int_{${args[2]}}^{${args[3]}} \\left(${args[0]} - ${args[1]}\\right) dx`;
      }
      if (low === 'derivative') {
        if (args.length >= 2) return `\\frac{d^{${args[1]}}}{dx^{${args[1]}}}\\!\\left(${args[0]}\\right)`;
        return `\\frac{d}{dx}\\!\\left(${args[0] ?? '\\square'}\\right)`;
      }
      if (low === 'curve' && (args.length === 5 || args.length === 6)) {
        if (args.length === 5) return `\\left(${args[0]},\\; ${args[1]}\\right),\\; ${args[3]} \\le ${args[2]} \\le ${args[4]}`;
        return `\\left(${args[0]},\\; ${args[1]},\\; ${args[2]}\\right),\\; ${args[4]} \\le ${args[3]} \\le ${args[5]}`;
      }
      if (low === 'intersect' || low === 'intersectpath') {
        return args.join(' \\cap ');
      }
      const pr = n.primes ?? '';
      const fn = STD_FUNCS.has(low) ? `\\${low}` : TEXT_FUNCS[low] ?? (n.name.length > 2 ? `\\operatorname{${n.name}}` : n.name);
      return `${fn}${pr}\\left(${args.join(',\\; ')}\\right)`;
    }
  }
}

/** Split an expression on top-level relation operators (<=, >=, !=, =, <, >). */
function splitRelations(s: string): { segments: string[]; rels: string[] } {
  const segments: string[] = [];
  const rels: string[] = [];
  let p = 0, b = 0, c = 0;
  let last = 0;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') p++;
    else if (ch === ')' && p > 0) p--;
    else if (ch === '[') b++;
    else if (ch === ']' && b > 0) b--;
    else if (ch === '{') c++;
    else if (ch === '}' && c > 0) c--;

    if (p === 0 && b === 0 && c === 0) {
      const two = s.slice(i, i + 2);
      if (two === '<=' || two === '>=' || two === '!=') {
        segments.push(s.slice(last, i).trim());
        rels.push(two === '<=' ? '\\le' : two === '>=' ? '\\ge' : '\\neq');
        i++;
        last = i + 1;
      } else if (ch === '=' || ch === '<' || ch === '>') {
        segments.push(s.slice(last, i).trim());
        rels.push(ch);
        last = i + 1;
      }
    }
  }
  segments.push(s.slice(last).trim());
  return { segments, rels };
}

/** Convert an ASCII GeoGebra / Edexcel expression into LaTeX for previewing. */
export function exprToLatex(raw: string): string {
  let s = normalizeForPreview(raw);
  if (!s) return '';

  let labelPrefix = '';
  const lblMatch = /^([a-zA-Z]\w*)\s*:(?!=)\s*(.*)$/.exec(s);
  if (lblMatch) {
    labelPrefix = `\\text{${lblMatch[1]}}:\\; `;
    s = lblMatch[2].trim();
    if (!s) return `${labelPrefix}\\square`;
  }

  const { segments, rels } = splitRelations(s);
  const rendered = segments.map((seg) => {
    if (!seg) return '\\square';
    const toks = tokenize(seg);
    if (!toks.length) return '\\square';
    return nodeToLatex(parseExprTokens(toks));
  });

  let body = rendered[0];
  for (let i = 0; i < rels.length; i++) {
    body += ` ${rels[i]} ${rendered[i + 1] ?? '\\square'}`;
  }
  return labelPrefix + body;
}

/** Render an ASCII expression to KaTeX HTML, or '' if blank or KaTeX has not finished loading yet. */
export function renderMathPreview(raw: string): string {
  if (!katexMod || !raw.trim()) return '';
  const tex = exprToLatex(raw);
  if (!tex) return '';
  try {
    return katexMod.renderToString(tex, {
      displayMode: false,
      throwOnError: false,
      strict: 'ignore',
      output: 'htmlAndMathml',
    });
  } catch {
    return '';
  }
}
