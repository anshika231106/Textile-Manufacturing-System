# MillTrace — Frontend (Client)

> React 18 + Vite + TypeScript frontend for the **MillTrace** Textile Manufacturing ERP system.

---

## 📌 Overview

The client is a single-page application (SPA) that provides a role-gated operational portal for internal staff and a public buyer-tracking landing page. It communicates with the MillTrace REST API via a Vite dev-proxy (no CORS issues in development) and by direct `VITE_API_BASE_URL` in production.

---

## 🛠 Tech Stack

| Category | Technology |
|---|---|
| **Framework** | React 18 |
| **Build Tool** | Vite 6 |
| **Language** | TypeScript 5.7 |
| **Routing** | React Router DOM v6 |
| **State Management** | Redux Toolkit + React Redux |
| **Styling** | Tailwind CSS v4 (Vite plugin) |
| **Animations** | Framer Motion 14 |
| **Charts** | Recharts 3 |
| **Icons** | Heroicons v2 · Lucide React |
| **Utilities** | clsx · tailwind-merge |

---

## 📁 Directory Structure

```text
client/
├── public/                    # Static assets (favicon, etc.)
├── src/
│   ├── components/
│   │   ├── layout/            # AppLayout, Sidebar/Nav, RequireRole guard
│   │   └── ui/                # Design-system primitives
│   │       ├── Badge.tsx      # Status colour badges
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── ErrorState.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       ├── Pagination.tsx # DEFAULT_PAGE_SIZE constant + Pagination component
│   │       ├── SearchableSelect.tsx
│   │       ├── Select.tsx
│   │       ├── Table.tsx      # Generic typed column table
│   │       ├── ThemeToggle.tsx
│   │       └── Toast.tsx
│   ├── features/              # Domain feature modules (each owns its API + pages)
│   │   ├── attendance/        # Worker daily attendance & wage summary
│   │   ├── auth/              # Login form, password-setup, auth context
│   │   ├── dispatch/          # Roll dispatch & invoice creation
│   │   ├── floor/             # Machine floor board, shift logging, production simulator
│   │   ├── landing/           # Public landing page + live buyer-tracking widget
│   │   ├── masters/           # Buyers, suppliers, yarn types, machines, workers master lists
│   │   ├── orders/            # Order list, order detail, create-order form
│   │   ├── qc/                # QC inspection queue, roll creation form, defect recording
│   │   ├── reports/           # Executive dashboard & month-end P&L report
│   │   ├── rolls/             # Roll traceability table & QR-label print
│   │   └── stock/             # Yarn inventory overview, receipt form, ledger panel
│   ├── lib/
│   │   ├── api.ts             # Typed fetch wrapper (base URL, auth header injection)
│   │   ├── auth.tsx           # AuthContext + useAuth hook + token refresh loop
│   │   ├── format.ts          # Currency, date, timestamp formatters
│   │   ├── motion.ts          # Shared Framer Motion variants
│   │   ├── numbers.ts         # Rounding helpers
│   │   └── useApi.ts          # Generic data-fetching hook with loading/error/reload
│   ├── store/
│   │   └── themeSlice.ts      # Dark/light theme Redux slice
│   └── main.tsx               # App entry – BrowserRouter, Redux Provider, AuthProvider
├── index.html
├── vite.config.ts             # Vite plugins, path aliases (@/, @shared/), dev proxy
├── tsconfig.app.json
└── package.json
```

---

## 🔐 Roles & Access

| Role | Accessible Pages |
|---|---|
| **OWNER** | Everything: Dashboard, Orders, Floor, QC, Dispatch, Stock, Attendance, Staff, Masters, Month-End Report |
| **SUPERVISOR** | Dashboard, Orders, Floor, QC, Dispatch, Rolls, Stock |
| **OFFICE** | Dashboard, Orders, Staff, Attendance, Masters, Invoices |
| **STAFF** | Floor board (own machines only), own Attendance view |
| *(public)* | Landing page + Buyer tracking portal (token-based, no login) |

Route guarding is enforced by the `<RequireRole>` component; unauthenticated users are redirected to `/login`.

---

## 📄 Key Pages & Features

### 🌐 Landing Page (`/`)
- Animated hero with live mill statistics (machines running, metres produced, QC pass rate).
- **Buyer Tracking Widget** — enter an order number or tracking token to pull live stage progress, roll counts, and dispatch status without logging in.
- Live sample order chips from the backend's `/public/samples` endpoint.
- Dark/light theme toggle.

### 🔑 Auth (`/login`, `/setup-password`)
- JWT-based login with access + refresh token pair.
- New-staff setup: time-limited password-setup link (10-minute expiry) sent by email when a staff account is created.

