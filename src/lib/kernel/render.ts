/* Turns a Kernel answer (Markdown with LaTeX maths) into safe HTML. Loaded only when the Kernel panel first opens,
   so KaTeX and its fonts never weigh down a page nobody asks a question on.
   Order matters: maths is cut out first (so Markdown can't mangle `_` and `*` inside it), the Markdown is rendered
   and sanitised (the model's text is untrusted), and only then is the KaTeX output, which we trust, put back. */
import { marked } from 'marked';
import katex from 'katex';
import DOMPurify from 'dompurify';
import 'katex/dist/katex.min.css';

const MATH = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)|\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?=\S)([^$\n`]+?)(?<=\S)\$(?!\d)/g;

let hooked = false;

export function renderKernel(src: string): string {
  if (!hooked) {
    // links from the model open in a new tab and can't reach back into the page
    DOMPurify.addHook('afterSanitizeAttributes', (n) => {
      if (n.tagName === 'A') { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener noreferrer'); }
    });
    hooked = true;
  }
  const math: string[] = [];
  const cut = src.replace(MATH, (all, code: string | undefined, dd?: string, sq?: string, rp?: string, d?: string) => {
    if (code) return code;
    const display = dd !== undefined || sq !== undefined;
    const tex = (dd ?? sq ?? rp ?? d ?? '').trim();
    let html: string;
    try {
      html = katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' });
    } catch {
      return all;
    }
    math.push(display ? `<span class="kx-math">${html}</span>` : html);
    return `kxmath${math.length - 1}xk`;
  });
  const html = DOMPurify.sanitize(marked.parse(cut, { async: false, gfm: true, breaks: true }) as string);
  return html.replace(/kxmath(\d+)xk/g, (_, i: string) => math[+i] ?? '');
}
