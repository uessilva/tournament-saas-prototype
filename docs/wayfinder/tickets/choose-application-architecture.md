---
labels:
  - wayfinder:grilling
parent: ../map.md
assignee:
blocked_by: []
status: closed
---

# Choose the prototype application architecture

## Question

Which application stack, authentication approach, database, background-processing model, and project structure should support a locally runnable, seeded prototype while keeping the core workflows simple to build and demonstrate?

## Resolution

Build one feature-oriented pnpm package using Next.js App Router, React, TypeScript, and Tailwind CSS. Use PostgreSQL with Drizzle ORM, checked-in migrations, Docker Compose, and seeded reset scripts. Authenticate with Auth.js email magic links and provide a seeded development shortcut for switching demo accounts.

Use `pdf-lib` for AcroForm generation and direct extraction, QR codes for sheet identity, and a replaceable scan-extraction interface backed by local Tesseract OCR, with representative seeded extraction results for reliable demonstrations. Store original uploads and source-image crops in a git-ignored local directory behind a storage interface, with metadata in PostgreSQL. Run Mailpit locally for email and expose pending-invitation shortcuts in the demo UI.

Process PDF extraction and email delivery through PostgreSQL-backed jobs. A local worker polls and claims jobs with leases, records attempts and errors, supports manual admin retry, and allows synchronous execution as a demo fallback.
