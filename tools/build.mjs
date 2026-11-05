import { copyFile, mkdir, readFile, readdir, lstat, unlink, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDesign } from './designs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharedSource = path.join(root, 'src');
const sharedFiles = ['index.html', 'styles.css', 'app.js'];
const cssColorVariables = {
  primary: '--gold', secondary: '--ink-2', backgroundDark: '--black', accentLight: '--gold-light',
  backgroundLight: '--paper', backgroundSoft: '--paper-soft', muted: '--muted', white: '--white', text: '--ink', button: '--button',
  buttonText: '--button-text', servicesBackground: '--services-bg', heroBackground: '--hero-bg',
  manifestoBackground: '--manifesto-bg', footerBackground: '--footer-bg', textOnDark: '--text-on-dark',
  textMutedOnDark: '--text-muted-on-dark', textMutedOnLight: '--text-muted-on-light',
  cardBackground: '--card-bg', cardBorder: '--card-border'
};

function cli(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!['--client', '--design', '--mode', '--out'].includes(key) || !args[index + 1] || args[index + 1].startsWith('--')) {
      throw new Error('Uso: node .\\tools\\build.mjs --client <id> [--design <id>] [--mode <basic|booking>] [--out <carpeta>]');
    }
    if (result[key]) throw new Error(`Opción repetida: ${key}`);
    result[key] = args[index + 1];
    index += 1;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result['--client'] || '')) throw new Error('Indicá --client con el ID de una carpeta de clients/.');
  if (result['--mode'] !== undefined && !['basic', 'booking'].includes(result['--mode'])) throw new Error('Indicá --mode basic o --mode booking.');
  return { client: result['--client'], design: result['--design'], mode: result['--mode'], out: result['--out'] };
}

