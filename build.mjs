// Build script: bundles JS/CSS with esbuild and assembles the static HTML pages.
//   node build.mjs           → one-off production build
//   node build.mjs --watch   → rebuild on change
//
// Pages live in src/pages/*.html and may use:
//   <!--#include header-->      → src/partials/header.html
//   {{t:some.key}}              → English text from src/i18n/en.js (the runtime swaps languages)
//   {{page}}                    → the page id (file name without .html)
import * as esbuild from 'esbuild';
import { readFile, writeFile, readdir, watch } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = process.env.AXIS_ROOT || path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, 'src');
const watchMode = process.argv.includes('--watch');
const dev = watchMode || process.argv.includes('--dev');

// Optional extra module folder (lets the bundle resolve dependencies installed elsewhere).
const nodePaths = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : [];

async function loadDictionary() {
  // Cache-bust so --watch picks up edits to the dictionary.
  const url = pathToFileURL(path.join(src, 'i18n', 'en.js')).href + '?v=' + Date.now();
  return (await import(url)).default;
}

function lookup(dict, key) {
  const value = key.split('.').reduce((node, part) => (node == null ? node : node[part]), dict);
  if (typeof value !== 'string') throw new Error(`Missing English string for "${key}"`);
  return value;
}

async function buildPages() {
  const dict = await loadDictionary();
  const partialDir = path.join(src, 'partials');
  const partials = {};
  for (const file of await readdir(partialDir)) {
    partials[path.basename(file, '.html')] = await readFile(path.join(partialDir, file), 'utf8');
  }
  const pageDir = path.join(src, 'pages');
  const pages = (await readdir(pageDir)).filter((f) => f.endsWith('.html'));
  for (const file of pages) {
    const page = path.basename(file, '.html');
    let html = await readFile(path.join(pageDir, file), 'utf8');
    // Partials may include other partials, so expand until stable.
    for (let i = 0; i < 5 && html.includes('<!--#include'); i++) {
      html = html.replace(/<!--#include\s+([\w-]+)\s*-->/g, (_, name) => {
        if (!(name in partials)) throw new Error(`Unknown partial "${name}" in ${file}`);
        return partials[name];
      });
    }
    html = html
      .replace(/\{\{page\}\}/g, page)
      .replace(/\{\{t:([\w.-]+)\}\}/g, (_, key) => lookup(dict, key));
    await writeFile(path.join(root, file), html);
  }
  return pages.length;
}

// app.js runs on every page; scene.js (three.js) and map.js (Leaflet) load on demand.
const jsOptions = {
  entryPoints: {
    app: path.join(src, 'main.js'),
    scene: path.join(src, 'features', 'scene.entry.js'),
    map: path.join(src, 'features', 'map.entry.js'),
  },
  outdir: path.join(root, 'assets/js'),
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  legalComments: 'none',
  charset: 'utf8', // keep Georgian/Cyrillic text as UTF-8 instead of \u escapes (much smaller)
  nodePaths,
  logLevel: 'warning',
};

const cssOptions = {
  entryPoints: [path.join(src, 'styles', 'main.css')],
  outfile: path.join(root, 'assets/css/main.css'),
  bundle: true,
  minify: !dev,
  external: ['../fonts/*', '../img/*'],
  logLevel: 'warning',
};

async function buildAll() {
  const started = Date.now();
  await Promise.all([esbuild.build(jsOptions), esbuild.build(cssOptions)]);
  const count = await buildPages();
  console.log(`built ${count} pages + assets in ${Date.now() - started}ms`);
}

await buildAll();

if (watchMode) {
  console.log('watching src/ …');
  let timer;
  for await (const _ of watch(src, { recursive: true })) {
    clearTimeout(timer);
    timer = setTimeout(() => buildAll().catch((err) => console.error(err.message)), 80);
  }
}

if (!existsSync(path.join(root, 'index.html'))) process.exitCode = 1;
