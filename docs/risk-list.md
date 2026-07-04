# Lista de Riesgos Técnicos — Unitik-Cob

**Artefacto OpenUP — Fase de Inicio (Iteración 0)**
Escala de impacto/probabilidad: Alta / Media / Baja. Exposición = Impacto × Probabilidad.

| # | Riesgo | Impacto | Prob. | Mitigación | Estado |
| --- | --- | --- | --- | --- | --- |
| R-01 | **Conectividad intermitente en Cumbitara** impide operaciones contra RouterBoard, WhatsApp o pasarela en tiempo real | Alta | Alta | Toda operación externa va por colas BullMQ con reintentos exponenciales (1, 5, 15, 30, 60 min); Redis con persistencia AOF; acciones se ejecutan al recuperar conectividad | Abierto |
| R-02 | **RouterBoard inaccesible o con firmware antiguo** — la RouterOS API podría comportarse distinto según versión de RouterOS | Alta | Media | Prototipo arquitectónico en Fase 2 con mock; pruebas tempranas contra RouterBoard real en Iteración 5; método `ping()` de verificación previa; sesiones API cortas | Abierto |
| R-03 | **Comprobantes de pago falsos** aceptados por error humano | Alta | Media | Doble vía de validación: webhook automático de pasarela oficial (`autoValidated`) y validación manual con comprobante adjunto, `validatedBy` y `validatedAt`; estado `REJECTED` con motivo y notificación | Abierto |
| R-04 | **Pérdida de datos** por fallas eléctricas o de hardware en zona rural | Alta | Media | Backup diario automatizado de PostgreSQL a las 02:00 (América/Bogota); volúmenes Docker persistentes; retención de 14 días | Abierto |
| R-05 | **Credenciales MikroTik expuestas** — acceso indebido a la infraestructura de red | Alta | Baja | AES-256-GCM para `apiPasswordEnc`; solo roles ADMIN/TECHNICIAN operan la red; rate limiting 20 acciones/min; auditoría con IP y user-agent | Abierto |
| R-06 | **Migración desde WhispHub** — datos de clientes existentes incompletos o inconsistentes | Media | Alta | Script de importación con validación en Iteración 3; período de operación en paralelo durante el piloto (Fase 4) | Abierto |
| R-07 | **Adopción por el personal** — usuarios acostumbrados a procesos manuales | Media | Media | UI 100 % en español, simple; capacitación al gerente, técnicos y cajero en Fase 4; piloto controlado con subconjunto de clientes | Abierto |
| R-08 | **Integración DIAN (Alegra/Siigo)** — dependencia de proveedor externo y normativa cambiante | Media | Media | Encapsular en módulo con interfaz propia; la facturación interna funciona aunque la electrónica falle (se reintenta por cola) | Abierto |
| R-09 | **WhatsApp Cloud API** — costos, aprobación de plantillas y límites de Meta | Media | Media | Canales de respaldo: SMS (Twilio) y email (Nodemailer); plantillas solicitadas con anticipación en Iteración 6 | Abierto |
| R-10 | **Alcance amplio para un solo desarrollador** — 8 iteraciones con módulos complejos | Alta | Media | Metodología OpenUP estricta: iteraciones de 4 semanas con demo; priorización por casos de uso críticos (CU-22, CU-23, CU-33); criterios de aceptación por iteración | Abierto |
| R-11 | **Cambios de precios/políticas de UNITIK** durante el desarrollo | Baja | Alta | Regla de oro #3: todo parámetro comercial vive en `system_config` editable desde el panel admin | Mitigado por diseño |
| R-12 | **Servidor local con recursos limitados** en la sede de UNITIK | Media | Media | Stack liviano (Alpine images); monitoreo Prometheus/Grafana opcional en Fase 4; requisitos mínimos documentados en manual técnico | Abierto |

## Seguimiento

Este documento se revisa al cierre de **cada iteración** (ritual OpenUP). Los riesgos materializados se registran con fecha, impacto real y acción tomada.
