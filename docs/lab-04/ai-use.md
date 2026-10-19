# Lab 4 AI-Assisted Development Report

**Models Used:**
*   **AI Specification Agent:** Claude Sonnet / Gemini Pro (Engineering Contract, Status-Transition Matrix, Database Justification, and Test Plan Traceability)
*   **AI Coding Agent:** Gemini Flash / Pro (Prisma Schema Migration, Express REST Controllers, Optimistic Concurrency, React Zen Green UI, and Vitest/Playwright Suites)

---

## 1. Selected Key Prompts (8 Prompts Across Spec DD, TDD, and Implementation)

### Prompt 1 — Sprint 4 Engineering Contract & Business Rules (Specification Agent)
> "Act as the AI Specification Agent for CPE334 Lab 4 (TokTickIT). Transform the Lab 4 handout into `docs/lab-04/specification.md` with sections 1–11. Define numbered Functional Requirements (FR-01 to FR-11), Business Rules (BR-01 to BR-09) covering parent-child Actions Taken, multi-staff collaboration where one Ticket Owner coordinates while any active IT Staff records actions, the 8-status transition matrix including `Reopened`, authoritative dashboard formulas, and two justified database-design decisions."

### Prompt 2 — REST API Contract & Conflict Handling (Specification Agent)
> "Draft `docs/lab-04/api-spec.md` defining `GET/POST /api/tickets/:id/actions-taken`, `PUT /api/actions-taken/:actionId`, `GET /api/dashboard/requester`, and `GET /api/dashboard/staff`. Include exact JSON shapes, 30-day UTC window for `recentlyResolved`, drill-down query parameters, safe `404` ownership errors for Requesters, and `409 Conflict` detection using `expectedUpdatedAt`."

### Prompt 3 — Test-Driven Traceability Matrix (Test DD Agent)
> "Create `docs/lab-04/tests.md` mapping AC-01 through AC-09 to automated API, workflow, concurrency, UI component, regression, and Playwright E2E tests. Ensure every business rule—especially conditional `followUpNote`, inactive-assignee rejection, multi-staff Actions Taken, resolution gate, and stale-update `409 Conflict`—has a dedicated test case."

### Prompt 4 — Prisma Schema & Non-Destructive Migration (Coding Agent)
> "Evolve `server/prisma/schema.prisma` to add the `ActionTaken` model linked to `Ticket` (`ticketId`) and `User` (`performedById`) with `actionDateTime`, `actionDescription`, `result`, `followUpRequired`, `followUpNote`, `attachmentNotes`, `createdAt`, and `updatedAt`. Generate a non-destructive Prisma migration that preserves all existing Users, Tickets, Attachments, Public Comments, and Internal Notes."

### Prompt 5 — Idempotent Database Seed (Coding Agent)
> "Update `server/prisma/seed.ts` so it is 100% idempotent using `upsert()` keyed by unique `email` and `ticketNo` instead of wiping all tables. Seed realistic Tickets across all 8 statuses (`New`, `Open`, `In Progress`, `Waiting for Requester`, `Resolved`, `Closed`, `Reopened`, `Cancelled`), all priorities, assigned and unassigned ownership, and Tickets with 0, 1, and multiple Actions Taken recorded by different IT Staff members."

### Prompt 6 — Actions Taken & Workflow Backend Hardening (Coding Agent)
> "Implement the Express handlers in `server/src/app.ts` for Actions Taken (`GET`, `POST`, `PUT`) and Ticket workflow (`PUT /status`, `PUT /owner`). Auto-populate `performedById` from `req.user.userId`, validate `actionDateTime` and conditional `followUpNote`, reject inactive assignees with `400`, enforce `ALLOWED_TRANSITIONS` (including `Reopened`), enforce the resolution gate when requested, and return `409 Conflict` when `expectedUpdatedAt` is stale."

### Prompt 7 — Authoritative Role Dashboards (Coding Agent)
> "Implement `GET /api/dashboard/requester` and `GET /api/dashboard/staff` using Prisma `count` and `findMany` queries. Include `myActionsTakenCount`, `myRecentActions` for the logged-in IT Staff member, active priority breakdowns, and concise `userCounts` for Administrators. Connect the React Dashboard cards in `client/src/App.tsx` to drill down into filtered ticket lists."

### Prompt 8 — Zen Green Actions Taken Create/Edit UI & Responsive Polish (Coding Agent)
> "Extend `client/src/App.tsx` Ticket Detail view with the `.actions-section` work tracker in Action Blue (`#EBF3FB`), supporting chronological list display, inline Edit mode (`PUT /api/actions-taken/:actionId`), and Record Action footer form. Restrict the status dropdown to permitted transitions from the current state, add duplicate-click button disables, and verify mobile/tablet/desktop responsive layouts."

---

## 2. My Reflection on Specification-Agent and Coding-Agent Use

*   **Specification Agent Before Coding Agent:** Using the AI Specification Agent first to formalize the status-transition matrix (`BR-06`), the distinction between Ticket Owner (`ownerId`) and Action Performer (`performedById`, `BR-02`), and the optimistic concurrency strategy (`expectedUpdatedAt`, `BR-09`) eliminated ambiguity before writing route code. When the specification explicitly stated how `followUpRequired` and stale timestamps behave, the Coding Agent generated accurate Express validation on the first pass.
*   **Where Human Engineering Judgment Was Essential:** The Coding Agent initially wrote a destructive seed (`deleteMany()`) and allowed the UI status dropdown to show all 8 statuses regardless of current state. Through Spec DD review and TDD verification, we refactored `seed.ts` to use idempotent `upsert()` calls, added `Reopened` outbound transitions, restricted the UI dropdown to `ALLOWED_STATUS_TRANSITIONS`, and added inline Action Taken editing and `409 Conflict` handling.
*   **Traceable Confidence via TDD:** Maintaining all 16 server test suites (66 tests) and 13 client test suites in sequential execution gave immediate feedback that adding Lab 4 Dashboards and Actions Taken did not break any Lab 1–3 authentication, attachment, or RBAC behavior.
