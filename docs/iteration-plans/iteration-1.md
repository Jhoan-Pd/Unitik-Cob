# Plan de Iteración 1 — Fase de Elaboración (OpenUP)

**Duración:** 4 semanas · **Inicio:** julio 2026 · **Estado: ✅ CERRADA (2026-07-06)**

**Verificación de cierre:** `pnpm test` 28/28 · `pnpm lint` 0 errores · `pnpm typecheck` limpio · `pnpm test:e2e` 6/6 contra PostgreSQL/Redis reales.

## Objetivos

Establecer los mecanismos transversales de seguridad y gobernanza que todos los módulos de dominio consumirán: autenticación, RBAC, auditoría y configuración editable. Riesgos atacados: R-05 (credenciales/accesos) y base para R-03 (validación de pagos).

## Alcance (checklist)

- [x] Módulo `auth`: JWT + Passport, login por correo o cédula, refresh tokens con secreto separado
- [x] Módulo `users`: CRUD con RBAC (4 roles), sin borrado físico, validaciones colombianas
- [x] Guards globales: `JwtAuthGuard` (con `@Public()`) y `RolesGuard` (`@Roles()`)
- [x] Módulo `governance`: 4 políticas como proveedores inyectables (skeleton funcional con reglas puras)
- [x] Interceptor global de auditoría (`@Audited`) + `AuditService` append-only con sanitización de secretos
- [x] Módulo `system-config`: lectura/edición de parámetros con auditoría de valor anterior/nuevo
- [x] Documentos formales de las 4 políticas en `docs/policies/`
- [x] Tests: 28 unitarios + 6 e2e (login, RBAC, refresh, auditoría con old/new values)

## Fuera de alcance (pasa a Iteración 2)

- Prototipo arquitectónico end-to-end: pago validado → evento → reconexión simulada (mock MikroTik + BullMQ real)
- Documento de arquitectura con diagramas de componentes, despliegue y secuencia

## Criterios de salida

1. Toda ruta no marcada `@Public()` exige JWT; rutas de gestión exigen rol correcto (verificado por e2e).
2. Mutaciones sobre entidades críticas generan `audit_log` con usuario, IP, user-agent y `policyRef` **antes** de responder.
3. `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm test:e2e` en verde.
4. Documentos de políticas versionados y matriz ISO/IEC 38500 actualizada al cierre.
