# Matriz de Cumplimiento ISO/IEC 38500 — Unitik-Cob

Se actualiza al cierre de **cada iteración** OpenUP con los principios cubiertos.

| Principio | Definición aplicada al proyecto | Mecanismos en el software | Estado (Iteración 0) |
| --- | --- | --- | --- |
| **1. Responsabilidad** | Roles y responsabilidades claros sobre las operaciones de TI | RBAC con 4 roles (ADMIN/TECHNICIAN/CASHIER/CLIENT); `AuditLog.userId` en toda operación; política de control de acceso a la red | 🔶 Modelo de datos definido (schema Prisma) |
| **2. Estrategia** | TI alineada con la continuidad del negocio en zona rural | Colas BullMQ con reintentos; Redis persistente (AOF); backup diario 02:00; health check `/health` | 🔶 Infraestructura base (Docker Compose + health check) |
| **3. Adquisición** | Decisiones de tecnología justificadas y documentadas | Stack elegido por conectividad intermitente, equipo pequeño e integración MikroTik (ver README); dependencias fijadas en lockfile | ✅ Stack documentado y justificado |
| **4. Desempeño** | El servicio cumple los niveles requeridos | Meta: reconexión < 5 min tras validación; métricas experimentales automáticas (`OperationalMetric`) | 🔶 Modelo de métricas definido |
| **5. Conformidad** | Cumplimiento normativo y de políticas internas | `audit_log` append-only; facturación electrónica DIAN (CUFE); políticas formalizadas en `docs/policies/` | 🔶 Tabla de auditoría definida |
| **6. Comportamiento humano** | El sistema respeta a las personas que lo usan | UI en español; validación en dos pasos de comprobantes (evita acusaciones injustas); promesas de pago (7/15 días); rate limiting de acciones de red | 🔶 Reglas capturadas en casos de uso |

Leyenda: ✅ cubierto · 🔶 parcial/en diseño · ⬜ pendiente

## Trazabilidad políticas → principios

| Política de Gobernanza | Principios ISO/IEC 38500 | Módulo NestJS | Iteración |
| --- | --- | --- | --- |
| 1. Gestión de pagos y reconexión | Desempeño + Conformidad | `governance/payment-reconnection.policy.ts` | 2 (skeleton), 4–5 (completa) |
| 2. Control de acceso a la red | Responsabilidad + Comportamiento humano | `governance/network-access-control.policy.ts` | 2 (skeleton), 5 (completa) |
| 3. Trazabilidad de la información | Conformidad + Responsabilidad | `governance/traceability.policy.ts` | 2 (skeleton + interceptor), 6 (dashboard) |
| 4. Continuidad del servicio | Estrategia + Desempeño | `governance/service-continuity.policy.ts` | 2 (skeleton), 5–6 (completa) |

## Historial por iteración

### Iteración 3 (Fase Construcción) — CERRADA 2026-07-06
**Entregado:** módulos `clients` (validaciones colombianas, GPS, estados con motivo auditados), `plans` (defaults desde `system_config`), `subscriptions` (única activa por cliente, tx), `invoices` lectura, y portal cliente React (login por cédula, mi plan, mis facturas, rutas por rol, refresh automático).
**Verificación de cierre:** `pnpm test` 46/46 + 2/2 web · lint 0 · typecheck limpio · e2e 13/13.
**Avance de principios:** Responsabilidad ✅ sostenido (nuevos módulos con RBAC + auditoría old/new); Comportamiento humano 🔶→ avanzado (portal 100 % español, login con cédula, motivos obligatorios en suspensiones); Conformidad sostenida (STATUS_CHANGE con motivo en `audit_log`).
**Riesgos:** R-06 (migración WhispHub) sigue abierto — el CRUD de clientes ya permite el script de importación; R-07 mitigado parcialmente (UI simple en español).

### Iteración 2 (Fase Elaboración) — CERRADA 2026-07-06 · **Fase 2 completada**
**Entregado:**
- Prototipo arquitectónico ejecutable del flujo crítico: pago registrado → validación manual (Política 1: solo ADMIN/CASHIER, comprobante obligatorio para Nequi/transferencia, rechazo con motivo + notificación) → evento `payment.validated` → job BullMQ idempotente → reconexión en RouterBoard (mock) → auditoría `RECONNECT` → métrica `RECONNECTION_TIME_MINUTES`.
- `QueuesModule` (Redis AOF) y worker con backoff de la política de continuidad (1/5/15/30/60 min).
- `MikrotikService` con los 7 métodos obligatorios en modo MOCK (misma interfaz que usará `node-routeros` en It. 5).
- `docs/architecture.md` reescrito desde el prototipo real (componentes, secuencia, despliegue, 6 ADRs).

