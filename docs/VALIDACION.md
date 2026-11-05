# VYB · Proyectos independientes y Restaurant Booking v1

Fecha: 4 de noviembre de 2026.

## Resultado y arquitectura

Cinco entregables autónomos: base neutra, Obsidian, Cosmetica, Gym y Restaurante. Cada carpeta contiene código fuente, herramientas, componentes, configuración, pruebas y documentación locales. Ningún proyecto requiere la base ni proyectos hermanos para generar o publicar. No se usan enlaces simbólicos, paquetes compartidos externos o importaciones hacia otra carpeta de VYB. La reutilización se realiza por copia inicial controlada.

La base no es un catálogo de cuatro diseños. Conserva un único diseño neutro de referencia y ofrece `tools/new-project.mjs` para crear una carpeta autónoma con un cliente neutro. No copia clientes ni salidas de demostración. Cada proyecto administra sus correcciones y actualizaciones por separado; los cambios de la base no se propagan automáticamente.

El ZIP v6 original no se modificó. SHA-256: `89415231459a38eb47b370be9c5a3be3e45ebb2627f4ff091bb7618f3030367d`. También se comparó su extracción original con todos los archivos del ZIP: sin diferencias.

## Conservación verificable

| Proyecto | Variantes conservadas | Archivos generados idénticos a v6 |
| --- | --- | --- |
| Obsidian | Obsidian Basic/Booking y Taller Norte Basic/Booking | 26 |
| Cosmetica | Booking | 9 |
| Gym | Booking | 9 |
| Total | Seis salidas existentes | 44 |

Las referencias SHA-256 por proyecto están en `tests/fixtures/v6-output-sha256.json`. Se regeneraron las páginas después de separarlas y coinciden byte por byte: HTML, CSS, app, configuración, marcadores y recursos locales. El generador, resolutor, alta de clientes, app y componentes de estas tres copias permanecen idénticos al original. Solo el registro de diseños se restringió a su propio diseño; no cambió el contenido visual ni la configuración de demostración.

## Cambios y archivos

En Obsidian/Cosmetica/Gym:
- Se copiaron `tools/`, `src/app.js` y `src/components/` como archivos locales independientes.
- Se conservaron únicamente HTML/CSS/defaults/starter del diseño correspondiente. Obsidian mantiene `src/index.html` y `src/styles.css`; Cosmetica y Gym mantienen sus rutas `templates/<diseño>/`.
- `config/designs.json` contiene una sola entrada; clientes y recursos de otros diseños se excluyeron.
- Se agregaron README propio, `.gitignore`, documentación de arquitectura/recursos/validación y pruebas de autonomía.
- Obsidian conserva `verify-build.mjs` y `verify-master.mjs`; solo se retiró de la primera suite el intento de copiar `templates/`, ya innecesario.
- Las suites históricas de catálogo completo se ejecutaron sobre una extracción temporal intacta de v6; no se incluyen en proyectos donde ya no corresponden. Sus controles se adaptaron a la suite autónoma.

En la base:
- Defaults y starter neutros, sin cuenta ni clientes demo.
- `tools/new-project.mjs` crea un proyecto nuevo fuera de la base, sin sobrescribir carpetas existentes.
- Runtime y componentes de reservas de referencia conservados.

En Restaurante:
- `src/index.html` y `src/styles.css`: presentación propia crema/terracota, portada en arco, historia, carta, experiencia, galería, reserva y contacto.
- `src/app.js`: renderizador de categorías/platos, sin convertir comida en servicios de citas; se retiró el renderizador de servicios no utilizado. Las funciones de reservas, aviso, apertura/cierre, foco y teclado se compararon con v6 y siguen iguales. También se eliminó el sufijo inglés «home» del nombre accesible de la marca.
- `tools/build.mjs`: validación de categorías/platos, precios/monedas, traducciones e imágenes y copiado de sus recursos.
- `config/template.json`, `config/client.example.json`, `config/designs.json`: defaults, inicio neutro y único diseño restaurante.
- `clients/restaurante/client.json` y `assets/*.webp`: demo Alba & Olive, cuatro categorías, ocho platos bilingües y cuatro fotos locales, con procedencia documentada.
- `docs/MENU-Y-RESERVAS.md`: esquema de carta y límites de Setmore.
- `dist/restaurante/booking/`: sitio generado.

No se agregó base de datos, autenticación, sistema de mesas, pedidos, carrito, pagos ni otra plataforma de reservas. No se publicó ningún repositorio o sitio.

## Pruebas automatizadas ejecutadas

