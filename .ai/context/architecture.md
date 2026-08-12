# AI Quick Start: Architecture & Data Flow Context

## 1. Purpose
This document provides a quick-start reference detailing the clean layer isolation rules and relational request data flows.

## 2. Summary
*   **Modular Layout**: Organization follows business feature modules rather than global directories.
*   **Layer Responsibilities**: Routes authenticate and validate; Controllers format; Services handle business rules; Repositories query database tables.
*   **Flow Structure**: Client View → Router/Middleware → Controller → Service → Repository → Relational Database.

## 3. Canonical Source
- [Architecture Specification](../docs/architecture.md)
- [Folder Structure Guide](../docs/folder-structure-guide.md)

## 4. Related Documents
- [REST API Contract](../docs/api-contract.md)
- [Coding Standards](../docs/coding-standards.md)
- [Architecture Review Checklist](../docs/architecture-review-checklist.md)
