# MillTrace — Backend (Server)

> Express + Prisma 7 + PostgreSQL (Neon) REST API for the **MillTrace** Textile Manufacturing ERP system.

---

## 📌 Overview

The server is a Node.js + TypeScript REST API that powers the entire MillTrace platform. It handles authentication, order lifecycle management, machine floor operations, QC inspection, stock movements, attendance tracking, invoicing, dispatch, and reporting — all backed by a PostgreSQL database hosted on Neon via Prisma 7.

---

## 🛠 Tech Stack

| Category | Technology |
|---|---|
| **Runtime** | Node.js v20+ |
| **Language** | TypeScript 5.9 |
| **Framework** | Express 4 |
| **ORM** | Prisma 7.10 (pinned — do **not** upgrade to v8) |
| **Database** | PostgreSQL via Neon (serverless, pooled) |
| **Auth** | JWT (access + refresh tokens) + bcryptjs |
| **Validation** | Zod 4 |
| **Email** | Nodemailer |
| **Security** | Helmet, CORS |
| **Dev Runner** | tsx (watch mode) |
| **Testing** | Vitest |

---

## 📁 Directory Structure

```text
server/
├── prisma/
│   ├── schema.prisma          # Prisma data model (all enums + models)
│   ├── seed.ts                # Demo seed: buyer → order → stock → production → QC → dispatch
│   └── migrations/            # Prisma migration history
├── scripts/
│   ├── seed-demo-orders.ts    # 45 linked orders across the last 7 days
│   ├── demo-reset.ts          # Wipe and reseed demo database
│   ├── backfill-salaries.ts   # One-time salary backfill
│   ├── concurrency.ts         # Concurrency stress test
│   ├── validation.ts          # Validation smoke test
│   ├── check-enum-parity.ts   # Verify shared/enums match Prisma schema
│   └── smoke.ts               # Basic API smoke test
├── src/
│   ├── config/                # dotenv loading, env variable validation
│   ├── db/
│   │   └── prisma.ts          # Singleton Prisma client (Neon adapter)
│   ├── domain/
│   │   ├── orderStatus.ts     # deriveOrderStatus() — status computed from stage jobs/rolls/dispatch
│   │   └── stageRules.ts      # checkCanStartStage(), checkStageCap(), stage sequencing
│   ├── lib/
│   │   ├── numbers.ts         # round2(), toDecimal() helpers
│   │   ├── payroll.ts         # staffWagesForMonth(), salariesForMonth()
│   │   └── respond.ts         # ok(), created(), noContent() response helpers
│   ├── middleware/
│   │   ├── authenticate.ts    # authenticate + authorize middleware
│   │   ├── requireAuth.ts     # requireAuth (alias for older routes)
│   │   ├── errorHandler.ts    # Global error → JSON response mapper
│   │   └── validate.ts        # Zod request validation (body, query, params)
│   └── modules/               # Feature modules — each has routes + service (+ optional service spec)
│       ├── attendance/        # Daily attendance roster + wage totals
│       ├── auth/              # Login, refresh, logout, /me
│       ├── dispatch/          # Roll dispatch + invoice creation (atomic transaction)
│       ├── floor/             # Machine management, stage jobs, production logs
│       ├── invoices/          # Invoice list + payment recording
│       ├── masters/           # Buyers, suppliers, yarn types, machines, workers CRUD
│       ├── orders/            # Order CRUD + full order detail (status derived, never stored)
│       ├── public/            # Unauthenticated routes: buyer tracking, sample orders, stats
│       ├── qc/                # Roll creation, QC inspection, defect recording
│       ├── reports/           # Executive dashboard + month-end P&L report
│       ├── rolls/             # Roll list + traceability
│       ├── staff/             # Staff creation, role management, deletion
│       └── stock/             # Yarn stock levels, receipt recording, ledger
├── generated/
│   └── prisma/                # Generated Prisma Client output (gitignored)
├── prisma7.config.ts          # Prisma 7 config file
├── .env.example               # Environment variable template
├── package.json
└── tsconfig.json
```

---

## 🗄️ Data Models

Key Prisma models (defined in `prisma/schema.prisma`):

| Model | Description |
|---|---|
| `User` | Staff accounts with `Role` (OWNER / OFFICE / SUPERVISOR / STAFF), daily wage, salary |
| `Buyer` | Buyer master with tracking-token lookup |
| `Supplier` | Yarn supplier master |
| `YarnType` | Yarn specification (code, name, colour, count, composition) |
| `Machine` | Production machine with `Stage` assignment and `MachineStatus` |
| `Order` | Order header (buyer, fabric type, metres, deadline, tracking token) |
| `OrderRequirement` | Yarn requirement lines linked to an Order |
| `StageJob` | Production job for SPINNING → WEAVING → DYEING on a Machine |
| `ProductionLog` | Shift-level metres produced within a StageJob |
| `StockMovement` | Yarn RECEIPT / ISSUE ledger entries |
| `Roll` | Physical roll created after dyeing, with `RollStatus` |
| `QcInspection` | QC result (PASS / REWORK / REJECT) with defect list |
| `Dispatch` | Dispatch record linking rolls to an order |
| `Invoice` | Invoice created on dispatch with payment status |
| `AttendanceRecord` | Daily present/absent record per staff per date |
| `RefreshToken` | Persisted JWT refresh tokens for token rotation |
| `PasswordSetupToken` | Time-limited (10 min) tokens for new-staff password setup |

