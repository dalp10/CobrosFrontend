# Mejoras sugeridas – Cobros Frontend

## Prioridad alta (impacto rápido)

### 1. ~~Entornos separados (development / production)~~ ✅ Hecho
- Creado `environment.development.ts` y `fileReplacements` en `angular.json`.

### 2. Usar los servicios HTTP en lugar de llamar `HttpClient` desde los componentes
- **Ahora:** Dashboard, deudores, deudor-detail, pagos, prestamos y usuarios llaman `this.http.get/post(...)` con `environment.apiUrl` directamente.
- **Mejorar:** Mover toda la lógica de API a los servicios (`DeudoresService`, `PagosService`, `PrestamosService`) y que los componentes solo llamen a los servicios. Así se centraliza la URL, los tipos y el manejo de errores.

### 3. ~~Ruta y menú para Usuarios~~ ✅ Hecho
- Ruta `usuarios` y enlace en el sidebar añadidos.

### 4. Tipado fuerte: quitar `any` y definir modelos
- **Ahora:** Muchos `get<any>()`, `(d: any)`, `e: any`, y no hay interfaz `Usuario` para la API de usuarios.
- **Mejorar:** Usar los modelos existentes (`Deudor`, `Pago`, `Prestamo`, etc.) en los subscribes y respuestas; crear interfaz `Usuario` y tipar listas y formularios de usuarios. Reduce bugs y mejora el autocompletado.

---

## Prioridad media (arquitectura y UX)

### 5. ~~Servicio de notificaciones (toast / snackbar)~~ ✅ Hecho
- `NotificationService` + `ToastContainerComponent` integrados en login, guard, deudores, pagos, usuarios, deudor-detail.

### 6. Helpers compartidos para formato y porcentajes
- **Ahora:** `fmt()` y `pct()` (o equivalentes) repetidos en dashboard, deudores, deudor-detail, pagos, prestamos.
- **Mejorar:** Un solo lugar (pipe `FormatNumberPipe` / `FormatPercentPipe` o util en `shared/`) y usarlo en todos los templates. Misma lógica en exports (CSV/PDF).

### 7. Patrón único de “cargar → listar → error”
- **Ahora:** Cada pantalla repite `loading = true`, `subscribe({ next, error })`, `loading = false`, `cdr.detectChanges()`.
- **Mejorar:** Servicios que devuelvan `Observable<T>` y, si quieres, un patrón reutilizable (ej. componente “con loading” o directiva) o simplemente un método helper que maneje loading + error + mensaje. Así se reduce duplicación y se unifica el comportamiento.

### 8. ~~Validar expiración del JWT al cargar la app~~ ✅ Hecho
- `AuthService` y `authGuard` comprueban `exp` del token; si está expirado se hace logout y redirección a login.

### 9. Control de acceso por rol (opcional)
- **Ahora:** Cualquier usuario logueado ve todo el menú (dashboard, deudores, préstamos, pagos).
- **Mejorar:** Si el backend distingue roles (admin, cobrador, etc.), un `roleGuard` o comprobación por ruta y ocultar en el menú o deshabilitar rutas según `currentUser().rol`.

---

## Prioridad baja / mejoras finas

### 10. Caché o refetch suave
- **Ahora:** Cada vez que entras a una pantalla se hace un nuevo GET (sin caché).
- **Mejorar:** Si los datos no cambian cada segundo, se puede cachear en el servicio (por ejemplo con un `BehaviorSubject` o signal + “última carga”) y opción “Actualizar” o refetch al volver a la pestaña. No es obligatorio pero mejora sensación de velocidad.

### 11. Un solo archivo de modelos
- **Ahora:** `models/index.ts` y `models/models.ts` con las mismas interfaces.
- **Mejorar:** Dejar un solo archivo (por ejemplo `index.ts` que reexporte) para no duplicar definiciones.

### 12. Exportación (CSV/PDF) en servicio o util compartido
- **Ahora:** Lógica de CSV/Excel y PDF repartida en deudor-detail y pagos con patrones similares.
- **Mejorar:** Un servicio o util (ej. `ExportService` o `exportCsv`, `exportPdf`) que reciba datos y opciones y genere el archivo. Reutilizar en todas las pantallas que exporten.

### 13. Tests
- **Ahora:** No se ven tests en el reporte.
- **Mejorar:** Añadir al menos tests unitarios para servicios (auth, deudores, pagos, prestamos) y para el guard; opcionalmente un test de integración para el flujo de login.

### 14. Accesibilidad y SEO
- Revisar labels en formularios, contraste, y si hace falta navegación por teclado. Si la app tiene partes públicas, considerar meta tags y estructura para SEO.

---

## Resumen por tema

| Tema           | Acción principal                                              |
|----------------|---------------------------------------------------------------|
| Config         | Entornos dev/prod con APIs distintas                         |
| API            | Usar servicios HTTP en todos los componentes                 |
| Tipado         | Eliminar `any`, usar modelos y crear `Usuario`               |
| UX             | Servicio de notificaciones (toast)                           |
| Código         | Helpers compartidos (fmt, pct, export), un solo archivo modelos |
| Auth           | Comprobar `exp` del JWT al iniciar; opcional rol en rutas    |
| Funcionalidad  | Activar ruta y menú de Usuarios                              |

Si indicas por dónde quieres empezar (por ejemplo: “entornos”, “servicios HTTP” o “toast”), se puede bajar a pasos concretos o a cambios de código archivo por archivo.

---

## Más mejoras (ideas adicionales)

### 15. ~~Confirmación antes de borrar~~ ✅ Hecho
- En `eliminarPago()` (deudor-detail) se usa `confirm()` además del modal.

### 16. Skeletons en lugar de “Cargando...”
- Sustituir el texto “Cargando...” por skeletons (bloques grises animados) en listas y dashboard. La app se siente más rápida y profesional.

### 17. Paginación o “Cargar más”
- Si las listas pueden ser muy largas (ej. pagos con `limit=200`), añadir paginación en el backend/frontend o un botón “Cargar más” para no traer todo de golpe y mejorar tiempos de carga.

### 18. Reintento en errores de red
- Para fallos por red (sin respuesta, timeout), usar `retry` o “Reintentar” en el mensaje de error. Útil en conexiones inestables.

### 19. Manejo global de errores
- Un `ErrorHandler` o interceptor que capture errores no manejados y muestre un mensaje genérico o envíe a una página de error, en lugar de fallar en silencio.

### 20. Diseño responsive / móvil
- Revisar que el sidebar y las tablas se usen bien en pantallas pequeñas (menú colapsable, tablas con scroll horizontal o cards).

### 21. Seguridad del token (opcional)
- Valorar usar `sessionStorage` en lugar de `localStorage` para que el token se borre al cerrar la pestaña, o que el backend use cookies httpOnly si quieres más seguridad.

### 22. Títulos de página por ruta
- Actualizar `document.title` (o meta) según la ruta (ej. “Dashboard – Cobros”, “Deudores – Cobros”) para pestañas y favoritos.
