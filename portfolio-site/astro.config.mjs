// @ts-check
import { defineConfig } from 'astro/config';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { truthGateIntegration } from './src/lib/validation/integration.ts';

/**
 * The Lead A/B review build (Phase 5, ART-DIRECTION-REVIEW.md §9).
 *
 * `REVIEW_LEAD` draws one of the two candidates; see
 * `src/lib/review/lead-candidate.ts`. The only thing this block adds to the
 * build is the guarantee that such a build CANNOT LAND IN dist/: the output
 * directory has to be named explicitly, and naming dist is refused. A review
 * frame is a photograph taken for a decision, not a release, and the way to
 * keep that true is to make the other outcome impossible rather than to
 * remember not to do it.
 *
 * With `REVIEW_LEAD` unset this is `undefined` and the config is the config.
 */
const reviewOutDir = (() => {
  if (!process.env.REVIEW_LEAD?.trim()) return undefined;
  const out = process.env.REVIEW_OUT?.trim();
  if (!out) {
    throw new Error(
      'REVIEW_LEAD を立てるなら REVIEW_OUT で出力先を明示すること。' +
        'review build は dist/ へ出力できない。',
    );
  }
  if (resolve(out) === resolve('dist')) {
    throw new Error('REVIEW_OUT に dist は指定できない。review build は公開ビルドではない。');
  }
  return out;
})();

// https://astro.build/config
export default defineConfig({
  // The canonical public origin, declared once. Every absolute URL the build
  // emits — the canonical link, og:url, the sitemap entries, the Sitemap line
  // in robots.txt — is resolved from `Astro.site` against this value, so there
  // is no second place that can disagree with it. Moving the site is a
  // one-line change here, and `check-links` fails the build if any emitted
  // absolute URL is on a different origin.
  site: 'https://portfolio.neppepe.net',

  // Static output. There is no server runtime to operate, and nothing on this
  // site is per-request: the content is a fixed set of works and the pages are
  // the same for every visitor.
  output: 'static',
  trailingSlash: 'always',

  // Only ever set for a review build — see `reviewOutDir` above.
  ...(reviewOutDir ? { outDir: reviewOutDir } : {}),

  integrations: [truthGateIntegration()],

  vite: {
    plugins: [tailwindcss()],

    build: {
      // esbuild, not lightningcss.
      //
      // lightningcss folds `animation-timeline` into the `animation`
      // shorthand — `animation: linear both mx-travel scroll(root)` — and
      // Chrome rejects a timeline written there, so the declaration is invalid
      // and every scroll-driven animation in motion.css silently disappears
      // from the production build. It also rewrites
      // `animation-range: entry 0% cover 16%` to `entry cover 16%`.
      //
      // Verified both ways with `document.getAnimations()` against a real
      // build: 0 scroll/view timelines with lightningcss, 14 with esbuild.
      // Nothing else in the site depends on lightningcss-specific output —
      // Tailwind runs its own pipeline for the utility layer either way.
      cssMinify: 'esbuild',
    },
  },
});
