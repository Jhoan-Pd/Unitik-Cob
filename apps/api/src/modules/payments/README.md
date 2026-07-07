# Módulo `payments`

**Propósito:** registro y validación de pagos — el disparador del flujo crítico del negocio: pago validado → evento → reconexión encolada.

**Política ISO/IEC 38500 asociada:** Gestión de pagos y reconexión (Desempeño + Conformidad).

**Estado:** prototipo arquitectónico (Iteración 2). La facturación completa (mora, promesas, webhook Wompi, DIAN) llega en Iteración 4.

**Reglas ya operativas:**
- Todo pago entra en `PENDING_VALIDATION`.
- Solo ADMIN o CASHIER validan (`PaymentReconnectionPolicy.canValidateManually`).
- Nequi/transferencia exigen comprobante adjunto para aprobar.
- Rechazo exige motivo y crea una notificación al cliente (`PAYMENT_REJECTED`).
- Aprobación marca `validatedBy`/`validatedAt`, emite `payment.validated` y la reconexión viaja por cola BullMQ — jamás síncrona.

**Endpoints principales:**

| Método | Ruta | Roles | Descripción |
| --- | --- | --- | --- |
| POST | `/api/payments` | ADMIN, CASHIER, CLIENT | Registrar pago (auditado) |
| GET | `/api/payments/:id` | autenticado | Consultar pago |
| PATCH | `/api/payments/:id/validate` | ADMIN, CASHIER | Aprobar/rechazar (auditado con old/new) |
