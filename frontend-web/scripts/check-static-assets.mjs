#!/usr/bin/env node
// Vérifie que les fichiers statiques (logo, icônes, images) restent accessibles
// partout, pas seulement sur un Mac.
//
// 1. Chaque chemin "/xxx.png" (ou .jpg, .svg…) cité dans le code doit exister
//    dans public/ (ou app/ pour icon.png) avec EXACTEMENT la même casse.
//    macOS et Windows ignorent la casse, Linux (Docker, CI, prod) non :
//    "/logo.png" pour un fichier "Logo.png" marche en local et casse ailleurs.
// 2. Les noms de fichiers de public/ sont en minuscules, sans espace.
// 3. Le middleware d'auth ne bloque pas les fichiers statiques : sinon un
//    visiteur non connecté (page de connexion) est redirigé au lieu de
//    recevoir le logo.
//
// Usage : npm run check:assets

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const errors = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const toUrl = (base, file) => '/' + relative(base, file).split(sep).join('/');

// ── Fichiers servis à la racine du site ─────────────────────────
const publicDir = join(root, 'public');
const publicFiles = walk(publicDir);
const served = new Set(publicFiles.map((f) => toUrl(publicDir, f)));
// Fichiers de métadonnées Next placés dans app/ (servis à la racine)
for (const name of readdirSync(join(root, 'app'))) {
  if (/^(icon|apple-icon|favicon|opengraph-image|twitter-image)\.[a-z]+$/.test(name)) {
    served.add('/' + name);
  }
}

// ── 2. Noms de fichiers sûrs dans public/ ───────────────────────
for (const file of publicFiles) {
  const url = toUrl(publicDir, file);
  if (/[A-Z\s]/.test(url)) {
    errors.push(`public${url} : renomme en minuscules, sans espace (ex. "${url.toLowerCase().replace(/\s+/g, '-')}")`);
  }
}

// ── 1. Références dans le code ──────────────────────────────────
const ASSET_REF = /["'`(]\s*(\/[^"'`()\s?#]+\.(?:png|jpe?g|gif|webp|avif|svg|ico))(?=[?#"'`)\s])/gi;
const servedLower = new Map([...served].map((u) => [u.toLowerCase(), u]));
const sourceDirs = ['app', 'components', 'hooks', 'lib', 'store'].map((d) => join(root, d));
const sourceFiles = [join(root, 'middleware.ts'), ...sourceDirs.flatMap((d) => walk(d))].filter((f) =>
  /\.(tsx?|jsx?|mjs|css)$/.test(f),
);

for (const file of sourceFiles) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(ASSET_REF)) {
    const url = match[1];
    if (url.startsWith('//') || served.has(url)) continue;
    const line = text.slice(0, match.index).split('\n').length;
    const where = `${relative(root, file)}:${line}`;
    const sameButCase = servedLower.get(url.toLowerCase());
    errors.push(
      sameButCase
        ? `${where} : "${url}" introuvable sous Linux, le fichier s'appelle "${sameButCase}" (casse différente)`
        : `${where} : "${url}" introuvable dans public/`,
    );
  }
}

// ── 3. Le middleware laisse passer les fichiers statiques ───────
const middleware = readFileSync(join(root, 'middleware.ts'), 'utf8');
const matcherSrc = middleware.match(/matcher:\s*\[\s*'([^']+)'/)?.[1];
if (!matcherSrc) {
  errors.push('middleware.ts : matcher introuvable, impossible de vérifier les fichiers statiques');
} else {
  // Le matcher est une expression régulière écrite dans une chaîne TS ('\\.' → '\.')
  const matcher = new RegExp('^' + matcherSrc.replace(/\\\\/g, '\\') + '$');
  for (const url of served) {
    if (matcher.test(url)) {
      errors.push(`middleware.ts : "${url}" passe par le middleware d'auth (redirigé vers /login si non connecté)`);
    }
  }
  if (!matcher.test('/chat')) {
    errors.push('middleware.ts : le matcher ne protège plus les pages (ex. /chat)');
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} problème(s) de fichiers statiques :\n`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✓ Fichiers statiques OK (${served.size} fichiers servis, ${sourceFiles.length} fichiers source vérifiés)`);
