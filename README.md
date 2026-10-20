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

> [!WARNING]
> **`docker-compose.yml` is strictly for local development and testing on `localhost` only.**
> It uses fallback environment variables (`ADMIN_PASSWORD=AdminInitial123!`, `DEMO_USER_PASSWORD=DemoInitial123!`, `SEED_DEMO_DATA=true`, `POSTGRES_PASSWORD=toktickit`) so that local evaluation works out of the box. **Never expose `docker-compose.yml` directly on a public internet-facing server.** For production or cloud deployments, use `./deploy/deploy.sh` (which generates random secrets in Google Secret Manager and disables demo seeding by default).

You can build and run the entire full-stack application (PostgreSQL 16 + one-shot Prisma Migration/Seed + Express/Prisma API + React/Nginx Frontend) with a single command:

```bash
# Option A: Full-Stack Multi-Container (PostgreSQL + One-Shot Migrate + API + Nginx Frontend)
docker compose up --build -d
# -> Frontend UI: http://localhost:5173
# -> Backend API: http://localhost:3000/api/health
# -> Readiness  : http://localhost:3000/api/ready

# Option B: Unified Single-Container Build (for Cloud Run / Render / Railway / Fly.io)
docker build -t toktickit-lab4 .
docker run -p 3000:3000 -e DATABASE_URL="postgresql://<user>:<pass>@host.docker.internal:5432/toktickit?schema=public" toktickit-lab4
# -> Unified UI + API: http://localhost:3000
```

---

## 3. Google Cloud Run Deployment (`deploy/deploy.sh` & `deploy/teardown.sh`)

The repository includes an idempotent deployment script for **Google Cloud Run + Cloud SQL for PostgreSQL + Secret Manager** designed to be executed directly inside **Google Cloud Shell**.

### Step-by-Step Deployment in Google Cloud Shell (<= 5 Steps)

