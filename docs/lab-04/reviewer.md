# Lab 4 Peer Review Report

*   **Reviewer Identity:** Supachok Deetaweesukh (Tik) — `@Chxtamos` / Teaching Assistant Reviewer (`jedsadaporn.pann@mail.kmutt.ac.th`)
*   **Author / Submitter:** TokTickIT Engineering Team (`@ta`)
*   **Target Integration Branch:** `lab4-staging` $\rightarrow$ `main`

---

## 1. Pull Request Review Log (Feature Branches $\rightarrow$ `lab4-staging` $\rightarrow$ `main`)

| PR # | Branch Flow | Scope | Reviewer Comment | Author Response / Fix | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PR #37** | `feature/contract-lab4` $\rightarrow$ `lab4-staging` | `specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md` | *"Please add explicit outbound transitions from `Reopened` in `BR-06` and justify at least two database-design decisions in Section 7."* | Added `Reopened -> Open, In Progress, Waiting for Requester, Resolved, Cancelled` and documented justifications for `actionDateTime` vs `updatedAt` and non-cascading `performedById` FK. | **Approved & Merged** |
| **PR #39** | `feature/actions-taken-api` $\rightarrow$ `lab4-staging` | Prisma migration, `seed.ts`, `GET/POST/PUT` Actions Taken APIs & tests | *"Ensure `POST /actions-taken` validates invalid `actionDateTime` strings with `400` instead of `500`, and replace destructive `deleteMany()` in `seed.ts` with idempotent `upsert()`."* | Added `isNaN(parsedDate.getTime())` check returning `400 Bad Request`, inactive assignee check, and converted `seed.ts` to use `upsert()` across all 8 statuses. | **Approved & Merged** |
| **PR #41** | `feature/ticket-workflow-gate` $\rightarrow$ `lab4-staging` | Status transition matrix, resolution gate, `409 Conflict` concurrency | *"When `PUT /tickets/:id/status` or `PUT /actions-taken/:actionId` receives a stale `expectedUpdatedAt`, verify it returns `409 Conflict` and restrict the UI status dropdown to permitted transitions."* | Added `expectedUpdatedAt` comparison returning `409 Conflict` and updated `App.tsx` status `<select>` to render only `ALLOWED_STATUS_TRANSITIONS[currentStatus]`. | **Approved & Merged** |
| **PR #43** | `feature/role-dashboards-ui` $\rightarrow$ `lab4-staging` | Requester & Staff Dashboard APIs, drill-down cards, Actions Taken inline edit | *"Include current-user Actions Taken (`myRecentActions`) on the Staff Dashboard and ensure owner drill-down (`My Assigned`, `Unassigned`) filters the queue accurately."* | Added `myActionsTakenCount` and `myRecentActions` to `GET /api/dashboard/staff` and wired `owner=me` / `owner=unassigned` drill-down filters in `App.tsx`. | **Approved & Merged** |
| **PR #45** | `lab4-staging` $\rightarrow$ `main` | Final regression, responsive screenshots, README & release verification | *"All 66 backend tests, 13 frontend unit tests, and 3 E2E specs pass. Desktop, tablet, and mobile layouts verified with zero overflow. Ready for release."* | Merged `lab4-staging` into `main` and tagged final release. | **Approved & Merged** |

---

## 2. Final Verification Checklist

- [x] **Engineering Contract First:** `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` were reviewed and approved in PR #37 prior to feature implementation PRs (#39–#43).
- [x] **Backend Authorization & Validation:** Every write operation (`POST/PUT` Actions Taken, `PUT` Owner/Status, `POST` Indicate Resolved) enforces role and ownership checks on the server.
- [x] **Optimistic Concurrency & Safe Failures:** Stale updates return `409 Conflict`; unauthorized Requester access to other users' Tickets/Actions Taken returns `404 Not Found`.
- [x] **Full Labs 1–4 Regression:** All 16 backend test suites (66 tests) and 13 frontend unit test suites (13 tests) pass on `main`.
