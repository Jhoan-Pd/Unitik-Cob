# Política 3 — Trazabilidad de la información

**Principios ISO/IEC 38500:** Conformidad + Responsabilidad
**Módulo:** `apps/api/src/modules/governance/traceability.policy.ts` + `apps/api/src/modules/audit/`
**Aprobación:** Gerencia UNITIK · Versión 1.0 — Iteración 1

## Propósito

Que ninguna operación crítica ocurra sin evidencia: quién la hizo, cuándo, desde dónde, qué cambió (valores anteriores y nuevos) y bajo qué principio de gobernanza.

## Reglas

1. Un **interceptor global** de NestJS audita CREATE/UPDATE/DELETE en las entidades críticas: Client, Invoice, Payment, Subscription, NetworkAccess, NetworkDevice, User, Plan, SystemConfig.
2. Cada registro de `audit_log` incluye `policyRef` con el principio ISO/IEC 38500 aplicable.
3. Meta: **≥ 95 %** de operaciones críticas con trazabilidad completa (métrica `TRACEABILITY_PERCENT`).
4. Los registros de auditoría son **append-only**: el módulo `audit` no expone ni implementa edición o borrado.
5. Claves sensibles (contraseñas, tokens, credenciales de dispositivos) se eliminan de los valores auditados antes de persistir.
6. La escritura de auditoría se completa **antes** de responder al cliente: cualquier estado observable tiene su rastro ya persistido.
7. Dashboard admin con exportación CSV/PDF filtrable por fecha, usuario y entidad (Iteración 6).

## Cumplimiento verificable

- Tests unitarios de sanitización y de no-propagación de fallos (`audit.service.spec.ts`).
- Test e2e: un PATCH de configuración produce un `audit_log` con `oldValues`/`newValues` correctos e IP.
- Un fallo del write de auditoría no rompe la operación, pero se loguea como ERROR y degrada la métrica del punto 3 — visible en la validación experimental.
