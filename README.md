# YardFlow

Multi-tenant scrap yard operations platform.

## Quick start (M1)

```bash
# Install dependencies
pnpm install

# Start PostgreSQL (Docker on host port **5434** — avoids local Postgres on 5432/5433)
pnpm db:up

# Copy environment (keep root .env and apps/api/.env in sync)
cp .env.example .env
cp .env.example apps/api/.env

# Migrate and seed
pnpm --filter @yardflow/api exec prisma generate
pnpm --filter @yardflow/api exec prisma migrate deploy
pnpm db:seed

# Run API and web
pnpm dev
```

- API: http://localhost:3001/v1/health  
- Web: http://localhost:3000  

**Demo login:** `owner@demo.local` / `Password123!` — tenant slug `demo-yard`

## Documentation

See [docs/README.md](./docs/README.md).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API + web |
| `pnpm test` | Run all tests |
| `pnpm build` | Build all packages |
| `pnpm db:seed` | Seed demo data |
