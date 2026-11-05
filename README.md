# VYB — Base reutilizable · Proyecto autónomo

Este proyecto contiene su propio código fuente, generador Node.js, componentes y recursos. No importa archivos de la base ni de otros proyectos VYB. Puede copiarse, mantenerse, generarse y publicarse en un repositorio separado. La versión v6 original se conserva sin modificaciones.

## Requisitos

Node.js 20 o superior; Python 3 con lanzador `py` para el servidor local en Windows. No requiere `npm install` ni dependencias de producción. Internet para Google Fonts, Setmore y las fotografías históricas remotas de Obsidian cuando corresponda.

## Extracción en Windows PowerShell

Guardá `VYB_BASE_REUTILIZABLE_v1.zip` en Descargas:

```powershell
$destinoVyb = Join-Path $HOME ('Downloads\VYB_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
Expand-Archive -LiteralPath "$HOME\Downloads\VYB_BASE_REUTILIZABLE_v1.zip" -DestinationPath $destinoVyb
Set-Location (Join-Path $destinoVyb 'VYB_BASE_REUTILIZABLE')
node --version
py --version
```

## Crear un proyecto nuevo independiente

La base incluye un diseño de referencia neutro, con Basic y Booking, sin clientes ni fotografías de demostración. Su composición proviene del contrato original Obsidian, con configuración neutra; no es una nueva propuesta visual comercial.

Desde la carpeta de esta base:

```powershell
node .\tools\new-project.mjs --out ..\VYB_MI_NEGOCIO --client mi-negocio --name "Mi negocio"
Set-Location ..\VYB_MI_NEGOCIO
node .\tools\build.mjs --client mi-negocio --mode booking
py -m http.server 8092 --bind 127.0.0.1 --directory .\dist\mi-negocio\booking
```

La carpeta destino debe ser nueva y estar fuera de la base. La herramienta copia código fuente, generador, componentes, documentación y pruebas; crea únicamente una configuración neutra, sin copiar clientes ni `dist`. La carpeta resultante no necesita la base para seguir funcionando. No hay sincronización automática: cada proyecto administra sus propias correcciones y versiones.

Para crear un diseño futuro, trabajá sobre el proyecto recién creado: adaptá `src/index.html`, `src/styles.css` y los textos neutros. Conservá los IDs y componentes que utiliza `src/app.js`; agregá validaciones/pruebas locales si el modelo de contenido cambia. No registres otros diseños dentro de esta base.

## Organización y archivos publicables

- `src/`: runtime y componentes locales. También contiene HTML y CSS de este diseño.
- `tools/`: generador y alta de clientes, propios de este proyecto.
- `config/designs.json`: registra solamente este diseño.
- `config/` : defaults, configuración inicial neutra y recursos de inicio.
- `clients/<id>/client.json`: datos públicos de cada negocio; `assets/` contiene sus imágenes.
- `dist/<id>/<modo>/`: resultado generado. Esta carpeta contiene **todo lo publicable** del cliente elegido.
- `tests/`: pruebas locales; `docs/`: instrucciones y reporte de validación.

No edites `dist` como solución permanente: se regenera. Para personalizar clientes, editá su JSON y sus recursos. Los archivos de `src`, `tools` y defaults solo se modifican al desarrollar la plantilla, con pruebas posteriores.

## Crear otro cliente de este mismo diseño

```powershell
node .\tools\new-client.mjs --client mi-cliente --name "Mi cliente" --mode booking
node .\tools\build.mjs --client mi-cliente
```

Los clientes nuevos usan `assets/placeholder.svg`, contactos vacíos y `booking.url` vacía. Completá nombre, logo, paleta, traducciones EN/ES, imágenes, precios, moneda, horarios, dirección, teléfono, WhatsApp, correo, redes y SEO desde `clients/mi-cliente/client.json`.

Para un repositorio por negocio, copiá el proyecto completo a una carpeta nueva y conservá solo la configuración y `dist` del negocio correspondiente. Todos los archivos fuente necesarios ya son locales. La herramienta `new-project.mjs` de la base automatiza el inicio de un proyecto neutro; no importa diseños de otros proyectos.

## Setmore

Configuración en `clients/<id>/client.json`:

```json
"booking": {
  "mode": "modal",
  "url": ""
}
```

Cada negocio debe crear su cuenta en https://www.setmore.com/, configurar servicios/citas, personal, disponibilidad y notificaciones, y copiar su Booking Page HTTPS desde su cuenta. Pegá esa URL en el JSON y regenerá. `modal` admite subdominios oficiales `*.setmore.com` por HTTPS sin credenciales ni puerto alternativo; `external` permite un enlace HTTPS a otra plataforma y abre otra pestaña segura.

Sin URL, el botón informa que no está configurado y no carga un calendario. El modal conserva Escape, cierre por botón/fondo, foco y enlace alternativo. Setmore gestiona las reservas; VYB no almacena datos de turnos. No incluyas contraseñas, tokens o claves privadas en el JSON.

La incrustación por iframe es un mecanismo oficial y gratuito documentado por Setmore. Conservamos su marca. Algunas funciones avanzadas y la eliminación de marca requieren planes pagos; revisá los límites vigentes de la cuenta antes de ofrecerlas. Fuentes: https://www.setmore.com/features/website-widgets y https://support.setmore.com/en/articles/490991-embed-your-booking-page-on-your-website .

La base no incluye ninguna cuenta de reservas configurada.

## Pruebas

```powershell
node .\tests\verify-independent.mjs
```

Las pruebas copian el código a una ruta temporal con espacios, fuera del proyecto y sin hermanos/base presentes. Generan páginas, comprueban recursos, idiomas, clientes neutros, aislamiento, URL y protección de salidas. No crean turnos reales ni requieren conexión con Setmore.

Los tests de catálogo multidiseño de v6 ya no describen esta arquitectura y se reemplazaron por la suite autónoma. Las referencias hash de los diseños aprobados se conservaron por proyecto. Consultá `docs/VALIDACION.md` para resultados y pruebas pendientes.

## Preparar GitHub y publicar

No se creó ni publicó ningún repositorio. Abrí una terminal en **esta** carpeta (no en la carpeta que reúne los ZIP):

```powershell
git init
git add .
git commit -m "Initial autonomous VYB project"
git branch -M main
```

Creá un repositorio vacío para este proyecto en GitHub y copiá de GitHub su comando `git remote add origin ...`. Luego ejecutá `git push -u origin main`. Revisá los archivos incluidos antes de subir: solo datos públicos, sin `.env` ni credenciales. Los nombres sugeridos son `vyb-obsidian`, `vyb-cosmetica`, `vyb-gym` y `vyb-restaurante`.

En un hosting estático, no hace falta un backend ni instalar paquetes. Si el hosting admite build, usá el comando de generación indicado arriba y seleccioná su `dist/<cliente>/booking` como directorio publicable. Si permite subir archivos, subí **el contenido** de esa carpeta. No subas el proyecto entero como directorio web. Activá HTTPS y probá enlaces, imágenes, móvil, idiomas, modal y su alternativa externa en el dominio final.

Antes de publicar: completar datos reales, revisar fotografías y permisos, configurar SEO/dominio, verificar la cuenta Setmore propia y efectuar una reserva controlada con autorización del negocio. No se publican automáticamente sitios ni repositorios.
