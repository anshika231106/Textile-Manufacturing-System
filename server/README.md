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

## 6. Apply existing migrations

```bash
npx prisma migrate dev
```

This applies migrations already committed under `prisma/migrations/` that you don't have locally yet.

**Only the DB owner creates new migrations.** If you're not making schema changes, don't run `migrate dev --name ...` — just plain `migrate dev` to sync.

## 7. Seed sample data (optional, but recommended)

```bash
npx prisma db seed
```

Populates a full sample chain: Buyer → Order → yarn stock → machines → stage jobs → rolls → QC → dispatch → invoice → payment, plus a worker and attendance record. Good for testing your own module against realistic, connected data.

## 8. Verify it worked

```bash
npx prisma studio
```

Opens a browser GUI (e.g. `http://localhost:51213`) showing live tables. If you see seeded data, you're connected correctly.

---
