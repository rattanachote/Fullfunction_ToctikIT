# Lab 2 UI Specification and Checklist

This specification defines the Zen Green Theme styling and component layout guidelines.

## 1. Color Tokens
*   **Primary Green:** `#006B3C` (Header background, primary buttons, headings, heavy accents).
*   **Secondary Green:** `#0B7A46` (Links, hover states, focused outline, tab active state).
*   **Pale Green:** `#EAF6EF` (Success confirmation panels, selected list elements, badge backgrounds).
*   **Page Background:** `#F5F7F6` (Main page background, quiet layout wrapper).
*   **Surface/Cards:** `#FFFFFF` (White panels, form cards, list container blocks with borders of `#D0D7D3`).
*   **Text:** `#1C2E24` (Charcoal green, used instead of pure black for readability).
*   **Errors:** `#A8221D` (Form validation messages, error border borders).
*   **Warnings:** `#D48208` (Badges or caution flags).

## 2. Layouts and Screens

### A. Development Requester Selection Screen
*   **Card Container:** Centered vertically and horizontally.
*   **Dropdown:** Select input showing all Active Requesters. If no active requesters are available, display a clear "No active requesters found" message.
*   **Information Box:** A pale-green callout box reminding that this is a simulated session login for testing, not an authentic authentication screen.
*   **Submit Button:** Green background with "Continue" label.

### B. Create Ticket Layout
*   **Grid structure:**
    *   *Row 1:* Category (Dropdown), Related System (Dropdown), Priority (Dropdown).
    *   *Row 2:* Summary (Full-width text input, maxLength 100).
    *   *Row 3:* Description (Full-width textarea, maxLength 2000).
    *   *Row 4:* Attachments upload interface.
*   **Submit Button:** Stays disabled when uploading is in progress. Shows spinner.

### C. My Tickets Listing
*   **Filter bar:** Keyword search input + Category dropdown + Priority dropdown + Status dropdown.
*   **Reset filters button:** Restores all selectors to defaults.
*   **Table:** Columns: Ticket No, Created Date, Summary, Category, Priority, Status, Last Updated.
*   **Pagination:** Next/Previous buttons and page number buttons centered below the table.

### D. Ticket Detail View
*   **Layout:** Two-column grid on desktop.
    *   *Left column:* Ticket fields (all read-only, showing warm ivory background `#FAF9F6`).
    *   *Right column:* Attachments List & Management.
*   **Attachments management:**
    *   Lists all files showing original names and sizes.
    *   Clicking a file downloads it.
    *   Clicking "Remove" triggers a confirmation modal asking for the removal reason.
    *   Marking an attachment as removed replaces the download link with a strikethrough name and reason label: `[Removed: Reason]`.
