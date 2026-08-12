# AI Quick Start: Database Context

## 1. Purpose
This document provides a quick-start reference detailing the relational integrity guidelines and ORM model mapping rules for database engines.

## 2. Summary
*   **Schema Layout**: Core relational database structure links User → Parent Resource → Child Column → Resource Item.
*   **Cascade Rules**: Relational models must utilize cascade rules to delete nested child records when parent rows are removed.
*   **Performance**: Query scans must query indexed fields (e.g. unique keys, foreign keys) to prevent full table scans.

## 3. Canonical Source
- [Entity Relationship Diagram (ERD)](../docs/erd.md)
- [Architecture Specification](../docs/architecture.md)

## 4. Related Documents
- [Deployment Guide](../docs/deployment.md)
- [Coding Standards](../docs/coding-standards.md)
- [Prisma Schema Config](../backend/prisma/schema.prisma)
