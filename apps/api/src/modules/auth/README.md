# Módulo `auth`

**Propósito:** autenticación con JWT + Passport y renovación con refresh tokens. Login por correo **o** cédula (los clientes usan su documento, según entrevista al gerente).

**Política ISO/IEC 38500 asociada:** Responsabilidad + Comportamiento humano — cada sesión queda auditada (`LOGIN`, `LOGIN_FAILED`, `TOKEN_REFRESH`) con IP y user-agent; las cuentas desactivadas pierden acceso de inmediato (revalidación por request en `JwtStrategy`).

**Endpoints principales:**

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/api/auth/login` | Login con `identifier` (correo o cédula) y `password`. Devuelve `accessToken` (15 min), `refreshToken` (7 días) y el usuario. |
| POST | `/api/auth/refresh` | Renueva el par de tokens con un refresh token vigente. |

**Notas de diseño:** los refresh tokens son JWT firmados con un secreto separado (`JWT_REFRESH_SECRET`), sin estado en BD; la revocación efectiva se logra desactivando el usuario (`isActive = false`). Expiraciones configurables por variables de entorno.
