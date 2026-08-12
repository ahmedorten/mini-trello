# Software Architecture Specification - Generic Template

| Metadata | Value |
| :--- | :--- |
| **Owner** | Principal Software Architect |
| **Reviewer** | Enterprise Engineering Reviewer |
| **Status** | Approved |
| **Version** | v1.0.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | [Requirements Specification](requirements.md) |
| **Referenced By** | [Canonical Document Index](index.md), [Folder Structure Guide](folder-structure-guide.md) |
| **Document Type** | Architectural Design |
| **Audience** | Development Team, AI Agents |

---

## 1. Feature-Based Modular Architecture
Instead of using standard technical folder divisions (where all controllers are in one directory, all services in another), this codebase structures files by **business feature modules**. This maximizes maintainability and ensures that backend modules can be swapped or isolated easily.

### 1.1 Folder Tree Mappings

#### Backend Layout (`src/`)
*   `config/`: App environments and database configuration settings.
*   `middlewares/`: Global middlewares (`authMiddleware`, `errorMiddleware`, `loggerMiddleware`).
*   `modules/`: Feature directories:
    *   `auth/`: Registration, login, session profile checks.
    *   `[feature-module]/`: Domain-specific CRUD routes, controllers, services, repositories, schemas, and specs.
*   `shared/`: Reusable custom decorators, typings, and helpers.

#### Frontend Layout (`src/`)
*   `assets/`: Style definitions (variables, animations).
*   `components/`: Reusable component nodes (buttons, badging details, overlays).
*   `views/`: Screen-level views.
*   `stores/`: Global state stores.
*   `services/`: Axios or custom fetch HTTP instance setups.
*   `router/`: Navigation mapping and authentication guards.

---

## 2. Technical Layer Standards

```
  ┌────────────────────────────────────────────────────────┐
  │                   Presentation Layer                   │
  │  - Routes bind API endpoints to Controller handlers   │
  │  - Schemas validate incoming body payloads            │
  └───────────────────────────┬────────────────────────────┘
                              │ Calls
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │                     Business Layer                     │
  │  - Services execute business rules                    │
  │  - Enforce ownership and validate cross-module limits  │
  └───────────────────────────┬────────────────────────────┘
                              │ Calls
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │                    Data Access Layer                   │
  │  - Repositories wrap ORM or database operations        │
  │  - Keeps SQL query structures isolated from services   │
  └────────────────────────────────────────────────────────┘
```

---

## 3. Data Integrity & Swappability
- **Entity Deletion**: Database relations use cascade deletions.
- **REST Protocol**: JSON payloads are returned via the envelope `{ success: true, data }`.
- **Stateless Verification**: JWT claims contain User details, keeping API nodes stateless.