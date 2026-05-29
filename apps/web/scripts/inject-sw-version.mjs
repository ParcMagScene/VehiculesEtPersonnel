#!/usr/bin/env node
/**
 * [PERF Phase 4.K] Injection de la version de build dans le Service Worker.
 *
 * Exécuté en post-build (apps/web/package.json → "build"), remplace le
 * placeholder __BUILD_VERSION__ dans dist/sw.js par un identifiant unique
 * basé sur la date/heure du build. À chaque deploy, la version change → la
 * phase activate du SW purge les anciens caches (emag-assets-*, etc.).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const swPath = resolve(__dirname, '..', 'dist', 'sw.js');

if (!existsSync(swPath)) {
  console.warn(`[inject-sw-version] dist/sw.js absent (${swPath}), skip.`);
  process.exit(0);
}

const src = readFileSync(swPath, 'utf8');
if (!src.includes('__BUILD_VERSION__')) {
  console.warn('[inject-sw-version] placeholder __BUILD_VERSION__ absent, skip.');
  process.exit(0);
}

// Format compact YYYYMMDDHHMMSS — tri lexicographique = ordre chronologique.
const d = new Date();
const pad = (n) => String(n).padStart(2, '0');
const version =
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
  `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

const out = src.replace(/__BUILD_VERSION__/g, version);
writeFileSync(swPath, out);
console.log(`[inject-sw-version] dist/sw.js → version ${version}`);