1. **Open Google Cloud Shell** in the [Google Cloud Console](https://console.cloud.google.com/) and select your GCP project (make sure Billing is enabled on the project):
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```
2. **Clone the repository and enter the folder:**
   ```bash
   git clone https://github.com/rattanachote/Fullfunction_ToctikIT.git
   cd Fullfunction_ToctikIT
   ```
3. **(Optional) Preview all `gcloud` commands with `DRY_RUN=1`:**
   ```bash
   DRY_RUN=1 bash ./deploy/deploy.sh
   ```
4. **Run the deployment script:**
   - **Production mode** (seeds Categories, Related Systems, and Administrator only):
     ```bash
     bash ./deploy/deploy.sh
     ```
   - **Demo mode** (also seeds demo Requester/ITStaff users and sample tickets with a randomly generated password):
     ```bash
     bash ./deploy/deploy.sh --demo
     ```
5. **Sign in & Change Initial Password:**
   - Open the printed **Service URL** (`https://toktickit-...a.run.app`).
   - Sign in as `john.smith@example.com` using the randomly generated `Admin Password` printed at the end of `deploy.sh` (or retrieve it anytime via `gcloud secrets versions access latest --secret=toktickit-admin-password`).
   - Because `mustChangePassword` is `true`, the system will immediately prompt you to set a new strong password.

### Redeploying Safely (Zero Data Loss)
To deploy new code changes, simply run `bash ./deploy/deploy.sh` again:
- Existing secrets (`toktickit-database-url`, `toktickit-admin-password`) are preserved.
- `prisma migrate deploy` applies only new migrations.
- `seed.ts` detects existing users (`prisma.user.count() > 0`) and skips seeding so passwords, tickets, sessions (in the `Session` table), and file attachments (in the `AttachmentBlob` table) are never overwritten or lost.

### Cost Estimate & How to Avoid Charges (`teardown.sh`)
- **Cloud Run** scales to `0` instances when idle (`--min-instances=0 --max-instances=3`, with `connection_limit=3` in `DATABASE_URL` so total DB connections stay safely below Cloud SQL limits).
- **Cloud SQL (`POSTGRES_16`, `--edition=enterprise`, `--tier=db-f1-micro`, 10 GB SSD)** runs continuously and costs approximately **USD 9–12 / month** while active (unless covered by GCP Free Trial credits).
- **To stop all charges completely when finished testing**, run the teardown script to delete the Cloud Run Service, Cloud Run Job, Cloud SQL instance, Artifact Registry, and Secrets:
  ```bash
  bash ./deploy/teardown.sh
  ```

### Environment Variables Reference

| Variable | Default / Required | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | **Required** | PostgreSQL connection URL (include `&connection_limit=3` on Cloud Run). |
| `PORT` | `3000` | HTTP port the Express server listens on (Cloud Run injects `PORT=8080`). |
| `NODE_ENV` | `development` | Set to `production` in Docker and Cloud Run. |
| `TZ` | `Asia/Bangkok` | Server timezone used for date/year calculations (`TKT-YYYY-XXXXXX`). |
| `ADMIN_PASSWORD` | **Required in production** | Initial password for `john.smith@example.com` when seeding an empty DB. |
| `SEED_DEMO_DATA` | `false` in production | Set to `true` to seed sample demo users and tickets when DB is empty. |
| `DEMO_USER_PASSWORD` | **Required if `SEED_DEMO_DATA=true` in production** | Initial password for demo Requester/ITStaff accounts. |
| `CORS_ORIGIN` | Optional | Comma-separated allowed CORS origins in production (disabled if unset in production). |
| `ALLOW_LEGACY_REQUESTER_HEADER` | `false` | Legacy `X-Requester-Id` header toggle (enabled only in Vitest for Lab 2 test compatibility; restricted to `Requester` role). |

---

## 4. Seeded Accounts (`npm run prisma:seed`)

- **In Production (`NODE_ENV=production`):**
  - Requires `ADMIN_PASSWORD` from the environment (no default fallback).
  - Seeds only Categories, Related Systems, and the Administrator (`john.smith@example.com`) with `mustChangePassword: true`.
  - If `SEED_DEMO_DATA=true` is set, demo accounts and sample tickets are also seeded using `DEMO_USER_PASSWORD` with `mustChangePassword: true`.
- **In Local Development (`NODE_ENV != production`):**
  - Uses local dev fallback password from `seed.ts` for local testing convenience.

| Role | Name | Email | Production `mustChangePassword` |
| :--- | :--- | :--- | :--- |
| **Administrator** | John Smith | `john.smith@example.com` | `true` |
| **IT Staff** | Sarah IT Support | `sarah.it@example.com` | `true` (when `SEED_DEMO_DATA=true`) |
| **IT Staff** | John Support | `john.s@example.com` | `true` (when `SEED_DEMO_DATA=true`) |
| **IT Staff** | Alice Staff | `alice.s@example.com` | `true` (when `SEED_DEMO_DATA=true`) |
| **IT Staff** | Inactive IT Staff | `inactive.it@example.com` | `true` (`isActive: false`) |
| **Requester** | Jennifer Anderson | `jennifer.a@example.com` | `true` (when `SEED_DEMO_DATA=true`) |
| **Requester** | Michael Brown | `michael.b@example.com` | `true` (when `SEED_DEMO_DATA=true`) |
| **Requester** | Sarah Johnson | `sarah.j@example.com` | `true` (when `SEED_DEMO_DATA=true`) |
| **Requester** | David Lee | `david.l@example.com` | `true` |
| **Requester** | Inactive Test User | `inactive.user@example.com` | `true` (`isActive: false`) |

The idempotent seed (`server/prisma/seed.ts`) populates **8 tickets (`TKT-YYYY-000001` – `TKT-YYYY-000008`)** spanning all 8 workflow statuses (`New`, `Open`, `In Progress`, `Waiting for Requester`, `Resolved`, `Closed`, `Reopened`, `Cancelled`), all priority levels (`HIGH`, `MEDIUM`, `LOW`), assigned and unassigned states, and tickets with **0, 1, and multiple Actions Taken** across multiple IT Staff members.

---

## 5. Running Automated Tests (Lab 1 – Lab 4 Regression Suite)

### Backend API & Integration Tests (16 Suites)
```bash
cd server
npm test
```

### Frontend Component & Workflow Tests (13 Suites)
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
