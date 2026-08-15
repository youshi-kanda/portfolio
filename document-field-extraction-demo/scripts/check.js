#!/usr/bin/env node
/**
 * Static check.
 *
 * Three things, in order of strictness:
 *
 *   1. Every JavaScript file parses (`node --check`).
 *   2. Every module under src/ loads — imports resolve and module bodies run,
 *      which catches a broken import path that a syntax check would miss.
 *      Only src/ is loaded, because importing a script or a test would run it.
 *   3. No file references a network API. This is the property the demo claims,
 *      so it is checked rather than asserted.
 *
 * Exit code 0 when everything passes, 1 otherwise.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCANNED_DIRS = ['src', 'scripts', 'tests'];

/**
 * Identifiers that would let the demo reach the network.
 *
 * Node core modules are listed as quoted specifiers rather than bare words so
 * a comment mentioning HTTP does not trip the check.
 */
const NETWORK_TOKENS = [
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  "'node:http'",
  "'node:https'",
  "'node:net'",
  "'node:dgram'",
  "'node:tls'",
  'UrlFetchApp',
  'axios',
  'node-fetch',
  'undici',
];

/** Files allowed to name a network token, because checking for it is their job. */
const NETWORK_TOKEN_EXEMPT = new Set([
  join('scripts', 'check.js'),
  join('tests', 'no-network.test.js'),
]);

function listJsFiles(dir) {
  const absolute = join(ROOT, dir);
  const found = [];
  for (const entry of readdirSync(absolute)) {
    const full = join(absolute, entry);
    if (statSync(full).isDirectory()) {
      found.push(...listJsFiles(join(dir, entry)));
    } else if (entry.endsWith('.js')) {
      found.push(join(dir, entry));
    }
  }
  return found.sort();
}

async function main() {
  const files = SCANNED_DIRS.flatMap(listJsFiles);
  const failures = [];
  let loadedModules = 0;

  for (const relative of files) {
    try {
      execFileSync(process.execPath, ['--check', join(ROOT, relative)], { stdio: 'pipe' });
    } catch (error) {
      failures.push(`${relative}: syntax error (${String(error.stderr ?? error.message).trim()})`);
      continue;
    }

    // Only src/ is imported: importing a script or a test file would run it.
    if (relative.startsWith(`src${join('/', '')}`) || relative.startsWith('src/')) {
      try {
        await import(pathToFileURL(join(ROOT, relative)).href);
        loadedModules += 1;
      } catch (error) {
        failures.push(`${relative}: does not load (${error.message})`);
        continue;
      }
    }

    if (NETWORK_TOKEN_EXEMPT.has(relative)) continue;

    const source = readFileSync(join(ROOT, relative), 'utf8');
    for (const token of NETWORK_TOKENS) {
      if (source.includes(token)) {
        failures.push(`${relative}: references a network API (${token})`);
      }
    }
  }

  if (failures.length > 0) {
    process.stdout.write(`check failed\n${failures.map((f) => `  ${f}`).join('\n')}\n`);
    return 1;
  }

  process.stdout.write(
    'check passed\n' +
      `  ${files.length} files parse\n` +
      `  ${loadedModules} src modules load\n` +
      '  0 network API references outside the guard itself\n',
  );
  return 0;
}

process.exitCode = await main();
