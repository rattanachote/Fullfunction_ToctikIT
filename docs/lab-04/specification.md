# Lab 4 Sprint Engineering Specification

## 1. Sprint Goal
Complete the core TokTickIT service-desk workflow by adding a parent-child **Actions Taken** work-tracking structure under Tickets, enforcing the complete Ticket status-transition matrix and formal resolution gate on the backend, delivering role-appropriate operational **Dashboards** with accurate aggregations and drill-down links for Requesters, IT Staff, and Administrators, and hardening the full-stack application built across Labs 1 through 4 under the Zen Green design language.

---

## 2. Stakeholder Request Interpretation
The stakeholder requires an auditable, collaborative mechanism to plan and record actual technical work performed on Tickets without losing clear accountability:
*   **Parent-Child Actions Taken:** Each Ticket can have zero, one, or multiple Actions Taken line items containing `actionDateTime`, `actionDescription`, `result`, `performedBy` (automatically bound to the authenticated IT Staff/Admin user), `followUpRequired`, `followUpNote` (mandatory whenever `followUpRequired` is true), and `attachmentNotes` (indicating which uploaded file or image to inspect).
*   **Ownership vs. Action Execution:** A single primary Ticket Owner coordinates the Ticket as a whole, while any active IT Staff member or Administrator may perform work and record or update Actions Taken on that Ticket.
*   **Advisory Requester Indication vs. Formal Resolution Gate:** Requesters may flag that a problem appears resolved (`requesterResolvedIndication`), which posts an advisory system comment, but only IT Staff or Administrators can formally transition a Ticket to `Resolved` or `Closed` after reviewing the work.
*   **Concise Operational Dashboards:** Requesters and IT Staff/Administrators receive role-specific dashboards summarizing live PostgreSQL metrics and recent activity with direct drill-down navigation into filtered queues or Ticket Detail views.
*   **Final Hardening & Regression:** All Labs 1–3 features (authentication, mandatory password change, RBAC, My Tickets, shared queue, public comments, private internal notes, file attachments, and user administration) must remain 100% functional, accessible, responsive, and protected against stale concurrent overwrites and duplicate submissions.

---

## 3. Scope

### 3.1. Included in Sprint 4
*   **Actions Taken Data Model, Migration & REST APIs:** `ActionTaken` Prisma model linked to `Ticket` and `User`, non-destructive migration (`20260901044623_lab4_actions_taken`), idempotent seed script covering all statuses/priorities and 0/1/multiple Actions Taken, plus `GET /api/tickets/:id/actions-taken`, `POST /api/tickets/:id/actions-taken`, and `PUT /api/actions-taken/:actionId`.
*   **Ticket Workflow & Resolution Gate:** Complete 8-status transition matrix (`New`, `Open`, `In Progress`, `Waiting for Requester`, `Resolved`, `Closed`, `Reopened`, `Cancelled`), backend resolution gate enforcement, and optimistic concurrency control (`expectedUpdatedAt` returning `409 Conflict` on stale updates).
*   **Role-Appropriate Dashboards:** `GET /api/dashboard/requester` and `GET /api/dashboard/staff` returning authoritative counts, priority breakdowns, current-user Actions Taken summaries, optional Administrator user-account counts, and top-5 recently updated Tickets with UI drill-down.
*   **Zen Green UI Extensions & Hardening:** Dashboard navigation bar, metric cards with keyboard and click drill-down, Actions Taken list/create/edit modes in Ticket Detail, permitted-transition status selector, duplicate-submit button locks, and full Labs 1–3 regression preservation.

### 3.2. Explicitly Excluded from Sprint 4
*   Automatic SLA clocks, escalation engines, on-call scheduling, and breach notifications.
*   Email, SMS, LINE, push, or other external notification services.
*   Inventory consumption, spare-parts management, purchasing, or cost accounting for services.
*   Time-sheet billing, payroll, or detailed labor-cost calculation.
*   Multi-level approval workflows and electronic signatures.
*   Advanced business-intelligence tools, custom report builders, or export warehouses.
*   Multi-tenant organizations and production-scale cloud operations.

---

## 4. Functional Requirements

