// Fails if anything in the built extension points at a file that is not in it: the manifest's
// paths, src/href in pages, url() in stylesheets, and extension paths in scripts.
// Usage: node scripts/verify-dist.js [dist-folder]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = path.resolve(process.argv[2] || 'dist');
// Paths Chrome serves itself rather than from the package.
const virtualPaths = ['/_favicon/'];
const external = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}

function manifestPaths(manifest) {
  return [
    manifest.background?.service_worker,
    manifest.side_panel?.default_path,
    manifest.options_page,
    manifest.options_ui?.page,
    manifest.action?.default_popup,
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action?.default_icon || {})
  ].filter(Boolean);
}

// A script's paths are resolved against the page that runs it, and every page is at the top of dist/.
function scriptPaths(source) {
  const found = [];
  for (const match of source.matchAll(/getURL\(\s*["'`]([^"'`]*)["'`]/g)) found.push(match[1]);
  for (const match of source.matchAll(/["'`](\/?assets\/[^"'`?#]+|[\w-]+\.html)(?=[?#"'`])/g)) found.push(match[1]);
  return found;
}

export function findMissing(root) {
  const missing = [];
  const check = (from, ref, base) => {
    const clean = ref.trim().split(/[?#]/)[0];
    if (!clean || external.test(ref.trim()) || virtualPaths.some(p => clean.startsWith(p))) return;
    const target = clean.startsWith('/') ? path.join(root, clean) : path.resolve(base, clean);
    if (!target.startsWith(root) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      missing.push(`${path.relative(root, from)} -> ${ref}`);
    }
  };
  const manifestFile = path.join(root, 'manifest.json');
  for (const ref of manifestPaths(JSON.parse(fs.readFileSync(manifestFile, 'utf8')))) check(manifestFile, ref, root);
  for (const file of files(root)) {
    const source = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.html')) {
      for (const match of source.matchAll(/\s(?:src|href)=["']([^"']*)["']/g)) check(file, match[1], path.dirname(file));
      for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) check(file, match[1], path.dirname(file));
    } else if (file.endsWith('.css')) {
      for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) check(file, match[1], path.dirname(file));
    } else if (file.endsWith('.js')) {
      for (const ref of scriptPaths(source)) check(file, ref, root);
    }
  }
  return missing;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!fs.existsSync(path.join(dist, 'manifest.json'))) {
    console.error(`❌ ${dist} has no manifest.json. Run "npm run build" first.`);
    process.exit(1);
  }
  const missing = findMissing(dist);
  if (missing.length) {
    console.error(`❌ ${missing.length} reference(s) in ${path.basename(dist)}/ point to missing files:`);
    for (const line of missing) console.error(`   ${line}`);
    process.exit(1);
  }
  console.log(`✅ Every file reference in ${path.basename(dist)}/ resolves.`);
}
