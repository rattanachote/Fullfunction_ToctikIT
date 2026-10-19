# Lab 2 REST API Specification

This document details the REST API endpoints and payloads for Sprint 2.

## 1. Reference Data Endpoints

### GET `/api/requesters`
*   **Description:** Retrieve active Development Requesters.
*   **Response:** `200 OK`
```json
[
  { "id": 1, "name": "Jennifer Anderson", "email": "jennifer@example.com" }
]
```

### GET `/api/categories`
*   **Description:** Retrieve all ticket categories.
*   **Response:** `200 OK`
```json
[
  { "id": 1, "name": "Account and Access" }
]
```

### GET `/api/systems`
*   **Description:** Retrieve active Related Systems.
*   **Response:** `200 OK`
```json
[
  { "id": 1, "name": "Corporate Laptop" }
]
```

---

## 2. Tickets Endpoints

### POST `/api/tickets`
*   **Request Headers:** `X-Requester-Id: <id>`
*   **Request Body:**
```json
{
  "categoryId": 1,
  "relatedSystem": "Corporate Laptop",
  "requestedPriority": "MEDIUM",
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery is draining much faster than usual."
}
```
*   **Response:** `201 Created`
```json
{
  "id": 12,
  "ticketNo": "TKT-2026-000012",
  "requesterId": 1,
  "categoryId": 1,
  "relatedSystem": "Corporate Laptop",
  "requestedPriority": "MEDIUM",
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery is draining much faster than usual.",
  "currentStatus": "New",
  "createdAt": "2026-08-11T12:00:00Z"
}
```

### GET `/api/tickets`
*   **Request Headers:** `X-Requester-Id: <id>`
*   **Query Parameters:**
    *   `search`: string (filters by ticketNo or summary)
    *   `category`: string (filters by Category Name)
    *   `priority`: string (filters by Requested Priority)
    *   `status`: string (filters by Current Status)
    *   `sort`: string (e.g. `createdAt_desc`, `priority_asc`)
    *   `page`: number (default: 1)
    *   `limit`: number (default: 10)
*   **Response:** `200 OK`
```json
{
  "tickets": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalCount": 42,
    "totalPages": 5
  }
}
```

### GET `/api/tickets/:id`
*   **Request Headers:** `X-Requester-Id: <id>`
*   **Response:**
    *   `200 OK` if requester matches `requesterId` of the ticket.
    *   `403 Forbidden` if requester ID does not match.

---

## 3. Attachments Endpoints

### POST `/api/tickets/:id/attachments`
*   **Request Headers:** `X-Requester-Id: <id>`
*   **Request Body:** Multipart Form Data (file field)
*   **Response:**
    *   `201 Created` with attachment metadata.
    *   `400 Bad Request` if file > 5MB, format invalid, or > 5 active attachments.

### GET `/api/attachments/:id`
*   **Request Headers:** `X-Requester-Id: <id>`
*   **Response:**
    *   `200 OK` (binary stream of the file)
    *   `403 Forbidden` if requester doesn't own the ticket.
    *   `404 Not Found` if file was soft-removed.

### DELETE `/api/attachments/:id`
*   **Request Headers:** `X-Requester-Id: <id>`
*   **Request Body:**
```json
{
  "reason": "Accidental upload of sensitive information"
}
```
*   **Response:** `200 OK` (attachment marked as soft-removed).