*   **FR-01 (Actions Taken Creation):** Permitted IT Staff and Administrators must be able to create an Action Taken under any accessible Ticket with `actionDateTime` (defaulting to current server timestamp if omitted), `actionDescription` (required), `result` (optional), `followUpRequired` (boolean), `followUpNote` (required when `followUpRequired = true`), and `attachmentNotes` (optional).
*   **FR-02 (Actions Taken Editing):** Permitted IT Staff and Administrators must be able to edit existing Action Taken items on a Ticket (updating description, result, follow-up flag/note, and attachment notes) while preserving the original creator audit trail.
*   **FR-03 (Actions Taken Visibility & Ordering):** Both IT Staff/Administrators and the owning Requester must see all Actions Taken for a Ticket ordered chronologically (`actionDateTime ASC, id ASC`). Requesters view Actions Taken in read-only mode.
*   **FR-04 (Multi-Staff Collaboration):** Any active IT Staff or Administrator must be able to record Actions Taken on a Ticket regardless of whether they are the primary Ticket Owner (`ownerId`).
*   **FR-05 (Ticket Status Transition Enforcement):** The backend must validate every status update against the approved transition matrix and reject disallowed transitions with `400 Bad Request` even if a client bypasses the UI.
*   **FR-06 (Advisory Resolution & Formal Resolution Gate):** Requesters can toggle `requesterResolvedIndication` on their owned Tickets without changing `currentStatus`. Only IT Staff and Administrators can transition a Ticket to `Resolved` or `Closed`, and the backend enforces the resolution gate when required.
*   **FR-07 (Requester Dashboard):** Authenticated Requesters must receive a dashboard summarizing only their owned Tickets (`totalOpen`, `inProgress`, `waitingForRequester`, `recentlyResolved` within 30 days) and their 5 most recently updated Tickets, with drill-down links to filtered `My Tickets` and `Ticket Detail`.
*   **FR-08 (IT Staff & Administrator Dashboard):** Authenticated IT Staff and Administrators must receive an operational dashboard showing `unassigned`, `myAssigned`, `myActionsTakenCount`, status counts (`new`, `open`, `inProgress`, `waitingForRequester`, `resolved`, `closed`), active priority counts (`high`, `medium`, `low`), 5 most recently updated queue Tickets, 5 most recent Actions Taken by the current user, and (for Administrators) concise user-account counts (`totalUsers`, `activeUsers`, `inactiveUsers`).
*   **FR-09 (Optimistic Concurrency & Safe Failure):** Ticket workflow updates (`PUT /api/tickets/:id/owner`, `PUT /api/tickets/:id/status`) and Action Taken edits (`PUT /api/actions-taken/:actionId`) must detect stale `expectedUpdatedAt` timestamps and return `409 Conflict` without overwriting newer changes.
*   **FR-10 (Duplicate-Action Prevention & Form Protection):** All write forms (Login, Change Password, Create Ticket, Record/Edit Action Taken, Public Comments, Internal Notes, Workflow Controls, Admin User CRUD) must disable submit triggers while in flight and preserve entered form text if a recoverable error occurs.
*   **FR-11 (Full Regression Preservation):** All Labs 1–3 capabilities—health check, reference categories/systems, authentication, first-login password change, attachment upload/download/soft-remove, public comments, internal notes, and administrator user management—must continue to pass all automated tests.

---

## 5. Business Rules

### 5.1. Authorization Matrix

