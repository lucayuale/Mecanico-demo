import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function loadDesign(selected) {
  const registry = JSON.parse(await readFile(path.join(root, 'config', 'designs.json'), 'utf8'));
  const id = selected ?? registry.default;
  if (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !Object.hasOwn(registry.designs, id)) {
    throw new Error(`Diseño no reconocido: ${String(id)}. Disponibles: ${Object.keys(registry.designs).join(', ')}.`);
  }
  const entry = registry.designs[id];
  const resolved = { id, defaultMode: entry.defaultMode, serviceImages: entry.serviceImages === true };
  for (const key of ['source', 'defaults', 'starter', 'starterAssets']) {
    const relative = entry[key];
    if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').includes('..')) throw new Error(`Ruta de diseño no válida: ${id}.${key}.`);
    const absolute = path.resolve(root, relative);
    if (!absolute.startsWith(root + path.sep)) throw new Error(`El diseño debe permanecer dentro del proyecto: ${id}.${key}.`);
    resolved[key] = absolute;
  }
  return resolved;
}
