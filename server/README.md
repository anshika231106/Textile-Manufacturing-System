# Database Setup — Textile Manufacturing System (MillTrace)

Backend stack: **Prisma 7 + Neon (PostgreSQL)**. Follow this top to bottom to get connected to our shared database. Takes about 10 minutes.

## Prerequisites

- Node.js v18+
- Git access to this repo
- The shared Neon credentials (ask the DB owner — **never commit `.env`**)

## 1. Clone and enter the backend folder

```bash
git clone <repo-url>
cd Textile-Manufacturing-System/Backend
```

## 2. Install dependencies

```bash
npm install
```

This installs Prisma **7.10.0**, pinned. Do not run a bare `npm install prisma` on its own later — it can silently pull the Prisma 8 release candidate, which breaks this setup.

## 3. Verify your Prisma version

```bash
npx prisma --version
```

Must show `7.10.0`. If it shows `8.0.0-rc...` or anything else, stop and ping the DB owner before continuing. **Ignore the "update available" banner** Prisma shows — do not run `npm i --save-dev prisma@latest`.

## 4. Set up your `.env`

Create `.env` in `Backend/` with the credentials shared by the DB owner:

```
DATABASE_URL="postgresql://<user>:<password>@<host>-pooler.<region>.aws.neon.tech/<db>?sslmode=require"
DIRECT_URL="postgresql://<user>:<password>@<host>.<region>.aws.neon.tech/<db>?sslmode=require"
```

- `DATABASE_URL` → **pooled** connection (has `-pooler` in hostname) — used by the running app.
- `DIRECT_URL` → **direct** connection (no `-pooler`) — used for migrations only.

Never guess these or reuse an old project's values — get the real ones from the DB owner each time.

## 5. Generate the Prisma Client

```bash
npx prisma generate
```

## 6. Apply Prisma migrations

This repository includes a baseline snapshot (`20261010143000_existing_database_baseline`) and a machine assignment/status migration. For an existing database that matches the baseline snapshot, register it once and then deploy the feature migration:

```bash
npx prisma migrate resolve --applied 20261010143000_existing_database_baseline
npx prisma migrate deploy
```

For a new, empty database, run `npx prisma migrate deploy` directly; it creates the baseline schema and applies the later migrations. Do not run the baseline resolve command on an empty database.

The baseline was generated from the existing database schema. Only resolve it as applied after verifying the target database matches that schema. For shared databases, use `migrate deploy`; do not use `migrate dev` to change the live schema.

## 7. Seed sample data (optional, but recommended)

```bash
npx prisma db seed
```

Populates a full sample chain: Buyer → Order → yarn stock → machines → stage jobs → rolls → QC → dispatch → invoice → payment, plus staff assignments and attendance. Demo users use the password `password`.

## 8. Verify it worked

```bash
npx prisma studio
```

Opens a browser GUI (e.g. `http://localhost:51213`) showing live tables. If you see seeded data, you're connected correctly.

---