| Operation / Resource | Requester | IT Staff | Administrator | Backend Enforcement |
| :--- | :--- | :--- | :--- | :--- |
| View Actions Taken (`GET /api/tickets/:id/actions-taken`) | Owned Tickets only (`404` if not owner) | All Tickets | All Tickets | `authenticate` + ownership check |
| Create Action Taken (`POST /api/tickets/:id/actions-taken`) | Forbidden (`403`) | Permitted | Permitted | `requireRole(["ITStaff", "Administrator"])` |
| Edit Action Taken (`PUT /api/actions-taken/:actionId`) | Forbidden (`403`) | Permitted | Permitted | `requireRole(["ITStaff", "Administrator"])` |
| Claim / Reassign Ticket Owner (`PUT /api/tickets/:id/owner`) | Forbidden (`403`) | Active IT Staff / Admin only | Active IT Staff / Admin only | `requireRole` + active role check |
| Update Ticket Status / IT Priority (`PUT /api/tickets/:id/status`) | Forbidden (`403`) | Permitted transitions only | Permitted transitions only | `requireRole` + transition matrix |
| Indicate Appears Resolved (`POST /api/tickets/:id/indicate-resolved`) | Owned Tickets only (`404` if not owner) | Forbidden (`403`) | Forbidden (`403`) | `requireRole(["Requester"])` + ownership |
| Requester Dashboard (`GET /api/dashboard/requester`) | Own metrics & tickets only | Own requester metrics (if any) | Own requester metrics (if any) | `authenticate` + `requesterId = user.userId` |
| Staff Dashboard (`GET /api/dashboard/staff`) | Forbidden (`403`) | Permitted | Permitted (+ user counts) | `requireRole(["ITStaff", "Administrator"])` |

### 5.2. Numbered Business Rules
*   **BR-01 (Parent-Child Integrity):** Every `ActionTaken` belongs to exactly one `Ticket` (`ticketId` foreign key). A Ticket may have zero, one, or many Actions Taken.
*   **BR-02 (Owner Coordination vs. Action Performer):** The Ticket Owner (`Ticket.ownerId`) coordinates the Ticket overall, but an `ActionTaken` may be performed and recorded by any active IT Staff or Administrator (`ActionTaken.performedById`).
*   **BR-03 (Automatic Actor Binding):** `performedById` is set automatically by the server from the authenticated session (`req.user.userId`) and cannot be spoofed by client payloads.
*   **BR-04 (Conditional Follow-Up Note):** Whenever `followUpRequired` is `true` (on create or update), `followUpNote` is mandatory and must be a non-empty trimmed string (`400 Bad Request` if missing/blank). When `followUpRequired` is `false`, `followUpNote` is cleared to `null`.
*   **BR-05 (Active Assignee Validation):** Neither a Ticket (`ownerId`) nor an Action Taken (`assigneeId`) may be assigned to an inactive user (`isActive = false`) or a user with role `Requester` (`400 Bad Request`).
*   **BR-06 (Complete Ticket Status-Transition Matrix):**
    *   `New` $\rightarrow$ `Open`, `In Progress`, `Cancelled`
    *   `Open` $\rightarrow$ `In Progress`, `Waiting for Requester`, `Resolved`, `Cancelled`
    *   `In Progress` $\rightarrow$ `Waiting for Requester`, `Resolved`, `Cancelled`
    *   `Waiting for Requester` $\rightarrow$ `In Progress`, `Open`, `Resolved`, `Cancelled`
    *   `Resolved` $\rightarrow$ `Closed`, `Reopened`
    *   `Reopened` $\rightarrow$ `Open`, `In Progress`, `Waiting for Requester`, `Resolved`, `Cancelled`
    *   `Closed` $\rightarrow$ `Reopened`
    *   `Cancelled` $\rightarrow$ `Reopened`
*   **BR-07 (Advisory Requester Resolution & Formal Resolution Gate):** A Requester toggling "Problem Appears Resolved" flips `requesterResolvedIndication` and appends a `[System Notification]` public comment, but never changes `currentStatus`. Formal transition to `Resolved` requires IT Staff/Admin action and, when `requireActionForResolve` is enforced, requires at least one recorded `ActionTaken`.
*   **BR-08 (Authoritative Backend Dashboard Calculations):**
    *   **Timezone & Date Boundaries:** All timestamps are stored in UTC ISO-8601 and evaluated relative to server UTC time (`thirtyDaysAgo = now - 30 days`).
    *   `Requester.totalOpen`: Count of owned Tickets where `currentStatus IN ("New", "Open", "In Progress", "Waiting for Requester", "Reopened")`.
    *   `Requester.inProgress`: Count of owned Tickets where `currentStatus = "In Progress"`.
    *   `Requester.waitingForRequester`: Count of owned Tickets where `currentStatus = "Waiting for Requester"`.
    *   `Requester.recentlyResolved`: Count of owned Tickets where `currentStatus IN ("Resolved", "Closed")` and `updatedAt >= now - 30 days`.
    *   `Staff.unassigned`: Count of Tickets where `ownerId IS NULL` and `currentStatus NOT IN ("Closed", "Cancelled")`.
    *   `Staff.myAssigned`: Count of Tickets where `ownerId = req.user.userId` and `currentStatus NOT IN ("Closed", "Cancelled")`.
    *   `Staff.myActionsTakenCount`: Count of `ActionTaken` records where `performedById = req.user.userId`.
    *   `Staff.byPriority.{high,medium,low}`: Count of active Tickets (`currentStatus NOT IN ("Closed", "Cancelled")`) grouped by `itPriority`.
