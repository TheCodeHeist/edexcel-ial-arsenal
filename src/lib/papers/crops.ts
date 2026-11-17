import type { Crop } from './types';

/* Question and mark-scheme crops live in a separate repo, TheCodeHeist/edexcel-ial-arsenal-data, served by
   GitHub Pages; pipeline/publish.py puts them there. Keeping ~1.3 MB of images per paper out of this repo
   keeps the site's own history and deploys small. */
export const CROPS_BASE = 'https://thecodeheist.github.io/edexcel-ial-arsenal-data';

/** Full URL of a crop, e.g. …/physics/WPH14_2026_06/q13_b_i.webp */
export function cropUrl(crop: Crop): string {
  return `${CROPS_BASE}/${crop.src}`;
}
