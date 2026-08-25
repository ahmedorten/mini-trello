> **Fetched from azure:** [1](https://dev.azure.com/AhmedOrten/CRM_Customer_Support/_workitems/edit/1)  
> *Fetched 2026-08-25T07:10:11.113Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Project Setup & Bootstrap  
**Type:** User Story  
**Status:** New  
**Labels:** Architecture, AzureDevOps, Bootstrap, NestJS, NodeJS, Prisma, SQLServer, TypeScript, VueJS

### Description

As a development team, we want to initialize the Customer Support CRM project with its backend, frontend, database, and basic architecture so that the project is ready for feature development.

Details:
- Backend: Node.js 24 LTS + TypeScript.
- Frontend: Vue 3 + TypeScript + Vite.
- Database: PostgreSQL.
- Database name: CustomerCRM.
- ORM: Prisma.
- Configure environment variables.
- Configure API structure, validation, logging, Swagger/OpenAPI and global error handling.
- Configure Vue Router, Pinia and API client.
- Create Git/project structure.
- Create initial database migration and seed structure.
- Create API health check.
- Verify Vue -> API -> PostgreSQL connectivity.

Demo:
Run the backend and frontend and demonstrate a successful request from Vue through the API to PostgreSQL.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/init-porject/1/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `init-porject`

## Tracker (metadata only)

- **Tracker type:** `azure`
- **Work item id:** `1` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `User Story`
- **Status:** `New`
- **Assignee:** ``
- **Labels:** `Architecture, AzureDevOps, Bootstrap, NestJS, NodeJS, Prisma, SQLServer, TypeScript, VueJS`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Project Setup & Bootstrap
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a development team, we want to initialize the Customer Support CRM project with its backend, frontend, database, and basic architecture so that the project is ready for feature development.

Details:
- Backend: Node.js 24 LTS + TypeScript.
- Frontend: Vue 3 + TypeScript + Vite.
- Database: PostgreSQL.
- Database name: CustomerCRM.
- ORM: Prisma.
- Configure environment variables.
- Configure API structure, validation, logging, Swagger/OpenAPI and global error handling.
- Configure Vue Router, Pinia and API client.
- Create Git/project structure.
- Create initial database migration and seed structure.
- Create API health check.
- Verify Vue -> API -> PostgreSQL connectivity.

Demo:
Run the backend and frontend and demonstrate a successful request from Vue through the API to PostgreSQL.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- Backend project runs successfully.
- Frontend project runs successfully.
- PostgreSQL CustomerCRM database is connected.
- Initial Prisma migration works.
- Health-check API is available.
- Vue can call the API successfully.
- Basic application layout and navigation are available.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| *(e.g. `attachments/flow.png`)* | *(e.g. UX flow)* |

*(Add rows per file. If none, write "None.")*

---

## Dependencies

- **Blocked by / related ids:** (tracker ids only; optional short note)
- **Depends on code areas or other stories:**

## Extra notes (optional)

- Anything not captured above (e.g. chat context) — keep short.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
