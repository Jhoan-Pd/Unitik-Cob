# Plan de Iteración 2 — Fase de Elaboración (OpenUP)

**Duración:** 4 semanas · **Estado: ✅ CERRADA (2026-07-06) — cierra la Fase de Elaboración**

**Verificación de cierre:** `pnpm test` 38/38 · `pnpm lint` 0 errores · `pnpm typecheck` limpio · `pnpm test:e2e` 8/8 (incluye prototipo end-to-end con reconexión en 0,01 min, SLA < 5).

## Objetivos

Validar la arquitectura con un prototipo ejecutable del flujo crítico del negocio (pago → validación → reconexión) y consolidar el documento de arquitectura. Riesgos atacados: R-01 (conectividad, vía colas reales) y R-02 (RouterBoard, vía interfaz mock con firma definitiva).

## Alcance (checklist)

- [x] Infraestructura BullMQ (`QueuesModule`) con Redis y `maxRetriesPerRequest: null`
- [x] `ServiceContinuityPolicy` conectada al worker: backoff custom 1/5/15/30/60 min, jobs con historial
- [x] Módulo `network`: `MikrotikService` con los 7 métodos obligatorios (modo MOCK), listener de `payment.validated`, `ReconnectionProcessor`
- [x] Módulo `payments` (prototipo): registro `PENDING_VALIDATION`, validación manual con reglas de la Política 1 (roles, comprobante obligatorio, rechazo con motivo + notificación)
- [x] Evento `payment.validated` (EventEmitter) → job idempotente `reconnect-<paymentId>`
- [x] Worker: reconexión mock, `NetworkAccess.lastAction='reconnected'`, cliente `ACTIVE`, auditoría `RECONNECT`, métrica `RECONNECTION_TIME_MINUTES`
- [x] Documento de arquitectura con vistas de componentes, secuencia y despliegue + ADRs
- [x] Tests: 38 unitarios + 10 e2e (prototipo end-to-end con BullMQ/Redis reales)

## Criterios de salida

1. El e2e del prototipo recorre pago → validación → cola → reconexión y verifica auditoría + métrica dentro del SLA.
2. Falla de MikroTik propaga al job → reintentos según política (test unitario).
3. `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm test:e2e` en verde.
4. `docs/architecture.md` refleja la arquitectura realmente construida.

## Cierre de la Fase de Elaboración

Con esta iteración se cumple el hito OpenUP de **arquitectura estable demostrada por ejecución**. La Fase 3 (Construcción, It. 3–6) rellena los módulos de dominio sobre estos rieles.
