# TokTickIT — Lab 4: Actions Taken, Ticket Resolution & Operational Dashboards

Complete full-stack implementation of **TokTickIT (Lab 1 – Lab 4)** built with **React 18 + TypeScript + Vite + Bootstrap 5** (Frontend) and **Express + TypeScript + Prisma + PostgreSQL** (Backend).

---

## 1. Key Capabilities (Lab 1 – Lab 4)

### Lab 4 Additions
1. **Actions Taken (Work Tracker) (`ActionTaken` model):**
   - IT Staff and Administrators can record chronological work entries (`actionDateTime`, `actionDescription`, `result`, `performedById`, `followUpRequired`, `followUpNote`, `attachmentNotes`) on any ticket via `POST /api/tickets/:id/actions-taken`.
   - Inline editing of existing Action Taken records via `PUT /api/actions-taken/:actionId` with optimistic concurrency control (`expectedUpdatedAt` -> `409 Conflict`).
   - Requesters have read-only visibility into `Actions Taken` on their own tickets while `Internal Notes` remain strictly hidden (`RBAC`).
2. **Complete Ticket Status Lifecycle & Formal Resolution Separation (`BR-01`, `BR-02`, `BR-08`):**
   - Server-enforced status state machine (`ALLOWED_TRANSITIONS`) covering all 8 statuses: `New`, `Open`, `In Progress`, `Waiting for Requester`, `Resolved`, `Closed`, `Reopened`, and `Cancelled`.
   - Strict separation between Requester resolution indication (`POST /api/tickets/:id/resolve-indication` -> sets `requesterResolvedIndication = true` without mutating `currentStatus`) and formal IT Staff resolution (`PUT /api/tickets/:id/status`).
   - Optimistic concurrency checking (`expectedUpdatedAt` -> `409 Conflict`) on ticket owner and status updates, plus optional formal resolution gate (`requireActionForResolve`).
3. **Operational Dashboards (`GET /api/dashboard/staff` & `GET /api/dashboard/requester`):**
   - **IT Staff / Admin Dashboard:** Unassigned active queue count, My Assigned active count, My Actions Taken count, status breakdown (`New`, `Open`, `In Progress`, `Waiting for Requester`, `Resolved`, `Closed`), active priority breakdown (`HIGH`, `MEDIUM`, `LOW`), Recent Queue Activity, My Recent Actions Taken, and Administrator System User Account summary (`totalUsers`, `activeUsers`, `inactiveUsers`).
   - **Requester Dashboard:** Scoped strictly to the authenticated requester's tickets (`totalOpen`, `inProgress`, `waitingForRequester`, `recentlyResolved` within 30 days, and 5 most recently updated tickets).
   - **Drill-Down Navigation:** Clicking any dashboard metric card navigates directly to the Ticket Queue / My Tickets view with the corresponding filter (`owner=unassigned`, `owner=me`, `status`, `priority`) pre-applied.

---

## 2. Prerequisites & Environment Setup

- **Node.js** `>= 20.x`
- **PostgreSQL** `>= 15.x` running on `localhost:5432`

### Backend Setup (`server/`)
```bash
cd server
cp .env.example .env   # Configure DATABASE_URL if needed
npm install
npx prisma migrate deploy
npm run prisma:seed    # Idempotent seed (safe to run multiple times)
npm run dev            # Starts Express API on http://localhost:3000
```

### Frontend Setup (`client/`)
```bash
cd client
cp .env.example .env
npm install
npm run dev            # Starts Vite UI on http://localhost:5173
```

### Docker Deployment (`docker-compose.yml` & `Dockerfile`)
You can build and run the entire full-stack application (PostgreSQL 16 + Express/Prisma API + React/Nginx Frontend) with a single command:

```bash
# Option A: Full-Stack Multi-Container (PostgreSQL + API + Nginx Frontend)
docker compose up --build -d
# -> Frontend UI: http://localhost:5173
# -> Backend API: http://localhost:3000/api/health

# Option B: Unified Single-Container Build (for Render / Railway / Fly.io / Cloud Run)
docker build -t toktickit-lab4 .
docker run -p 3000:3000 -e DATABASE_URL="postgresql://toktickit:toktickit@host.docker.internal:5432/toktickit?schema=public" toktickit-lab4
# -> Unified UI + API: http://localhost:3000
```

---

## 3. Seeded Demo Accounts (`npm run prisma:seed`)

All seeded accounts use the password: **`password123`**

| Role | Name | Email | Account State |
| :--- | :--- | :--- | :--- |
| **Administrator** | John Smith | `john.smith@example.com` | Active (`mustChangePassword: false`) |
| **IT Staff** | Sarah IT Support | `sarah.it@example.com` | Active (`mustChangePassword: false`) |
| **IT Staff** | John Support | `john.s@example.com` | Active (`mustChangePassword: false`) |
| **IT Staff** | Alice Staff | `alice.s@example.com` | Active (`mustChangePassword: false`) |
| **IT Staff** | Inactive IT Staff | `inactive.it@example.com` | Inactive (`isActive: false`) |
| **Requester** | Jennifer Anderson | `jennifer.a@example.com` | Active (`mustChangePassword: false`) |
| **Requester** | Michael Brown | `michael.b@example.com` | Active (`mustChangePassword: false`) |
| **Requester** | Sarah Johnson | `sarah.j@example.com` | Active (`mustChangePassword: false`) |
| **Requester** | David Lee | `david.l@example.com` | Active (`mustChangePassword: true` — tests first-login password change) |
| **Requester** | Inactive Test User | `inactive.user@example.com` | Inactive (`isActive: false`) |

The idempotent seed (`server/prisma/seed.ts`) populates **8 tickets (`TKT-YYYY-000001` – `TKT-YYYY-000008`)** spanning all 8 workflow statuses (`New`, `Open`, `In Progress`, `Waiting for Requester`, `Resolved`, `Closed`, `Reopened`, `Cancelled`), all priority levels (`HIGH`, `MEDIUM`, `LOW`), assigned and unassigned states, and tickets with **0, 1, and multiple Actions Taken** across multiple IT Staff members.

---

## 4. Running Automated Tests (Lab 1 – Lab 4 Regression Suite)

### Backend API & Integration Tests (16 Suites / 66 Tests)
```bash
cd server
npm test
```

### Frontend Component & Workflow Tests (13 Suites / 13 Tests)
```bash
cd client
npm test
```

### End-to-End Playwright Specs
```bash
npx playwright test e2e/lab-04
```

---

## 5. Lab 4 Documentation & Deliverables

All Lab 4 engineering contract documents and visual artifacts are organized as follows:

```text
lab4/
├── README.md
├── docs/
│   └── lab-04/
│       ├── specification.md   # Problem Statement, FR-01..11, BR-01..09, AC-01..09, DB Design & Migration Plan
│       ├── api-spec.md        # Complete Lab 4 REST API Contract & Status Transition Matrix
│       ├── ui-spec.md         # Screen Inventory, States, Responsive Breakpoints & Component Rules
│       ├── tests.md           # Full Test Plan & Traceability Matrix (Lab 1 – Lab 4)
│       ├── ai-use.md          # AI Usage Log (8 Prompts) & Engineering Reflection
│       └── reviewer.md        # Independent Peer Review Report & Defect Resolution Log
└── artifacts/
    └── lab-04/
        └── screenshots/
            ├── staff-dashboard/
            ├── requester-dashboard/
            └── actions-taken/
```
