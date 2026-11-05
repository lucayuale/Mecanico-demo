import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, readdir, rm, lstat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=await mkdtemp(path.join(os.tmpdir(),'VYB autonomous path with spaces '));
const project=path.join(temp,'standalone project');
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const digest=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
function run(script,args=[],success=true,where=project){const r=spawnSync(process.execPath,[path.join(where,'tools',script),...args],{cwd:os.tmpdir(),encoding:'utf8'});assert.equal(r.status===0,success,`${script} ${args.join(' ')}\n${r.stdout}\n${r.stderr}`);return r;}
async function config(id,mode='booking',where=project){const ctx={window:{}};vm.runInNewContext(await readFile(path.join(where,'dist',id,mode,'config.js'),'utf8'),ctx);return ctx.window.VYB_CONFIG;}
async function walk(p){const a=[];for(const e of await readdir(p,{withFileTypes:true})){const f=path.join(p,e.name);assert.equal((await lstat(f)).isSymbolicLink(),false,'No symlinks allowed');if(e.isDirectory())a.push(...await walk(f));else a.push(f);}return a;}
async function verifyOutput(id,mode){const dir=path.join(project,'dist',id,mode),c=await config(id,mode),h=await readFile(path.join(dir,'index.html'),'utf8');for(const f of ['index.html','styles.css','app.js','config.js','.vyb-build.json'])assert.ok((await lstat(path.join(dir,f))).isFile());
assert.match(h,new RegExp(`<html lang="${c.language.default}"`));assert.equal(h.includes('{{SEO_'),false);
const ids=[...h.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size,'unique IDs');
for(const m of h.matchAll(/(?:src|href)="([^"#]+)"/g)){if(!/^[a-z]+:/i.test(m[1]))assert.ok((await lstat(path.join(dir,m[1]))).isFile());}
for(const m of h.matchAll(/href="#([^\"]+)"/g))assert.ok(ids.includes(m[1]),`missing anchor ${m[1]}`);
const assets=[c.images.hero,c.images.manifesto,...c.images.gallery.flatMap(x=>[x.src,x.large]),...c.services.map(x=>x.image),...(c.menu||[]).flatMap(x=>x.items.map(d=>d.image))].filter(x=>x?.startsWith('assets/'));
for(const f of assets){assert.equal(await digest(path.join(dir,f)),await digest(path.join(project,'clients',id,f)));if(f.endsWith('.webp')){const b=await readFile(path.join(dir,f));assert.equal(b.toString('ascii',8,12),'WEBP');}}
if(mode==='basic'){assert.doesNotMatch(h,/id="booking-modal"|id="booking-status"/);assert.equal(c.booking.url,'');}else{assert.match(h,/id="booking-modal"/);assert.match(h,/id="booking-fallback"[^>]*rel="noopener noreferrer"/);}
for(const lang of c.language.available)for(const m of h.matchAll(/data-i18n="([^"]+)"/g))assert.ok(c.translations[lang][m[1]]?.trim(),`${lang}.${m[1]}`);
}
try{
 await mkdir(project);for(const name of ['config','src','tools','clients','templates','tests','docs','README.md','.gitignore']){try{await cp(path.join(root,name),path.join(project,name),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}}
 await mkdir(path.join(project,'clients'),{recursive:true});
 const reg=await json(path.join(project,'config/designs.json'));assert.equal(Object.keys(reg.designs).length,1,'Exactly one design per project');
 const design=reg.default,entry=reg.designs[design],defaults=await json(path.join(project,entry.defaults));
 const before=await readdir(path.join(root,'clients')).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
 for(const id of await readdir(path.join(project,'clients')))for(const mode of defaults.supportedModes){run('build.mjs',['--client',id,'--mode',mode]);await verifyOutput(id,mode);}
 const fixture=await json(path.join(root,'tests/fixtures/v6-output-sha256.json'));
 for(const [f,expected] of Object.entries(fixture))assert.equal(await digest(path.join(project,f)),expected,`v6 regression: ${f}`);
 console.log(`PASS: ${design} builds with no master or sibling projects present; ${Object.keys(fixture).length} v6 output files preserved byte for byte.`);
 const builder=path.join(project,'tools/build.mjs');
 for(const f of (await walk(project)).filter(x=>/\.(?:m?js|html|css|json)$/.test(x)&&!x.includes(path.sep+'dist'+path.sep)&&!x.includes(path.sep+'tests'+path.sep))){const s=await readFile(f,'utf8');assert.doesNotMatch(s,/\/workspace\/|workspace\\scratch|VYB_PLANTILLA_MAESTRA_v6/,'No machine-specific source paths');if(f.endsWith('.mjs'))for(const m of s.matchAll(/from\s+['"]([^'"]+)['"]/g)){if(m[1].startsWith('node:'))continue;assert.ok(path.resolve(path.dirname(f),m[1]).startsWith(project+path.sep),'Import stays inside its own project');}}
 run('new-client.mjs',['--client','neutral-one','--name','Neutral One','--mode','booking']);run('new-client.mjs',['--client','neutral-two','--name','Neutral Two','--mode','booking']);
 const onePath=path.join(project,'clients/neutral-one/client.json'),one=await json(onePath);
 assert.equal(one.booking.url,'');assert.equal(one.contact.phone,'');assert.equal(one.contact.email,'');assert.doesNotMatch(JSON.stringify(one),/obsidiam|lucarcnp|Alba & Olive|PIVOT|Serein|Obsidian|Taller Norte|setmore\.com/i);
 assert.equal(one.images.hero,'assets/placeholder.svg');run('build.mjs',['--client','neutral-one']);run('build.mjs',['--client','neutral-two']);await verifyOutput('neutral-one','booking');assert.equal((await config('neutral-one')).booking.url,'');
 const two=await digest(path.join(project,'dist/neutral-two/booking/config.js'));one.business.name='Changed One';one.language.default='es';await writeFile(onePath,JSON.stringify(one));run('build.mjs',['--client','neutral-one']);assert.equal((await config('neutral-one')).language.default,'es');assert.equal(await digest(path.join(project,'dist/neutral-two/booking/config.js')),two);
 run('new-client.mjs',['--client','neutral-one'],false);
 const sentinel=path.join(temp,'unowned');await mkdir(sentinel);await writeFile(path.join(sentinel,'keep.txt'),'KEEP');run('build.mjs',['--client','neutral-one','--out',sentinel],false);assert.equal(await readFile(path.join(sentinel,'keep.txt'),'utf8'),'KEEP');
 run('build.mjs',['--client','neutral-one','--out','docs'],false);run('build.mjs',['--client','neutral-one','--design','other'],false);
 for(const url of ['javascript:alert(1)','http://obsidiam.setmore.com','https://evil.example.test','https://obsidiam.setmore.com.evil.test','https://user:pass@obsidiam.setmore.com','https://obsidiam.setmore.com:444']){one.booking={mode:'modal',url};await writeFile(onePath,JSON.stringify(one));run('build.mjs',['--client','neutral-one'],false);}
 one.booking={mode:'external',url:'https://booking.example.test'};await writeFile(onePath,JSON.stringify(one));run('build.mjs',['--client','neutral-one']);assert.equal((await config('neutral-one')).booking.url,'https://booking.example.test/');assert.doesNotMatch(await readFile(path.join(project,'dist/neutral-one/booking/index.html'),'utf8'),/id="booking-modal"/);
 one.booking={mode:'modal',url:''};one.password='forbidden';await writeFile(onePath,JSON.stringify(one));run('build.mjs',['--client','neutral-one'],false);delete one.password;
 if(design==='restaurante'){
  const demo=await config('restaurante');assert.equal(demo.language.default,'en');assert.equal(demo.menu.length,4);assert.equal(demo.menu.flatMap(c=>c.items).length,8);assert.equal(demo.booking.url,'https://obsidiam.setmore.com/');assert.equal(one.menu.length,0);
  const valid=[{id:'new-category',name:{en:'New category',es:'Nueva categoría'},items:[{id:'dish',name:{en:'New dish',es:'Nuevo plato'},description:{en:'Description',es:'Descripción'},price:17.5,currency:'USD',image:'assets/placeholder.svg',imageAlt:{en:'Placeholder',es:'Imagen de ejemplo'}}]}];one.menu=valid;await writeFile(onePath,JSON.stringify(one));run('build.mjs',['--client','neutral-one']);assert.equal((await config('neutral-one')).menu[0].items[0].price,17.5);
  for(const mutate of [m=>{m[0].items[0].price=-1;},m=>{m.push(m[0]);},m=>{delete m[0].name.es;},m=>{m[0].items[0].currency='INVALID';},m=>{m[0].items[0].image='../outside.webp';},m=>{m[0].items[0].image='javascript:alert(1)';},m=>{delete m[0].items[0].imageAlt.es;}]){one.menu=structuredClone(valid);mutate(one.menu);await writeFile(onePath,JSON.stringify(one));run('build.mjs',['--client','neutral-one'],false);}
  assert.match(await readFile(path.join(project,'src/app.js'),'utf8'),/createElement\('article'\)/);assert.equal((await readFile(path.join(project,'src/app.js'),'utf8')).includes('link.href = \'#menu-\''),true);
  console.log('PASS: 4 menu categories, 8 bilingual dishes; price, category, image, currency and translation validation; dishes do not trigger booking.');
 }
 if(design==='base'){
  const created=path.join(temp,'brand new independent site');run('new-project.mjs',['--out',created,'--client','business','--name','My Business']);run('build.mjs',['--client','business'],true,created);assert.equal((await config('business','basic',created)).booking.url,'');run('new-project.mjs',['--out',created,'--client','business'],false);run('new-project.mjs',['--out',path.join(project,'inside'),'--client','business'],false);
  console.log('PASS: base creates a complete independent source project outside itself; rejects existing folders and nested destinations.');
 }
 assert.deepEqual(await readdir(path.join(root,'clients')).catch(e=>{if(e.code==='ENOENT')return [];throw e;}),before);
 console.log('PASS: neutral clients, ES/EN, local resources, missing booking URL, external mode, isolation, HTTPS allow-list, credentials and output ownership.');
} finally {await rm(temp,{recursive:true,force:true});}
