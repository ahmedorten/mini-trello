# Quality & Audit Checklists - Generic Template

| Metadata | Value |
| :--- | :--- |
| **Owner** | QA Lead |
| **Reviewer** | Principal Software Architect |
| **Status** | Approved |
| **Version** | v1.0.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | [Testing Strategy](testing.md), [Security Guidelines](security.md) |
| **Referenced By** | [Canonical Document Index](index.md) |
| **Document Type** | QA Checklist |
| **Audience** | Development Team, QA Team, AI Agents |

---

## 1. Security Checklist

Verify all items before deploying changes to staging or production:
- [ ] **Access Authorization**: All routes except public auth paths require JWT or session token validation.
- [ ] **Input Sanitization**: Body payloads are parsed using schemas; strings are validated to prevent HTML tags or raw SQL injections.
- [ ] **Bcrypt Work Factor**: Passwords must be hashed using secure algorithms with appropriate iteration factors (e.g. Bcrypt 10 rounds).
- [ ] **Safe SQL Queries**: Database mutations and selects use parameterized queries or ORM methods.
- [ ] **Token Expiration**: JWT signatures have short lifetimes (e.g. 24 hours).

---

## 2. Performance Checklist

Verify that modifications optimize memory footprint and query speeds:
- [ ] **No N+1 Queries**: Nested relations (e.g. parents and child entities) are fetched in a unified query using ORM joins or batch executions.
- [ ] **Indexed Queries**: Relational constraints (e.g., owner IDs, group IDs) make use of indexed fields.
- [ ] **Asset Minification**: Frontend assets, CSS scripts, and icons are compiled using production bundlers.
- [ ] **Payload Sizes**: Returned JSON payloads contain only necessary attributes.

---

## 3. Documentation Checklist

Verify that documentation remains in sync with code additions:
- [ ] **Database Schema**: Schema structures and ERD diagrams reflect database modifications.
- [ ] **REST API Spec**: Path modifications, error codes, and request bodies match [API Contract](api-contract.md).
- [ ] **In-code Comments**: Public endpoints, middlewares, and services have complete annotations explaining parameters, return shapes, and constraints.
