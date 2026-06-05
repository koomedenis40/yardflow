# YardFlow — Data-Loss Incident & Recovery Plan

**Status:** Active — no source has been written back to the project yet
**Created:** 2026-06-05
**Severity:** Critical (source-code loss, no backup)

---

## 1. Incident summary

While fixing the Android native build, the assistant attempted to clean `node_modules` on Windows using:

```
robocopy <empty-dir> <target> /MIR
```

`robocopy /MIR` **follows NTFS directory junctions by default** (the `/XJ` flag was not used). pnpm populates `node_modules` with junctions that point back into the real workspace source (`packages/*` and workspace cross-links). Mirroring an empty folder over `node_modules` therefore traversed those junctions and **purged the real source directories**.

**Root cause:** Destructive `robocopy /MIR` over a pnpm `node_modules` tree containing junctions, without `/XJ`. Compounding factors: project lived under a long, space-containing path; no git repository; no backup.

This was an assistant error.

---

## 2. Damage assessment

### Lost (emptied)
- `apps/api/**` — entire NestJS + Prisma backend
- `apps/web/**` — Next.js tenant web app (most files; a few small files partially recovered)
- `apps/pos/**` — Expo/React Native app (M4)
- `packages/validation/**`, `packages/types/**`, `packages/utils/**`, `packages/theme/**`

### Survived intact (on disk)
- Root config: `package.json`, `turbo.json`, `pnpm-workspace.yaml`, `.env`, `.env.example`, `.npmrc`, `.gitignore`
- `docs/` (8 files):
  - `DATABASE_CONTRACTS.md` (369 lines)
  - `SYSTEM_RULES.md` (298 lines)
  - `TRANSACTION_FLOWS.md` (321 lines)
  - `PERMISSION_MATRIX.md` (151 lines)
  - `EVENT_ARCHITECTURE.md` (181 lines)
  - `DELETION_AND_REVERSAL_RULES.md` (93 lines)
  - `UI_DIRECTION.md` (108 lines)
  - `README.md`
- Root milestone reports: `M1_FOUNDATION_REPORT.md`, `M1_DB_FIX_REPORT.md`, `M2_CORE_LEDGER_REPORT.md`, `M2_5_OPERATIONAL_UX_REPORT.md`, `M3_PAYMENTS_BALANCES_REPORT.md`, `M3_5_WEB_READINESS_REPORT.md`, `M3_6_ADAPTIVE_WORKSPACE_REPORT.md`, `M3_6_INTERNAL_SERVER_ERROR_DIAGNOSIS.md`, `M4_NATIVE_MOBILE_FOUNDATION_REPORT.md`, `ARCHITECTURE_REVIEW.md`, `PRD.md`, `DESIGN_SYSTEM_UPDATE_REPORT.md`, `UI_DIRECTION_UPDATE_REPORT.md`, `CURSOR_NEXT_PROMPT.md`
- `infra/docker-compose.yml`, `infra/README.md`
- `Downloads/yardflow_predev_rules_pack/` — duplicate docs only (no code)

---

## 3. Recovery attempts performed

| Attempt | Result |
|--------|--------|
| Windows File Recovery (`winfr`, regular mode) → `D:` external drive | Recovered file **names/paths** but most **contents overwritten** by prior `node_modules` reinstalls. Output at `D:\Recovery_20260605_105646\`. |
| Local backup search (OneDrive, Documents, Downloads, Desktop, D:) | No source copy. Only a docs pack in `Downloads`. |
| Off-machine (git remote / deploy / other PC) | User confirmed **none exists**. |
| Cursor local history | Does not contain agent-written source files. |

### Files confirmed VALID from `D:` undelete (to be salvaged)
Pending final content confirmation, the following recovered with genuine content:
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/[tenantSlug]/layout.tsx`
- `apps/web/src/components/ops/kpi-group.tsx`
- `apps/web/src/app/page.tsx` (verify)
- `apps/api/.env.example`

