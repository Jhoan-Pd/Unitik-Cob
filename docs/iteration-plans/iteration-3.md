# Plan de Iteración 3 — Fase de Construcción (OpenUP)

**Duración:** 4 semanas · **Estado: en curso**

## Objetivos

Primer incremento de dominio sobre los rieles de gobernanza: gestión de clientes y planes, suscripciones, y el portal cliente básico funcionando de punta a punta (backend + frontend).

## Alcance (checklist)

- [x] Módulo `clients`: registro atómico usuario+cliente, validaciones colombianas (cédula 6–10 dígitos, celular 3XXXXXXXXX), GPS de instalación, búsqueda y filtros
- [x] Transiciones de estado con motivo obligatorio, solo ADMIN, auditadas como SUSPEND/REACTIVATE/CUT/CANCEL
- [x] Módulo `plans`: CRUD ADMIN (velocidad, precio, reúso, TV) con defaults desde `system_config`; sin borrado (desactivación)
- [x] Módulo `subscriptions`: asignar plan cierra la suscripción activa anterior (tx); día de corte desde `system_config`
- [x] Módulo `invoices` (solo lectura): `/invoices/my` para el portal — la generación llega en It. 4
- [x] Portal cliente (React): login (correo o cédula; contraseña inicial = cédula), "Mi información", "Mi plan" (velocidad y precio en formato COP), "Mis facturas" con estados en español
- [x] Rutas protegidas por rol en el frontend (`ProtectedRoute`); placeholder del panel staff
- [x] Cliente HTTP con refresh automático de token ante 401
- [x] Tests: 46 unitarios backend + 2 frontend + 5 e2e nuevos (13 e2e en total)

## Criterios de salida

1. Flujo demo: admin registra cliente → asigna plan → el cliente entra al portal con su cédula y ve plan y facturas (e2e verde).
2. RBAC verificado: CLIENT recibe 403 en rutas de staff; suspensión sin motivo recibe 400.
3. `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm test:e2e` en verde.
