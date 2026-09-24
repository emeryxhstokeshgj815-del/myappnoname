#!/usr/bin/env node
// Build the single-file app: bundle JS, minify CSS, inline data and sounds -> index.html
import { build, transform } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = process.env.CRUX_DATA || join(ROOT, 'data', 'build', 'app-data.json');
const outPath = process.env.CRUX_OUT || join(ROOT, 'index.html');

const js = await build({
  entryPoints: [join(ROOT, 'src', 'main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  target: ['es2019', 'safari13', 'chrome80', 'firefox78'],
  write: false,
  legalComments: 'none',
});
const css = await transform(readFileSync(join(ROOT, 'src', 'styles.css'), 'utf8'), { loader: 'css', minify: true, target: ['safari13', 'chrome80'] });

if (!existsSync(dataPath)) {
  console.error('Missing dataset: ' + dataPath + ' (run python3 scripts/build_dataset.py)');
  process.exit(1);
}
const data = readFileSync(dataPath, 'utf8');
JSON.parse(data); // fail early on broken JSON

const soundsDir = join(ROOT, 'assets', 'sounds');
const sounds = {};
for (const f of readdirSync(soundsDir)) {
  if (f.endsWith('.wav')) sounds[f.replace(/\.wav$/, '')] = readFileSync(join(soundsDir, f)).toString('base64');
}

const safe = (s) => s.replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');
let html = readFileSync(join(ROOT, 'src', 'index.template.html'), 'utf8');
html = html
  .replace('/*__CSS__*/', () => css.code.trim())
  .replace('/*__DATA__*/', () => safe(data))
  .replace('/*__SOUNDS__*/', () => safe(JSON.stringify(sounds)))
  .replace('/*__JS__*/', () => safe(js.outputFiles[0].text.trim()));
writeFileSync(outPath, html);
const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log(`index.html ${kb(Buffer.byteLength(html))} (js ${kb(js.outputFiles[0].text.length)}, css ${kb(css.code.length)}, data ${kb(data.length)}, sounds ${kb(JSON.stringify(sounds).length)})`);
