# Software Requirements Specification (SRS) - Generic Template

| Metadata | Value |
| :--- | :--- |
| **Owner** | Project Manager |
| **Reviewer** | Principal Software Architect |
| **Status** | Approved |
| **Version** | v1.1.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | [Project Charter](charter.md) |
| **Referenced By** | [Canonical Document Index](index.md), [Scope](scope.md), [User Stories](user-stories.md) |
| **Document Type** | Functional Requirements |
| **Audience** | Development Team, QA Team, AI Agents |

---

## 1. Introduction
This document defines the functional and non-functional requirements for the swappable reference application.

---

## 2. Functional Requirements

### 2.2 Parent Resource Management
- **REQ-001**: User can list all parent resources owned by them.
- **REQ-002**: User can create a new parent resource (name required).
- **REQ-003**: User can edit a parent resource's metadata (name/description).
- **REQ-004**: User can delete a parent resource (must cascade delete child columns and items).

### 2.3 Column Grouping Management
- **REQ-005**: User can create column grouping categories linked to a Parent Resource.
- **REQ-006**: User can update column category names and ordering index positions.
- **REQ-007**: User can delete a column category (must cascade delete nested items).

### 2.4 Item Management
- **REQ-008**: User can create an item inside a column group (title required).
- **REQ-009**: User can edit an item's title, description, priority, or due date.
- **REQ-010**: User can move an item between columns, updating list IDs and sequence order indices.
- **REQ-011**: User can delete an item.

---

## 3. Requirements Traceability Model
This matrix traces functional requirements down to their testing specs, ensuring full coverage:

| Req ID | Target Epic | Sprint Task ID | Code Implementation Path | QA Verification Spec |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-001** | `EPIC-200` (Board/Resource CRUD) | `TASK-106` (Repository/Service) | `src/modules/resources/resources.service.ts` | `src/modules/resources/resources.spec.ts` |
| **REQ-002** | `EPIC-200` (Board/Resource CRUD) | `TASK-107` (Route/Controller) | `src/modules/resources/resources.controller.ts` | `src/modules/resources/resources.spec.ts` |
| **REQ-003** | `EPIC-200` (Board/Resource CRUD) | `TASK-107` (Route/Controller) | `src/modules/resources/resources.controller.ts` | `src/modules/resources/resources.spec.ts` |
| **REQ-004** | `EPIC-200` (Board/Resource CRUD) | `TASK-107` (Route/Controller) | `src/modules/resources/resources.controller.ts` | `src/modules/resources/resources.spec.ts` |
| **REQ-005** | `EPIC-300` (Column Grouping) | `TASK-201` (Deferred Sprint 02) | `src/modules/columns/columns.service.ts` | `src/modules/columns/columns.spec.ts` |
| **REQ-010** | `EPIC-400` (Leaf Item Movement) | `TASK-302` (Deferred Sprint 03) | `src/modules/items/items.service.ts` | `src/modules/items/items.spec.ts` |