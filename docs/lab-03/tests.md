# Lab 3 Test Plan and Traceability Matrix

This document maps the acceptance criteria (AC) to specific automated test cases and traces their execution results.

## 1. Traceability Matrix

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **API-01** | API | AC-01 (Mandatory Password Change) | Login succeeds; user with mustChangePassword = true gets token and flag | Authenticated response; flag mustChangePassword = true | `server/tests/lab-03/auth.api.test.ts` | Pass |
| **API-02** | API | AC-01 / BR-02 | User with mustChangePassword = true attempts accessing normal endpoints | Blocked with 403 Forbidden | `server/tests/lab-03/auth.api.test.ts` | Pass |
| **API-03** | API | BR-01 | Login with invalid credentials | Rejected with 401 Unauthorized | `server/tests/lab-03/auth.api.test.ts` | Pass |
| **API-04** | API | AC-02 (IT Queue Access) | IT Staff retrieves all tickets in queue | Returns list of all tickets | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| **API-05** | API | BR-04 (Safe errors) | Requester attempts to view another user's ticket | Returns 404 Not Found to prevent leaking | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| **API-06** | API | BR-06 (Internal Note Privacy) | Requester attempts to read internal notes | Rejected with 403 Forbidden | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| **API-07** | API | BR-07 (Transitions) | IT Staff updates status with valid transition | Updates status, returns 200 OK | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| **API-08** | API | BR-07 (Transitions) | IT Staff updates status with invalid transition | Rejected with 400 Bad Request | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| **API-09** | API | BR-08 (Safety Control) | Administrator deactivates their own account | Rejected with 400 Bad Request | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| **API-10** | API | BR-10 (Admin CRUD) | Administrator creates user with duplicate email | Rejected with 400 Bad Request | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| **UNIT-01** | Unit | FR-01 / UI | Login screen inputs and submission triggers login | Form fields update; login API called | `client/tests/lab-03/Login.test.tsx` | Pass |
| **UNIT-02** | Unit | FR-02 / UI | User needing password change sees Change Password form | Renders fields; other views blocked | `client/tests/lab-03/ChangePassword.test.tsx` | Pass |
| **UNIT-03** | Unit | FR-04 / UI | Shared queue displays when logged in as IT Staff | Queue headers and list items show | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass |
| **UNIT-04** | Unit | FR-08 / UI | Control panel and notes render in details for IT Staff | Operations panel and notes section show | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass |
| **UNIT-05** | Unit | FR-10 / UI | User management screen displays user accounts list | Table renders; admin actions show | `client/tests/lab-03/UserManagement.test.tsx` | Pass |
| **E2E-01** | E2E | AC-01 / BR-02 | Login forces password change for new users | Forced redirect to Change Password | `e2e/lab-03/authentication.spec.ts` | Pass |
| **E2E-02** | E2E | AC-02 / UI | IT staff view ticket queue and inspect detail sections | Shared queue and details visible | `e2e/lab-03/staff-ticket-flow.spec.ts` | Pass |
| **E2E-03** | E2E | FR-10 / UI | Admin user accesses user management screen | Dashboard list and create user visible | `e2e/lab-03/user-administration.spec.ts` | Pass |

## 2. Test Execution Instructions
To execute the automated test suites, use the following commands:

```bash
# Execute backend unit and integration API tests
cd server && npm test

# Execute frontend component unit tests
cd client && npm test

# Execute end-to-end user flow tests using Playwright
npx playwright test
```
