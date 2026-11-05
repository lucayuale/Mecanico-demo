import { cp, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opts = {};
async function main() {
  for (let i=0;i<args.length;i+=2) {
    if (!['--out','--client','--name'].includes(args[i]) || !args[i+1] || args[i+1].startsWith('--') || Object.hasOwn(opts,args[i])) throw new Error('Uso: node tools/new-project.mjs --out <carpeta-nueva> --client <id> [--name "Nombre"]');
    opts[args[i]]=args[i+1];
  }
  if (!opts['--out'] || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(opts['--client']||'')) throw new Error('Indicá carpeta nueva e ID seguro.');
  const destination = path.resolve(process.cwd(),opts['--out']);
  if (destination===root || destination.startsWith(root+path.sep) || root.startsWith(destination+path.sep)) throw new Error('El proyecto nuevo debe estar fuera de la base y no contenerla.');
  const parent=path.dirname(destination); await mkdir(parent,{recursive:true});
  // Reserve the destination first. Existing folders, even empty ones, are never overwritten.
  await mkdir(destination);
  let stage;
  try {
    stage=await mkdtemp(path.join(parent,'.vyb-create-'));
    for(const item of ['config','src','tools','tests','docs','README.md','.gitignore']) await cp(path.join(root,item),path.join(stage,item),{recursive:true});
    await mkdir(path.join(stage,'clients')); await mkdir(path.join(stage,'dist'));
    const result=spawnSync(process.execPath,[path.join(stage,'tools/new-client.mjs'),'--client',opts['--client'],'--name',opts['--name']||'Nuevo negocio'],{encoding:'utf8'});
    if(result.status!==0) throw new Error(result.stderr||'No se pudo crear la configuración.');
    await writeFile(path.join(stage,'PROJECT.md'),'# Proyecto autónomo\n\nCreado desde VYB Base. No requiere la base para generar o publicar.\nCliente: '+opts['--client']+'\n\nGenerar: `node tools/build.mjs --client '+opts['--client']+'`\n');
    await rm(destination,{recursive:true}); await rename(stage,destination); stage=null;
    console.log('Proyecto independiente creado: '+destination);
  } catch(error) { await rm(destination,{recursive:true,force:true}); throw error; }
  finally { if(stage) await rm(stage,{recursive:true,force:true}); }
}
main().catch(error=>{console.error('ERROR: '+error.message);process.exitCode=1;});
