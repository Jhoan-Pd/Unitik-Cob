# Módulo `network`

**Propósito:** integración con la infraestructura MikroTik/RouterBoard (RouterOS API) y ejecución de reconexiones/suspensiones vía cola BullMQ.

**Políticas ISO/IEC 38500 asociadas:** Control de acceso a la red (Responsabilidad + Comportamiento humano) y Continuidad del servicio (Estrategia + Desempeño).

**Componentes:**
- `MikrotikService`: los 7 métodos obligatorios (`enableClient`, `disableClient`, `createPppoeUser`, `removePppoeUser`, `changeUserProfile`, `getActiveConnections`, `ping`). **En modo MOCK** (Iteración 2, `MIKROTIK_MOCK=true` por defecto); el driver real con `node-routeros` llega en Iteración 5 con la misma interfaz.
- `PaymentValidatedListener`: al evento `payment.validated` encola el job `reconnect` (idempotente por pago, `jobId = reconnect:<paymentId>`), con reintentos 1/5/15/30/60 min de la política de continuidad.
- `ReconnectionProcessor`: worker BullMQ — ejecuta la reconexión, actualiza `NetworkAccess` (`lastAction = 'reconnected'`) y el estado del cliente, audita `RECONNECT` y registra la métrica `RECONNECTION_TIME_MINUTES`.

**Endpoints:** ninguno todavía — el CRUD de `NetworkDevice` y la vista de dispositivos llegan en Iteración 5.

**Regla innegociable:** ninguna operación contra la RouterBoard es síncrona; todo pasa por la cola.