**Verificación de cierre (2026-07-06):** `pnpm test` 38/38 · `pnpm lint` 0 · `pnpm typecheck` limpio · `pnpm test:e2e` 8/8. Reconexión medida: 0,01 min (SLA < 5 min).

**Avance de principios:**
- **Estrategia**: 🔶→✅ base — continuidad operando con colas persistentes y reintentos reales (falta RouterBoard física, Fase 4).
- **Desempeño**: 🔶 avanzado — SLA instrumentado con métrica automática; validación definitiva en Fase 4.
- **Conformidad/Responsabilidad**: sostenidos — todo el flujo nuevo quedó auditado (VALIDATION con old/new, RECONNECT con policyRef).

**Riesgos:** R-01 mitigado por diseño y probado (job reintenta ante fallo de MikroTik); R-02 acotado (interfaz final congelada, solo falta transporte).

**Hito OpenUP:** arquitectura estable demostrada por ejecución → inicia Fase 3 (Construcción).

### Iteración 1 (Fase Elaboración) — CERRADA 2026-07-06
**Entregado:**
- Módulo `auth` (JWT + Passport, refresh con secreto separado, login por correo/cédula) con auditoría de `LOGIN`, `LOGIN_FAILED` y `TOKEN_REFRESH` (IP + user-agent).
- Módulo `users` con RBAC de 4 roles; sin borrado físico (desactivación) para preservar historia de auditoría.
- Guards globales `JwtAuthGuard`/`RolesGuard`; módulo `governance` con las 4 políticas inyectables y testeadas.
- `AuditModule`: interceptor global `@Audited` — registra usuario, IP, user-agent, `oldValues`/`newValues` y `policyRef`, sanitiza secretos y completa la escritura **antes** de responder; servicio append-only.
- Módulo `system-config` auditado con valor anterior/nuevo (regla de oro #3).
- Documentos formales de las 4 políticas en `docs/policies/`.

**Verificación de cierre (2026-07-06):** `pnpm test` 28/28 · `pnpm lint` 0 errores · `pnpm typecheck` limpio · `pnpm test:e2e` 6/6.

**Avance de principios:**
- **Responsabilidad**: 🔶→✅ para los módulos existentes — RBAC operativo, toda mutación con autor identificado.
- **Conformidad**: 🔶 avanzado — trazabilidad automática con old/new values funcionando (e2e verificado); falta cubrir módulos de dominio (It. 3–6).
- **Comportamiento humano**: 🔶 — mensajes de validación en español, login por cédula para clientes.
- **Estrategia / Desempeño**: sin cambio (la política de continuidad se ejercita en It. 2 con BullMQ).

**Riesgos:** R-05 mitigado parcialmente (RBAC + auditoría con IP); resto sin cambios.

**Pasa a Iteración 2:** prototipo arquitectónico pago→validación→reconexión simulada y documento de arquitectura.

### Iteración 0 (Fase Inicio) — CERRADA 2026-07-04
**Entregado:**
- Monorepo pnpm (apps/api NestJS, apps/web React+Vite, packages/shared-types), schema Prisma completo (15 modelos, 14 enums, incluye `AuditLog`, `SystemConfig`, `OperationalMetric`) con migración `init` aplicable en frío.
- Docker Compose con PostgreSQL 16, Redis 7 (AOF), API y Web — un solo comando levanta el ambiente.
- Seed: 6 planes (4 Fibra + 2 Radio con precios del documento), 8 parámetros de `system_config`, usuario ADMIN.
- Health check `/health` (DB + Redis) con test unitario y e2e; Swagger operativo en `/api/docs`.
- Artefactos OpenUP: visión, 39 casos de uso, 12 riesgos, planes de iteración, esta matriz.
- CI GitHub Actions; Husky + commitlint (Conventional Commits).

**Verificación de cierre (ritual OpenUP, 2026-07-04):**
| Comando | Resultado |
| --- | --- |
| `pnpm test` | ✅ 2/2 unitarios (api) + web sin tests aún (Iteración 3) |
| `pnpm lint` | ✅ 0 errores en los 3 paquetes |
| `pnpm typecheck` | ✅ TypeScript strict sin errores |
| `pnpm test:e2e` | ✅ 1/1 (health contra PostgreSQL y Redis reales) |

**Cobertura de principios al cierre:** Adquisición ✅ · Estrategia 🔶 (infraestructura de continuidad base) · Responsabilidad, Desempeño, Conformidad, Comportamiento humano 🔶 (definidos en modelo de datos y casos de uso; se implementan desde Iteración 1).

**Riesgos:** sin cambios frente a `risk-list.md`; R-01 (conectividad) ya mitigado por diseño con Redis AOF en el compose.

**Pendiente que pasa a Iteración 1:** ninguno — alcance completado.
