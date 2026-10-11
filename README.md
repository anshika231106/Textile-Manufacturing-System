# MillTrace — Textile Manufacturing System

> Comprehensive ERP and manufacturing workflow tracking system tailored for **Everest Textile Mills**.

---

## 📌 Project Overview

**MillTrace** is a full-stack manufacturing execution and operations platform that traces and manages the complete textile production lifecycle:

```
Yarn Receipt → Order → Spinning → Weaving → Dyeing → Roll Creation → QC Inspection → Dispatch → Invoice/Payment → Month-End Report
```

- **Internal Staff Portal**: Role-based operational access for `OWNER`, `OFFICE`, `SUPERVISOR`, and `STAFF`.
- **Buyer Tracking Portal**: Public, tokenized real-time order tracking for buyers — no login required.

---

## 🛠 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite 6, TypeScript 5.7, React Router v6, Tailwind CSS v4, Framer Motion, Redux Toolkit, Recharts |
| **Backend** | Node.js, Express 4, TypeScript 5.9, Prisma 7 ORM, Zod 4, Nodemailer, Helmet |
| **Database** | PostgreSQL (Neon — serverless, pooled) |
| **Auth** | JWT (access + refresh tokens), bcryptjs |
| **Contracts** | Shared TypeScript DTOs and Enums (`shared/`) |

---

## 📁 Repository Structure

```text
Textile-Manufacturing-System/
├── client/                    # Vite + React 18 + Tailwind CSS v4 frontend
│   ├── src/
│   │   ├── components/        # Reusable UI primitives & layout shells
│   │   │   ├── layout/        # AppLayout, Sidebar/Nav, RequireRole guard
│   │   │   └── ui/            # Button, Input, Select, Table, Modal, Pagination, etc.
│   │   ├── features/          # Domain-specific feature modules & API clients
│   │   │   ├── attendance/    # Worker daily attendance & payroll view
│   │   │   ├── auth/          # Login, password-setup, auth context
│   │   │   ├── dispatch/      # Roll dispatch & invoicing
│   │   │   ├── floor/         # Machine floor board, shift logging, production simulator
│   │   │   ├── landing/       # Public landing page & buyer-tracking widget
│   │   │   ├── masters/       # Buyers, suppliers, yarns, machines, workers
│   │   │   ├── orders/        # Order management & detail view
│   │   │   ├── qc/            # Quality control inspection & roll creation
│   │   │   ├── reports/       # Executive dashboard & month-end P&L report
│   │   │   ├── rolls/         # Roll traceability & QR-label printing
│   │   │   ├── staff/         # Staff management & role administration
│   │   │   └── stock/         # Yarn inventory, receipts, & ledger panel
│   │   └── lib/               # API client, auth context, hooks, formatters
│   ├── README.md              # Frontend-specific documentation
│   └── package.json
├── server/                    # Express + Prisma backend API
│   ├── prisma/                # Schema, migrations, and seed scripts
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   ├── scripts/               # Dev utilities: smoke tests, demo seed, enum parity check
│   ├── src/
│   │   ├── config/            # Environment & server configuration
│   │   ├── db/                # Prisma singleton client (Neon adapter)
│   │   ├── domain/            # Business logic: order status derivation, stage rules
│   │   ├── lib/               # Number helpers, payroll calculations, response formatters
│   │   ├── middleware/        # Auth, Zod validation, global error handler
│   │   └── modules/           # Feature controllers, routes, and services (13 modules)
│   ├── README.md              # Backend-specific documentation
│   └── package.json
├── package.json               # Root workspace scripts (delegates to client/ and server/)
└── README.md                  # This file
```

---

## 🔐 Roles & Access

| Role | Capabilities |
|---|---|
| **OWNER** | Full access: orders, floor, QC, dispatch, stock, attendance, staff management, masters, month-end P&L |
| **SUPERVISOR** | Floor operations, QC inspection, dispatch, rolls, stock |
| **OFFICE** | Orders, staff management, attendance & wages, masters, invoices |
| **STAFF** | Own machines on floor board, own attendance & wage summary |
| *(public)* | Landing page + buyer order tracking (token-based, no login) |

---

## 📦 Order Pipeline

```
PENDING
  └── IN_PRODUCTION
        ├── SPINNING  (machines: spindle frames)
        ├── WEAVING   (machines: looms)
        └── DYEING    (machines: dyeing vessels)
              └── QC
                    ├── READY       (all rolls passed, none dispatched)
                    ├── DISPATCHED  (partially dispatched)
                    └── COMPLETED   (all rolls dispatched + invoice issued)
```

Order status is **never stored** — it is derived at read time by `deriveOrderStatus()` from stage jobs, rolls, and dispatch records.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- A Neon PostgreSQL database (see `server/README.md` for credentials setup)

### 1. Install all dependencies

```bash
# From the project root:
cd client && npm install && cd ../server && npm install && cd ..
```

### 2. Configure environment variables

```bash
# Backend
cp server/.env.example server/.env
# Fill in DATABASE_URL, DIRECT_URL, JWT_SECRET, etc.

# Frontend
cp client/.env.example client/.env
# Set VITE_API_BASE_URL=http://localhost:4000/api/v1
```

### 3. Set up the database

```bash
cd server
npx prisma generate           # Generate Prisma Client
npx prisma migrate deploy     # Apply schema migrations
npx prisma db seed            # Seed demo data (optional but recommended)
```

### 4. Run the development servers

From the **project root**, run each in a separate terminal:

```bash
# Backend API (http://localhost:4000)
npm run server:dev

# Frontend SPA (http://localhost:5173)
npm run client:dev
```

> The Vite dev server proxies all `/api/*` requests to `http://localhost:4000`, so no CORS configuration is needed during development.

### 5. Production build

```bash
npm run client:build    # Build frontend to client/dist/
```

---

## 📡 API Base URL

| Environment | URL |
|---|---|
| Development | `http://localhost:4000/api/v1` |
| Production | Your deployed server URL + `/api/v1` |

Public (no auth) endpoints:
- `GET /api/v1/public/track/:token` — buyer order tracking
- `GET /api/v1/public/samples` — live order demo chips (landing page)
- `GET /api/v1/public/stats` — mill-wide operational statistics

---

## 📝 Further Documentation

| File | Contents |
|---|---|
| [`client/README.md`](./client/README.md) | Frontend tech stack, features, pages, pagination strategy, path aliases |
| [`server/README.md`](./server/README.md) | Backend setup, all API routes, data models, domain logic, scripts |
| [`MVP.md`](./MVP.md) | Core business rules & API specification |
| [`Frontend_MVP.md`](./Frontend_MVP.md) | Frontend feature specification (single source of truth) |
