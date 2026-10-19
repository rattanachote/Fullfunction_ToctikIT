# Lab 4 REST API Specification

This document defines the exact REST API contract for Sprint 4, including endpoint paths, HTTP methods, request/response schemas, validation rules, RBAC authorization, safe error behavior, and optimistic concurrency (`409 Conflict`) handling. All approved endpoints from Labs 1, 2, and 3 remain active and unchanged.

---

## 1. Actions Taken Endpoints

### 1.1. `GET /api/tickets/:id/actions-taken`
*   **Description:** Retrieve all Actions Taken line items for a Ticket ordered chronologically (`actionDateTime ASC, id ASC`).
*   **Authentication & Authorization:**
    *   Requires `Authorization: Bearer <token>`.
    *   `ITStaff` and `Administrator` can view Actions Taken on any Ticket.
    *   `Requester` can view Actions Taken **only** on Tickets where `ticket.requesterId === req.user.userId`.
*   **Responses:**
    *   `200 OK`:
```json
[
  {
    "id": 1,
    "ticketId": 1,
    "actionDateTime": "2026-10-19T10:00:00.000Z",
    "actionDescription": "Ran Lenovo Vantage battery health check and calibrated power management firmware.",
    "result": "Wear level reported at 68% capacity; replacement battery required.",
    "performedById": 6,
    "performedBy": {
      "id": 6,
      "name": "Sarah IT Support",
      "email": "sarah.it@example.com",
      "role": "ITStaff"
    },
    "followUpRequired": true,
    "followUpNote": "Order replacement battery pack L19M4P72 and schedule swap with user.",
    "attachmentNotes": "See battery-report.pdf attached on ticket.",
    "createdAt": "2026-10-19T10:00:00.000Z",
    "updatedAt": "2026-10-19T10:00:00.000Z"
  }
]
```
    *   `401 Unauthorized`: Missing or invalid token.
    *   `404 Not Found`: Ticket does not exist **or** belongs to another Requester (safe error preventing enumeration).

---

### 1.2. `POST /api/tickets/:id/actions-taken`
*   **Description:** Record a new Action Taken under a Ticket. Automatically sets `performedById` from the authenticated user and updates the parent Ticket's `updatedAt` timestamp.
*   **Authentication & Authorization:** `ITStaff` and `Administrator` only (`403 Forbidden` for `Requester`).
*   **Request Body:**
```json
{
  "actionDateTime": "2026-10-19T14:30:00.000Z",
  "actionDescription": "Replaced laptop keyboard and verified key matrix",
  "result": "Tested and working cleanly",
  "followUpRequired": true,
  "followUpNote": "Check with user again in 3 days",
  "attachmentNotes": "Hardware inspection photo uploaded"
}
```
*   **Validation Rules:**
    *   `actionDescription`: Required, non-empty string (`400 Bad Request` if missing/blank).
    *   `followUpRequired`: Boolean (defaults to `false`).
    *   `followUpNote`: Required non-empty string whenever `followUpRequired === true` (`400 Bad Request` if missing/blank).
    *   `actionDateTime`: Optional ISO-8601 date string (defaults to `new Date()`; `400 Bad Request` if invalid date format).
    *   `assigneeId` (if supplied): Must reference an active (`isActive === true`) `ITStaff` or `Administrator` user (`400 Bad Request` if inactive or `Requester`).
*   **Responses:**
    *   `201 Created`: Returns created `ActionTaken` object with `performedBy`.
    *   `400 Bad Request`: Validation failure (`{ "error": "..." }`).
    *   `403 Forbidden`: Called by a `Requester`.
    *   `404 Not Found`: Parent Ticket does not exist.

---

### 1.3. `PUT /api/actions-taken/:actionId`
*   **Description:** Update an existing Action Taken record (description, result, follow-up flag/note, attachment notes) with optional optimistic concurrency check.
*   **Authentication & Authorization:** `ITStaff` and `Administrator` only (`403 Forbidden` for `Requester`).
*   **Request Body:**
```json
{
  "actionDescription": "Replaced laptop keyboard and verified key matrix",
  "result": "Confirmed stable after 48h user test",
  "followUpRequired": false,
  "followUpNote": null,
  "attachmentNotes": "See updated photo",
  "expectedUpdatedAt": "2026-10-19T10:00:00.000Z"
}
```
*   **Responses:**
    *   `200 OK`: Returns updated `ActionTaken` object with `performedBy`.
    *   `400 Bad Request`: Empty `actionDescription`, invalid `actionDateTime`, or `followUpRequired = true` without a non-empty `followUpNote`.
    *   `403 Forbidden`: Called by a `Requester`.
    *   `404 Not Found`: Action Taken record does not exist.
    *   `409 Conflict`: `expectedUpdatedAt` does not match the database record's current `updatedAt` timestamp.

---

## 2. Ticket Workflow & Concurrency Endpoints

### 2.1. `PUT /api/tickets/:id/status`
*   **Description:** Transition Ticket `currentStatus` and/or update `itPriority` (`LOW`, `MEDIUM`, `HIGH`).
*   **Authentication & Authorization:** `ITStaff` and `Administrator` only.
*   **Request Body:**
```json
{
  "currentStatus": "Resolved",
  "itPriority": "HIGH",
  "expectedUpdatedAt": "2026-10-19T11:00:00.000Z",
  "requireActionForResolve": true
}
```
*   **Permitted Status Transitions (`ALLOWED_TRANSITIONS`):**
    *   `New` $\rightarrow$ `Open`, `In Progress`, `Cancelled`
    *   `Open` $\rightarrow$ `In Progress`, `Waiting for Requester`, `Resolved`, `Cancelled`
    *   `In Progress` $\rightarrow$ `Waiting for Requester`, `Resolved`, `Cancelled`
    *   `Waiting for Requester` $\rightarrow$ `In Progress`, `Open`, `Resolved`, `Cancelled`
    *   `Resolved` $\rightarrow$ `Closed`, `Reopened`
    *   `Reopened` $\rightarrow$ `Open`, `In Progress`, `Waiting for Requester`, `Resolved`, `Cancelled`
    *   `Closed` $\rightarrow$ `Reopened`
    *   `Cancelled` $\rightarrow$ `Reopened`
