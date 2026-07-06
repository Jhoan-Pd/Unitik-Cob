# Módulo `system-config`

**Propósito:** parámetros de negocio editables desde el panel admin (regla de oro #3: nunca hardcodear montos, porcentajes, días de corte ni URLs).

**Política ISO/IEC 38500 asociada:** Estrategia + Conformidad — todo cambio de parámetro queda auditado con valor anterior y nuevo, y quién lo cambió (`updatedBy`).

**Parámetros sembrados:** `interest_rate_percent` (2.5), `grace_period_days` (7), `max_promise_days` (15), `cut_off_day_start` (1), `cut_off_day_end` (10), `double_payment_after_days` (30), `installation_fee_default` (50000), `tv_service_price` (10000).

**Endpoints principales (ADMIN):**

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/system-config` | Listar todos los parámetros |
| GET | `/api/system-config/:key` | Consultar un parámetro |
| PATCH | `/api/system-config/:key` | Actualizar valor (auditado) |

Los módulos de dominio consumen `SystemConfigService.getNumber(key)` — no se crean claves por API (solo el seed), para evitar parámetros huérfanos por errores de tipeo.
