# Política 2 — Control de acceso a la red

**Principios ISO/IEC 38500:** Responsabilidad + Comportamiento humano
**Módulo:** `apps/api/src/modules/governance/network-access-control.policy.ts`
**Aprobación:** Gerencia UNITIK · Versión 1.0 — Iteración 1

## Propósito

Proteger la infraestructura MikroTik/RouterBoard: solo personal autorizado la opera, ninguna credencial viaja o se guarda en claro, y toda acción deja evidencia de quién, cuándo y desde dónde.

## Reglas

1. Solo usuarios con rol **ADMIN o TECHNICIAN** ejecutan acciones sobre `NetworkDevice` y `NetworkAccess` (RBAC verificado por guard + política).
2. Contraseñas de dispositivos cifradas con **AES-256-GCM** (`apiPasswordEnc`); nunca en texto plano ni en logs.
3. Las sesiones RouterOS API se cierran tras cada operación — sin conexiones permanentes.
4. **Rate limiting:** máximo 20 acciones de red por usuario por minuto.
5. Toda acción de red se audita con `ipAddress` y `userAgent` en `audit_log`.

## Cumplimiento verificable

- `NetworkAccessControlPolicy.canOperateNetwork()` centraliza el punto 1 (test unitario).
- El interceptor global de auditoría captura IP y user-agent en toda mutación (verificado por e2e).
- La integración MikroTik (Iteración 5) consumirá esta política; el rate limiter se implementa allí.
