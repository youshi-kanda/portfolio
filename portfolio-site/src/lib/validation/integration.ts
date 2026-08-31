/**
 * The gate, wired into the build.
 *
 * content-model §2.3: validate at the START of the build, before rendering.
 * `astro:build:start` is the last hook that runs before any page is rendered,
 * so a failure here means nothing was ever written to dist/.
 *
 * Failures are not downgradable. There is no `--force`.
 */
import type { AstroIntegration } from 'astro';
import { loadAll } from '../content/load.ts';
import { format, runGates } from './index.ts';

export function truthGateIntegration(): AstroIntegration {
  return {
    name: 'portfolio:truth-gate',
    hooks: {
      'astro:build:start': ({ logger }) => {
        const { errors, warnings, ok } = runGates(loadAll(), { mode: 'production' });

        for (const w of warnings) logger.warn(`[${w.code}] ${w.message}`);

        if (!ok) {
          throw new Error(
            'Truth Gate: production build を中止しました。\n' +
              format(errors) +
              '\n\n  preview / development build であればこの内容でも表示できます' +
              '（npm run dev）。',
          );
        }
        logger.info('Truth Gate: content OK');
      },
    },
  };
}
