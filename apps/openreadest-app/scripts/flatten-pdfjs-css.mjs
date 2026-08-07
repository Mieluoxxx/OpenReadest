/**
 * Flattens the nested pdf.js CSS from the foliate-js submodule into
 * public/vendor/pdfjs/.
 *
 * Replaces two `npx postcss ... > out.css` shell steps. Two reasons:
 *
 * 1. Incremental: skips work when the output is newer than both the source CSS
 *    and this script, which keeps `pnpm dev` / `tauri dev` startup fast. The
 *    shell redirect form had no way to do that and re-ran PostCSS every time.
 * 2. Shell redirection truncates the output file before PostCSS runs, so a
 *    failure left behind an empty-but-present CSS file. Writing only after a
 *    successful transform keeps the previous output intact on failure.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import postcssNested from 'postcss-nested';

const thisFile = fileURLToPath(import.meta.url);
const appDir = resolve(dirname(thisFile), '..');
const sourceDir = resolve(appDir, '../../packages/foliate-js/vendor/pdfjs');
const outDir = join(appDir, 'public/vendor/pdfjs');

const stylesheets = ['annotation_layer_builder.css', 'text_layer_builder.css'];

const mtimeOf = (path) => {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return null;
  }
};

const scriptMtime = mtimeOf(thisFile) ?? Date.now();

mkdirSync(outDir, { recursive: true });

for (const name of stylesheets) {
  const source = join(sourceDir, name);
  const target = join(outDir, name);

  const sourceMtime = mtimeOf(source);
  if (sourceMtime === null) {
    console.error(`Missing pdf.js stylesheet: ${source}`);
    console.error('Initialize Git submodules: git submodule update --init --recursive');
    process.exit(1);
  }

  const targetMtime = mtimeOf(target);
  if (targetMtime !== null && targetMtime >= sourceMtime && targetMtime >= scriptMtime) {
    continue;
  }

  const css = readFileSync(source, 'utf8');
  const result = await postcss([postcssNested]).process(css, { from: source, map: false });
  writeFileSync(target, result.css);
  console.log(`Flattened ${name}`);
}
