# Política 4 — Continuidad del servicio

**Principios ISO/IEC 38500:** Estrategia + Desempeño
**Módulo:** `apps/api/src/modules/governance/service-continuity.policy.ts`
**Aprobación:** Gerencia UNITIK · Versión 1.0 — Iteración 1

## Propósito

Que la conectividad intermitente de Cumbitara (riesgo R-01) nunca pierda una operación: lo que no se puede ejecutar ahora, se encola y se ejecuta cuando la red vuelve.

## Reglas

1. Las operaciones críticas (reconexión, suspensión, notificación) van a colas **BullMQ** con reintentos exponenciales: **5 intentos a 1, 5, 15, 30 y 60 minutos**.
2. Si la RouterBoard está caída, la acción permanece encolada y se ejecuta al recuperar conectividad.
3. Redis persiste con **AOF**: las colas sobreviven reinicios del servidor.
4. Los jobs críticos conservan su historial (`removeOnComplete/Fail = false`) para trazabilidad.
5. **Backup diario automatizado** de PostgreSQL a las 02:00 América/Bogota (servicio `backup` en `docker-compose.prod.yml`, retención 14 días).
6. Endpoint `/health` verifica: base de datos, Redis, RouterBoard, WhatsApp API y pasarela de pagos.

## Cumplimiento verificable

- `ServiceContinuityPolicy.retryDelaysMs()` y `criticalJobOptions()` son la única fuente de los parámetros de reintento (test unitario).
- `/health` ya operativo para DB y Redis (e2e); los checks de RouterBoard/WhatsApp/pasarela se conectan en Iteraciones 5–6.
- Tras 5 reintentos fallidos se notifica al administrador (Iteración 5).
