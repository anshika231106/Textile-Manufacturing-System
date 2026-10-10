# MillTrace — Textile Manufacturing System

> Comprehensive ERP and manufacturing workflow tracking system tailored for **Everest Textile Mills**.

---

## 📌 Project Overview

**MillTrace** is a single-page manufacturing execution and operations platform designed to trace and manage the full textile lifecycle:

$$\text{Yarn Receipt} \longrightarrow \text{Order} \longrightarrow \text{Production Stages} \longrightarrow \text{Roll Creation} \longrightarrow \text{Quality Control} \longrightarrow \text{Dispatch} \longrightarrow \text{Invoice/Payment} \longrightarrow \text{Month-End Report}$$

- **Internal Staff Portal**: Role-based operational access for `OWNER`, `OFFICE`, `SUPERVISOR`, and `STOREKEEPER`.
- **Buyer Tracking Portal**: Public, tokenized real-time tracking for buyers without login credentials.

---

## 🛠 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, React Router v6, Tailwind CSS |
| **Backend** | Node.js, Express, TypeScript, Prisma ORM |
| **Database** | PostgreSQL (Neon) |
| **Contracts** | Shared TypeScript DTOs and Enums (`shared/`) |

---

## 📁 Repository Structure

```text
milltrace/
├── docs/                     # Documentation & seed data specifications
├── shared/                   # Shared API contracts, types, and enums
│   ├── api.ts
│   └── enums.ts
├── client/                   # Vite + React + Tailwind frontend application
│   ├── src/
│   │   ├── components/       # Reusable UI primitives & layout shells
│   │   │   ├── layout/       # AppLayout, Nav, RequireRole
│   │   │   └── ui/           # Button, Input, Select, Table, Modal, etc.
│   │   ├── features/         # Domain-specific feature modules & APIs
│   │   │   ├── attendance/   # Worker attendance & payroll view
│   │   │   ├── auth/         # Login & authentication
│   │   │   ├── dispatch/     # Roll dispatch & invoicing
│   │   │   ├── floor/        # Machine floor board & shift logging
│   │   │   ├── masters/      # Buyers, suppliers, yarns, machines, workers
│   │   │   ├── orders/       # Order management & feasibility checks
│   │   │   ├── qc/           # Quality control inspection & roll creation
│   │   │   ├── reports/      # Month-end & executive dashboards
│   │   │   ├── rolls/        # Roll traceability & QR label printing
│   │   │   ├── stock/        # Yarn inventory & stock receipts
│   │   │   └── track/        # Public buyer order tracker
│   │   └── lib/              # API client, auth context, custom hooks
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                   # Express + Prisma backend application
│   ├── prisma/               # Schema, migrations, and seed scripts
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── config/           # Environment and server configuration
│   │   ├── db/               # Prisma database client
│   │   ├── domain/           # Business logic & domain calculations
│   │   ├── lib/              # Utility helpers & response formatters
│   │   ├── middleware/       # Auth, validation, and error handlers
│   │   └── modules/          # Feature controllers, routes, and services
│   ├── package.json
│   └── tsconfig.json
├── Frontend_MVP.md           # Frontend Single Source of Truth
├── MVP.md                    # Core Business & API Specification
└── package.json              # Root workspace development scripts
```

---

## 🚦 Current Status & Progress

- [x] **Project Directory Architecture**: Folder structure created matching `Frontend_MVP.md`.
- [x] **Frontend Foundation**:
  - Initialized Vite + React 18 + TypeScript environment in `client/`.
  - Configured Tailwind CSS v4 styling system.
  - Setup TypeScript and Vite path aliases (`@/*` and `@shared/*`).
  - Verified client production build.
- [x] **Backend Foundation**:
  - Organized backend directory under `server/`.
  - Prisma ORM structure initialized with PostgreSQL schema.
- [ ] **Next Steps**:
  - Define shared DTOs & enums in `shared/`.
  - Implement shared layout, navigation, auth context, and UI primitives.
  - Connect feature modules to backend API endpoints in vertical slices.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher

### Installation

1. **Install Frontend Dependencies:**
   ```bash
   cd client
   npm install
   ```

2. **Install Backend Dependencies:**
   ```bash
   cd ../server
   npm install
   ```

### Running Locally

- **Run Frontend Dev Server:**
  ```bash
  npm run client:dev
  ```
  *Frontend will be running at: `http://localhost:5173`*

- **Run Backend Dev Server:**
  ```bash
  npm run server:dev
  ```
  *Backend API will be running at: `http://localhost:3000`*

- **Build for Production:**
  ```bash
  npm run client:build
  ```
