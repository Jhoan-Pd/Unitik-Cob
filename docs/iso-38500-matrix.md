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

### Iteración 0 (Fase Inicio) — 2026-07
- Monorepo, schema Prisma completo (incluye `AuditLog`, `SystemConfig`, `OperationalMetric`), Docker Compose con Redis persistente, seed con parámetros configurables y health check.
- Principio de **Adquisición** cubierto: stack justificado y fijado.
- Resto de principios: en diseño (modelo de datos y casos de uso los contemplan).
