# Plan de Iteración 0 — Fase de Inicio (OpenUP)

**Duración:** 1 semana · **Fecha:** julio 2026

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

## Criterios de salida

1. `docker compose up -d` levanta el ambiente completo.
2. `pnpm --filter @unitik/api prisma:migrate` aplica la migración en frío desde cero.
3. `pnpm lint`, `pnpm typecheck` y `pnpm test` pasan sin errores.
4. Artefactos OpenUP de Inicio revisados y versionados.

## Demo de cierre

Ambiente corriendo + `/health` verde + recorrido por visión, casos de uso y riesgos.
