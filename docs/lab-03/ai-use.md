# Lab 3 AI-Assisted Development Report

**Model Used:** Gemini 3.5 Flash

## 1. Key Prompts and Iterations

### Prompt 1: Database Schema Evolvement
> "Help me update the Prisma schema from Lab 2 to support real users, authentication passwords, roles (Requester, ITStaff, Administrator), and ticket ownership. Ensure that existing relations between Requesters and Tickets are preserved by renaming/remapping. Also add PublicComment and InternalNote models."

### Prompt 2: PBKDF2 Password Hashing
> "Write a pure JavaScript/TypeScript helper function for Node.js using the built-in `crypto` module to hash and verify passwords using PBKDF2. I want to avoid compiling binary modules like bcrypt on Windows dev systems."

### Prompt 3: Admin Safety Middleware
> "Write the Express PUT handler for updating user accounts. Implement the validation rules: prevent deactivating own logged-in account, and check if the user is the last active Administrator before deactivating or changing their role."

---

## 2. Developer Reflection on AI Use
*   **Speed:** AI dramatically reduced the time required to build the Express routing boilerplate, draft the test files, and write the boilerplate markdown specifications.
*   **Role Change:** The developer's focus shifted from writing routine code to validating security specifications, checking edge cases (e.g. deactivating the last active Admin, safe error statuses), and confirming that data relations remained intact.
*   **Verification:** Hand-off testing (Vitest and manually navigating views) was crucial to verify that AI-generated routes matched the requested REST API specifications exactly.
