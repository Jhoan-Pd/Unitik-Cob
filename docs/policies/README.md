# Políticas de Gobernanza de TI — ISO/IEC 38500

Las 4 políticas se formalizan aquí como documentos y se implementan como módulos NestJS en `apps/api/src/modules/governance/`. Los documentos completos se redactan en la **Fase de Elaboración (Iteración 1–2)** junto con el skeleton de cada política.

| # | Política | Principios ISO/IEC 38500 | Documento | Módulo |
| --- | --- | --- | --- | --- |
| 1 | Gestión de pagos y reconexión | Desempeño + Conformidad | `payment-reconnection.md` (pendiente It. 1) | `payment-reconnection.policy.ts` |
| 2 | Control de acceso a la red | Responsabilidad + Comportamiento humano | `network-access-control.md` (pendiente It. 1) | `network-access-control.policy.ts` |
| 3 | Trazabilidad de la información | Conformidad + Responsabilidad | `traceability.md` (pendiente It. 1) | `traceability.policy.ts` |
| 4 | Continuidad del servicio | Estrategia + Desempeño | `service-continuity.md` (pendiente It. 1) | `service-continuity.policy.ts` |

Las reglas de cada política están especificadas en el documento maestro del proyecto y resumidas en la [matriz ISO/IEC 38500](../iso-38500-matrix.md).
