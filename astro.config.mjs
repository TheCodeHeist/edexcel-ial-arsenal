// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

// Static site: every page is pre-rendered at build time into dist/.
// Standalone simulations in public/ are copied as-is.
export default defineConfig({
  integrations: [svelte()],
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
