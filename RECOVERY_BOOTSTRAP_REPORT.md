# YardFlow — Recovery Bootstrap Report

**Generated:** 2026-06-05 12:46
**New workspace:** `C:\dev\yardflow-rebuild`
**Mode:** Recovery — workspace prepared, NO application code implemented yet

---

## Git initialized status
- Repository initialized: **YES** (`git init -b main`)
- Branch: **main**
- Baseline commit: **`07366749238db58307926777f8d5214b7cc1d9d5`**
- Baseline commit message: `Restore YardFlow documentation baseline`
- Tracked files: **33**
- Secrets safety: `.env` is git-ignored and **NOT** tracked; only `.env.example` is committed.
- Remote: **none yet** (push to GitHub as soon as R1/M1 rebuild passes its gate).

## Files copied (surviving assets only — copy-only, non-destructive)
**Folders**
- `docs/` (8 files)
- `infra/` (`docker-compose.yml`, `README.md`)
- `.github/` (CI workflow)

**Root markdown (16):** ARCHITECTURE_REVIEW, CURSOR_NEXT_PROMPT, DESIGN_SYSTEM_UPDATE_REPORT, M1_DB_FIX_REPORT, M1_FOUNDATION_REPORT, M2_5_OPERATIONAL_UX_REPORT, M2_CORE_LEDGER_REPORT, M3_5_WEB_READINESS_REPORT, M3_6_ADAPTIVE_WORKSPACE_REPORT, M3_6_INTERNAL_SERVER_ERROR_DIAGNOSIS, M3_PAYMENTS_BALANCES_REPORT, M4_NATIVE_MOBILE_FOUNDATION_REPORT, PRD, README, RECOVERY_PLAN_AND_INCIDENT_REPORT, UI_DIRECTION_UPDATE_REPORT

**Config:** `package.json`, `turbo.json`, `pnpm-workspace.yaml`, `.npmrc`, `.gitignore`, `.env` (untracked), `.env.example`

**Generated in this workspace:** `RECOVERY_PLAN.md`, `RECOVERY_BOOTSTRAP_REPORT.md`

## Documents available (specs for rebuild)
- `docs/DATABASE_CONTRACTS.md` (369) — schema, entities, relations
- `docs/SYSTEM_RULES.md` (298) — business/integrity rules
- `docs/TRANSACTION_FLOWS.md` (321) — purchase/sale/payment/balance flows
- `docs/PERMISSION_MATRIX.md` (151) — roles & permissions
- `docs/EVENT_ARCHITECTURE.md` (181) — domain events
- `docs/DELETION_AND_REVERSAL_RULES.md` (93) — append-only/reversal policy
- `docs/UI_DIRECTION.md` (108) — web/mobile UX direction
- M1–M4 milestone reports — per-feature implementation detail

## Missing code areas (to rebuild)
- `apps/api/**` — NestJS + Prisma backend (full rebuild from docs)
- `apps/web/**` — Next.js app (rebuild from docs + M3.x reports)
- `packages/types`, `packages/validation`, `packages/utils` — rebuild from contracts
- `apps/pos/**`, `packages/theme/**` — **restore verbatim from chat transcript** (M4)

## Next recommended rebuild milestone
**R1 — Monorepo scaffold + shared packages** (`packages/types`, `packages/validation`, `packages/utils`), driven by `DATABASE_CONTRACTS.md` and `TRANSACTION_FLOWS.md`.
Gate: `pnpm -r build` green for the packages. Then proceed to **R2 (apps/api foundation)** and push to GitHub once R2 boots with passing migrations + `/v1/health`.
