# Architecture Decision Records (ADRs) - Generic Template

| Metadata | Value |
| :--- | :--- |
| **Owner** | Principal Software Architect |
| **Reviewer** | Reviewer |
| **Status** | Approved |
| **Version** | v1.0.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | None |
| **Referenced By** | [Canonical Document Index](index.md) |
| **Document Type** | Architectural Decisions |
| **Audience** | Development Team, AI Agents |

---

## ADR-001: Backend Core Platform Selection

*   **Status**: Approved
*   **Context**: The educational goal requires swappable reference implementations. The primary implementation must be lightweight, type-safe, widely adopted, and have minimal framework magic to allow easy framework comparison.
*   **Decision**: Use a lightweight server framework (e.g. Express) in TypeScript strict mode.
*   **Consequences**:
    -   *Pros*: Fast setup, lightweight footprint, clear layer code.
    -   *Cons*: Lacks built-in dependency injection or ORM features, requiring explicit integration plans.

---

## ADR-002: Persistence Layer Selection

*   **Status**: Approved
*   **Context**: Domain resources are highly relational. Querying details requires nesting relations. Fast joins and cascade deletes are critical.
*   **Decision**: Use a relational database engine (e.g. PostgreSQL).
*   **Consequences**:
    -   *Pros*: ACID compliance, native UUID support, clean cascade deletes, robust performance.
    -   *Cons*: Higher operational overhead than SQLite; requires setting up containerized engines.

---

## ADR-003: ORM Tooling Selection

*   **Status**: Approved
*   **Context**: To maintain type safety from database to routes, a schema-first database mapping toolkit is required.
*   **Decision**: Use an ORM mapping tool (e.g. Prisma ORM).
*   **Consequences**:
    -   *Pros*: Auto-generated type definitions matching the schema file, easy migration commands.
    -   *Cons*: Adds query abstraction layer.

---

## ADR-004: Frontend Client Framework Selection

*   **Status**: Approved
*   **Context**: The frontend client needs to consume REST APIs and offer a responsive UI with fluid sorting actions.
*   **Decision**: Use a component-based reactive framework (e.g. Vue 3 Composition API).
*   **Consequences**:
    -   *Pros*: Reactive binding, Composition API enables modular helper layout, high performance.
    -   *Cons*: Framework swap requires specific style variables alignment.