# Lab 3 Peer Review Report

**Reviewer Name:** Supachok Deetaweesukh (Tik)
**Reviewer Email:** jedsadaporn.pann@mail.kmutt.ac.th

## 1. Review Summary
This review covers the Sprint 3 deliverables for TokTickIT. The review evaluates authentication, role-based authorization, IT Staff ticket workflow controls, and Administrator user CRUD actions.

## 2. Review Checklist

- [x] **Secure Authentication:** Passwords are hashed in the database using a strong algorithm (PBKDF2) and random salts.
- [x] **Mandatory Password Change:** Users with `mustChangePassword` are blocked from normal screens and forced to change password.
- [x] **RBAC Enforcement:** The backend enforces roles. Requesters cannot access admin/IT staff APIs, and safe errors (404) prevent information leaks.
- [x] **IT Queue & Status Transitions:** IT queue query, assignment controls, and status transitions conform to the transition matrix rules.
- [x] **Visual Distinction:** Public comments and internal notes are clearly distinct in the UI.
- [x] **Admin Safety Controls:** Self-deactivation and deactivating the last active administrator are blocked.

## 3. Reviewer Comments
*   **Code Quality:** The session token generation and helper file `auth.ts` are cleanly decoupled from route controllers.
*   **Security:** Middleware properly queries the database on each request to ensure account activity status is fresh, preventing deactivated accounts from accessing APIs immediately.
*   **UI/UX:** The visual separation between comments and internal notes is clean and prevents private notes leakage.
