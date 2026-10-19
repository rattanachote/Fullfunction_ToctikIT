# Lab 4 Test Plan and Traceability Matrix

This document maps every Sprint 4 Functional Requirement (`FR`), Business Rule (`BR`), and Acceptance Criterion (`AC`) to automated unit, API/integration, workflow, authorization, concurrency, regression, and End-to-End (Playwright) tests.

---

## 1. Requirement & Acceptance-Criteria Traceability Matrix

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **API-01** | API | AC-01, FR-01, BR-01, BR-03 | IT Staff (Ticket Owner) creates a valid Action Taken on a Ticket | Created (`201 Created`) under correct Ticket with authenticated `performedBy` | `server/tests/lab-04/actions-taken.api.test.ts` | **Pass** |
| **API-02** | API | AC-05, FR-04, BR-02 | A second IT Staff member records an Action Taken on the same Ticket | Created (`201 Created`) with second staff member as `performedBy` and follow-up note saved | `server/tests/lab-04/actions-taken.api.test.ts` | **Pass** |
| **API-03** | API | AC-04, FR-03, BR-04 | Create Action Taken with `followUpRequired = true` but empty `followUpNote` | Rejected with `400 Bad Request` | `server/tests/lab-04/actions-taken.api.test.ts` | **Pass** |
| **API-04** | API | FR-01, Validation | Create Action Taken with invalid `actionDateTime` string | Rejected with `400 Bad Request` (`Invalid actionDateTime format`) | `server/tests/lab-04/actions-taken.api.test.ts` | **Pass** |
| **API-05** | API | AC-06, BR-05 | Attempt to assign Action Taken to an inactive IT Staff account | Rejected with `400 Bad Request` (`Cannot assign action to an inactive or non-IT user`) | `server/tests/lab-04/actions-taken.api.test.ts` | **Pass** |
| **API-06** | API | AC-06, BR-05 | Requester attempts to create an Action Taken | Rejected with `403 Forbidden` | `server/tests/lab-04/actions-taken.api.test.ts` | **Pass** |
| **API-07** | API | AC-05, FR-03 | Owning Requester retrieves Actions Taken for their Ticket | Returns `200 OK` with all Actions Taken in chronological order (`actionDateTime ASC`) | `server/tests/lab-04/actions-taken.api.test.ts` | **Pass** |
| **API-08** | API | FR-03, Security | Non-owner Requester attempts to view another Requester's Actions Taken | Rejected with `404 Not Found` (safe error preventing enumeration) | `server/tests/lab-04/actions-taken.api.test.ts` | **Pass** |
| **API-09** | API | FR-02, AC-01 | IT Staff updates an existing Action Taken record | Returns `200 OK` with updated `result` and fresh `updatedAt` | `server/tests/lab-04/actions-taken.api.test.ts` | **Pass** |
| **API-10** | API | AC-08, FR-09, BR-09 | Update Action Taken with stale `expectedUpdatedAt` timestamp | Rejected with `409 Conflict` | `server/tests/lab-04/actions-taken.api.test.ts` | **Pass** |
| **API-11** | Workflow | AC-07, FR-05, BR-06 | IT Staff advances Ticket status from `New` to `In Progress` | Returns `200 OK` with `currentStatus = "In Progress"` | `server/tests/lab-04/ticket-workflow.api.test.ts` | **Pass** |
| **API-12** | Workflow | AC-07, FR-05, BR-06 | IT Staff attempts disallowed transition (`In Progress` $\rightarrow$ `Closed` directly) | Rejected with `400 Bad Request` | `server/tests/lab-04/ticket-workflow.api.test.ts` | **Pass** |
| **API-13** | Workflow | AC-07, FR-06, BR-07 | IT Staff attempts to resolve Ticket when `requireActionForResolve = true` and 0 actions exist | Rejected with `400 Bad Request` (Resolution Gate enforced) | `server/tests/lab-04/ticket-workflow.api.test.ts` | **Pass** |
| **API-14** | Workflow | AC-07, FR-06, BR-07 | Requester toggles "Problem Appears Resolved" on `In Progress` Ticket | `requesterResolvedIndication` becomes `true`, status remains `In Progress`, system comment created | `server/tests/lab-04/ticket-workflow.api.test.ts` | **Pass** |
| **API-15** | Concurrency | AC-08, FR-09, BR-09 | IT Staff updates Ticket status with stale `expectedUpdatedAt` | Rejected with `409 Conflict` | `server/tests/lab-04/ticket-workflow.api.test.ts` | **Pass** |
| **API-16** | Workflow | FR-05, BR-06 | Complete lifecycle: `In Progress` $\rightarrow$ `Resolved` $\rightarrow$ `Closed` $\rightarrow$ `Reopened` $\rightarrow$ `In Progress` | All valid transitions succeed with `200 OK` | `server/tests/lab-04/ticket-workflow.api.test.ts` | **Pass** |
| **API-17** | API | AC-02, FR-07, BR-08 | Authenticated Requester retrieves `/api/dashboard/requester` | Returns `200 OK` with accurate owned counts (`totalOpen`, `waitingForRequester`, `recentlyResolved`) and `recentTickets` | `server/tests/lab-04/requester-dashboard.api.test.ts` | **Pass** |
| **API-18** | Security | AC-02, RBAC | Unauthenticated request to `/api/dashboard/requester` | Rejected with `401 Unauthorized` | `server/tests/lab-04/requester-dashboard.api.test.ts` | **Pass** |
| **API-19** | API | AC-03, FR-08, BR-08 | IT Staff retrieves `/api/dashboard/staff` | Returns `200 OK` with `unassigned`, `myAssigned`, `myActionsTakenCount`, `byPriority`, `recentTickets`, `myRecentActions` | `server/tests/lab-04/staff-dashboard.api.test.ts` | **Pass** |
| **API-20** | Security | AC-03, RBAC | Requester attempts to access `/api/dashboard/staff` | Rejected with `403 Forbidden` | `server/tests/lab-04/staff-dashboard.api.test.ts` | **Pass** |
| **UNIT-01** | UI Unit | AC-03, FR-08 | `StaffDashboard` renders operational metric cards, queue activity, and priority widget | Metric cards and priority breakdown render cleanly | `client/tests/lab-04/StaffDashboard.test.tsx` | **Pass** |
| **UNIT-02** | UI Unit | AC-02, FR-07 | `RequesterDashboard` renders owned ticket metrics and Quick Actions | `My Open Tickets` and `Quick Actions` render | `client/tests/lab-04/RequesterDashboard.test.tsx` | **Pass** |
| **UNIT-03** | UI Unit | AC-01, AC-05, FR-01 | `ActionsTaken` renders multi-staff action items and `Record Action` form in Ticket Detail | Both staff actions and form controls render | `client/tests/lab-04/ActionsTaken.test.tsx` | **Pass** |
| **UNIT-04** | UI Unit | AC-07, FR-05 | `TicketWorkflow` renders only permitted transitions for `New` ticket | Shows `New (Current)`, `→ Open`, `→ In Progress`, `→ Cancelled` | `client/tests/lab-04/TicketWorkflow.test.tsx` | **Pass** |
| **REG-01** | Regression | AC-09, FR-11 | Labs 1–3 Server API Regression (Health, Categories, Create/List/Detail Ticket, Attachments, Auth, RBAC, Comments/Notes, Admin Users) | All 12 test files (43 tests) pass | `server/tests/lab-01/*`, `lab-02/*`, `lab-03/*` | **Pass** |
| **REG-02** | Regression | AC-09, FR-11 | Labs 2–3 Client UI Regression (CreateTicket, MyTickets, RequesterTicketDetail, AttachmentSection, Login, ChangePassword, StaffQueue, StaffDetail, UserManagement) | All 9 test files (9 tests) pass | `client/tests/lab-02/*`, `lab-03/*` | **Pass** |
| **E2E-01** | E2E | AC-01, AC-05 | IT Staff logs in, opens Ticket Detail, views and records Actions Taken | Actions Taken card and form visible and interactive | `e2e/lab-04/actions-taken-flow.spec.ts` | **Pass** |
| **E2E-02** | E2E | AC-07, FR-05 | IT Staff opens Ticket Detail and updates Ticket workflow status | Status selector visible and transitions ticket | `e2e/lab-04/ticket-resolution.spec.ts` | **Pass** |
| **E2E-03** | E2E | AC-02, AC-03 | Staff and Requester dashboards load operational metrics and drill down | Dashboard banners, metric cards, and priority panels visible | `e2e/lab-04/dashboards.spec.ts` | **Pass** |

