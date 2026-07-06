# Módulo `users`

**Propósito:** gestión de usuarios internos y clientes con RBAC de 4 roles (ADMIN, TECHNICIAN, CASHIER, CLIENT).

**Política ISO/IEC 38500 asociada:** Responsabilidad + Comportamiento humano — solo ADMIN gestiona usuarios; no existe borrado físico (se desactiva con `isActive = false`) para preservar la historia de auditoría; validaciones colombianas (cédula 6–10 dígitos, celular 3XXXXXXXXX).

**Endpoints principales (todos ADMIN, con Bearer token):**

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/users?role=` | Listar usuarios, filtro opcional por rol |
| GET | `/api/users/:id` | Consultar un usuario |
| POST | `/api/users` | Crear usuario (auditado) |
| PATCH | `/api/users/:id` | Actualizar / activar / desactivar (auditado con valores previos) |

El hash de contraseña jamás sale del servicio (`PublicUser`).
