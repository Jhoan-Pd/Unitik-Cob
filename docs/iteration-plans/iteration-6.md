# Plan de Iteración 6 — Fase de Construcción (OpenUP)

**Duración:** 4 semanas · **Estado: en curso (parte 1 entregada)**

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

## Parte 2 — pendiente para cerrar la iteración

- [ ] Notificaciones in-app en tiempo real con WebSockets (Socket.io) para el panel admin
- [ ] Reportes exportables adicionales: recaudo y clientes por plan (CSV); evaluación de `exceljs`/`pdfkit` para Excel/PDF nativos
- [ ] Paneles frontend: admin (dashboard, cartera, auditoría), técnico (tickets, actas), cajero (caja) — hoy solo existe el portal cliente y el placeholder de staff
- [ ] Recordatorios automáticos de vencimiento y promesa (`OVERDUE_REMINDER`, `PROMISE_REMINDER`) generados por cron

## Criterios de salida (al cierre)

1. e2e cubre: efectivo → recibo → reconexión; ticket → cierre; auditoría exportada; KPIs y métricas. ✅ (parte 1)
2. Frontend de los 3 paneles staff operativo con los flujos críticos. ⬜
3. Todo verde: test, lint, typecheck, e2e. ✅ (parte 1)
