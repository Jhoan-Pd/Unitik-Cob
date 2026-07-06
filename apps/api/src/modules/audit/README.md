# Módulo `audit`

**Propósito:** trazabilidad de toda operación crítica (regla de oro #1). Tabla `audit_log` **append-only**: este módulo solo inserta; no existe código de edición ni borrado de registros de auditoría.

**Política ISO/IEC 38500 asociada:** Trazabilidad de la información (Conformidad + Responsabilidad).

**Cómo funciona:**
- `AuditInterceptor` (global): audita automáticamente toda ruta mutante marcada con `@Audited({ entity })` — captura usuario, IP, user-agent, acción (por método HTTP o override) y respuesta sanitizada.
- `AuditService.record()`: para registros manuales con `oldValues` precisos o acciones de dominio (`LOGIN`, `RECONNECT`, `SUSPEND`).
- Claves sensibles (contraseñas, tokens, credenciales de dispositivos) se eliminan antes de persistir (`TraceabilityPolicy.sensitiveKeys()`).
- Un fallo al escribir auditoría no rompe la operación de negocio: se loguea como error y queda visible en la métrica `TRACEABILITY_PERCENT`.

**Endpoints:** ninguno todavía — la consulta/exportación de auditoría llega en Iteración 6 (panel admin).
