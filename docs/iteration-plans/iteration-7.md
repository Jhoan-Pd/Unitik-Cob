# Plan de Iteración 7 — Fase de Transición (OpenUP)

**Duración:** 4 semanas · **Estado: en curso**

## Objetivos

Preparar y ejecutar el despliegue en UNITIK (Cumbitara): ambiente de pruebas, manuales, línea base experimental y capacitación. Esta iteración mezcla entregables de software con **actividades de campo del tesista**.

## Entregables de software (listos)

- [x] `POST /api/metrics/baseline` (ADMIN, auditado): registro de mediciones BASELINE de campo — las 4 métricas, con fecha real y contexto (fuente, observador). `GET /api/metrics/experimental?phase=BASELINE` las agrega para la comparación estadística
- [x] Manual técnico (`docs/manuals/manual-tecnico.md`): instalación desde cero, variables críticas, activación de la RouterBoard real (`MIKROTIK_MOCK=false`), operación de jobs/colas/backups y solución de problemas
- [x] Manual de usuario (`docs/manuals/manual-usuario.md`): guía por rol en lenguaje no técnico + preguntas frecuentes
- [x] `docker-compose.prod.yml` con backup diario 02:00 (desde Iteración 0, verificado)

## Actividades de campo (responsable: tesista + UNITIK)

- [ ] **Medir BASELINE antes del piloto** (procesos manuales actuales): tiempos de reconexión observados (Payment→reconexión manual), reprocesos administrativos/semana, reclamos/mes (registros WhispHub o físicos), % de operaciones con registro trazable. Registrar cada medición vía `POST /metrics/baseline`
- [ ] Instalar el ambiente de pruebas en el servidor de UNITIK (manual técnico §2)
- [ ] Capacitación: gerente (panel admin + reportes), técnicos (tickets + actas), cajero (caja) — usar el manual de usuario como guion
- [ ] Contratar/activar proveedores: Wompi producción, WhatsApp Cloud API o Twilio, Alegra o Siigo (decisión R-08/R-09)
- [ ] Migrar clientes desde WhispHub (script de importación sobre `POST /clients`, riesgo R-06)

## Criterios de salida

1. Sistema corriendo en el servidor de UNITIK con datos reales migrados.
2. BASELINE completa registrada (≥ 1 medición por métrica, idealmente ≥ 10 de tiempo de reconexión).
3. Personal capacitado (acta de capacitación firmada — anexo de la tesis).
