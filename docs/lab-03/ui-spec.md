# Lab 3 UI Specification and Checklist

This document defines the Zen Green theme specifications, responsive layout guidelines, and the visual checklist for Lab 3.

## 1. Color Palette Tokens
We reuse the Zen Green styling parameters defined in Lab 2 and add orange/yellow accents for internal notes:
*   **Primary Green:** `#006B3C` (Header navbar, primary buttons, major headlines).
*   **Secondary Green:** `#0B7A46` (Links, hover states, focused inputs).
*   **Pale Green:** `#EAF6EF` (Success feedback panel, public comments section card).
*   **Warning Orange:** `#D48208` (Lock icons, internal notes card, reset password button).
*   **Page Background:** `#F5F7F6` (Near-white main background).
*   **Surface:** `#FFFFFF` (Card panels, form elements).
*   **Text:** `#1C2E24` (Charcoal dark green for readability).

---

## 2. Layouts and Roles

### A. Login & Change Password Layouts
*   **Centered Card:** The login form is rendered in a centered card (`.col-md-5`) with a lock header icon.
*   **Mandatory Change Password Form:** Shows warning header and checklist of password rules. Users are blocked from closing this screen or accessing the rest of the application until saved.

### B. Shared Ticket Queue Table (IT Staff / Admin)
*   **Search and Filter bar:** Full-width search box and filters (Category, Status, Priority).
*   **Table Columns:** Ticket No, Created Date, Summary, Category, Requested Priority, IT Priority, Status, Owner, Action.
*   **Row Styling:** Hover states indicate row selection; active detail rows are highlighted in pale green.

### C. Split Details View with Visual Distinctions
*   **Left Column:** Read-only ticket details (Category, System, Priority, status, descriptions).
*   **Right Column:** Attachment list and upload controls.
*   **Comment Sections:**
    *   *Public Comments:* Wrapped in a green border card (`.comments-section`) labeled `💬 Public Comments (Shared communication)`.
    *   *Internal Notes:* Labeled `🔒 Internal Notes (Visible to IT Staff & Admin Only)` and wrapped in an orange border card (`.notes-section`) with an alert box to clearly warn users that it is a private section.

### D. User Management (Admin Dashboard)
*   **Two-Column Split Layout on Desktop:**
    *   *Left:* Searchable user listing (Name, Email, Role, Status, edit actions).
    *   *Right:* Action Drawers (Create User form / Edit User form / Reset Password form) that slide into view when clicked, showing highlighted green or yellow focus borders.

---

## 3. Responsive Web Design Checks
*   **Mobile Screen (< 768px):** Navigation collapses to a single row. Grid columns stack vertically into a single list layout.
*   **Tablet (768px - 991px):** Details forms split to two-column grids. Drawers occupy 50% width on the right.
*   **Desktop (>= 992px):** All side-by-side elements render fully. Tables adjust with ellipsis overflow styling.
