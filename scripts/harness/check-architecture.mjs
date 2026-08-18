import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const layers = ['types', 'config', 'policy', 'domain', 'services', 'adapters', 'entrypoints', 'app'];

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');
const layerIndex = new Map(layers.map((layer, index) => [layer, index]));
const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g;

export function layerForPath(pathname) {
  const parts = normalize(pathname).split(sep);
  return parts.find((part) => layerIndex.has(part)) ?? null;
}

export function validateArchitecture(sourceLayer, specifier) {
  const targetLayer = layerForPath(specifier);
  if (!layerIndex.has(sourceLayer)) return false;
  if (targetLayer === null) return true;
  return layerIndex.get(targetLayer) <= layerIndex.get(sourceLayer);
}

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const file = join(directory, entry);
    return statSync(file).isDirectory() ? walk(file) : [file];
  });
}

function resolveImport(file, specifier) {
  if (!specifier.startsWith('.')) return specifier;
  return resolve(dirname(file), specifier);
}

export function inspectArchitecture(root = sourceRoot) {
  const violations = [];
  for (const file of walk(root).filter((candidate) => ['.ts', '.tsx'].includes(extname(candidate)))) {
    const sourceLayer = layerForPath(relative(root, file));
    if (sourceLayer === null) continue;
    const content = readFileSync(file, 'utf8');
    for (const match of content.matchAll(importPattern)) {
      const specifier = match[1];
      if (!validateArchitecture(sourceLayer, resolveImport(file, specifier))) {
        violations.push(`${relative(root, file)} (${sourceLayer}) cannot import ${specifier}`);
      }
    }
  }
  return violations;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const violations = inspectArchitecture();
  if (violations.length > 0) {
    console.error(violations.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Architecture check passed.');
  }
}