---

## 🌐 API Routes

All authenticated routes require `Authorization: Bearer <accessToken>`.

### Auth — `/api/v1/auth`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | ✗ | Email + password → access + refresh tokens |
| POST | `/auth/refresh` | ✗ | Exchange refresh token → new access token |
| POST | `/auth/logout` | ✗ | Invalidate refresh token |
| GET | `/auth/me` | ✓ | Fetch own profile |

### Staff — `/api/v1`
| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/staff` | OFFICE, OWNER | List all staff |
| POST | `/staff` | OFFICE, OWNER | Create staff + send password-setup email |
| PATCH | `/staff/:id/role` | OWNER | Change staff role (one-level promotions) |
| DELETE | `/staff/:id` | OFFICE, OWNER | Delete staff |

### Orders — `/api/v1`
| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/orders` | All | Paginated order list (`?limit=&offset=&status=`) |
| POST | `/orders` | OWNER, OFFICE | Create new order |
| GET | `/orders/:id` | All | Full order detail (status derived from stage jobs) |
| PATCH | `/orders/:id` | OWNER, OFFICE | Update order header fields |

### Floor — `/api/v1`
| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/floor` | All | Machine list with current job and status |
| POST | `/machines` | OWNER | Create machine |
| PATCH | `/machines/:id` | OWNER | Update machine details |
| DELETE | `/machines/:id` | OWNER | Retire machine |
| POST | `/floor/stage-jobs` | SUPERVISOR | Start a production stage job |
| PATCH | `/floor/stage-jobs/:id/complete` | SUPERVISOR | Complete a stage job |
| POST | `/floor/logs` | SUPERVISOR, STAFF | Add production log (shift metres) |
| POST | `/floor/breakdown` | SUPERVISOR | Report machine breakdown |
| POST | `/floor/resume` | SUPERVISOR | Resume machine from breakdown |

### QC — `/api/v1`
| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/qc/queue` | SUPERVISOR, OWNER | Rolls awaiting QC inspection |
| POST | `/qc/rolls` | SUPERVISOR | Create roll (validates metres ≤ remaining output) |
| POST | `/qc/inspect` | SUPERVISOR | Record QC result + defects (PASS/REWORK/REJECT) |

### Stock — `/api/v1`
| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/stock` | All | Current yarn stock levels |
| POST | `/stock/receipts` | OWNER, OFFICE | Record yarn receipt |
| GET | `/stock/ledger` | All | Paginated yarn movement ledger (`?limit=&offset=&yarnTypeId=`) |

### Dispatch & Invoices — `/api/v1`
| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/dispatch` | SUPERVISOR, OWNER | List dispatches |
| POST | `/dispatch` | SUPERVISOR, OWNER | Create dispatch + invoice (atomic) |
| GET | `/invoices` | OFFICE, OWNER | Invoice list |
| PATCH | `/invoices/:id/payment` | OFFICE, OWNER | Record payment against invoice |

### Attendance — `/api/v1`
| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/attendance` | All | Daily attendance roster for a date |
| POST | `/attendance` | SUPERVISOR | Save full day roster |
| GET | `/attendance/wages` | OFFICE, OWNER | Monthly wage totals per staff |
| PATCH | `/attendance/staff/:id/wage` | OFFICE, OWNER | Update staff daily wage |

### Masters — `/api/v1`
| Method | Path | Roles | Description |
|---|---|---|---|
| GET/POST | `/buyers` | All / OWNER | List or create buyers |
| GET/POST | `/suppliers` | All / OWNER, OFFICE | List or create suppliers |
| GET/POST | `/yarn-types` | All / OWNER, OFFICE | List or create yarn types |

### Reports — `/api/v1/reports`
| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/reports/dashboard` | OWNER, OFFICE, SUPERVISOR | Live operational KPI snapshot |
| GET | `/reports/month-end` | OWNER | Monthly P&L: purchases, wages, invoiced, payments, profit |

### Public (no auth) — `/api/v1`
| Method | Path | Description |
|---|---|---|
| GET | `/public/track/:token` | Buyer order tracking by token or order number |
| GET | `/public/samples` | Last 6 orders for landing page demo chips |
| GET | `/public/stats` | Mill-wide operational stats for landing page |

---

## 🏗️ Domain Logic

### Order Status (never stored)
`deriveOrderStatus()` in `src/domain/orderStatus.ts` computes a display status from the order's stage jobs, rolls, and dispatches at read time:

```
PENDING → IN_PRODUCTION → QC → READY → DISPATCHED → COMPLETED
```

