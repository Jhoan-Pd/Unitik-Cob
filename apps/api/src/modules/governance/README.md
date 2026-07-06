# Módulo `governance`

**Propósito:** implementar las 4 políticas de Gobernanza de TI del proyecto como proveedores inyectables. Ningún módulo de dominio re-implementa reglas de gobernanza: las consume de aquí.

**Políticas y principios ISO/IEC 38500:**

| Política | Archivo | Principios |
| --- | --- | --- |
| Gestión de pagos y reconexión | `payment-reconnection.policy.ts` | Desempeño + Conformidad |
| Control de acceso a la red | `network-access-control.policy.ts` | Responsabilidad + Comportamiento humano |
| Trazabilidad de la información | `traceability.policy.ts` | Conformidad + Responsabilidad |
| Continuidad del servicio | `service-continuity.policy.ts` | Estrategia + Desempeño |

**Endpoints:** ninguno — es un módulo de reglas puras (sin controlador). Los documentos formales están en `docs/policies/`.

**Estado:** skeleton funcional (Iteración 1). Los consumidores llegan en las Iteraciones 4–6 (pagos, red, notificaciones).
