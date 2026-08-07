/**
 * Verifies that the pdf.js runtime assets were copied into
 * public/vendor/pdfjs/ before the frontend tries to import them.
 *
 * Without this the copy steps fail silently (cpx exits 0 when a glob matches
 * nothing) and the problem only surfaces much later as a confusing webpack
 * error: Can't resolve '@pdfjs/pdf.min.mjs'.
 *
 * Also guards the mtime-based `cpx -u` copies: those skip work by timestamp, so
 * a pdfjs-dist version bump whose extracted files happen to be older than the
 * vendored copies would leave stale assets in place. The version stamp catches
 * that mismatch.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vendorDir = join(appDir, 'public/vendor/pdfjs');
const stampFile = join(vendorDir, '.pdfjs-version');

const requiredFiles = [
  'pdf.min.mjs',
  'pdf.worker.min.mjs',
  'openjpeg.wasm',
  'qcms_bg.wasm',
  'annotation_layer_builder.css',
  'text_layer_builder.css',
];
const requiredDirs = ['cmaps', 'standard_fonts'];

const problems = [];

for (const name of requiredFiles) {
  const target = join(vendorDir, name);
  try {
    const stat = statSync(target);
    if (!stat.isFile()) {
      problems.push(`${name}: not a file`);
    } else if (stat.size === 0) {
      problems.push(`${name}: empty file`);
    }
  } catch {
    problems.push(`${name}: missing`);
  }
}

for (const name of requiredDirs) {
  const target = join(vendorDir, name);
  try {
    if (!statSync(target).isDirectory()) {
      problems.push(`${name}/: not a directory`);
    } else if (readdirSync(target).length === 0) {
      problems.push(`${name}/: empty directory`);
    }
  } catch {
    problems.push(`${name}/: missing`);
  }
}

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};

const installed = readJson(join(appDir, 'node_modules/pdfjs-dist/package.json'))?.version ?? null;
let vendored = null;
try {
  vendored = readFileSync(stampFile, 'utf8').trim();
} catch {
  vendored = null;
}

if (installed && vendored && installed !== vendored) {
  problems.push(`stale assets: vendored ${vendored}, but pdfjs-dist ${installed} is installed`);
}

if (problems.length > 0) {
  console.error(`pdf.js vendor assets are incomplete in ${vendorDir}:`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  console.error('\nTo rebuild them:');
  console.error('  rm -rf apps/openreadest-app/public/vendor/pdfjs');
  console.error('  pnpm install && pnpm setup-vendors');
  console.error(
    '\nIf pdfjs-dist itself is missing, initialize Git submodules first: git submodule update --init --recursive',
  );
  process.exit(1);
}

if (installed && installed !== vendored) {
  writeFileSync(stampFile, `${installed}\n`);
}

console.log(`pdf.js vendor assets verified in ${vendorDir}${installed ? ` (${installed})` : ''}`);
