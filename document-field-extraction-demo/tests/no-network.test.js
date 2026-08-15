/**
 * Network guard.
 *
 * The demo claims it never reaches the network. This file checks that claim
 * two ways: by trapping the global network entry points and running the whole
 * pipeline against them, and by scanning the source for anything that could
 * open a connection.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { runExtractionPipeline } from '../src/index.js';
import { createMockProvider, MOCK_SCENARIOS } from '../src/providers/mock-provider.js';
import { loadOutputSchema } from '../src/schema.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

describe('runtime network trap', () => {
  it('completes the pipeline with every network entry point poisoned', () => {
    const trapped = [];
    const poison = (name) =>
      function poisoned() {
        trapped.push(name);
        throw new Error('network access is prohibited in demo tests');
      };

    const saved = {
      fetch: globalThis.fetch,
      XMLHttpRequest: globalThis.XMLHttpRequest,
      WebSocket: globalThis.WebSocket,
    };

    globalThis.fetch = poison('fetch');
    globalThis.XMLHttpRequest = poison('XMLHttpRequest');
    globalThis.WebSocket = poison('WebSocket');

    try {
      const schema = loadOutputSchema();
      for (const scenario of MOCK_SCENARIOS) {
        const result = runExtractionPipeline({ provider: createMockProvider(scenario), schema });
        assert.equal(typeof result.ok, 'boolean', scenario);
      }
      assert.deepEqual(trapped, [], 'pipeline touched a network entry point');
    } finally {
      globalThis.fetch = saved.fetch;
      globalThis.XMLHttpRequest = saved.XMLHttpRequest;
      globalThis.WebSocket = saved.WebSocket;
    }
  });
});

describe('static network scan', () => {
  /**
   * Node core modules are written as quoted specifiers so that prose mentioning
   * HTTP does not trip the scan.
   */
  const FORBIDDEN = [
    'fetch(',
    'XMLHttpRequest',
    'WebSocket',
    "'node:http'",
    "'node:https'",
    "'node:net'",
    "'node:dgram'",
    "'node:tls'",
    'UrlFetchApp',
  ];

  const SELF = join('tests', 'no-network.test.js');
  const GUARD = join('scripts', 'check.js');

  function listJsFiles(dir) {
    const found = [];
    for (const entry of readdirSync(join(ROOT, dir))) {
      const relative = join(dir, entry);
      if (statSync(join(ROOT, relative)).isDirectory()) {
        found.push(...listJsFiles(relative));
      } else if (entry.endsWith('.js')) {
        found.push(relative);
      }
    }
    return found;
  }

  const files = ['src', 'scripts', 'tests']
    .flatMap(listJsFiles)
    .filter((file) => file !== SELF && file !== GUARD);

  it('scans every source file', () => {
    assert.ok(files.length >= 10, `expected to scan the whole project, saw ${files.length} files`);
  });

  for (const relative of files) {
    it(`${relative} references no network API`, () => {
      const source = readFileSync(join(ROOT, relative), 'utf8');
      for (const token of FORBIDDEN) {
        assert.equal(source.includes(token), false, `${relative} references ${token}`);
      }
    });
  }
});

describe('dependency surface', () => {
  it('declares no dependencies at all', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    assert.equal(manifest.dependencies, undefined);
    assert.equal(manifest.devDependencies, undefined);
  });

  it('imports only node: builtins from outside the project', () => {
    const files = ['src', 'scripts', 'tests'].flatMap(listJsFiles);
    const importPattern = /from\s+'([^']+)'/g;

    for (const relative of files) {
      const source = readFileSync(join(ROOT, relative), 'utf8');
      for (const [, specifier] of source.matchAll(importPattern)) {
        const isRelative = specifier.startsWith('.');
        const isBuiltin = specifier.startsWith('node:');
        assert.ok(isBuiltin || isRelative, `${relative} imports third-party module ${specifier}`);
      }
    }
  });

  function listJsFiles(dir) {
    const found = [];
    for (const entry of readdirSync(join(ROOT, dir))) {
      const relative = join(dir, entry);
      if (statSync(join(ROOT, relative)).isDirectory()) {
        found.push(...listJsFiles(relative));
      } else if (entry.endsWith('.js')) {
        found.push(relative);
      }
    }
    return found;
  }
});
