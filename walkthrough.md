# CPE334 Lab 4 Walkthrough — Actions Taken, Ticket Resolution & Operational Dashboards

We have implemented, audited, and verified all functional, business rule, database, UI, testing, and documentation requirements for **CPE334 Lab 4** in accordance with `SE Lab 4.pdf`.

---

## 1. Summary of Changes Made

### 1.1 Database Schema & Idempotent Seeding (`server/prisma/`)
- **Prisma Schema (`schema.prisma`):**
  - Added the `ActionTaken` model (`id`, `ticketId`, `actionDateTime`, `actionDescription`, `result`, `performedById`, `followUpRequired`, `followUpNote`, `attachmentNotes`, `createdAt`, `updatedAt`) linked to `Ticket` (`actionsTaken`) and `User` (`performedBy`).
  - Added `requesterResolvedIndication` (`Boolean @default(false)`) on `Ticket` to separate requester resolution confirmation from formal IT Staff status transitions.
- **Idempotent Seed (`seed.ts`):**
  - Replaced destructive table wipes with idempotent `upsert()` logic across categories, related systems, users, and 8 canonical tickets (`TKT-YYYY-000001` through `TKT-YYYY-000008`).
  - Seeded all 8 lifecycle statuses (`New`, `Open`, `In Progress`, `Waiting for Requester`, `Resolved`, `Closed`, `Reopened`, `Cancelled`), all priorities (`HIGH`, `MEDIUM`, `LOW`), assigned and unassigned tickets, and tickets with **0, 1, and multiple Actions Taken** recorded by different IT Staff members.

### 1.2 Backend API & Business Rules (`server/src/app.ts`)
- **Complete Status State Machine (`ALLOWED_TRANSITIONS`):**
  - Enforced server-side transitions for all 8 statuses, including `Reopened -> ["Open", "In Progress", "Waiting for Requester", "Resolved", "Cancelled"]`, `Resolved -> ["Closed", "Reopened"]`, `Closed -> ["Reopened"]`, and `Cancelled -> ["Reopened"]`.
- **Optimistic Concurrency Control (`409 Conflict`):**
  - Enforced `expectedUpdatedAt` timestamp checks on `PUT /api/tickets/:id/owner`, `PUT /api/tickets/:id/status`, and `PUT /api/actions-taken/:actionId`.
- **Actions Taken Validation & Audit Integrity:**
  - Validated `actionDateTime` ISO parsing (`400 Bad Request` on invalid date strings), active IT Staff/Admin `assigneeId` validation, conditional `followUpNote` requirement when `followUpRequired === true`, and automatic parent ticket `updatedAt` touch on action creation/update.
- **Operational Dashboards & Queue Drill-Down Filters:**
  - Enhanced `GET /api/dashboard/staff` with `myActionsTakenCount`, `myRecentActions`, and Administrator-only `userCounts` (`totalUsers`, `activeUsers`, `inactiveUsers`).
  - Bounded `GET /api/dashboard/requester` `recentlyResolved` metric to the last 30 days.
  - Added `owner=unassigned`, `owner=me`, `categoryId`, and `sortBy=updatedAt_desc` query filters to `GET /api/tickets`.

### 1.3 Frontend UI (`client/src/api.ts` & `client/src/App.tsx`)
- **Actions Taken Work Tracker:**
  - Chronological list of recorded actions with performer name/role badge, timestamp, description, outcome result, follow-up alert, and attachment notes.
  - Inline edit mode (`Edit` -> `Save Changes` / `Cancel`) for IT Staff and Administrators with optimistic concurrency payload (`expectedUpdatedAt`).
  - Read-only view for Requesters on their own tickets while keeping `Internal Notes (IT Only)` completely hidden.
- **Permitted Status Transitions & Duplicate-Submit Guards:**
  - Status dropdown dynamically displays only the current status and valid next statuses from `ALLOWED_STATUS_TRANSITIONS[ticketDetails.currentStatus]`.
  - Added loading/disabled states across workflow updates, action creation/editing, comments, and internal notes.
- **Dashboards & Drill-Down Navigation:**
  - Added `My Recent Actions Taken` and Admin `System User Accounts` cards on the Staff Dashboard.
  - Wired metric cards to drill down directly into the filtered Ticket Queue / My Tickets list.

---

## 2. Automated Test Execution Results

### 2.1 Backend API & Integration Tests (Vitest + Supertest)
All **66 tests** across **16 test suites** (Lab 1 – Lab 4) pass:
```text
 RUN  v2.1.9 C:/Users/lm/Desktop/CPE334/lab4/server

 ✓ tests/lab-04/actions-taken.api.test.ts (10 tests)
 ✓ tests/lab-04/ticket-workflow.api.test.ts (7 tests)
 ✓ tests/lab-03/comments-notes.api.test.ts (7 tests)
 ✓ tests/lab-03/authorization.api.test.ts (6 tests)
 ✓ tests/lab-03/staff-ticket-detail.api.test.ts (5 tests)
 ✓ tests/lab-03/users-admin.api.test.ts (7 tests)
 ✓ tests/lab-04/staff-dashboard.api.test.ts (3 tests)
 ✓ tests/lab-03/staff-queue.api.test.ts (3 tests)
 ✓ tests/lab-04/requester-dashboard.api.test.ts (2 tests)
 ✓ tests/lab-03/auth.api.test.ts (6 tests)
 ✓ tests/lab-02/create-ticket.api.test.ts (3 tests)
 ✓ tests/lab-02/attachments.api.test.ts (2 tests)
 ✓ tests/lab-02/ticket-detail.api.test.ts (2 tests)
 ✓ tests/lab-02/my-tickets.api.test.ts (1 test)
 ✓ tests/lab-01/categories.test.ts (1 test)
 ✓ tests/lab-01/health.test.ts (1 test)

 Test Files  16 passed (16)
      Tests  66 passed (66)
```

### 2.2 Frontend Component & Workflow Tests (Vitest + React Testing Library)
All **13 test suites** (Lab 2 – Lab 4) pass:
```text
 RUN  v2.1.9 C:/Users/lm/Desktop/CPE334/lab4/client

 ✓ tests/lab-04/ActionsTaken.test.tsx (1 test)
 ✓ tests/lab-04/TicketWorkflow.test.tsx (1 test)
 ✓ tests/lab-04/StaffDashboard.test.tsx (1 test)
 ✓ tests/lab-04/RequesterDashboard.test.tsx (1 test)
 ✓ tests/lab-03/StaffTicketDetail.test.tsx (1 test)
 ✓ tests/lab-03/UserManagement.test.tsx (1 test)
 ✓ tests/lab-03/ChangePassword.test.tsx (1 test)
 ✓ tests/lab-03/StaffTicketQueue.test.tsx (1 test)
 ✓ tests/lab-03/Login.test.tsx (1 test)
 ✓ tests/lab-02/RequesterTicketDetail.test.tsx (1 test)
 ✓ tests/lab-02/AttachmentSection.test.tsx (1 test)
 ✓ tests/lab-02/MyTickets.test.tsx (1 test)
 ✓ tests/lab-02/CreateTicket.test.tsx (1 test)

 Test Files  13 passed (13)
      Tests  13 passed (13)
```

---

## 3. Deliverable Repository Increment

```text
docs/lab-04/
├── specification.md
├── tests.md
├── ui-spec.md
├── api-spec.md
├── reviewer.md
└── ai-use.md

artifacts/lab-04/screenshots/
├── staff-dashboard/
├── requester-dashboard/
└── actions-taken/
```
