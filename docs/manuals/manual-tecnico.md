# Manual Técnico — Unitik-Cob

**Artefacto OpenUP — Fase de Transición (Iteración 7)** · Para el responsable técnico de UNITIK.

## 1. Requisitos del servidor (sede Cumbitara)

- CPU 4 núcleos, 8 GB RAM, 100 GB SSD (mínimo: 2 núcleos / 4 GB).
- Windows con Docker Desktop **o** Linux con Docker Engine + Compose v2.
- Acceso de red a la RouterBoard MikroTik (puerto API 8728) y salida a internet para WhatsApp/Wompi/DIAN.

## 2. Instalación desde cero

```bash
git clone https://github.com/Jhoan-Pd/Unitik-Cob.git && cd Unitik-Cob
cp .env.example .env        # completar credenciales reales (ver §3)
docker compose -f docker-compose.prod.yml up -d
docker compose exec api sh -c "cd /app/apps/api && npx prisma migrate deploy && npx prisma db seed"
```

Verificación: `curl http://localhost/health` → `database: up, redis: up`. Web en `http://<ip-servidor>/`.

## 3. Variables de entorno críticas (.env)

| Variable | Propósito | Nota |
| --- | --- | --- |
| `POSTGRES_*`, `DATABASE_URL` | Base de datos | Cambiar la contraseña por defecto |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Sesiones | Generar 2 secretos largos distintos |
| `DEVICE_SECRET_KEY` | Cifrado AES-256-GCM de credenciales MikroTik | 64 caracteres hex: `openssl rand -hex 32` |
| `MIKROTIK_MOCK` | `false` activa el driver RouterOS real | Mantener `true` hasta el piloto |
| `WOMPI_EVENTS_SECRET` | Verificación de firma del webhook | Del panel Wompi (producción) |
| `DIAN_MOCK`, `NOTIFICATIONS_MOCK` | `false` activa proveedores reales | Requieren contratos (R-08, R-09) |
| `TZ` | Siempre `America/Bogota` | No cambiar |

## 4. Activar la RouterBoard real (fin del piloto)

1. En el panel admin → Dispositivos, registrar la RouterBoard con su IP, usuario y contraseña del API (queda cifrada).
2. Los perfiles PPPoE en RouterOS deben llamarse **igual que los planes** ("Plan 1 Fibra", …).
3. Poner `MIKROTIK_MOCK=false` en `.env` y reiniciar: `docker compose -f docker-compose.prod.yml up -d api`.
4. Probar con "ping" desde el panel; luego validar un pago de prueba y verificar la reconexión (< 5 min) en Auditoría.

## 5. Operación

- **Jobs automáticos** (hora Colombia): facturación mensual (día 1, 01:00), mora y doble mensualidad (03:00), promesas vencidas (04:00), suspensiones (05:00), recordatorios (08:00), notificaciones (cada 5 min), **backup de BD (02:00, retención 14 días, carpeta `./backups`)**.
- **Colas BullMQ**: si la RouterBoard está caída, las acciones reintentan a 1/5/15/30/60 min; nada se pierde (Redis AOF).
- **Logs**: `docker compose logs -f api` (JSON estructurado Pino).
- **Restaurar backup**: `docker compose exec -T postgres psql -U $POSTGRES_USER $POSTGRES_DB < backups/unitik_<fecha>.sql`.

## 6. Solución de problemas

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| `/health` → `redis: down` | Contenedor Redis detenido | `docker compose restart redis`; los jobs pendientes se reanudan |
| Reconexiones no ejecutan | RouterBoard inalcanzable | Ver Auditoría (`NETWORK_ACTION_SKIPPED`/reintentos); revisar IP/API y `ping` del panel |
| Webhook Wompi rechazado (403) | `WOMPI_EVENTS_SECRET` no coincide | Copiar el secreto de eventos del ambiente correcto de Wompi |
| Cliente no puede entrar al portal | Cuenta desactivada o contraseña | El admin la reactiva/edita en Usuarios; contraseña inicial = cédula |

## 7. Arquitectura y auditoría

Ver `docs/architecture.md` (componentes, secuencia del flujo crítico, ADRs) y `docs/policies/` (las 4 políticas ISO/IEC 38500). Los registros de auditoría **no se pueden editar ni borrar**; se exportan a CSV desde el panel admin.