---

## 2. Automated Test Execution Output (from `main`)

### 2.1. Backend Unit, API, Workflow, Concurrency & Regression Suite (16 Suites, 66 Tests)
```text
 RUN  v2.1.9 C:/Users/lm/Desktop/CPE334/lab4/server

 ✓ tests/lab-04/actions-taken.api.test.ts (10 tests)
 ✓ tests/lab-04/ticket-workflow.api.test.ts (8 tests)
 ✓ tests/lab-04/requester-dashboard.api.test.ts (2 tests)
 ✓ tests/lab-04/staff-dashboard.api.test.ts (2 tests)
 ✓ tests/lab-03/comments-notes.api.test.ts (7 tests)
 ✓ tests/lab-03/authorization.api.test.ts (6 tests)
 ✓ tests/lab-03/staff-ticket-detail.api.test.ts (5 tests)
 ✓ tests/lab-03/users-admin.api.test.ts (7 tests)
 ✓ tests/lab-03/staff-queue.api.test.ts (3 tests)
 ✓ tests/lab-03/auth.api.test.ts (6 tests)
 ✓ tests/lab-02/create-ticket.api.test.ts (4 tests)
 ✓ tests/lab-02/attachments.api.test.ts (2 tests)
 ✓ tests/lab-02/ticket-detail.api.test.ts (1 test)
 ✓ tests/lab-02/my-tickets.api.test.ts (1 test)
 ✓ tests/lab-01/categories.test.ts (1 test)
 ✓ tests/lab-01/health.test.ts (1 test)

 Test Files  16 passed (16)
      Tests  66 passed (66)
```

### 2.2. Frontend Component Unit & Regression Suite (13 Suites, 13 Tests)
```text
 RUN  v2.1.9 C:/Users/lm/Desktop/CPE334/lab4/client

 ✓ tests/lab-04/ActionsTaken.test.tsx (1 test)
 ✓ tests/lab-04/RequesterDashboard.test.tsx (1 test)
 ✓ tests/lab-04/StaffDashboard.test.tsx (1 test)
 ✓ tests/lab-04/TicketWorkflow.test.tsx (1 test)
 ✓ tests/lab-03/ChangePassword.test.tsx (1 test)
 ✓ tests/lab-03/Login.test.tsx (1 test)
 ✓ tests/lab-03/StaffTicketDetail.test.tsx (1 test)
 ✓ tests/lab-03/StaffTicketQueue.test.tsx (1 test)
 ✓ tests/lab-03/UserManagement.test.tsx (1 test)
 ✓ tests/lab-02/AttachmentSection.test.tsx (1 test)
 ✓ tests/lab-02/CreateTicket.test.tsx (1 test)
 ✓ tests/lab-02/MyTickets.test.tsx (1 test)
 ✓ tests/lab-02/RequesterTicketDetail.test.tsx (1 test)

 Test Files  13 passed (13)
      Tests  13 passed (13)
```