### Stage Sequencing
`stageRules.ts` enforces the immutable sequence **SPINNING → WEAVING → DYEING**:
- `checkCanStartStage()` — rejects out-of-order stage starts.
- `checkStageCap()` — optionally limits concurrent jobs per stage (env: `ENFORCE_STAGE_CAP=true`).

### Concurrency Guards
Both `startProduction` and `dispatch` use conditional `updateMany` with status checks to prevent race conditions when multiple requests hit simultaneously.

---

## 📡 Pagination

| Endpoint | Type | Mechanism |
|---|---|---|
| `GET /orders` | **Database** | Prisma `skip` + `take` (status-filtered views: server-memory slice) |
| `GET /stock/ledger` | **Database** | Prisma `skip` + `take` with `count()` for total |

Both return `{ items: [...], meta: { total, limit, offset } }`.

---

## ⚙️ Environment Variables

Create `.env` in `server/` (copy from `.env.example`):

```env
NODE_ENV=development
PORT=4000

# Neon PostgreSQL — pooled connection for the app
DATABASE_URL="postgresql://<user>:<password>@<endpoint>-pooler.<region>.aws.neon.tech/<database>?sslmode=require&pgbouncer=true&connect_timeout=15"

# Neon PostgreSQL — direct connection for migrations only
DIRECT_URL="postgresql://<user>:<password>@<endpoint>.<region>.aws.neon.tech/<database>?sslmode=require"

JWT_SECRET="replace-with-at-least-32-random-characters"
JWT_EXPIRES_IN=12h
CLIENT_ORIGIN=http://localhost:5173

# Feature flags
ENFORCE_STAGE_CAP=true          # Limit concurrent jobs per stage
DEFECT_FLAG_PCT=10              # Auto-flag rolls with defect% above this threshold

# Seed / demo
SEED_USER_PASSWORD="replace-me"
ALLOW_DEMO_RESET=false          # Set true only on the demo database
DEMO_DB_NAME=                   # Safety check: only reset if DB name matches
```

> **Never commit `.env`** — ask the DB owner for the real Neon credentials each time.

---

## 🚀 Getting Started

### Prerequisites
- Node.js `v20.x` or higher
- Access to a Neon PostgreSQL database

### Install

```bash
cd server
npm install
```

> Prisma **7.10.0** is pinned. Do **not** run a bare `npm install prisma` later — it can silently pull the Prisma 8 release candidate, which breaks this setup.

### Verify Prisma Version

```bash
npx prisma --version
# Must show 7.10.0
```

### Generate Prisma Client

```bash
npx prisma generate
# or: npm run db:generate
```

### Apply Migrations

**Existing database** (matches baseline snapshot `20261010143000_existing_database_baseline`):
```bash
npx prisma migrate resolve --applied 20261010143000_existing_database_baseline
npx prisma migrate deploy
```

**New empty database**:
```bash
npx prisma migrate deploy
```

> Use `migrate deploy` on shared/production databases. Do not run `migrate dev` against the live schema.

### Seed Demo Data

Full demo chain (buyer → order → production → QC → dispatch → invoice):
```bash
npm run db:seed
```

Large operational dataset (45 orders across the last 7 days, with completed orders, invoices, and ≥ ₹17,500 operating profit):
```bash
npm run seed:demo-orders
```

Reset and reseed the demo database (requires `ALLOW_DEMO_RESET=true`):
```bash
npm run demo:reset
```

### Run Development Server

```bash
npm run dev
```

API will be available at **`http://localhost:4000`**.

### Verify Database Connection

```bash
npx prisma studio
```

Opens a browser GUI at `http://localhost:51213` showing live tables.

---

## 🧪 Scripts & Testing

| Script | Description |
|---|---|
| `npm run dev` | Start server with tsx hot-reload |
| `npm run start` | Start server (no watch) |
| `npm run typecheck` | TypeScript type-check only (`tsc --noEmit`) |
| `npm test` | Run Vitest unit tests |
| `npm run smoke` | Quick API smoke test |
| `npm run test:concurrency` | Concurrent request stress test |
| `npm run test:validation` | Zod validation boundary test |
| `npm run check:enums` | Verify `shared/enums.ts` matches Prisma schema enums |
| `npm run backfill:salaries` | One-time salary field backfill |

---

## 📝 Notes

- **Password setup links**: When a staff account is created, the server generates a `PasswordSetupToken` (10-minute expiry) and emails a setup link to the new user via Nodemailer. The link includes the token so the user can set their own password.
- **Rolls & metres validation**: `POST /qc/rolls` rejects roll metre values that would exceed the remaining dyeing stage output for the order, preventing over-creation of fabric.
- **Invoice + dispatch atomicity**: `POST /dispatch` wraps roll-status updates, dispatch creation, and invoice creation in a single Prisma `$transaction`, ensuring no partial writes.
- **STAFF role restriction**: STAFF users can only interact with machines they are assigned to on the floor board. They cannot access financial data, other staff records, or management functions.
