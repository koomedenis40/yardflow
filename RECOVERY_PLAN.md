# YardFlow — Recovery Plan

**Workspace:** `C:\dev\yardflow-rebuild` (clean rebuild; short path avoids Windows long-path issues)
**Status:** Recovery Mode — documentation baseline restored; no application code yet
**Baseline commit:** `07366749238db58307926777f8d5214b7cc1d9d5`

---

## 1. What happened
During an Android build fix, a `node_modules` cleanup used `robocopy /MIR` **without `/XJ`**. On Windows, `/MIR` follows NTFS **directory junctions**, and pnpm fills `node_modules` with junctions pointing back into the real workspace source. Mirroring an empty folder over `node_modules` therefore traversed those junctions and **deleted the source** in `apps/*` and `packages/*`. There was no Git repo and no backup. A `winfr` undelete recovered filenames but the contents had been overwritten by prior `node_modules` reinstalls.

## 2. What survived
- `docs/` (8): `DATABASE_CONTRACTS.md`, `SYSTEM_RULES.md`, `TRANSACTION_FLOWS.md`, `PERMISSION_MATRIX.md`, `EVENT_ARCHITECTURE.md`, `DELETION_AND_REVERSAL_RULES.md`, `UI_DIRECTION.md`, `README.md`
- Root reports: `PRD.md`, `ARCHITECTURE_REVIEW.md`, `M1_FOUNDATION_REPORT.md`, `M1_DB_FIX_REPORT.md`, `M2_CORE_LEDGER_REPORT.md`, `M2_5_OPERATIONAL_UX_REPORT.md`, `M3_PAYMENTS_BALANCES_REPORT.md`, `M3_5_WEB_READINESS_REPORT.md`, `M3_6_ADAPTIVE_WORKSPACE_REPORT.md`, `M3_6_INTERNAL_SERVER_ERROR_DIAGNOSIS.md`, `M4_NATIVE_MOBILE_FOUNDATION_REPORT.md`, `DESIGN_SYSTEM_UPDATE_REPORT.md`, `UI_DIRECTION_UPDATE_REPORT.md`, `CURSOR_NEXT_PROMPT.md`
- Config: `package.json`, `turbo.json`, `pnpm-workspace.yaml`, `.npmrc`, `.gitignore`, `.env`, `.env.example`
- `infra/docker-compose.yml`, `infra/README.md`
- M4 full source recoverable from the original chat transcript (`apps/pos/*`, `packages/theme/*`)

## 3. What was lost
- `apps/api/**` (NestJS + Prisma backend) — full loss
- `apps/web/**` (Next.js) — near-full loss (a few small files partially recovered, unverified)
- `apps/pos/**` (Expo/RN, M4) — recoverable from chat transcript
- `packages/validation`, `packages/types`, `packages/utils`, `packages/theme` — theme recoverable from chat; others must be rebuilt

## 4. Recovery strategy
Rebuild in a clean workspace, **docs-first**, bottom-up (shared packages → API → web → mobile), validating each layer before the next. M4 (`apps/pos`, `packages/theme`) is restored verbatim from the chat transcript; backend/web/shared packages are reconstructed to be **functionally faithful to the surviving contracts** (not byte-identical).

## 5. Strict Git commit policy
- Commit after **every** successful milestone (one logical milestone per commit).
- Never commit secrets (`.env` is git-ignored; only `.env.example` is tracked).
- Use clear messages: `rebuild(scope): summary`.
- Tag milestones: `m1-foundation`, `m2-ledger`, `m3-payments`, `m4-mobile`.
- **Push to GitHub as soon as the M1 rebuild passes** its validation gate.
- Never force-push; never rewrite shared history.

## 6. Rebuild milestones
| # | Milestone | Source of truth | Output |
|---|-----------|-----------------|--------|
| R0 | Workspace + docs baseline | survivors | DONE (this commit) |
| R1 | Monorepo scaffold + shared packages (`types`, `validation`, `utils`) | `DATABASE_CONTRACTS.md`, `TRANSACTION_FLOWS.md` | buildable packages |
| R2 | `apps/api` foundation (Prisma schema, auth, tenancy, migrations) | `DATABASE_CONTRACTS.md`, `SYSTEM_RULES.md`, `M1` reports | API boots, `/v1/health` ok, migrations apply |
| R3 | Core ledger (categories, suppliers, buyers, purchases, sales, stock) | `TRANSACTION_FLOWS.md`, `M2`/`M2.5` reports | append-only ledger + stock integrity |
| R4 | Payments & balances (supplier/buyer payments, FIFO allocations) | `TRANSACTION_FLOWS.md`, `M3` report | balances + allocations correct |
| R5 | `apps/web` (auth, dashboard, ops screens) | `UI_DIRECTION.md`, `M3.5`/`M3.6` reports | web builds + runs |
| R6 | `apps/pos` + `packages/theme` (restore from chat) | chat transcript | pos typechecks/builds |
| R7 | Android build reliability (the original task) | this plan | dev build runs on device |

## 7. Validation gates (must pass before next milestone)
- **Typecheck/build:** `pnpm -r build` (or per-filter) green.
- **API tests:** `pnpm --filter @yardflow/api test` green.
- **Web build:** `pnpm --filter @yardflow/web build` green.
- **Mobile:** `pnpm --filter @yardflow/pos` typecheck green.
- **Data integrity:** tenant isolation, append-only ledger, FIFO allocation, stock balance reconciliation verified against the contracts.
- Each gate passed → commit (+ push from R2 onward).

## 8. Safety rules (pnpm / Windows / node_modules)
- **Never** run `robocopy /MIR` on a tree that may contain junctions without `/XJ`.
- **Never** delete `node_modules` while dev servers / watchers are running.
- Prefer deleting `node_modules` with `pnpm` (e.g. `pnpm -w exec rimraf node_modules`) or `rmdir /s /q`, never mirror-from-empty.
- Keep `node-linker=hoisted` (avoids the Windows 260-char native-build path failure).
- Keep the project at a **short path** (`C:\dev\yardflow-rebuild`).
- Commit before any dependency/cleanup operation.
- Set up a Git remote and push early; keep periodic zipped snapshots until then.
