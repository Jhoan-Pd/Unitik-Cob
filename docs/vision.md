# Documento de Visión — Unitik-Cob

**Artefacto OpenUP — Fase de Inicio (Iteración 0)**
Trabajo de Grado: Gobernanza de TI en ISP regionales — Caso UNITIK, Cumbitara, Nariño
Universidad Cooperativa de Colombia — Ingeniería de Software

## 1. Introducción

Unitik-Cob es un sistema web integrador OSS/BSS a la medida para **UNITIK Internet Sin Límite S.A.S.**, ISP regional del municipio rural de Cumbitara, Nariño (Colombia), que presta servicio de internet por Fibra Óptica (casco urbano) y Radio Enlace (zona rural) a usuarios residenciales, comerciales y rurales.

## 2. Planteamiento del problema

| Elemento | Descripción |
| --- | --- |
| **El problema de** | procesos manuales de validación de pagos, suspensión y reconexión del servicio |
| **afecta a** | personal administrativo, área técnica y clientes de UNITIK |
| **cuyo impacto es** | demoras en reconexión, reprocesos administrativos, reclamos de clientes, riesgo de aceptar comprobantes falsos y ausencia total de trazabilidad |
| **una solución exitosa sería** | un sistema que automatice el ciclo pago → validación → reconexión, integrado con la RouterBoard MikroTik, con registros auditables alineados con ISO/IEC 38500 |

### Situación actual

- El personal verifica manualmente cada pago (Nequi, transferencia, efectivo) y confirma que el comprobante no sea falso.
- Tras validar, notifica por canales informales al área técnica para reconectar al usuario en la RouterBoard MikroTik.
- El sistema de facturación actual (WhispHub) está desarticulado de la infraestructura de red.
- No existen políticas formales de Gobernanza de TI ni trazabilidad de operaciones.

## 3. Interesados (stakeholders)

| Interesado | Rol | Interés principal |
| --- | --- | --- |
| Eyner Dayan Romo | Gerente | Visión completa del negocio, reportes, control de cartera |
| Personal administrativo | Administrador del sistema | Validar pagos sin reprocesos, configurar tarifas y cortes |
| Germán | Cajero | Recibir pagos en efectivo, cierre de caja diario |
| Técnicos | Técnico | Instalaciones, tickets, operación de red asignada |
| Clientes | Usuario final | Consultar estado de cuenta, pagar en línea, reconexión rápida |
| Universidad / Director de tesis | Evaluador | Validación experimental y cumplimiento ISO/IEC 38500 |

## 4. Objetivo del producto

Automatizar el ciclo completo **pago → validación → reconexión**, integrar la gestión administrativa con la infraestructura de red MikroTik/RouterBoard, y generar registros trazables auditables alineados con los 6 principios de ISO/IEC 38500: **responsabilidad, estrategia, adquisición, desempeño, conformidad y comportamiento humano**.

## 5. Características principales (features)

1. Validación de pagos manual (comprobante) y automática (webhook Wompi/Nequi).
2. Reconexión y suspensión automáticas sobre RouterBoard MikroTik vía RouterOS API, con colas BullMQ resistentes a caídas de conectividad.
3. Facturación mensual automática con interés por mora, promesas de pago y doble mensualidad configurables.
4. Cuatro paneles por rol: Administrador, Técnico, Cajero y Portal Cliente.
5. Auditoría append-only de toda operación crítica (`audit_log`) con referencia al principio ISO/IEC 38500 aplicable.
6. Notificaciones multicanal: WhatsApp Cloud API, email, SMS e in-app.
7. Facturación electrónica DIAN (Alegra/Siigo) con CUFE.
8. Métricas experimentales BASELINE vs POST_INTERVENTION para la validación cuantitativa del trabajo de grado.

## 6. Restricciones

- **Conectividad intermitente** en Cumbitara: toda operación externa se encola con reintentos exponenciales.
- **Stack obligatorio**: Node.js 20, NestJS 10, TypeScript 5 strict, Prisma 5, PostgreSQL 16, Redis 7, React 18 + Vite.
- **Timezone** `America/Bogota`; moneda COP sin decimales.
- Precios, porcentajes y fechas de corte **configurables** (tabla `system_config`), nunca en código.
- Metodología OpenUP en 4 fases con iteraciones de 4 semanas.

## 7. Indicadores de éxito (validación experimental — Fase 4)

| Métrica | Situación esperada |
| --- | --- |
| Tiempo de reconexión | < 5 minutos desde la validación del pago |
| Reprocesos administrativos | Reducción frente a línea base |
| Reclamos de facturación/reconexión | Reducción frente a línea base |
| Trazabilidad de operaciones críticas | ≥ 95 % |
