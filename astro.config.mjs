// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

// Static site: every page is pre-rendered at build time into dist/.
// Standalone simulations in public/ are copied as-is.
export default defineConfig({
  site: 'https://ial-arsenal.thecodeheist.is-a.dev',
  integrations: [svelte()],
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  // Past papers moved from /<subject>/papers/ to their own section, /papers/<subject>/; keep old links working.
  redirects: {
    '/[subject]/papers': '/papers/[subject]',
    '/[subject]/papers/[paper]': '/papers/[subject]/[paper]',
    '/[subject]/topics': '/papers/[subject]/topics',
    '/[subject]/topics/[topic]': '/papers/[subject]/topics/[topic]',
  },
});
