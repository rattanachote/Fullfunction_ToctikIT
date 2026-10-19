# Lab 2 Test Plan and Results

## 1. Test Strategy
Testing follows a Test-Driven Development (TDD) approach, focusing on unit tests, API tests, UI component tests, and End-to-End (E2E) tests.

*   **API Tests:** Verify correct database interactions, input validation, and business rule enforcement (including ownership verification and soft-removal logic).
*   **UI Tests:** Validate state changes (loading, success, error, empty) and responsive design adherence for Zen Green styles.
*   **E2E Tests:** Execute full user flows starting from Requester Selection to ticket creation and list verification.

## 2. Planned Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| API-01 | API | AC-01 | Create valid ticket | 201; one saved Ticket; number returned | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-02 | API | AC-03 | Retrieve unauthorized ticket details | 403 Forbidden; ownership enforced | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |
| API-03 | API | BR-04 | Upload oversized file (> 5MB) | 400 Bad Request; file rejected | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-04 | API | BR-05 | Retrieve soft-removed attachment | 404/403 Error; retrieval blocked | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| UI-01 | UI | AC-02 | Redirect to selector when no requester selected | Page shows selection screen | `client/src/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-02 | UI | BR-04 | Render error when upload limit exceeded | Validation message appears near attachment field | `client/src/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| E2E-01 | E2E | AC-01, AC-05 | Full requester ticket creation and attachment flow | Confirm page displays Ticket Number and attachment is listed | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |

## 3. Acceptance-Criterion Traceability

*   **AC-01 (Creation Success):** Mapped to `API-01` and `E2E-01`.
*   **AC-02 (Identity Redirect):** Mapped to `UI-01`.
*   **AC-03 (Ownership Separation):** Mapped to `API-02`.
*   **AC-04 (File Validation):** Mapped to `API-03`.
*   **AC-05 (Soft-removal Integrity):** Mapped to `API-04` and `E2E-01`.

## 4. Responsive and Visual Checklist
- [ ] No clipped labels on desktop, tablet, or mobile.
- [ ] Fields stack vertically on viewports under 768px.
- [ ] Buttons use minimum touch target of 44x44px on mobile viewports.
- [ ] Badges for Priority (Low, Medium, High) have distinctive, accessible background colors.

## 5. Test Commands
*   **Backend Tests:** `cd server && npm test`
*   **Frontend Tests:** `cd client && npm test`
*   **E2E Tests:** `npx playwright test`
