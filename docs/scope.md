# Project Scope - Generic Template

| Metadata | Value |
| :--- | :--- |
| **Owner** | Project Manager |
| **Reviewer** | Principal Software Architect |
| **Status** | Approved |
| **Version** | v1.0.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | [Project Charter](charter.md), [Requirements](requirements.md) |
| **Referenced By** | [Canonical Document Index](index.md), [README](../README.md) |
| **Document Type** | Scope Specification |
| **Audience** | Project Stakeholders, Development Team, AI Agents |

---

## 1. Product Boundaries

### 1.1 In-Scope Features
*   **Authentication & Session Control**: Sign up, login, token verification, JWT stateless session handling, CORS policies.
*   **Dashboard Metrics**: Aggregation of user resource counts, item totals, and completed counts.
*   **CRUD Resource, Group, and Item**: Standard database actions mapped to parent-child schemas.
*   **Item Reordering & Sorting**: API PATCH `/move` endpoint to recalculate ordering indices inside column groups.
*   **Global Text Search**: Filtering items by query keywords.

### 1.2 Out-of-Scope Items
- **Real-Time WebSockets**: No socket connections; the UI fetches state via standard REST endpoints.
- **File Uploads**: No attachment features or S3/cloud storage bindings.
- **Collaborative Workspaces**: Resources are single-user workspaces. Shareable resources, team permissions, and invitation emails are excluded.
- **Activity Log Audit Trails**: Logging changes at the user-facing level is excluded.
- **Comment Threads**: Comments on items are excluded.
- **Notifications Engine**: Push, email, or in-app notification centers are excluded.