function fail(message) { throw new Error(`Configuración inválida: ${message}`); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function rejectPrivateKeys(value, where = 'configuración') {
  if (!isObject(value) && !Array.isArray(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (/password|secret|api[_-]?key|access[_-]?token|credential|private[_-]?key/i.test(key)) fail(`${where}.${key} parece contener credenciales; guardá únicamente datos públicos.`);
    rejectPrivateKeys(item, `${where}.${key}`);
  }
}
function luminance(hexColor) {
  let hex = hexColor.slice(1);
  if (hex.length === 3) hex = [...hex].map(char => char + char).join('');
  const rgb = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
function contrastRatio(first, second) {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function localizedHas(value, languages, label, required = true) {
  if (typeof value === 'string') {
    if (!required || value.trim()) return;
    fail(`${label} no puede estar vacío.`);
  }
  if (!isObject(value)) {
    if (!required && (value === undefined || value === null || value === '')) return;
    fail(`${label} debe ser texto o un objeto con textos por idioma.`);
  }
  for (const language of languages) {
    if (typeof value[language] !== 'string' || (required && !value[language].trim())) {
      fail(`${label}.${language} es obligatorio.`);
    }
  }
}
function httpsUrl(value, label, required = false) {
  if (!value && !required) return '';
  if (typeof value !== 'string') fail(`${label} debe ser un enlace HTTPS.`);
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) fail(`${label} debe ser un enlace HTTPS válido, sin credenciales.`);
    return url.href;
  } catch {
    fail(`${label} debe ser un enlace HTTPS válido.`);
  }
}
function isSetmoreBookingUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.port && url.hostname.toLowerCase().endsWith('.setmore.com');
  } catch { return false; }
}
function localAsset(value, label, clientDir, required = false) {
  if (!value && !required) return '';
  if (typeof value !== 'string' || !value.trim()) fail(`${label} debe ser una ruta local assets/... o una URL HTTPS.`);
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return httpsUrl(value, label, true);
  if (!/^assets(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)+$/.test(value) || value.split('/').some(part => part === '.' || part === '..')) {
    fail(`${label} debe permanecer dentro de assets/ y no contener segmentos inseguros.`);
  }
  const absolute = path.resolve(clientDir, value);
  if (!absolute.startsWith(path.resolve(clientDir, 'assets') + path.sep)) fail(`${label} queda fuera de la carpeta assets del cliente.`);
  return value;
}
function validateConfig(client, template, clientDir, mode, pageHtml) {
  if (!isObject(client) || !isObject(template)) fail('se esperaba un objeto JSON en la plantilla y el cliente.');
  rejectPrivateKeys(client, 'cliente');
  const languages = template.supportedLanguages;
  if (!Array.isArray(languages) || languages.length < 1) fail('config/template.json debe definir supportedLanguages.');
  if (!template.supportedModes?.includes(mode)) fail(`La variante ${mode} no está habilitada en config/template.json.`);
  for (const [name, value] of Object.entries(template.defaults?.colors || {})) {
    if (!(name in cssColorVariables) || typeof value !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) fail(`defaults.colors.${name} debe ser un token de color hexadecimal permitido.`);
  }
  const available = client.language?.available;
  if (!Array.isArray(available) || available.length < 1 || available.some(language => !languages.includes(language))) fail(`language.available debe usar los idiomas permitidos: ${languages.join(', ')}.`);
  if (!available.includes(client.language?.default)) fail('language.default debe estar incluido en language.available.');
  if (client.language.numberLocale) {
    try { new Intl.NumberFormat(client.language.numberLocale); } catch { fail('language.numberLocale no es un locale reconocido.'); }
  }
  if (client.booking !== undefined && !isObject(client.booking)) fail('booking debe ser un objeto.');
  const booking = isObject(client.booking) ? client.booking : {};
  const bookingMode = booking.mode ?? 'external';
  if (!['modal', 'external'].includes(bookingMode)) fail('booking.mode debe ser modal o external.');
  let bookingUrl = booking.url ?? '';
  if (bookingUrl !== '' && typeof bookingUrl !== 'string') fail('booking.url debe ser texto HTTPS o quedar vacío.');
  if (bookingUrl) {
    const safeBookingUrl = httpsUrl(bookingUrl, 'booking.url', true);
    bookingUrl = safeBookingUrl;
    if (bookingMode === 'modal') {
      if (!isSetmoreBookingUrl(safeBookingUrl)) fail('booking.url en modo modal debe ser un subdominio HTTPS oficial de Setmore (*.setmore.com) en el puerto estándar.');
    }
  }
  client.booking = { ...booking, url: bookingUrl, mode: bookingMode };
  if (mode === 'basic' && client.booking?.url) console.warn('Aviso: booking.url se ignora en modo Basic.');
  if (typeof client.business?.name !== 'string' || !client.business.name.trim()) fail('business.name es obligatorio y debe ser texto.');
  if (typeof client.seo?.title !== 'string' || !client.seo.title.trim()) fail('seo.title es obligatorio y debe ser texto.');
  if (typeof client.seo?.description !== 'string' || !client.seo.description.trim()) fail('seo.description es obligatorio y debe ser texto.');
  if (client.seo.canonicalUrl) httpsUrl(client.seo.canonicalUrl, 'seo.canonicalUrl');
  if (client.seo.ogImage) localAsset(client.seo.ogImage, 'seo.ogImage', clientDir);
  if (client.seo.businessType && !['LocalBusiness', 'HairSalon', 'BeautySalon', 'Restaurant', 'ExerciseGym', 'MedicalBusiness'].includes(client.seo.businessType)) fail('seo.businessType no está en la lista admitida.');

  const colors = client.brand?.colors || {};
  const palette = { ...template.defaults.colors, ...colors };
  for (const [name, value] of Object.entries(colors)) {
    if (!(name in cssColorVariables)) fail(`brand.colors.${name} no es un token visual reconocido.`);
    if (typeof value !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) fail(`brand.colors.${name} debe ser un color hexadecimal RGB de 3 o 6 dígitos.`);
  }
  for (const [name, value] of Object.entries(template.defaults.colors)) {
    if (typeof value !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) fail(`defaults.colors.${name} debe ser un color hexadecimal RGB de 3 o 6 dígitos.`);
  }
  const contrastChecks = [
    ['texto principal sobre fondo claro', palette.text || palette.primary, palette.backgroundLight],
    ['texto de botones', palette.buttonText, palette.button],
    ['texto claro sobre fondo oscuro', palette.textOnDark, palette.servicesBackground],
    ['color principal sobre fondo oscuro', palette.primary, palette.servicesBackground]
  ];
  for (const [label, foreground, background] of contrastChecks) {
    if (contrastRatio(foreground, background) < 4.5) fail(`el contraste de ${label} es menor que 4.5:1; ajustá los colores.`);
  }
  if (client.brand?.logoImage) localAsset(client.brand.logoImage, 'brand.logoImage', clientDir);
  if (client.brand?.favicon) localAsset(client.brand.favicon, 'brand.favicon', clientDir);

  const images = client.images || {};
  localAsset(images.hero, 'images.hero', clientDir, true);
  localizedHas(images.heroAlt, available, 'images.heroAlt');
  localAsset(images.manifesto, 'images.manifesto', clientDir, true);
  if (!Array.isArray(images.gallery) || images.gallery.length > 30) fail('images.gallery debe ser una lista de hasta 30 imágenes.');
  images.gallery.forEach((image, index) => {
    if (!isObject(image)) fail(`images.gallery[${index}] debe ser un objeto.`);
    localAsset(image.src, `images.gallery[${index}].src`, clientDir, true);
    localAsset(image.large || image.src, `images.gallery[${index}].large`, clientDir, true);
    localizedHas(image.alt, available, `images.gallery[${index}].alt`);
    localizedHas(image.caption, available, `images.gallery[${index}].caption`, false);
  });

  if (!Array.isArray(client.services) || client.services.length > 40) fail('services debe ser una lista de hasta 40 servicios.');
  const serviceIds = new Set();
  const display = client.serviceDisplay || { price: true, duration: true };
  for (const key of ['price', 'duration']) if (typeof display[key] !== 'boolean') fail(`serviceDisplay.${key} debe ser true o false.`);
  client.services.forEach((service, index) => {
    if (!isObject(service)) fail(`services[${index}] debe ser un objeto.`);
    if (!/^[a-z0-9-]+$/.test(service.id || '') || serviceIds.has(service.id)) fail(`services[${index}].id debe ser único y usar letras minúsculas, números o guiones.`);
    serviceIds.add(service.id);
    localizedHas(service.title, available, `services[${index}].title`);
    localizedHas(service.description, available, `services[${index}].description`, false);
    if (service.image) localAsset(service.image, `services[${index}].image`, clientDir);
    if (display.duration) localizedHas(service.duration, available, `services[${index}].duration`);
    if (display.price && (!Number.isFinite(service.price) || service.price < 0)) fail(`services[${index}].price debe ser un número no negativo.`);
    if (display.price && (!/^[A-Z]{3}$/.test(service.currency || '') || (Intl.supportedValuesOf && !Intl.supportedValuesOf('currency').includes(service.currency)))) fail(`services[${index}].currency debe ser una moneda ISO admitida por el entorno.`);
  });

  const hours = client.businessDetails?.hours || [];
  if (!Array.isArray(hours) || hours.length > 14) fail('businessDetails.hours debe contener hasta 14 filas.');
  hours.forEach((row, index) => {
    if (!isObject(row)) fail(`businessDetails.hours[${index}] debe ser un objeto.`);
    localizedHas(row.label, available, `businessDetails.hours[${index}].label`);
    localizedHas(row.value, available, `businessDetails.hours[${index}].value`);
  });
  for (const key of ['address', 'addressNote', 'hoursNote']) {
    if (client.businessDetails?.[key]) localizedHas(client.businessDetails[key], available, `businessDetails.${key}`, false);
  }

  const contact = client.contact || {};
  if (contact.phone && (typeof contact.phone !== 'string' || !/^\+?[\d().\s-]{6,25}$/.test(contact.phone) || contact.phone.replace(/\D/g, '').length < 6)) fail('contact.phone tiene un formato no válido.');
  if (contact.email && (typeof contact.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))) fail('contact.email tiene un formato no válido.');
  if (contact.whatsapp && (typeof contact.whatsapp !== 'string' || !/^\+?[\d\s().-]{7,25}$/.test(contact.whatsapp) || contact.whatsapp.replace(/\D/g, '').length < 7)) fail('contact.whatsapp tiene un formato no válido.');
  if (contact.socials && !Array.isArray(contact.socials)) fail('contact.socials debe ser una lista.');
  if ((contact.socials || []).some(social => !isObject(social))) fail('cada elemento de contact.socials debe ser un objeto.');
  for (const [index, social] of (contact.socials || []).entries()) {
    if (typeof social.label !== 'string' || !social.label.trim()) fail(`contact.socials[${index}].label es obligatorio.`);
    httpsUrl(social.url, `contact.socials[${index}].url`, true);
  }

  for (const [key, action] of Object.entries(client.actions?.basic || {})) {
    if (!isObject(action) || !['section', 'whatsapp', 'phone', 'email', 'contact', 'visit'].includes(action.type)) fail(`actions.basic.${key}.type no está permitido.`);
    if (action.type === 'section' && !['#visit', '#visit-card', '#services', '#gallery', '#story'].includes(action.target)) fail(`actions.basic.${key}.target no es una sección válida.`);
    localizedHas(action.label, available, `actions.basic.${key}.label`);
  }

  const translations = client.translations || {};
  for (const language of available) {
    if (!isObject(translations[language])) fail(`translations.${language} debe existir.`);
  }
  const pageJs = readFileSync(path.join(sharedSource, 'app.js'), 'utf8');
  const required = new Set([
    ...[...pageHtml.matchAll(/data-i18n="([^"]+)"/g)].map(match => match[1]),
    ...[...pageJs.matchAll(/\bt\('([^']+)'\)/g)].map(match => match[1]),
    'heroBooking', 'heroBasic', 'visitBooking', 'visitBasic', 'manifestoBooking', 'manifestoBasic',
    'switchLanguage', 'languageName_en', 'languageName_es', 'openMenu', 'closeMenu'
  ]);
  for (const language of available) {
    const translationsForLanguage = { ...(template.translations?.[language] || {}), ...(translations[language] || {}) };
    for (const key of required) if (typeof translationsForLanguage[key] !== 'string' || !translationsForLanguage[key].trim()) fail(`falta traducción ${language}.${key}.`);
  }

  return { ...client, mode, template: { defaults: template.defaults, translations: template.translations }, translations: mergeTranslations(template.translations, client.translations) };
}
function mergeTranslations(base, overrides) {
  const merged = {};
  for (const language of Object.keys(base || {})) merged[language] = { ...(base[language] || {}), ...(overrides[language] || {}) };
  for (const language of Object.keys(overrides || {})) merged[language] = { ...(merged[language] || {}), ...overrides[language] };
  return merged;
}
function html(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function checkedImageUrl(value) { return typeof value === 'string' && /^https:\/\//i.test(value) ? httpsUrl(value, 'imagen') : ''; }
function optionalHead(config) {
  const tags = [];
  if (config.brand?.favicon) tags.push(`<link rel="icon" href="${html(config.brand.favicon)}">`);
  const canonical = config.seo?.canonicalUrl ? httpsUrl(config.seo.canonicalUrl, 'seo.canonicalUrl') : '';
  if (canonical) tags.push(`<link rel="canonical" href="${html(canonical)}">`);
  const hero = checkedImageUrl(config.images?.hero);
  let ogImage = checkedImageUrl(config.seo?.ogImage) || hero;
  if (!ogImage && canonical && config.images?.hero?.startsWith('assets/')) ogImage = new URL(config.images.hero, canonical.endsWith('/') ? canonical : canonical + '/').href;
  if (ogImage) tags.push(`<meta property="og:image" content="${html(ogImage)}">`);
  const structured = makeStructuredData(config, canonical);
  if (structured) tags.push(`<script type="application/ld+json">${JSON.stringify(structured).replaceAll('<', '\\u003c')}</script>`);
  return tags.join('\n  ');
}
function makeStructuredData(config, canonical) {
  if (!config.seo?.includeStructuredData || !canonical || !config.businessDetails?.structuredAddress) return null;
  const address = config.businessDetails.structuredAddress;
  const keys = ['streetAddress', 'addressLocality', 'addressRegion', 'postalCode', 'addressCountry'];
  if (keys.some(key => typeof address[key] !== 'string' || !address[key].trim())) return null;
  const data = { '@context': 'https://schema.org', '@type': config.seo.businessType || 'LocalBusiness', name: config.business.name, description: config.seo.description, url: canonical, address: { '@type': 'PostalAddress' } };
  for (const key of keys) data.address[key] = address[key];
  if (config.contact?.phone) data.telephone = config.contact.phone;
  if (config.contact?.email) data.email = config.contact.email;
  return data;
}
function renderSeo(htmlSource, config) {
  const replacements = {
    '{{LANG}}': html(config.language.default),
    '{{SEO_TITLE}}': html(config.seo.title),
    '{{SEO_DESCRIPTION}}': html(config.seo.description),
    '{{SEO_THEME_COLOR}}': html(config.brand?.colors?.backgroundDark || config.template.defaults.colors.backgroundDark)
  };
  let result = htmlSource.replace(/\{\{(LANG|SEO_TITLE|SEO_DESCRIPTION|SEO_THEME_COLOR)\}\}/g, (_match, token) => replacements[`{{${token}}}`]);
  result = result.replace('<!-- VYB-OPTIONAL-SEO -->', optionalHead(config));
  if (Object.keys(replacements).some(token => result.includes(token)) || result.includes('<!-- VYB-OPTIONAL-SEO -->')) fail('no se pudieron completar las etiquetas SEO del HTML.');
  return result;
}
function renderBookingMarkup(htmlSource, mode, bookingMode, bookingUrl) {
  const includeModal = mode === 'booking' && bookingMode === 'modal';
  let result = htmlSource;
  if (!includeModal) result = result.replace(/\s*<!-- VYB-BOOKING-MODAL-START -->[\s\S]*?<!-- VYB-BOOKING-MODAL-END -->\s*/g, '\n');
  if (mode !== 'booking') result = result.replace(/\s*<p class="booking-status container" id="booking-status"[\s\S]*?<\/p>\s*/g, '\n');
  if (bookingUrl) result = result.replace(/<small\b[^>]*data-booking-unconfigured[^>]*>[\s\S]*?<\/small>/g, '');
  return result;
}
function colorOverrides(colors = {}) {
  const result = {};
  for (const [key, variable] of Object.entries(cssColorVariables)) if (colors[key]) result[key] = variable;
  return result;
}
async function assertSafeOutput(outputDir, client, mode, design) {
  const resolved = path.resolve(outputDir);
  const forbidden = ['src', 'config', 'clients', 'tools', 'tests', 'assets', 'docs', 'templates'];
  for (const name of forbidden) {
    const dir = path.resolve(root, name);
    if (resolved === dir || resolved.startsWith(dir + path.sep)) throw new Error(`La carpeta de salida no puede estar dentro de ${name}/.`);
  }
  if (resolved === root || resolved.startsWith(path.resolve(root, 'clients') + path.sep)) throw new Error('La carpeta de salida no puede ser la raíz ni una carpeta de cliente.');
  let previous = null;
  try {
    const entries = await readdir(resolved);
    const markerPath = path.join(resolved, '.vyb-build.json');
    if (entries.includes('.vyb-build.json')) {
      previous = JSON.parse(await readFile(markerPath, 'utf8'));
      if (previous.version !== 1) throw new Error('El marcador de la carpeta de salida no es compatible; elegí otra ruta.');
      if (previous.client !== client || previous.mode !== mode) throw new Error(`La carpeta ya pertenece al sitio ${previous.client}/${previous.mode}; elegí otra ruta para no mezclar clientes.`);
      if ((previous.design ?? 'obsidian') !== design) throw new Error(`La carpeta ya pertenece al diseño ${previous.design ?? 'obsidian'}; elegí otra ruta para no mezclar diseños.`);
      if (previous.assets && (!Array.isArray(previous.assets) || previous.assets.some(asset => !/^assets(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)+$/.test(asset)))) throw new Error('El marcador de la carpeta de salida no es válido; elegí otra ruta.');
    } else if (entries.length > 0) {
      throw new Error('La carpeta de salida ya contiene archivos sin marcador VYB. Elegí una carpeta vacía para proteger tus datos.');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return previous;
}
async function build() {
  const { client: clientId, design: requestedDesign, mode: requestedMode, out } = cli(process.argv.slice(2));
  const clientDir = path.resolve(root, 'clients', clientId);
  if (!clientDir.startsWith(path.resolve(root, 'clients') + path.sep)) throw new Error('ID de cliente no válido.');
  const clientPath = path.join(clientDir, 'client.json');
  const client = await readFile(clientPath, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') throw new Error(`No existe clients/${clientId}/client.json.`); throw error; });
  const design = await loadDesign(requestedDesign ?? client.design);
  const template = JSON.parse(await readFile(design.defaults, 'utf8'));
  let pageSource = await readFile(path.join(design.source, 'index.html'), 'utf8');
  for (const name of ['booking-modal', 'lightbox']) {
    pageSource = pageSource.replace(`<!-- VYB-COMPONENT:${name} -->`, await readFile(path.join(sharedSource, 'components', `${name}.html`), 'utf8'));
  }
  if (/VYB-COMPONENT:/.test(pageSource)) fail('hay un componente compartido no reconocido.');
  if (client.mode !== undefined && !['basic', 'booking'].includes(client.mode)) fail('mode debe ser basic o booking.');
  const mode = requestedMode ?? client.mode ?? design.defaultMode ?? 'basic';
  const mergedConfig = validateConfig(client, template, clientDir, mode, pageSource);
  if (design.id !== 'obsidian' || client.design !== undefined) mergedConfig.design = design.id;
  for (const imagePath of collectLocalAssets(mergedConfig)) {
    const absolute = path.resolve(clientDir, imagePath);
    const info = await lstat(absolute).catch(() => null);
    if (!info?.isFile() || info.isSymbolicLink()) fail(`${imagePath} no existe como archivo regular dentro de clients/${clientId}/assets.`);
    if (info.size > 8 * 1024 * 1024) fail(`${imagePath} supera 8 MB; optimizá la imagen antes de publicar.`);
    if (info.size > 2 * 1024 * 1024) console.warn(`Aviso: ${imagePath} supera 2 MB; conviene optimizarla para móviles.`);
  }
  const outputDir = out ? path.resolve(root, out) : path.join(root, 'dist', clientId, mode);
  const previousBuild = await assertSafeOutput(outputDir, clientId, mode, design.id);
  await mkdir(outputDir, { recursive: true });
  const currentAssets = collectLocalAssets(mergedConfig);
  for (const oldAsset of previousBuild?.assets || []) {
    if (currentAssets.includes(oldAsset)) continue;
    const oldPath = path.resolve(outputDir, oldAsset);
    if (oldPath.startsWith(path.resolve(outputDir, 'assets') + path.sep)) await unlink(oldPath).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  for (const file of sharedFiles) {
    let content = file === 'index.html' ? pageSource : await readFile(path.join(file === 'app.js' ? sharedSource : design.source, file), 'utf8');
    if (file === 'index.html') content = renderSeo(content, mergedConfig);
    if (file === 'index.html') content = renderBookingMarkup(content, mode, mergedConfig.booking.mode, mergedConfig.booking.url);
    if (file === 'styles.css' && design.serviceImages) {
      const rules = mergedConfig.services.map((service, index) => service.image
        ? `.service-row:nth-child(${index + 1})::before{background-image:url(${JSON.stringify(service.image.startsWith('assets/') ? service.image : httpsUrl(service.image, 'services.image', true))})}` : '').filter(Boolean);
      if (rules.length) content += '\n/* Imágenes decorativas configuradas por cliente */\n' + rules.join('\n') + '\n';
    }
    await writeFile(path.join(outputDir, file), content);
  }
  for (const asset of currentAssets) {
    const destination = path.join(outputDir, asset);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(clientDir, asset), destination);
  }
  const publicConfig = { ...mergedConfig, booking: mode === 'booking' ? mergedConfig.booking : { url: '', mode: 'external' }, colorVariables: colorOverrides(mergedConfig.brand?.colors) };
  const serialized = JSON.stringify(publicConfig, null, 2).replaceAll('<', '\\u003c');
  await writeFile(path.join(outputDir, 'config.js'), `window.VYB_CONFIG = ${serialized};\n`);
  await writeFile(path.join(outputDir, '.vyb-build.json'), JSON.stringify({ version: 1, client: clientId, mode, assets: currentAssets, ...(design.id !== 'obsidian' ? { design: design.id } : {}) }, null, 2) + '\n');
  console.log(`Generado: ${path.relative(root, outputDir)} (${clientId} · ${mode})`);
}
function collectLocalAssets(config) {
  const candidates = [config.brand?.logoImage, config.brand?.favicon, config.seo?.ogImage, config.images?.hero, config.images?.manifesto, ...(config.images?.gallery || []).flatMap(image => [image.src, image.large]), ...(config.services || []).map(service => service.image)];
  return [...new Set(candidates.filter(value => typeof value === 'string' && value.startsWith('assets/')))];
}

build().catch(error => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
