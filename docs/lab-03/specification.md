# Lab 3 Sprint Engineering Specification

## 1. Sprint Goal
Evolve the TokTickIT system to support secure authentication, role-based authorization, IT Staff ticketing workflows, and Administrator user management. By the end of this sprint, the application replaces the temporary requester selector with secure credentials-based login, enforces three roles (Requester, IT Staff, Administrator), allows IT Staff to claim and process tickets, and enables Administrators to manage user accounts.

## 2. Stakeholder Request Interpretation
The system must transition from simulated testing identities to secure logins. The application must:
*   Authenticate users via email and password, requiring initial passwords to be changed on first login.
*   Enforce role-based access control (RBAC) across all API endpoints and UI screens.
*   Allow IT Staff to view a shared ticket queue, claim/assign ownership, set IT priority, update ticket status, post public comments, and record private internal notes.
*   Allow Requesters to toggle a "Problem Appears Resolved" indication on their owned tickets and post public comments.
*   Allow Administrators to manage users (view, create, edit, reset passwords, deactivate accounts) while enforcing safety constraints (prevent self-deactivation and deactivating the last administrator).

## 3. Scope

### Included
*   **Authentication & Sessions:** Password hashing via PBKDF2 with unique salts, login, logout, current user session retrieval, and mandatory first-login password change.
*   **IT Staff Shared Queue:** Search, filtering (category, priority, status), sorting, pagination, and assignment of ownership.
*   **IT Staff Ticket Details:** Claim/reassign ownership, edit IT priority and ticket status, view/post public comments, and write internal notes.
*   **Requester Screen Updates:** Display current user/role, post public comments, toggle resolution indication, and block direct access.
*   **Administrator User Management:** Search/filter user list, CRUD operations (excluding deletion), reset user passwords, and account safety enforcement.
*   **Data Models & Seeding:** Updated Prisma schemas, database migration, and idempotent seeding.

### Excluded
*   Email invitations, password-reset emails, MFA, and social logins.
*   Self-registration and requester-created accounts.
*   Actions Taken by IT Staff (deferred to Lab 4).
*   Dashboards, KPI analytics, department structures, and pagination for the user list.

## 4. Functional Requirements
*   **FR-01 (Authentication):** Users must log in with email and password.
*   **FR-02 (Mandatory Password Change):** Users with the `mustChangePassword` flag set to true must be forced to choose a new password before entering the application.
*   **FR-03 (Role-Based Navigation):** The application shell must only display navigation destinations permitted for the user's role.
*   **FR-04 (IT Staff Shared Queue):** IT Staff must be able to view, search, filter, and page through a shared queue of all tickets.
*   **FR-05 (IT Ticket Claim/Reassign):** IT Staff must be able to claim a ticket (set themselves as owner) or reassign it to another active IT Staff/Admin.
*   **FR-06 (IT Status/Priority Control):** IT Staff must be able to update IT Priority and Ticket Status.
*   **FR-07 (Public Comments):** Both Requesters and IT Staff must be able to post public comments on a ticket.
*   **FR-08 (Internal Notes):** Only IT Staff and Administrators must be able to view and post private internal notes on a ticket.
*   **FR-09 (Requester Resolution Indication):** Requesters must be able to flag their owned tickets as "Problem Appears Resolved".
*   **FR-10 (Admin User CRUD):** Administrators must be able to create new users, edit basic account details, and reset passwords.
*   **FR-11 (Admin Safety Controls):** The system must prevent an Administrator from deactivating their own account or deactivating the last active Administrator.

