# Módulo `clients`

**Propósito:** gestión del ciclo de vida de clientes UNITIK — registro (técnico en instalación con GPS, o admin), actualización, y transiciones de estado (suspender/reactivar/cortar/cancelar).

**Política ISO/IEC 38500 asociada:** Responsabilidad + Conformidad — solo ADMIN cambia estados y siempre con motivo auditado; el registro crea usuario CLIENT + cliente atómicamente; validaciones colombianas (cédula, celular 3XXXXXXXXX).

**Decisiones:**
- `clientCode = CLI-<cédula>` (único por construcción).
- Contraseña inicial del portal = cédula si no se especifica (login "documento y contraseña" de la entrevista); cambio de contraseña llega en It. 6.
- Sin borrado físico: `CANCELLED` es el estado terminal.

**Endpoints principales:**

| Método | Ruta | Roles | Descripción |
| --- | --- | --- | --- |
| GET | `/api/clients/me` | CLIENT | Mi información (portal) |
| GET | `/api/clients?status=&search=` | ADMIN, TECHNICIAN, CASHIER | Listar/buscar |
| GET | `/api/clients/:id` | ADMIN, TECHNICIAN, CASHIER | Detalle |
| POST | `/api/clients` | ADMIN, TECHNICIAN | Registrar (auditado) |
| PATCH | `/api/clients/:id` | ADMIN, TECHNICIAN | Actualizar (auditado con old/new) |
| PATCH | `/api/clients/:id/status` | ADMIN | Cambiar estado con motivo (auditado como SUSPEND/REACTIVATE/CUT/CANCEL) |