*   **BR-09 (Optimistic Concurrency Control):** When a client supplies `expectedUpdatedAt` on Ticket owner/status updates or Action Taken edits, the backend compares it to the current database `updatedAt`. Any mismatch returns `409 Conflict` to prevent lost updates.

---

## 6. UI Specification Summary
Detailed wireframes, color tokens, and component states are documented in [`docs/lab-04/ui-spec.md`](file:///c:/Users/lm/Desktop/CPE334/lab4/docs/lab-04/ui-spec.md).
*   **Zen Green Theme Continuity:** Primary Green `#006B3C`, Secondary Green `#0B7A46`, Pale Green `#EAF6EF`, Warning Orange `#D48208`/`#FDF3E7`, Action Tracker Blue `#104F8C`/`#EBF3FB`, and Read-Only Ivory `#FAF9F6`.
*   **Role-Appropriate Navigation:** Navbar includes `Dashboard` (with active-page highlighting), role-specific queue/ticket buttons (`My Tickets` + `Create Ticket` for Requesters; `Ticket Queue` for IT Staff; `User Management` + `Ticket Queue` for Administrators), user identity badge, and `Logout`.
*   **Dashboards:** Concise metric cards with `role="button"`, `tabIndex={0}`, keyboard (`Enter`/`Space`) and click drill-down into filtered ticket lists, accompanied by top-5 recent tickets and (for IT Staff/Admin) `My Recent Actions Taken` and priority/user breakdowns.
*   **Actions Taken on Ticket Detail:** Light-blue bordered card displaying chronological action items, actor role badges, follow-up warning badges, attachment notes, inline **Edit** mode for IT Staff/Admin, and a **Record Action** footer form with conditional Follow-Up Note input.
*   **Workflow Controls:** Status dropdown displays only `currentStatus` and the permitted next transitions from `ALLOWED_STATUS_TRANSITIONS`.

---

## 7. Data Changes, Design Justifications & Migration Strategy

### 7.1. Prisma Model Increment (`ActionTaken`)
```prisma
model ActionTaken {
  id                Int      @id @default(autoincrement())
  ticketId          Int
  ticket            Ticket   @relation(fields: [ticketId], references: [id])
  actionDateTime    DateTime @default(now())
  actionDescription String
  result            String?
  performedById     Int
  performedBy       User     @relation(fields: [performedById], references: [id])
  followUpRequired  Boolean  @default(false)
  followUpNote      String?
  attachmentNotes   String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

### 7.2. Two Justified Database-Design Decisions (Required by §5.1)
1.  **Separate `actionDateTime` vs. `createdAt` / `updatedAt` Timestamps:**
    *   *Justification:* `createdAt` and `updatedAt` provide an immutable system audit trail and optimistic concurrency token (`@updatedAt`), whereas `actionDateTime` represents the operational time the technical work occurred (allowing IT Staff to accurately log work performed earlier during an outage while preserving deterministic chronological ordering `ORDER BY actionDateTime ASC, id ASC`).
2.  **Relational Foreign Keys (`ticketId`, `performedById`) with Non-Cascading User Reference & Nullable Optional Fields (`result`, `followUpNote`, `attachmentNotes`):**
    *   *Justification:* Linking `performedById` to `User(id)` with soft-deactivation (`User.isActive`) guarantees historical auditability—even if an IT Staff member leaves the team and is deactivated, all past Actions Taken retain their foreign-key integrity and actor name. Keeping `followUpNote` nullable at the schema level while enforcing non-empty validation in the application layer when `followUpRequired = true` avoids storing dummy placeholder strings when no follow-up is needed.

### 7.3. Migration, Legacy Backfill & Rollback Strategy (Required by §5.2)
*   **Migration:** Applied via `server/prisma/migrations/20260901044623_lab4_actions_taken/migration.sql`, which executes `CREATE TABLE "ActionTaken"` and adds foreign key constraints `ActionTaken_ticketId_fkey` and `ActionTaken_performedById_fkey`.
*   **Legacy Data Preservation & Backfill:** Because `ActionTaken` is a child table in a `1:N` relationship, all existing `User`, `Ticket`, `Attachment`, `PublicComment`, and `InternalNote` rows from Labs 1–3 remain 100% intact with zero destructive column drops. Legacy Tickets created prior to Lab 4 naturally have `0` rows in `ActionTaken`, which the API returns as `actionsTaken: []` and the UI renders with the empty state `"No actions taken recorded yet."` Dashboard aggregations query `Ticket` and `ActionTaken` counts directly, treating legacy Tickets seamlessly.
*   **Rollback / Recovery Approach:** If a rollback to Lab 3 is required, executing `DROP TABLE IF EXISTS "ActionTaken" CASCADE;` (or `npx prisma migrate resolve --rolled-back 20260901044623_lab4_actions_taken`) cleanly removes the Sprint 4 table without affecting any Labs 1–3 tables or records.

### 7.4. Idempotent Seed Data (`server/prisma/seed.ts`)
*   Uses `prisma.category.upsert`, `prisma.relatedSystem.upsert`, `prisma.user.upsert`, and `prisma.ticket.upsert` (keyed by unique `ticketNo` `TKT-<YEAR>-000001` through `000008`) so running `npm run prisma:seed` repeatedly is 100% safe and non-destructive.
*   Seeds all 8 statuses (`New`, `Open`, `In Progress`, `Waiting for Requester`, `Resolved`, `Closed`, `Reopened`, `Cancelled`), all priorities (`LOW`, `MEDIUM`, `HIGH`), assigned and unassigned Tickets, and Tickets with **0 Actions Taken** (`TKT-000002`, `TKT-000008`), **1 Action Taken** (`TKT-000003`, `TKT-000004`, `TKT-000006`), and **multiple Actions Taken by different IT Staff** (`TKT-000001`, `TKT-000005`).

---

## 8. API Contract Summary
Full request/response schemas and status codes are specified in [`docs/lab-04/api-spec.md`](file:///c:/Users/lm/Desktop/CPE334/lab4/docs/lab-04/api-spec.md).
*   `GET /api/tickets/:id/actions-taken` — Retrieve ordered Actions Taken for a Ticket (`200 OK`, `404 Not Found` for non-owner Requester).
*   `POST /api/tickets/:id/actions-taken` — Create an Action Taken (`201 Created`, `400 Bad Request` on missing description/followUpNote/invalid date/inactive assignee, `403 Forbidden` for Requester).
*   `PUT /api/actions-taken/:actionId` — Update an existing Action Taken (`200 OK`, `400 Bad Request`, `404 Not Found`, `409 Conflict` on stale `expectedUpdatedAt`).
*   `PUT /api/tickets/:id/status` — Update Ticket status and/or IT priority with transition matrix, optional resolution gate, and `409 Conflict` detection.
*   `PUT /api/tickets/:id/owner` — Assign or unassign Ticket owner with active-IT validation and `409 Conflict` detection.
*   `GET /api/dashboard/requester` — Authoritative Requester metrics and 5 recent owned Tickets (`200 OK`).
*   `GET /api/dashboard/staff` — Authoritative IT Staff/Admin metrics, priority breakdown, 5 recent queue Tickets, 5 recent current-user Actions Taken, and Admin user counts (`200 OK`, `403 Forbidden` for Requester).

---

## 9. Acceptance Criteria

*   **AC-01 (Create Action Taken & Auto Actor):** Given a permitted IT Staff user and valid data, when an Action Taken is created on a Ticket, then it is saved under the correct Ticket with the authenticated creator (`performedById`) and returns `201 Created`.
*   **AC-02 (Requester Dashboard Ownership):** Given an authenticated Requester, when dashboard data is retrieved via `GET /api/dashboard/requester`, then only metrics and recent Tickets owned by that Requester are returned.
*   **AC-03 (IT Staff & Admin Dashboard Metrics):** Given an authenticated IT Staff or Administrator user, when `GET /api/dashboard/staff` is called, then accurate unassigned, myAssigned, status, priority, and current-user Actions Taken counts are returned, while Requesters receive `403 Forbidden`.
*   **AC-04 (Follow-Up Note Validation):** Given `followUpRequired = true`, when an IT Staff user creates or updates an Action Taken with an empty `followUpNote`, then the backend rejects the request with `400 Bad Request`.
*   **AC-05 (Multi-Actor Collaboration & Ordering):** Given a Ticket owned by one IT Staff member, when a second IT Staff member records an Action Taken, then both Actions Taken are stored and returned in chronological order (`actionDateTime ASC, id ASC`) and visible to the owning Requester in read-only mode.
*   **AC-06 (Inactive Assignee & Role Protection):** Given a Requester or an inactive IT Staff account, when a request attempts to create an Action Taken as a Requester (`403 Forbidden`) or assign work to an inactive user (`400 Bad Request`), then the backend blocks the operation.
*   **AC-07 (Status Transition Matrix & Advisory Resolution):** Given a Ticket in `In Progress`, when a Requester clicks "Problem Appears Resolved", then `requesterResolvedIndication` becomes `true` while `currentStatus` remains `In Progress`; and when IT Staff attempts an invalid transition (e.g., `In Progress` $\rightarrow$ `Closed` directly) or resolves without required action when gated, the backend returns `400 Bad Request`.
*   **AC-08 (Optimistic Concurrency Control):** Given a Ticket or Action Taken modified by another user, when an update request is submitted with a stale `expectedUpdatedAt` timestamp, then the backend rejects the overwrite with `409 Conflict`.
*   **AC-09 (Full Labs 1–3 Regression):** Given the complete integrated application, when the automated test suites across `lab-01`, `lab-02`, `lab-03`, and `lab-04` are executed, then 100% of API, unit, and E2E tests pass.

---

## 10. Product Definition of Done (DoD)
- [x] Sprint 4 Engineering Contract (`specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`) completed and traceable (`FR` $\leftrightarrow$ `BR` $\leftrightarrow$ `AC` $\leftrightarrow$ `Test ID`).
- [x] Non-destructive Prisma migration (`20260901044623_lab4_actions_taken`) applied; all Labs 1–3 tables and records preserved.
- [x] Idempotent `seed.ts` safely runnable multiple times, populating all 8 statuses, all priorities, and Tickets with 0, 1, and multiple Actions Taken.
- [x] Backend enforces RBAC, transition matrix (including `Reopened`), conditional `followUpNote`, valid dates, active assignees, and `409 Conflict` stale-update protection.
- [x] Requester and IT Staff/Admin Dashboards compute live metrics from PostgreSQL and support keyboard/click drill-down to filtered views.
- [x] Ticket Detail screen supports viewing, creating, and inline editing of Actions Taken under the Zen Green theme.
- [x] All server API tests, client unit tests, and Playwright E2E suites pass with zero console errors.

---

## 11. Assumptions and Decisions
1.  **"Recently Resolved" Window (30 Days):** For the Requester Dashboard `recentlyResolved` metric, "recently" is defined as Tickets in `Resolved` or `Closed` status whose `updatedAt` timestamp falls within the last 30 calendar days (`now - 30d` in UTC).
2.  **Optimistic Concurrency via `expectedUpdatedAt`:** Rather than adding a separate integer `version` column that would require backfilling legacy `Ticket` rows, concurrency control compares the ISO-8601 `updatedAt` timestamp (`expectedUpdatedAt`) already maintained by Prisma's `@updatedAt`. If `expectedUpdatedAt` is supplied and differs from the stored row, the API returns `409 Conflict`.
3.  **Action Taken Edit Permissions:** Any active IT Staff or Administrator can edit an Action Taken item on an accessible Ticket (e.g., to append test results or update follow-up notes during shift handoffs), while `performedById` remains immutably bound to the original creator.
