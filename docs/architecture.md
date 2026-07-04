# Documento de Arquitectura — Unitik-Cob

**Artefacto OpenUP — se completa en la Fase de Elaboración (Iteraciones 1–2)** con diagramas de componentes, despliegue y secuencia del flujo crítico pago → validación → reconexión.

## Vista preliminar (Fase de Inicio)

```
┌──────────────┐   HTTPS    ┌──────────────────┐
│  Web (React) │ ─────────► │  Nginx (proxy)   │
└──────────────┘            └──────┬───────────┘
                                   ▼
                            ┌──────────────────┐     ┌──────────────┐
                            │  API (NestJS)    │ ──► │ PostgreSQL 16│
                            │  módulos + 4     │     └──────────────┘
                            │  políticas gob.  │     ┌──────────────┐
                            │  + AuditLog      │ ──► │  Redis 7     │
                            └──────┬───────────┘     │  (BullMQ)    │
                                   │ colas           └──────┬───────┘
                                   ▼ (reintentos exp.)      │ workers
                     ┌─────────────┴──────────────┬─────────┘
                     ▼                            ▼
             ┌───────────────┐            ┌───────────────────┐
             │ RouterBoard   │            │ WhatsApp / SMS /  │
             │ MikroTik      │            │ Email / Wompi /   │
             │ (RouterOS API)│            │ Alegra-Siigo DIAN │
             └───────────────┘            └───────────────────┘
```

Decisión clave: **ninguna operación contra sistemas externos es síncrona** — todas pasan por colas BullMQ con reintentos exponenciales (1, 5, 15, 30, 60 min), porque Cumbitara tiene conectividad intermitente (riesgo R-01).
