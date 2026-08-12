# User Stories - Generic Template

| Metadata | Value |
| :--- | :--- |
| **Owner** | Project Manager |
| **Reviewer** | Principal Software Architect |
| **Status** | Approved |
| **Version** | v1.0.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | [Requirements Specification](requirements.md) |
| **Referenced By** | [Canonical Document Index](index.md), [Acceptance Criteria](acceptance-criteria.md) |
| **Document Type** | Agile Artifact |
| **Audience** | Development Team, QA Team, AI Agents |

---

## 1. Authentication Epics

### US-101: User Registration
*   **As a** visitor,
*   **I want to** register with my name, unique email, and password,
*   **So that** I can create a private account.

### US-102: User Login
*   **As a** registered user,
*   **I want to** login with my email and password,
*   **So that** I can access my private dashboard.

---

## 2. Parent Resource Epics

### US-201: Create Parent Resource
*   **As a** logged-in user,
*   **I want to** create a new resource with a name and optional description,
*   **So that** I can organize my data.

### US-202: List Parent Resources
*   **As a** logged-in user,
*   **I want to** view a list of all my resources on my dashboard,
*   **So that** I can select a resource to view its details.

---

## 3. Sub-Resource Grouping Epics

### US-301: Resource Initialization
*   **As a** user creating a new parent resource,
*   **I want the resource to** automatically initialize with default grouping columns (e.g. Stage A, Stage B, Stage C),
*   **So that** I can immediately start managing child items.

### US-302: Create Sub-Resource Column
*   **As a** logged-in user,
*   **I want to** add a custom list grouping column to my resource,
*   **So that** I can represent custom pipelines.

---

## 4. Leaf Item Epics

### US-401: Create Leaf Item
*   **As a** user viewing a resource grouping,
*   **I want to** create an item with a title, description, priority, and due date,
*   **So that** I can capture item details.

### US-402: Move Leaf Item
*   **As a** user,
*   **I want to** shift an item from one group column to another,
*   **So that** I can update the item's completion status.
