# Plan de Iteración 6 — Fase de Construcción (OpenUP)

**Duración:** 4 semanas · **Estado: partes 1 y 2 entregadas — lista para cierre**

## Objetivos

Cerrar la Fase de Construcción: operación diaria completa (tickets, caja, actas), gobierno visible (auditoría consultable/exportable, KPIs) y notificaciones.

## Parte 1 — entregada (2026-07-08)

- [x] Módulo `tickets`: número `TKT-<año>-<seq>`, visibilidad por rol (cliente: propios; técnico: asignados con restricción de gestión; admin/cajero: todos), `closedAt` automático, categorías incluyen `RECONNECTION_COMPLAINT` (alimenta métrica de reclamos)
- [x] Módulo `cashier`: efectivo validado al instante (Política 1 permite CASHIER; el efectivo no exige comprobante), recibo `REC-<fecha>-<seq>`, reconexión disparada, cierre de caja diario por cajero y estado de cuenta de cliente
- [x] Módulo `installations`: acta del técnico con equipos (JSON), metros de cable, equipos pagados por el cliente y firma digital (URL)
- [x] Panel de auditoría: consulta con filtros (fecha/usuario/entidad/acción) y **exportación CSV** compatible con Excel — solo ADMIN, append-only
- [x] Dashboard KPIs: clientes activos/suspendidos, ingresos del mes, morosos y monto, tickets abiertos, dispositivos online/total
- [x] Endpoint `/api/metrics/experimental?phase=BASELINE|POST_INTERVENTION&from&to` con las 4 métricas de la tesis (BASELINE desde mediciones manuales almacenadas; POST calculada en vivo)
- [x] Módulo `notifications`: bandeja in-app (`/notifications/my` + marcar leída), despacho cada 5 min con canales en modo MOCK (proveedores reales de WhatsApp/SMS/email se contratan en Fase 4 — R-09)
- [x] Tests: 78 unitarios + 27 e2e (7 suites)

## Parte 2 — entregada (2026-07-08)

- [x] **WebSockets (Socket.io)**: gateway `/ws` con autenticación JWT en el handshake, salas por rol; `payment.validated` se difunde al staff en tiempo real (los sockets sin token se desconectan)
- [x] Reportes CSV: **recaudo** por período (con totales y bandera de auto-validación) y **clientes por plan** con ingreso mensual estimado — compatibles con Excel; PDF nativo se evalúa en Fase 4
- [x] **Panel ADMIN** (React): tarjetas KPI, cartera con ranking de morosos, tabla de auditoría con exportación CSV autenticada, y feed de eventos en vivo por WebSocket
- [x] **Panel CAJERO**: búsqueda de cliente → estado de cuenta → recibir efectivo (recibo en pantalla) → cierre de caja del día
- [x] **Panel TÉCNICO**: tickets asignados con avance de estado (Abierto → En progreso → Resuelto → Cerrado)
- [x] Recordatorios cron (08:00): `OVERDUE_REMINDER` (in-app + WhatsApp mock, uno por cliente/día) y `PROMISE_REMINDER` (promesas que vencen en 24 h)

## Criterios de salida

1. e2e cubre: efectivo → recibo → reconexión; ticket → cierre; auditoría exportada; KPIs y métricas. ✅
2. Frontend de los 3 paneles staff operativo con los flujos críticos. ✅
3. Todo verde: `pnpm test` 78/78 + 2/2 web · lint 0 · typecheck limpio · e2e 27/27 (7 suites). ✅
