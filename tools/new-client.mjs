import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDesign } from './designs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function options(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!['--client', '--name', '--mode', '--design'].includes(key) || !value || value.startsWith('--') || key in values) {
      throw new Error('Uso: node .\\tools\\new-client.mjs --client <id> [--name "Nombre del negocio"] [--design <id>] [--mode basic|booking]');
    }
    values[key] = value;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values['--client'] || '')) throw new Error('El ID debe usar minúsculas, números y guiones, sin espacios ni rutas.');
  const mode = values['--mode'];
  if (mode !== undefined && !['basic', 'booking'].includes(mode)) throw new Error('La modalidad debe ser basic o booking.');
  const name = (values['--name'] ?? 'Nuevo negocio').trim();
  if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('El nombre debe tener entre 1 y 120 caracteres, sin caracteres de control.');
  return { id: values['--client'], name, mode, designId: values['--design'] };
}

async function createClient() {
  const { id, name, mode: requestedMode, designId } = options(process.argv.slice(2));
  const design = await loadDesign(designId);
  const mode = requestedMode ?? design.defaultMode;
  const defaults = JSON.parse(await readFile(design.defaults, 'utf8'));
  if (!defaults.supportedModes.includes(mode)) throw new Error(`El diseño ${design.id} no admite la modalidad ${mode}.`);
  const profile = JSON.parse(await readFile(design.starter, 'utf8'));
  profile.business.name = name;
  profile.mode = mode;
  if (design.id !== 'obsidian' || profile.design !== undefined) profile.design = design.id;
  profile.seo.title = name;
  // La URL permanece vacía: cada negocio configura su propia cuenta.
  profile.booking.url = '';
  const clientRoot = path.join(root, 'clients');
  await mkdir(clientRoot, { recursive: true });
  const destination = path.join(clientRoot, id);
  try {
    await mkdir(destination);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`clients/${id} ya existe. No se sobrescribió ningún archivo.`);
    throw error;
  }
  try {
    await cp(design.starterAssets, path.join(destination, 'assets'), { recursive: true });
    await writeFile(path.join(destination, 'client.json'), JSON.stringify(profile, null, 2) + '\n', { flag: 'wx' });
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
  console.log(`Creado: clients/${id}/client.json (${mode}). Completá los datos y reemplazá las imágenes de ejemplo antes de publicar.`);
  console.log(`Generar: node .\\tools\\build.mjs --client ${id}`);
}

createClient().catch(error => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