### 📋 Orders (`/orders`, `/orders/:id`)
- Paginated order table with status filter tabs (backend pagination via `?limit=&offset=`).
- Order detail: stage progress timeline, yarn requirements, roll list, dispatch events.
- Create-order form with buyer selection, fabric spec, yarn requirements, and deadline.

### 🏭 Floor Board (`/floor`)
- Machine card grid grouped by stage (SPINNING → WEAVING → DYEING).
- Start/pause/complete stage jobs with shift and operator assignment.
- Production log entry and machine breakdown reporting.
- STAFF role sees only their assigned machines.

### 🔬 QC Inspection (`/qc`)
- Queue of rolls pending inspection, paginated client-side.
- Create Roll form: validates roll metres ≤ remaining dyeing output.
- Record defects per roll with defect type and defect percentage.
- Pass / Rework / Reject actions with concurrency-safe backend updates.

### 🚚 Dispatch & Invoicing (`/dispatch`)
- Select passed rolls for a buyer's order, record quantity dispatched.
- Atomic dispatch + invoice creation in a single backend transaction.
- Invoice list with payment-recording workflow.

### 🧵 Stock & Yarn Ledger (`/stock`)
- Current yarn stock levels per yarn type with low-stock alerts.
- Record stock receipts (supplier, kg, rate per kg).
- **Stock Ledger Panel**: paginated via real backend pagination (`skip` / `take` in Prisma) — page changes fire a new API request, only the current page is fetched.

### 👥 Staff Management (`/staff`)
- Create staff accounts (triggers welcome email with password-setup link).
- View / edit / delete staff. Role promotions restricted to OWNER (one-level promotions only).

### 📅 Attendance & Wages (`/attendance`)
- Supervisors mark daily presence for the whole roster.
- Office/Owner see monthly wage totals (daily wage × present days).
- Staff see only their own attendance and wage summary.

### 📊 Reports (`/dashboard`, `/reports/month-end`)
- **Dashboard**: Live KPIs — active machines, today's production by shift, revenue this month, pending orders, low-stock yarn, recent activity feed.
- **Month-End Report** (OWNER only): Yarn purchases, staff wages + salaries, invoiced revenue, payments received, operating profit, cost-per-order breakdown. Client-side pagination over the generated report.

### 🗂 Masters (`/masters`)
- Full tables for Buyers, Suppliers, Yarn Types, Machines, and Workers.
- Client-side text filtering and tab switching (full dataset, no pagination).

---

## 📡 Pagination Strategy

| Module | Type | Mechanism |
|---|---|---|
| Orders List | **Backend** | `?limit=&offset=` query params; SQL `SKIP`/`TAKE` |
| Stock Ledger | **Backend** | `?limit=&offset=` query params; SQL `SKIP`/`TAKE` |
| QC Queue | **Frontend** | Full fetch, `.slice()` in React state |
| Staff | **Frontend** | Full fetch, `.slice()` in React state |
| Attendance | **Frontend** | Full fetch, `.slice()` in React state |
| Month-End Report | **Frontend** | Calculated report array sliced with `orderPage` / `wagePage` state |
| Masters | **None** | Full dataset rendered with client-side text filter |

---

## ⚙️ Environment Variables

Create `.env` in `client/` (copy from `.env.example`):

```env
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

> **In development**, the Vite dev server proxies all `/api` requests to `http://localhost:4000`, so you do not strictly need `VITE_API_BASE_URL` unless deploying to a static host.

---

## 🚀 Getting Started

### Prerequisites
- Node.js `v20.x` or higher
- npm `v10.x` or higher
- Backend server running on port `4000` (see `server/README.md`)

### Install

```bash
cd client
npm install
```

### Run Development Server

```bash
npm run dev
```

Frontend will be available at **`http://localhost:5173`**. All `/api/*` requests are proxied to the backend at `http://localhost:4000`.

### Type-check / Production Build

```bash
npm run build   # runs tsc -b then vite build
npm run preview # preview the built output locally
```

---

## 🔗 Path Aliases

| Alias | Resolves to |
|---|---|
| `@/*` | `src/*` |
| `@shared/*` | `../shared/*` |

---

## 📝 Notes

- **Theme**: Dark/light mode persisted via Redux (`themeSlice`) and toggled from the navigation bar.
- **Mock fallbacks**: Each `*.api.ts` file has local mock data as a `catch` fallback so the UI renders even when the backend is offline — useful for frontend-only development.
- **Framer Motion**: Shared animation variants live in `src/lib/motion.ts`. The app respects `prefers-reduced-motion`.