## 5. Business Rules
*   **BR-01:** Only active users with valid credentials may authenticate.
*   **BR-02:** A user marked as requiring a password change cannot enter the normal application until a new valid password is saved.
*   **BR-03:** Password complexity: Minimum 8 characters, containing at least one uppercase letter, one lowercase letter, one number, and one special character.
*   **BR-04:** The authenticated user identity (not client-supplied ID) determines ownership of requester operations.
*   **BR-05:** Requesters may indicate a problem is resolved, but cannot formally change the ticket status to `Resolved` or `Closed` (only IT Staff/Admin can do this).
*   **BR-06:** Public comments are visible to Requesters, IT Staff, and Administrators. Internal notes are visible ONLY to IT Staff and Administrators.
*   **BR-07:** Ticket status transitions must follow the transition matrix:
    *   `New` -> `Open`, `In Progress`, `Cancelled`
    *   `Open` -> `In Progress`, `Waiting for Requester`, `Resolved`, `Cancelled`
    *   `In Progress` -> `Waiting for Requester`, `Resolved`, `Cancelled`
    *   `Waiting for Requester` -> `In Progress`, `Open`, `Resolved`, `Cancelled`
    *   `Resolved` -> `Closed`, `Reopened`
    *   `Closed` -> `Reopened`
    *   `Cancelled` -> `Reopened`
*   **BR-08:** Administrators cannot deactivate their own accounts or change their own roles to non-administrator.
*   **BR-09:** The system must prevent deactivating or role-changing the last active Administrator.
*   **BR-10:** User accounts must be deactivated instead of deleted. Duplicating email addresses is prohibited.

## 6. UI Specification Summary
*   **Zen Green Design Language:** Reuses color tokens: Primary Green (`#006B3C`), Secondary Green (`#0B7A46`), Pale Green (`#EAF6EF`), Page Background (`#F5F7F6`), Text (`#1C2E24`), Read-Only Ivory (`#FAF9F6`).
*   **Distinct Comments and Notes UI:** Public comments card uses pale green borders; Internal notes card uses warning/orange border (`#D48208`) with a clear lock icon and warning banner to prevent accidental public disclosure.
*   **Responsive Layout:** Single-column layout on mobile, two-column grid on desktop.

## 7. Data Changes
*   `User` model replaces `RequesterUser` and adds `passwordHash`, `role`, `mustChangePassword`, and `isActive` fields.
*   `Ticket` model adds `ownerId` (referencing `User`), `itPriority` (string), and `requesterResolvedIndication` (boolean).
*   `PublicComment` and `InternalNote` models added to track comments.

## 8. API Contract Summary
*   `POST /api/auth/login` -> Authenticates and returns token/user.
*   `POST /api/auth/logout` -> Invalidates session token.
*   `POST /api/auth/change-password` -> Changes password, resets `mustChangePassword`.
*   `PUT /api/tickets/:id/owner` -> Assigns owner (IT/Admin only).
*   `PUT /api/tickets/:id/status` -> Updates status/priority (IT/Admin only).
*   `POST /api/tickets/:id/indicate-resolved` -> Requester resolution toggle.
*   `POST/GET /api/tickets/:id/comments` -> Manages public comments.
*   `POST/GET /api/tickets/:id/notes` -> Manages internal notes (IT/Admin only).
*   `GET/POST/PUT /api/admin/users` -> Admin user CRUD.

## 9. Acceptance Criteria
*   **AC-01 (Mandatory Password Change):** Given a user with `mustChangePassword` true, when they login, they are directed to the change password form, and all other screens are blocked.
*   **AC-02 (IT Queue Access):** Given an authenticated IT Staff user, when they view the ticket queue, they see all tickets in the system.
*   **AC-03 (Admin Safety Control):** Given an active Administrator user, when they attempt to deactivate their own account, the system rejects the request and shows a validation error.
*   **AC-04 (Internal Note Privacy):** Given an authenticated Requester, when they query the internal notes endpoint, they receive a 403 Forbidden error.

## 10. Definition of Done
*   Data migrations and seed scripts implemented.
*   Backend REST APIs secured with role check middlewares.
*   Login, Change Password, IT Queue/Detail, and User Management views fully responsive.
*   All Vitest unit tests and Playwright E2E tests pass.

## 11. Assumptions and Decisions
*   **Session Storage:** Session tokens are stored in memory on the backend and client-side `sessionStorage` for secure session tracking without third-party libraries.
*   **Password Hashing:** PBKDF2 is chosen for password hashing to avoid C++ binary compilation dependencies on Windows local systems.
