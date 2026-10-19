# Lab 3 REST API Specification

This document defines the endpoints, payloads, and response status codes for Sprint 3.

---

## 1. Authentication Endpoints

### POST `/api/auth/login`
*   **Description:** Log in a user.
*   **Request Body:**
```json
{
  "email": "jennifer.a@example.com",
  "password": "password123"
}
```
*   **Responses:**
    *   `200 OK` on success:
```json
{
  "token": "a1b2c3d4...",
  "user": {
    "id": 1,
    "name": "Jennifer Anderson",
    "email": "jennifer.a@example.com",
    "role": "Requester",
    "mustChangePassword": true
  }
}
```
    *   `401 Unauthorized` on invalid credentials.
    *   `403 Forbidden` if the account is deactivated.

### POST `/api/auth/logout`
*   **Description:** Log out the user and invalidate the session.
*   **Request Headers:** `Authorization: Bearer <token>`
*   **Response:** `200 OK`

### GET `/api/auth/me`
*   **Description:** Get profile details of the current logged-in user.
*   **Request Headers:** `Authorization: Bearer <token>`
*   **Response:** `200 OK`

### POST `/api/auth/change-password`
*   **Description:** Force password update when `mustChangePassword` is true.
*   **Request Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
```json
{
  "currentPassword": "password123",
  "newPassword": "NewPassword123!"
}
```
*   **Response:** `200 OK`

---

## 2. Tickets Operations (RBAC Enforced)

### GET `/api/tickets`
*   **Request Headers:** `Authorization: Bearer <token>`
*   **Response:**
    *   `200 OK`
    *   Requesters receive only their owned tickets. IT Staff/Admins receive all tickets in the shared queue.

### PUT `/api/tickets/:id/owner` (IT Staff / Admin Only)
*   **Description:** Claim ownership or reassign ticket.
*   **Request Body:**
```json
{
  "ownerId": 10 // User ID of active IT Staff/Admin, or null to unassign
}
```
*   **Response:** `200 OK`

### PUT `/api/tickets/:id/status` (IT Staff / Admin Only)
*   **Description:** Update status and IT priority.
*   **Request Body:**
```json
{
  "currentStatus": "In Progress",
  "itPriority": "HIGH"
}
```
*   **Response:** `200 OK` (if the transition is permitted by transition matrix; otherwise `400 Bad Request`).

### POST `/api/tickets/:id/indicate-resolved` (Requester Only)
*   **Description:** Requester toggles their resolution indication.
*   **Response:** `200 OK` (automatically creates a system notification comment).

---

## 3. Comments and Notes Endpoints

### GET/POST `/api/tickets/:id/comments`
*   **Request Headers:** `Authorization: Bearer <token>`
*   **POST Request Body:** `{ "content": "Sample public comment" }`
*   **Response:** `200 OK` (fetch) / `201 Created` (create). Visible to Requester, IT Staff, Admin.

### GET/POST `/api/tickets/:id/notes` (IT Staff / Admin Only)
*   **Request Headers:** `Authorization: Bearer <token>`
*   **POST Request Body:** `{ "content": "Sample private internal note" }`
*   **Response:** `200 OK` / `201 Created`. Requesters receive `403 Forbidden` if accessed.

---

## 4. Admin User Management Endpoints (Admin Only)

### GET `/api/admin/users`
*   **Query Parameters:** `search` (keyword name/email), `role` (role filter)
*   **Response:** `200 OK`

### POST `/api/admin/users`
*   **Request Body:**
```json
{
  "name": "Jane Support",
  "email": "jane.s@example.com",
  "role": "ITStaff",
  "isActive": true,
  "initialPassword": "TempPassword123!"
}
```
*   **Response:** `201 Created` (forces `mustChangePassword` to true).

### PUT `/api/admin/users/:id`
*   **Request Body:**
```json
{
  "name": "Jane Support",
  "email": "jane.s@example.com",
  "role": "ITStaff",
  "isActive": false
}
```
*   **Response:** `200 OK` (safety check fails return `400 Bad Request`).

### PUT `/api/admin/users/:id/reset-password`
*   **Request Body:** `{ "newInitialPassword": "NewPassword123!" }`
*   **Response:** `200 OK` (forces `mustChangePassword` to true).