1. Las cuatro suites originales de v6 pasaron desde una extracción temporal del ZIP: `verify-build`, `verify-master`, `verify-designs`, `verify-gym`.
2. Las dos suites históricas aplicables pasaron dentro de Obsidian autónomo: `verify-build` y `verify-master`.
3. `node tests/verify-independent.mjs` pasó en cada uno de los cinco proyectos. La prueba copia cada código fuente a una ruta temporal con espacios, sin la base ni hermanos presentes, ejecuta su generador desde otra carpeta y comprueba recursos, navegación interna, idiomas, configuración y seguridad.
4. Los clientes neutros se generan sin cuentas heredadas, fotografías de demo, teléfono/correo ni nombres comerciales particulares. Se probó modificar un cliente sin cambiar la salida de otro.
5. Se comprobaron URL vacía, modo externo, HTTPS, dominios Setmore, credenciales rechazadas, alta duplicada, protección de carpeta ajena y rechazo de rutas/modos/diseños incorrectos.
6. Restaurante: cuatro categorías/ocho platos, carga de imágenes, precios, cambios configurables y rechazo de moneda/precio/ruta/ID/traducciones inválidos. Menú neutro vacío y aviso correspondiente.
7. Base: creación de proyecto autónomo con `new-project`, generación desde la copia y rechazo de destinos existentes o dentro de la base.
8. `node --check`: 42 archivos JS/MJS correctos entre los cinco proyectos (base 6, Obsidian 15, Cosmetica 7, Gym 7, Restaurante 7).
9. ZIP: raíz única por proyecto, integridad del archivo, extracción a carpetas nuevas y repetición de las pruebas autónomas. Se incluyen los recursos y salidas necesarios; no hay páginas QA, cachés ni credenciales.

Las pruebas temporales se eliminan al finalizar. Los archivos de referencia solo contienen rutas relativas y hashes; no requieren el proyecto v6 para ejecutarse.

## Revisión real en navegador · Restaurante

Chrome remoto de escritorio, aproximadamente 1348 px de ancho útil. También revisión responsive mediante iframe con viewports de 320, 390 y 768 px por 844 px de alto; su ancho útil de documento puede ser menor por la barra de scroll.

- Portada y carta revisadas visualmente; ocho platos y sus precios visibles.
- Inglés predeterminado y cambio completo a español comprobados; categorías y descripciones cambian correctamente.
- Sin desbordamiento horizontal de la página VYB en los tres anchos y ambos idiomas.
- Menú móvil: apertura y cierre al seguir un enlace; navegación por categorías verificada.
- Fotos del menú y galería cargadas; lightbox abre, cierra con Escape y devuelve foco al elemento original.
- Modal Setmore: interfaz externa cargada en escritorio y móvil, marca conservada, enlace alternativo visible con URL configurada.
- Escape en escritorio y botón de cierre móvil: cierran el modal y restauran el foco al botón de origen. Panel de 302 px dentro del viewport de 320 px.
- Cliente neutro sin URL: aviso correcto en inglés y español, modal cerrado e iframe sin `src`; carta vacía con mensaje traducido.
- Sin errores de consola asociados a `terminal.local` en la lectura final.

No se repitió una exploración visual completa de cada página anterior: su conservación se acredita por generación y coincidencia exacta de los 44 archivos. No se afirma que una comprobación estática equivalga a una prueba manual de todos sus flujos.

## Límites y pendientes antes de publicar

- No se completó ninguna reserva real ni se enviaron correos, cancelaciones o datos personales.
- La cuenta temporal solicitada pertenece a Obsidian y sus servicios no son mesas del restaurante. Se informa dentro de la página y el modal. No se hereda a restaurantes nuevos.
- Setmore ofrece citas y widget oficial; la integración no implementa asignación de mesas, comensales, combinación de mesas ni capacidad total/simultánea del salón. No promete confirmación de mesa real.
- El contenido interno de Setmore conserva su propio idioma/configuración. A 320 px presentó desplazamiento horizontal interno; el panel VYB sí cabe y mantiene alternativa externa. No se modifica la interfaz de Setmore.
- Revisar dispositivos físicos, Safari/Firefox, teclado virtual, conexión lenta y dominio/HTTPS definitivos. El iframe responsive no sustituye estas pruebas.
- Para negocio real: datos y SEO completos, carta/precios/ingredientes/alérgenos reales, fotografías autorizadas y propia cuenta de reservas con un proceso de confirmación definido por el restaurante.
- Obsidian conserva fotografías remotas históricas y sus dependencias de red. Se documentó que no se realizó una nueva auditoría de derechos de estos recursos heredados. Cosmetica/Gym conservan sus recursos locales documentados; Restaurante incluye imágenes Unsplash locales de licencia conocida. Fuentes externas y Setmore requieren internet.
- No se validó un despliegue real ni se subió código a GitHub. Las instrucciones están incluidas en cada README.

## Comandos de control

Desde la carpeta de cada proyecto autónomo:

```powershell
node .\tests\verify-independent.mjs
```

Restaurante:

```powershell
node .\tools\build.mjs --client restaurante --mode booking
py -m http.server 8092 --bind 127.0.0.1 --directory .\dist\restaurante\booking
```

Abrir http://127.0.0.1:8092/ y detener con Ctrl+C. Cada README incluye extracción, alta de clientes, generación y publicación para Windows PowerShell.
