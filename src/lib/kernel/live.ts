/* Live tools: things the page that's open right now lets Kernel do. A lab registers its own tools while it is mounted
   (build this circuit, add this reagent, run this synthesis) and Kernel offers them to the AI next to its site-wide
   tools. Labs stay independent of Kernel: they only import this tiny module.

   In a lab component:
     import { provideKernelTools } from '../../lib/kernel/live';
     onMount(() => provideKernelTools('circuit', 'Circuit Builder: …what the student sees, what the tools do…', [
       { name: 'circuit_build', description: '…', parameters: { type: 'object', properties: {…} }, run: (args) => '…result text…' },
     ]));
   Tool names should start with the lab's scope so they never clash. `run` may be async, and returns text for the AI
   (what happened, and anything the student should now see), or { text, images }. Throw an Error with a helpful
   message when the arguments don't make sense; the AI sees the message and can try again. */

import type { ToolDef, ToolResult } from '../ai';

export interface LiveTool extends ToolDef {
  run(args: Record<string, unknown>): string | ToolResult | Promise<string | ToolResult>;
}

interface Provider { scope: string; about: string; tools: LiveTool[] }
const providers = new Map<string, Provider>();

/** Register a lab's tools for as long as it is on screen. Returns the unregister function (return it from onMount). */
export function provideKernelTools(scope: string, about: string, tools: LiveTool[]): () => void {
  const p = { scope, about, tools };
  providers.set(scope, p);
  return () => { if (providers.get(scope) === p) providers.delete(scope); };
}

/** The live tools right now, and a description of each lab offering them (for the system prompt). */
export function liveTools(): { defs: ToolDef[]; about: string[] } {
  const all = [...providers.values()];
  return {
    defs: all.flatMap((p) => p.tools.map(({ name, description, parameters }) => ({ name, description, parameters }))),
    about: all.map((p) => p.about),
  };
}

export function findLiveTool(name: string): LiveTool | undefined {
  for (const p of providers.values()) { const t = p.tools.find((x) => x.name === name); if (t) return t; }
  return undefined;
}

export async function runLiveTool(t: LiveTool, args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const r = await t.run(args);
    return typeof r === 'string' ? { text: r } : r;
  } catch (e) {
    return { text: `That didn't work: ${(e as Error).message}` };
  }
}
