# Backlog Epics - Reusable Enterprise Template

This document compiles the Epic breakdowns, Story point allocations, and dependencies.

---

## 1. Epic Matrix

| Epic ID | Epic Name | Story Points | Dependencies | Priority |
| :--- | :--- | :---: | :--- | :--- |
| **EPIC-100** | User Authentication & Profile | 8 SP | None | Critical |
| **EPIC-200** | Parent Resource CRUD | 5 SP | EPIC-100 | High |
| **EPIC-300** | Child Column Grouping CRUD | 3 SP | EPIC-200 | High |
| **EPIC-400** | Leaf Item CRUD & Movement | 8 SP | EPIC-300 | High |
| **EPIC-500** | Search & Analytics Dashboard | 5 SP | EPIC-400 | Medium |

---

## 2. Epic Breakdowns

### EPIC-100: User Authentication & Profile
- **Scope**: Sign up validation, hash crypts, bearer JWT claims, authentication middleware guards.
- **Stories**:
  - `US-101`: Visitor Registration API (3 SP).
  - `US-102`: Credentials Login & Token generation (3 SP).
  - `US-103`: Route verification middleware (2 SP).

### EPIC-200: Parent Resource CRUD
- **Scope**: Parent resource management, ownership permissions, cascade deletions, default columns.
- **Stories**:
  - `US-201`: Create Parent Resource with default columns initialized (e.g. Stage Alpha, Stage Beta) (2 SP).
  - `US-202`: List parent resources & detail fetcher (2 SP).
  - `US-203`: Modify metadata & delete parent resources (1 SP).

### EPIC-300: Child Column Grouping CRUD
- **Scope**: Intermediate grouping column routes, position sequence indexes.
- **Stories**:
  - `US-301`: Add list group column (1 SP).
  - `US-302`: Edit title and reorder grouping columns (1 SP).
  - `US-303`: Delete grouping column cascade w/ items (1 SP).