*   **Responses:**
    *   `200 OK`: Updated Ticket object.
    *   `400 Bad Request`: Empty payload, disallowed status transition, invalid priority, or resolution gate failure (`requireActionForResolve = true` when `actionsTaken` count is `0`).
    *   `404 Not Found`: Ticket not found.
    *   `409 Conflict`: Stale `expectedUpdatedAt` detected.

### 2.2. `PUT /api/tickets/:id/owner`
*   **Description:** Claim or reassign Ticket primary owner (`ownerId` of an active `ITStaff`/`Administrator`, or `null` to unassign).
*   **Request Body:** `{ "ownerId": 6, "expectedUpdatedAt": "2026-10-19T11:00:00.000Z" }`
*   **Responses:** `200 OK`, `400 Bad Request` (inactive or non-IT user), `404 Not Found`, `409 Conflict` (stale `expectedUpdatedAt`).

---

## 3. Dashboard Contract

### 3.1. `GET /api/dashboard/requester`
*   **Description:** Returns authoritative metrics and the 5 most recently updated Tickets owned by the authenticated Requester.
*   **Calculation & Date Boundaries:**
    *   All queries filter by `requesterId = req.user.userId`.
    *   `totalOpen`: `currentStatus IN ("New", "Open", "In Progress", "Waiting for Requester", "Reopened")`.
    *   `inProgress`: `currentStatus = "In Progress"`.
    *   `waitingForRequester`: `currentStatus = "Waiting for Requester"`.
    *   `recentlyResolved`: `currentStatus IN ("Resolved", "Closed")` AND `updatedAt >= (now - 30 days)` (UTC).
    *   `recentTickets`: Top 5 owned Tickets ordered by `updatedAt DESC`. Returns `[]` and `0` counts when no matching records exist.
*   **Drill-Down Destinations:**
    *   `totalOpen` $\rightarrow$ `My Tickets` (`status=All Statuses`)
    *   `inProgress` $\rightarrow$ `My Tickets` (`status=In Progress`)
    *   `waitingForRequester` $\rightarrow$ `My Tickets` (`status=Waiting for Requester`)
    *   `recentlyResolved` $\rightarrow$ `My Tickets` (`status=Resolved`)
    *   `recentTickets[i]` $\rightarrow$ `Ticket Detail` (`id = recentTickets[i].id`)
*   **Response (`200 OK`):**
```json
{
  "metrics": {
    "totalOpen": 2,
    "inProgress": 1,
    "waitingForRequester": 1,
    "recentlyResolved": 1
  },
  "recentTickets": [
    {
      "id": 1,
      "ticketNo": "TKT-2026-000001",
      "summary": "Laptop battery drains quickly",
      "currentStatus": "In Progress",
      "requestedPriority": "HIGH",
      "itPriority": "HIGH",
      "updatedAt": "2026-10-19T12:00:00.000Z",
      "category": { "id": 2, "name": "Hardware" },
      "owner": { "id": 6, "name": "Sarah IT Support", "email": "sarah.it@example.com" }
    }
  ]
}
```

### 3.2. `GET /api/dashboard/staff`
*   **Description:** Returns operational service-desk metrics, priority breakdown, 5 most recently updated queue Tickets, 5 most recent Actions Taken by the current user, and (for Administrators) user account counts.
*   **Authentication & Authorization:** `ITStaff` and `Administrator` only (`403 Forbidden` for `Requester`).
*   **Calculation & Drill-Down Rules:**
    *   `unassigned`: `ownerId IS NULL` and `currentStatus NOT IN ("Closed", "Cancelled")` $\rightarrow$ drills down to `Ticket Queue (owner=unassigned)`.
    *   `myAssigned`: `ownerId = req.user.userId` and `currentStatus NOT IN ("Closed", "Cancelled")` $\rightarrow$ drills down to `Ticket Queue (owner=me)`.
    *   `myActionsTakenCount`: Total `ActionTaken` rows where `performedById = req.user.userId`.
    *   `new`, `open`, `inProgress`, `waitingForRequester`, `resolved`, `closed`: Exact counts by `currentStatus` $\rightarrow$ drills down to `Ticket Queue (status=<Status>)`.
    *   `byPriority.{high,medium,low}`: Active Tickets (`NOT IN ("Closed", "Cancelled")`) by `itPriority` $\rightarrow$ drills down to `Ticket Queue (priority=<Priority>)`.
    *   `userCounts` (Admin only): `{ totalUsers, activeUsers, inactiveUsers }`.
*   **Response (`200 OK`):**
```json
{
  "metrics": {
    "unassigned": 1,
    "myAssigned": 2,
    "myActionsTakenCount": 2,
    "new": 1,
    "open": 1,
    "inProgress": 1,
    "waitingForRequester": 1,
    "resolved": 1,
    "closed": 1,
    "byPriority": {
      "high": 2,
      "medium": 2,
      "low": 1
    },
    "userCounts": {
      "totalUsers": 10,
      "activeUsers": 8,
      "inactiveUsers": 2
    }
  },
  "recentTickets": [...],
  "myRecentActions": [...]
}
```