### Files recovered but CORRUPT (do NOT use)
- `apps/web/src/lib/auth-context.tsx` (overwritten with browser-cache JS)
- `apps/web/src/app/login/page.tsx`, `[tenantSlug]/dashboard/page.tsx`, `[tenantSlug]/categories/page.tsx`
- `apps/web/src/components/tenant-shell.tsx`, `components/ops/global-search.tsx`

---

## 4. Source material available for reconstruction

1. **This chat transcript** → exact, verbatim contents of all **M4** files:
   - `apps/pos/**` (config, lib, components, screens, routes)
   - `packages/theme/**`
   - M4 doc edits (already on disk)
2. **Surviving docs** → authoritative specs to rebuild backend/web/shared packages:
   - DB schema & contracts → `DATABASE_CONTRACTS.md`
   - Business logic, ledger, balances, allocations → `TRANSACTION_FLOWS.md`, `SYSTEM_RULES.md`
   - Roles/permissions → `PERMISSION_MATRIX.md`
   - Events → `EVENT_ARCHITECTURE.md`
   - Web UX/pages → `UI_DIRECTION.md`, `M3_5`/`M3_6` reports
   - Per-milestone implementation detail → `M1`–`M4` reports
3. **Salvaged valid files** from `D:` (small set above).
4. **Surviving config** (workspace wiring, env, infra compose).

---

## 5. Recovery plan (ordered)

### Phase 0 — Safety (do first)
- [ ] `git init` + initial commit of everything currently on disk (lock in survivors before any new work).
- [ ] Copy `D:\Recovery_20260605_105646\` salvage set into a `_recovered/` scratch folder for reference (not directly into source).
- [ ] Establish safe-cleanup rule: never `robocopy /MIR` a `node_modules`; if needed use `/XJ`, or delete with pnpm/`rimraf`. Prefer `node-linker=hoisted` (already set) and **commit frequently**.

### Phase 1 — Exact recovery (high confidence)
- [ ] Recreate `packages/theme/**` verbatim from chat.
- [ ] Recreate `apps/pos/**` verbatim from chat (config, `src/`, `app/`).
- [ ] Drop in salvaged valid web files where confirmed authentic.

### Phase 2 — Rebuild shared packages (from docs/usage)
- [ ] `packages/types` — domain types from `DATABASE_CONTRACTS.md`.
- [ ] `packages/validation` — Zod/DTO schemas from contracts + transaction flows.
- [ ] `packages/utils` — helpers (money/weight/date) inferred from reports.

### Phase 3 — Rebuild `apps/api` (NestJS + Prisma)
- [ ] `prisma/schema.prisma` from `DATABASE_CONTRACTS.md`.
- [ ] Modules: auth/tenancy, suppliers, buyers, categories, purchases, sales, supplier-payments, buyer-payments, balances, stock, dashboard — per `TRANSACTION_FLOWS.md` + M2/M3 reports.
- [ ] Enforce append-only ledger, tenant isolation, FIFO allocation, permissions.

### Phase 4 — Rebuild `apps/web` (Next.js)
- [ ] App routes (login, `[tenantSlug]` dashboard/categories/suppliers/buyers/stock/payments) per M3.x reports + `UI_DIRECTION.md`.
- [ ] Reuse salvaged `layout.tsx`, `kpi-group.tsx`, etc.

### Phase 5 — Integrate & verify
- [ ] Safe `pnpm install` (hoisted; no `/MIR`).
- [ ] `pnpm --filter @yardflow/api test`, web build, pos typecheck.
- [ ] Re-validate Android build path fix (the original task).

---

## 6. Caveats / expectations

- Rebuilt `apps/api`, `apps/web`, and `packages/validation|types|utils` will be **functionally faithful to the documented contracts**, **not byte-identical** to the lost code. Behavior should match the docs; internal structure/naming may differ.
- M4 (`apps/pos`, `packages/theme`) will be **exact** (from chat).
- Any business logic that existed in code but was **not** captured in docs/reports may need re-specification with you.

## 7. Prevention going forward
- Initialize git now; commit after each phase; add a remote ASAP.
- Never run `robocopy /MIR` against junction-containing trees without `/XJ`.
- Keep `node-linker=hoisted` to avoid the Windows long-path issue that started this.
- Consider periodic zipped snapshots until a remote is in place.
