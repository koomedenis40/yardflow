# YardFlow local infrastructure

## PostgreSQL (Docker)

```bash
docker compose -f infra/docker-compose.yml up -d
```

| Setting | Value |
|---------|-------|
| Host port | **5434** (container internal 5432) |
| User / password / database | `yardflow` / `yardflow` / `yardflow` |

### Why port 5434?

On many developer machines, **PostgreSQL is already installed** and listens on `5432` (and sometimes `5433`). Tools on the host (Prisma, NestJS, `psql`) then connect to the **local** instance—not Docker—causing errors like:

```txt
P1010: User was denied access on the database
role "yardflow" does not exist
```

`docker exec` into the container still works because that uses the container’s Postgres directly.

**CI (GitHub Actions)** uses an isolated Postgres service on `5432` with no conflict; local dev uses `5434`.

If `5434` is taken on your machine, change the host port in `docker-compose.yml` and `DATABASE_URL` together.
