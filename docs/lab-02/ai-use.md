# Lab 2 — AI Use and Reflection

**LLM/agent used:** Google Antigravity (Gemini)

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Help me define the Prisma schema for Ticket, Attachment, RelatedSystem, and RequesterUser. | Integrated models into `schema.prisma` mapping active/inactive requesters and soft-removal properties. |
| 2 | Write an Express route for file upload validation (JPG/PNG/WEBP/PDF, <=5MB, max 5 active). | Used in the attachment upload endpoint to enforce BR-04. |
| 3 | How can I implement ticket-list query search and pagination in Prisma? | Implemented paginated tickets retrieval with filters and keywords in `GET /api/tickets`. |
| 4 | Explain how to write a soft-remove endpoint and restrict access by requesterId. | Configured `DELETE /api/attachments/:id` to check ownership and block downloads for removed files. |
| 5 | Design React form validation for ticket summary and description. | Added character limits and state checking to disable the submit button on input validation failures. |
| 6 | Guide me on writing E2E tests for the simulated login and ticket creation flow in Playwright. | Implemented test scripts in `e2e/lab-02/` to cover simulated selection login and form submission. |

## Reflection
Leveraging the AI agent allowed rapid prototyping of the Express REST API endpoints and complex pagination queries in Prisma. Designing the soft-removal process was simplified by discussing the database schema constraints first. I had to pay close attention to the fact that SQLite doesn't natively support Prisma enums in the same way PostgreSQL does during local testing, choosing to use plain strings with codebase constraints to maintain database-agnostic code.
