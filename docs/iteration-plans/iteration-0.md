# Plan de Iteración 0 — Fase de Inicio (OpenUP)

**Duración:** 1 semana · **Fecha:** julio 2026 · **Estado: ✅ CERRADA (2026-07-04)**

## Objetivos

Establecer la base técnica y los artefactos OpenUP de la Fase de Inicio para que las iteraciones de Elaboración partan de un ambiente reproducible.

## Alcance (checklist)

- [x] Monorepo pnpm workspaces: `apps/api` (NestJS), `apps/web` (React + Vite), `packages/shared-types`
- [x] Prisma con el schema completo del modelo de dominio (15 modelos, 14 enums)
- [x] Docker Compose: PostgreSQL 16, Redis 7 (AOF), API, Web (Nginx)
- [x] Seed: 6 planes (4 Fibra + 2 Radio), 8 parámetros de sistema, usuario ADMIN de prueba
- [x] ESLint + Prettier + Husky (commit-msg con commitlint → Conventional Commits)
- [x] README con visión del producto
- [x] Documento de visión (`docs/vision.md`)
- [x] Lista inicial de casos de uso (`docs/use-cases.md`) — 39 casos de uso
- [x] Lista de riesgos técnicos con mitigaciones (`docs/risk-list.md`) — 12 riesgos
- [x] Matriz ISO/IEC 38500 inicial (`docs/iso-38500-matrix.md`)
- [x] CI con GitHub Actions (lint, typecheck, migraciones en frío, tests, build)
- [x] Health check `/health` (DB + Redis) y página de estado en el frontend

## Fuera de alcance (se difiere)

- Autenticación JWT, RBAC, interceptor de auditoría → Iteración 1–2 (Elaboración)
- Módulos de negocio (clientes, facturas, pagos, red) → Iteraciones 3–6 (Construcción)

## Criterios de salida — verificados al cierre

1. ✅ `docker compose up -d` levanta el ambiente completo (4 contenedores: postgres, redis, api, web).
2. ✅ Migración `20260704224759_init` aplicada en frío desde cero.
3. ✅ `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` pasan sin errores.
4. ✅ Artefactos OpenUP versionados en git (rama `main`).

## Demo de cierre — realizada 2026-07-04

- `/health` respondió `{"status":"ok", database:"up", redis:"up"}` directo (3000) y vía Nginx (8080).
- Swagger operativo en `/api/docs`; seed verificado (6 planes, 8 configs, ADMIN).
- Recorrido por visión, casos de uso, riesgos y matriz ISO/IEC 38500.

## Notas técnicas de la iteración

- `bcryptjs` reemplaza a `bcrypt`: el build nativo de node-pre-gyp crashea pnpm en el equipo de desarrollo Windows.
- PostgreSQL del compose expone **5433** en el host (un PostgreSQL local de Windows ocupa el 5432).
- Prisma genera para `native` + `linux-musl-openssl-3.0.x` (imagen Alpine); la imagen instala `openssl`.
