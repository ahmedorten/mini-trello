# Technical Debt Register - Generic Template

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
| **Document Type** | Tech Debt Log |
| **Audience** | Development Team, AI Agents |

---

## 1. Technical Debt Catalog

| Debt ID | Feature Area | Description of Debt | Impact | Priority | Scheduled Remediation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DEBT-001** | Database | SQLite fallback capability missing in schema. If Postgres local engine fails to boot, developers are blocked. | Medium | Low | Post Milestone 2 |
| **DEBT-002** | Real-time | App relies on REST polling. Real-time updates from concurrent sessions do not synchronize instantly. | High | Medium | Phase 5 Integration |
| **DEBT-003** | Styling | Ad-hoc style overrides inside UI components instead of using variables. | Low | Low | Sprint 04 Cleanup |

---

## 2. Rationale & Consequences

### DEBT-002: Lack of Real-Time WebSockets
- **Context**: Collaborative updates require real-time synchronization. However, integrating WebSockets adds substantial protocol complexity.
- **Consequence**: Users must manually refresh or rely on short-poll fetch loops. We accept this trade-off to keep backend frameworks easy to compare during educational swaps.
