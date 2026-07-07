# Plan de Iteración 5 — Fase de Construcción (OpenUP)

**Duración:** 4 semanas · **Estado: ✅ CERRADA (2026-07-07)**

**Verificación de cierre:** `pnpm test` 70/70 (api) + 2/2 (web) · `pnpm lint` 0 errores · `pnpm typecheck` limpio · `pnpm test:e2e` 22/22 (6 suites).

## Objetivos

Integración completa con la infraestructura de red MikroTik aplicando la Política 2 (control de acceso a la red): driver RouterOS real, credenciales cifradas, suspensión automática por mora y cambio de plan reflejado en la RouterBoard.

## Alcance entregado

- [x] `MikrotikService` con los 7 métodos obligatorios respaldados por **node-routeros** (comandos `/ppp/secret` y `/ppp/active`); sesiones efímeras cerradas en `finally`; modo MOCK por defecto hasta conectar la RouterBoard física (Fase 4)
- [x] Credenciales de dispositivos cifradas **AES-256-GCM** (`iv.tag.ciphertext`, clave `DEVICE_SECRET_KEY`); jamás se devuelven por API ni aparecen en auditoría
- [x] CRUD de `NetworkDevice` (solo ADMIN/TECHNICIAN) con estado **online/offline/unknown** derivado de `lastPing` y endpoint de ping
- [x] **Rate limiting** de acciones de red: 20/min por usuario (valor de la política de gobernanza), guard con ventana deslizante
- [x] Cola unificada `network-actions` con 3 tipos de job: `reconnect`, `suspend`, `change-profile` — reintentos de la política de continuidad
- [x] **Suspensión automática** (cron diario 05:00): facturas `OVERDUE` con gracia vencida (`grace_period_days`) → job idempotente por cliente/día; las facturas con promesa (`PROMISE_TO_PAY`) quedan protegidas
- [x] **Cambio de plan → perfil PPPoE**: evento `subscription.changed` → job `change-profile` (el perfil RouterOS lleva el nombre del plan)
- [x] Auditoría completa: `RECONNECT`, `SUSPEND` (con motivo), `CHANGE_PROFILE`, `NETWORK_ACTION_SKIPPED`, `PING` — todas con `policyRef` de Responsabilidad

## Criterios de salida

1. e2e: dispositivo creado con secreto cifrado no expuesto + ping online + moroso suspendido por el worker con rastro `SUSPEND`. ✅
2. Falla de RouterBoard propaga al job → reintentos 1/5/15/30/60 min (unit test). ✅
3. Todo verde: test, lint, typecheck, e2e. ✅

## Nota para Fase 4

Poner `MIKROTIK_MOCK=false` y registrar la RouterBoard real de Cumbitara activa el driver `node-routeros` sin tocar ningún otro módulo (la interfaz es idéntica).
