# Documento de Arquitectura — Unitik-Cob

**Artefacto OpenUP — Fase de Elaboración (Iteración 2)**
Validado con el prototipo arquitectónico ejecutable (`test/payment-reconnection.e2e-spec.ts`).

## 1. Metas y restricciones arquitectónicas

| Restricción | Decisión que la resuelve |
| --- | --- |
| Conectividad intermitente en Cumbitara (R-01) | Ninguna operación externa es síncrona: colas BullMQ + Redis AOF con reintentos 1/5/15/30/60 min |
| Trazabilidad ISO/IEC 38500 (R-03, política 3) | Interceptor global de auditoría; `audit_log` append-only; escritura previa a la respuesta |
| Equipo pequeño, un desarrollador | Monolito modular NestJS (no microservicios); monorepo pnpm; TypeScript strict end-to-end |
| Integración nativa MikroTik | `MikrotikService` con interfaz fija; mock en Elaboración, `node-routeros` en Construcción |
| Parámetros de negocio cambiantes (R-11) | `system_config` editable y auditado; los módulos leen, nunca hardcodean |

## 2. Vista de componentes

```
┌─────────────────────────── apps/web (React 18 + Vite) ───────────────────────────┐
│  pages/admin · pages/technician · pages/cashier · pages/client                   │
│  TanStack Query (server state) · Zustand (UI state) · React Router               │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │ HTTPS /api (Nginx)
┌──────────────────────────────────────▼───────────────────────────────────────────┐
│                              apps/api (NestJS 10)                                │
│                                                                                  │
│  ┌─ Transversales (globales) ────────────────────────────────────────────────┐   │
│  │ JwtAuthGuard + RolesGuard (RBAC 4 roles)                                  │   │
│  │ AuditInterceptor (@Audited) ──► AuditService ──► audit_log (append-only)  │   │
│  │ GovernanceModule: 4 políticas inyectables ISO/IEC 38500                   │   │
│  │ SystemConfigModule: parámetros de negocio                                 │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  auth │ users │ payments │ invoices* │ clients* │ plans* │ tickets* │ cashier*   │
│                   │                                                              │
│                   │ emit('payment.validated')                                    │
│                   ▼                                                              │
│  ┌─ network ─────────────────────────────────────────────┐                       │
│  │ PaymentValidatedListener ──► cola BullMQ 'reconnection'│                      │
│  │ ReconnectionProcessor (worker) ──► MikrotikService     │                      │
│  └───────────────────────────────────────────────────────┘                       │
│         (* = Iteraciones 3–6)                                                    │
└───────┬─────────────────────┬────────────────────────┬───────────────────────────┘
        ▼                     ▼                        ▼
  PostgreSQL 16          Redis 7 (AOF)          RouterBoard MikroTik
  (Prisma 5)             colas BullMQ           (RouterOS API :8728)
                                                + WhatsApp/Wompi/DIAN (It. 4–6)
```

## 3. Flujo crítico (secuencia validada por el prototipo)

```
Cajero/Admin      payments        EventEmitter      network:listener     BullMQ        worker:processor      MikroTik(mock)    PostgreSQL
    │  PATCH /payments/:id/validate │                     │                │                  │                    │               │
    ├──────────────►│ policy.canValidateManually(role)    │                │                  │                    │               │
    │               │ requiresProof(NEQUI) ✓              │                │                  │                    │               │
    │               │ tx: Payment→VALIDATED, Invoice→PAID─┼────────────────┼──────────────────┼────────────────────┼──────────────►│
    │               ├─ emit payment.validated ───────────►│                │                  │                    │               │
    │◄─ 200 OK ─────┤ (AuditInterceptor ya escribió       ├─ busca NetworkAccess del cliente  │                    │               │
    │               │  VALIDATION con old/new values)     ├─ add('reconnect', jobId=pago) ───►│                    │               │
    │               │                                     │                ├─ process(job) ──►│                    │               │
    │               │                                     │                │ (reintentos      ├─ enableClient ────►│               │
    │               │                                     │                │  1/5/15/30/60min │◄─ ok (sesión efímera)              │
    │               │                                     │                │  si falla)       ├─ tx: access reconnected,           │
    │               │                                     │                │                  │      client ACTIVE ───────────────►│
    │               │                                     │                │                  ├─ audit RECONNECT ─────────────────►│
    │               │                                     │                │                  └─ métrica RECONNECTION_TIME ───────►│
```

Resultado medido en el prototipo (Redis y PostgreSQL reales, RouterBoard mock): **0,01 min** — SLA < 5 min con margen amplio; el margen real se valida en Fase 4 con la RouterBoard física.

## 4. Vista de despliegue

```
Servidor UNITIK (Cumbitara) — Docker Compose
├── nginx/web  :80   → SPA React + proxy /api y /health
├── api        :3000 → NestJS (incluye workers BullMQ en el mismo proceso)
├── postgres   :5432 → volumen persistente + backup diario 02:00 (retención 14 días)
└── redis      :6379 → AOF (colas sobreviven reinicios)
        ↓ red local del ISP
RouterBoard MikroTik (RouterOS API 8728) · OLT · APs
        ↓ internet (intermitente)
WhatsApp Cloud API · Wompi · Alegra/Siigo (DIAN) · Twilio
```

Desarrollo en Windows: PostgreSQL del compose expuesto en **5433** (conflicto con PostgreSQL local); API y web corren con `pnpm dev` contra esos contenedores.

## 5. Decisiones de arquitectura (ADR resumidas)

1. **Monolito modular, no microservicios** — un solo proceso NestJS con módulos por dominio; los workers BullMQ viven en el mismo proceso. Simplicidad operativa para un servidor local en zona rural.
2. **Eventos internos (`@nestjs/event-emitter`) + colas externas (BullMQ)** — el evento desacopla `payments` de `network` dentro del proceso; la cola aporta persistencia y reintentos ante caídas. La cola es la frontera de confiabilidad, no el event bus.
3. **Jobs idempotentes** — `jobId = reconnect-<paymentId>`: reencolar el mismo pago no duplica reconexiones (BullMQ deduplica por id; los dos puntos están prohibidos en ids).
4. **Auditoría antes de responder** — el interceptor completa el `INSERT` de auditoría antes de despachar la respuesta: todo estado observable tiene rastro. Costo de latencia asumido (~ms) a cambio de conformidad.
5. **Mock de MikroTik detrás de la interfaz definitiva** — los 7 métodos obligatorios ya existen con su firma final; la Iteración 5 solo sustituye el transporte por `node-routeros`. El resto del sistema no cambia.
6. **Refresh tokens sin estado** — JWT con secreto separado; la revocación se materializa con `isActive = false` (re-verificado en cada request por `JwtStrategy`).

## 6. Atributos de calidad verificados

| Atributo | Mecanismo | Evidencia |
| --- | --- | --- |
| Confiabilidad ante cortes | Cola persistente + reintentos de política | Test: fallo de MikroTik propaga → BullMQ reintenta |
| Trazabilidad | Interceptor + auditoría en worker | e2e: `VALIDATION` con old/new + `RECONNECT` con policyRef |
| Seguridad | RBAC + guards globales + sanitización de secretos en auditoría | e2e 401/403; unit tests de sanitización |
| Desempeño (SLA reconexión) | Métrica automática `RECONNECTION_TIME_MINUTES` | e2e: valor < 5 min registrado en `operational_metrics` |
