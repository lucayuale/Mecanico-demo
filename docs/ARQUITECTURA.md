# Arquitectura autónoma · Base reutilizable

Origen: copia controlada de VYB v6. La reutilización ocurre al crear el proyecto; no existe una dependencia permanente de la base ni importaciones hacia otros proyectos.

El único diseño de este proyecto se resuelve en `config/designs.json`. Cada comando obtiene su raíz desde `import.meta.url`, por lo que funciona aunque la terminal esté en otra carpeta. Las rutas de componentes, recursos y configuración permanecen dentro de esta copia.

Se conserva el generador original y la lógica Booking de referencia. El generador, app y componentes son copias del original, sin cambios funcionales.

Cada repositorio puede evolucionar por separado. Las mejoras futuras de la base no modifican proyectos existentes; se trasladan explícitamente como cambios revisados y probados. No hay paquetes externos, enlaces simbólicos ni rutas a proyectos hermanos.
