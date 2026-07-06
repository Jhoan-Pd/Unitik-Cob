# Política 1 — Gestión de pagos y reconexión

**Principios ISO/IEC 38500:** Desempeño + Conformidad
**Módulo:** `apps/api/src/modules/governance/payment-reconnection.policy.ts`
**Aprobación:** Gerencia UNITIK (Eyner Dayan Romo) · Versión 1.0 — Iteración 1

## Propósito

Eliminar la validación manual informal de comprobantes y garantizar que todo pago validado produzca la reconexión del servicio en menos de 5 minutos, con evidencia auditable.

## Reglas

1. Todo pago por Nequi o transferencia bancaria ingresa en estado `PENDING_VALIDATION`.
2. Los pagos recibidos por webhook de la pasarela oficial (Wompi) se validan automáticamente (`autoValidated = true`).
3. La validación manual exige: usuario con rol **ADMIN o CASHIER**, comprobante adjunto (`proofUrl`), y registro de `validatedBy` y `validatedAt`.
4. Al pasar a `VALIDATED` se emite `payment.validated`, que encola la reconexión en BullMQ (nunca se ejecuta síncrona contra la RouterBoard).
5. Si el comprobante es falso o inválido → estado `REJECTED`, con motivo registrado y notificación al cliente.
6. **SLA de reconexión: < 5 minutos** desde la validación (métrica experimental `RECONNECTION_TIME_MINUTES`).

## Cumplimiento verificable

- `PaymentReconnectionPolicy.canValidateManually()` es la única fuente de verdad del punto 3 (test unitario en `governance.policies.spec.ts`).
- Toda transición de estado de pago queda en `audit_log` con `policyRef = "ISO/IEC 38500 - Desempeño/Conformidad"`.
- Implementación completa del flujo: Iteraciones 4–5.
