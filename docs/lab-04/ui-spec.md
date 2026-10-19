# Lab 4 UI Specification, Responsive Design, and Accessibility Checklist

This document defines the Zen Green design language extensions, dashboard card structures, Actions Taken work-tracker modes, responsive breakpoints, and accessibility verification for Sprint 4.

---

## 1. Zen Green Color Palette & Visual Hierarchy

| Token Name | Hex Code | Usage in TokTickIT |
| :--- | :--- | :--- |
| **Primary Green** | `#006B3C` | Top navigation bar (`.navbar-green`), primary CTA buttons (`.btn-green-primary`), section titles, active metric numbers |
| **Secondary Green** | `#0B7A46` | Interactive hover states, drill-down links (`View all →`), active pagination badges |
| **Pale Green** | `#EAF6EF` | Public Comments container border/header (`.comments-section`), Requester resolution status banner, filter pills |
| **Action Blue** | `#104F8C` / `#EBF3FB` | **Actions Taken (Work Tracker)** container border and header (`.actions-section`, `.actions-header`) |
| **Warning Orange** | `#D48208` / `#FDF3E7` | **Internal Notes (Private)** container border and header (`.notes-section`, `.notes-header`), Follow-Up Required badges |
| **Read-Only Surface** | `#FAF9F6` | Read-only Ticket description box (`.bg-read-only`) with `#D0D7D3` border |
| **Page Canvas** | `#F5F7F6` | Main application background with dark charcoal green `#1C2E24` typography |

---

## 2. Screen Layouts, Modes, and Feedback States

### 2.1. Global Navigation Bar
*   Displays brand logo (`TokTickIT` — clicks return to `Dashboard`) and role-appropriate destinations with active-page button styling (`btn-light text-green-primary` when active, `btn-outline-light` when inactive):
    *   **Requester:** `Dashboard` | `My Tickets` | `Create Ticket`
    *   **IT Staff:** `Dashboard` | `Ticket Queue`
    *   **Administrator:** `Dashboard` | `User Management` | `Ticket Queue`
*   Displays current authenticated user's name, role badge, and `Logout` button.

### 2.2. IT Staff & Administrator Dashboard (`screen === "dashboard"`)
*   **6 Operational Metric Cards (`.col-6 .col-md-2`):** `New`, `Open`, `In Progress`, `Waiting`, `My Assigned`, and `Unassigned`. Each card has `role="button"`, `tabIndex={0}`, hover lift animation, and click/keyboard handler that applies the corresponding status or owner filter (`owner=me` or `owner=unassigned`) and navigates to `Ticket Queue`.
*   **Recent Queue Activity List (`.col-md-8`):** Shows top 5 recently updated Tickets with Ticket No badge, Status badge, IT Priority badge, Summary, Requester name, Owner name, and `Details` button.
*   **My Recent Actions Taken Panel (`.col-md-8`):** Lists the current IT Staff/Admin user's 5 most recent Actions Taken with total recorded count badge, Ticket No, description, result, timestamp, and `Open Ticket` drill-down button.
*   **Active Tickets by Priority Widget (`.col-md-4`):** Shows `HIGH`, `MEDIUM`, and `LOW` counts with click drill-down into priority-filtered `Ticket Queue`.
*   **System User Accounts Widget (Administrator Only):** Concise summary of `Total Accounts`, `Active Users`, and `Inactive Users`.
*   **Feedback States:** Spinner during `dashboardLoading`, `.alert-danger` banner on `dashboardError`, and clean empty-state messages (`"No tickets found."`, `"You have not recorded any Actions Taken yet."`) when counts are zero.

### 2.3. Requester Dashboard (`screen === "dashboard"`)
*   **4 Summary Metric Cards (`.col-6 .col-md-3`):**
    1.  `My Open Tickets` (`totalOpen`) $\rightarrow$ drills down to `My Tickets (All Statuses)`
    2.  `In Progress` (`inProgress`) $\rightarrow$ drills down to `My Tickets (In Progress)`
    3.  `Waiting on You` (`waitingForRequester`) $\rightarrow$ drills down to `My Tickets (Waiting for Requester)`
    4.  `Resolved / Closed (30d)` (`recentlyResolved`) $\rightarrow$ drills down to `My Tickets (Resolved)`
