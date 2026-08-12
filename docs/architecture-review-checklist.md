# Architecture Review Checklist - Generic Template

| Metadata | Value |
| :--- | :--- |
| **Owner** | Principal Software Architect |
| **Reviewer** | Reviewer |
| **Status** | Approved |
| **Version** | v1.0.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | [Architecture Specification](architecture.md) |
| **Referenced By** | [Canonical Document Index](index.md) |
| **Document Type** | Architecture Checklist |
| **Audience** | Development Team, AI Agents |

---

## 1. Architectural Layout Checks

### 1.1 Layer Separation Guidelines
- [ ] **Middleware Bounds**: Route validation (schema checking) is completed within route middleware files. Controllers do not parse properties manually.
- [ ] **Controller Scope**: Controllers only bind HTTP responses and envelopes, delegating the actual work to the Service layer.
- [ ] **Service Isolation**: Services do not import Express/framework request or response packages, ensuring that the business logic can be ported to other frameworks without modifications.
- [ ] **Repository Isolation**: Database queries are encapsulated in the Repository layer using the ORM or query client. No DB queries run outside repositories.

### 1.2 Relational Checks
- [ ] **Cascades**: Cascade deletion rules are applied to all relational database structures.
- [ ] **Ordering Logic**: New groupings and items are assigned an `order` property equal to `max(order) + 1` relative to their parent container.
- [ ] **Index Utilizations**: Database queries use indexed fields (like emails or foreign IDs) for scanning, preventing full table scans.
