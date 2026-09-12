# Mejoras sugeridas – Cobros Frontend

## Prioridad alta (impacto rápido)

### 1. ~~Entornos separados (development / production)~~ ✅ Hecho
- Creado `environment.development.ts` y `fileReplacements` en `angular.json`.

### 2. ~~Usar los servicios HTTP en lugar de llamar `HttpClient` desde los componentes~~ ✅ Hecho
- Toda la lógica de API vive en los servicios (`DeudoresService`, `PagosService`, `PrestamosService`, `UsuariosService`, etc.); ningún componente inyecta `HttpClient` directamente.

### 3. ~~Ruta y menú para Usuarios~~ ✅ Hecho
- Ruta `usuarios` y enlace en el sidebar añadidos.

### 4. ~~Tipado fuerte: quitar `any` y definir modelos~~ ✅ Hecho
- Interfaz `Usuario` en `models/index.ts`, normalización de `pagos.service.ts` tipada con `Record<string, unknown>`, y `body`/`cuotas` en `deudor-detail` tipados con `Partial<Prestamo>` / `Cuota[]`.

---

## Prioridad media (arquitectura y UX)

### 5. ~~Servicio de notificaciones (toast / snackbar)~~ ✅ Hecho
- `NotificationService` + `ToastContainerComponent` integrados en login, guard, deudores, pagos, usuarios, deudor-detail.

### 6. ~~Helpers compartidos para formato y porcentajes~~ ✅ Hecho
- `FormatNumberPipe` / `FormatPercentPipe` en templates; `shared/utils/format.ts` (`formatMonto`, `formatSoles`, `formatFecha`) para los exports CSV/PDF (dashboard, deudor-detail, prestamos, deudores).

### 7. ~~Patrón único de “cargar → listar → error”~~ ✅ Hecho
- `shared/utils/loading.ts` (`withLoading()`) encapsula `loading = false` + `cdr.detectChanges()` en `next`/`error`; aplicado en `prestamos.component.ts` (`cargar()`), `deudores.component.ts` (`load()`) y `pagos.component.ts` (`buscar()`). Flujos multi-paso (alertas, dashboard, deudor-detail, usuarios) se dejan como están para no añadir complejidad sin beneficio claro.

### 8. ~~Validar expiración del JWT al cargar la app~~ ✅ Hecho
- `AuthService` y `authGuard` comprueban `exp` del token; si está expirado se hace logout y redirección a login.

### 9. ~~Control de acceso por rol~~ ✅ Hecho
- `guards/role.guard.ts` (`roleGuard(['admin'])`) protege `/usuarios`; el sidebar oculta el enlace a usuarios si `currentUser().rol !== 'admin'`.

---

## Prioridad baja / mejoras finas

### 10. ~~Caché o refetch suave~~ ✅ Hecho
- `DeudoresService`, `PrestamosService`, `PagosService` (resumen) y `UsuariosService` cachean `getAll()`/`getResumen()` 30-45s con `invalidateCache()` tras create/update/delete.

### 11. ~~Un solo archivo de modelos~~ ✅ Hecho
- Solo existe `models/index.ts`.

### 12. ~~Exportación (CSV/PDF) en servicio o util compartido~~ ✅ Hecho
- `services/export.service.ts` (`downloadCsv`, `downloadPdfFromHtml`) usado por deudores, deudor-detail, pagos, prestamos y reparto.

### 13. ~~Tests~~ ✅ Hecho
- Tests unitarios con `HttpTestingController` para `AuthService` (login, logout, refresh, restauración de sesión), `DeudoresService` (cache 30s e invalidación), `PagosService` (normalización de `getAll`/`getResumen` en camelCase y snake_case) y `PrestamosService` (cache por deudor, cuotas, invalidación). Total 27 tests pasando (`npm test -- --watch=false`).

### 14. ~~Accesibilidad y SEO~~ ✅ Hecho
- `index.html` ya tiene `lang="es"` y meta description. Revisados formularios y botones de icono: todos los botones de solo-icono tienen `aria-label`. Se añadió `alt` a las imágenes de comprobante y al modal de imagen ampliada en `deudor-detail`, y `aria-label="Cerrar"` al botón de cierre del modal.

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

### 16. ~~Skeletons en lugar de “Cargando...”~~ ✅ Hecho
- `shared/skeleton/skeleton.component.ts` (`<app-skeleton>`) en dashboard, deudores, deudor-detail (incl. cronograma), pagos, prestamos, usuarios, alertas y reparto.

### 17. ~~Paginación o “Cargar más”~~ ✅ Hecho
- Deudores, préstamos y pagos tienen "Ver N más" client-side con `PAGE_SIZE`/`*Visible`; pagos además pagina en el backend (`PagosFilter.page/limit`).

### 18. ~~Reintento en errores de red~~ ✅ Hecho
- `interceptors/retry.interceptor.ts` reintenta una vez (con delay de 800ms) en errores de red (status 0) o 5xx; no reintenta 4xx.

### 19. ~~Manejo global de errores~~ ✅ Hecho
- `global-error-handler.ts` (`GlobalErrorHandler`) captura errores no controlados y muestra un mensaje genérico vía `NotificationService`; los `HttpErrorResponse` (ya manejados por interceptores/componentes) solo se loguean.

### 20. ~~Diseño responsive / móvil~~ ✅ Hecho (básico)
- Sidebar colapsable con `.menu-toggle` y media query `@media (max-width: 768px)` en `layout.component.css`.

### 21. ~~Seguridad del token (opcional)~~ ✅ Hecho
- El access token se guarda en `sessionStorage` (se borra al cerrar la pestaña) en `auth.service.ts` y `auth.guard.ts`. El refresh token ya usa cookie httpOnly.

### 22. ~~Títulos de página por ruta~~ ✅ Hecho
- `title-strategy.ts` (`CobrosTitleStrategy`) + `title` en cada ruta de `app.routes.ts`: pestañas muestran “Dashboard – Cobros”, “Deudores – Cobros”, etc.