*   **My Recent Tickets (`.col-md-8`):** Shows top 5 owned Tickets ordered by `updatedAt DESC`, highlighting tickets in `Waiting for Requester` with an `Attention Required` badge and a `Details` button.
*   **Quick Actions (`.col-md-4`):** Primary `Create Ticket` button and secondary `View My Tickets` button.

### 2.4. Actions Taken & Workflow Controls on Ticket Detail (`screen === "detail"`)
*   **IT Staff Operations & Workflow Controls Card:**
    *   `Assignee / Owner` dropdown (lists active IT Staff & Administrators + `Unassigned`).
    *   `Update Status` dropdown: Dynamically shows **only** `currentStatus (Current)` and permitted next statuses from `ALLOWED_STATUS_TRANSITIONS`.
    *   `Set IT Priority` dropdown (`LOW`, `MEDIUM`, `HIGH`).
    *   All three selectors disable during in-flight requests (`disabled={workflowUpdating}`) and display a dismissible `.alert-success` or `.alert-danger` feedback banner (`workflowFeedback`), including `409 Conflict` warnings if another user modified the ticket.
*   **Actions Taken (Work Tracker) Card (`.actions-section`):**
    *   **View Mode (All Roles):** Lists every Action Taken chronologically with performer name, role badge, timestamp, description, italic `Result`, yellow `Follow-Up: <note>` badge when `followUpRequired = true`, and paperclip `attachmentNotes`.
    *   **Create Mode (IT Staff & Admin Only):** Footer form with `actionDescription` (required textarea), `result`, `attachmentNotes`, `Follow-up Required?` checkbox, conditional `followUpNote` input (required when checked), validation error alert, and `Record Action` submit button (`disabled={actionSubmitting}`).
    *   **Inline Edit Mode (IT Staff & Admin Only):** Clicking `Edit` on any Action Taken row opens an inline edit form pre-populated with that action's fields, validating `followUpNote` when `followUpRequired` is checked, sending `expectedUpdatedAt` for concurrency protection, and providing `Save Action` / `Cancel` buttons.

---

## 3. Responsive, Visual & Accessibility Verification Checklist

- [x] **Design Consistency:** Zen Green palette (`#006B3C`, `#0B7A46`, `#EAF6EF`) applied consistently across Login, Change Password, Dashboards, My Tickets, Ticket Queue, Create Ticket, Ticket Detail, and User Management.
- [x] **Visual Distinction of Ticket Sections:** Public Comments (Pale Green `#EAF6EF`), Internal Notes (Warning Orange `#FDF3E7` with lock icon, hidden from Requesters), and Actions Taken (Action Blue `#EBF3FB` with clipboard icon) are visually unmistakable.
- [x] **Editable vs. Read-Only Fields:** Read-only Ticket description and metadata use `#FAF9F6` (`.bg-read-only`), while editable form inputs use white `#FFFFFF` surfaces with semantic `<label>` elements.
- [x] **Validation Placement & Data Preservation:** Inline `.alert-danger` messages appear directly above the relevant form without clearing user-entered text on recoverable errors.
- [x] **Keyboard Focus & Operation:** All metric cards (`role="button" tabIndex={0}`), form controls (`htmlFor`/`id`, `aria-label`), and buttons support keyboard navigation with visible focus rings.
- [x] **Desktop (`>= 992px`), Tablet (`768px–991px`), and Mobile (`< 768px`) Responsiveness:**
    - Desktop renders 6-column staff metric cards and side-by-side 2-column detail panels.
    - Tablet wraps metric cards cleanly into 2–3 rows and preserves split panels.
    - Mobile (`375px` width) collapses metric cards into 2-per-row (`col-6`), stacks detail cards vertically, and wraps tables in `.table-responsive` with zero horizontal page overflow, zero clipped text, and zero overlapping controls.
