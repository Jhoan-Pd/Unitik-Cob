# Plan de Iteración 4 — Fase de Construcción (OpenUP)

**Duración:** 4 semanas · **Estado: ✅ CERRADA (2026-07-07)**

**Verificación de cierre:** `pnpm test` 58/58 (api) + 2/2 (web) · `pnpm lint` 0 errores · `pnpm typecheck` limpio · `pnpm test:e2e` 19/19 (5 suites, en serie contra PostgreSQL/Redis reales).

## Objetivos

Motor de facturación completo con todas las políticas comerciales de UNITIK parametrizadas en `system_config`, y las dos vías de validación de pago de la Política 1 operando: manual (con comprobante) y automática (webhook Wompi firmado).

## Alcance entregado

- [x] Generación mensual automática (cron día 1, 01:00 América/Bogota) — idempotente por (suscripción, período), `FCT-<período>-<códigoCliente>`, TV incluida en el subtotal
- [x] Mora (cron diario 03:00): `PENDING` vencida → `OVERDUE` + interés único `subtotal × interest_rate_percent`
- [x] **Doble mensualidad**: mora > `double_payment_after_days` agrega una mensualidad extra una sola vez (auditada como `DOUBLE_BILLING`)
- [x] Descuentos: solo ADMIN, motivo obligatorio, no supera el total ni toca facturas pagadas (auditado con old/new)
- [x] Promesas de pago: 7 o 15 días, una vigente por factura, factura → `PROMISE_TO_PAY`; cron 04:00 devuelve a `OVERDUE` las incumplidas (`PROMISE_BROKEN`); el pago validado las marca cumplidas
- [x] Webhook Wompi: verificación de firma SHA-256 (propiedades + timestamp + secreto), único camino auto-validado (`autoValidated`), idempotente por transacción, rechaza montos alterados
- [x] Factura electrónica DIAN: encolada en BullMQ (regla de oro #4), procesador MOCK con CUFE determinístico — el proveedor real (Alegra/Siigo) se decide en Fase 4 (riesgo R-08)
- [x] Vista de cartera y morosidad: totales, conteos y ranking de morosos
- [x] e2e en serie (`maxWorkers: 1`): las suites comparten una BD — el paralelismo generaba carreras entre fixtures

## Criterios de salida

1. e2e recorre: generar → vencer → interés → descuento → promesa → webhook firmado → PAID + promesa cumplida + réplica ignorada. ✅
2. Firma inválida o monto alterado → 403 (protección contra comprobantes falsos digitales). ✅
3. Todos los parámetros comerciales provienen de `system_config` — verificado también en los tests. ✅
