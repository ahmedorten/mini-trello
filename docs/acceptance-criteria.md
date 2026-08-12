# Acceptance Criteria Specifications - Generic Template

| Metadata | Value |
| :--- | :--- |
| **Owner** | Project Manager |
| **Reviewer** | QA Lead |
| **Status** | Approved |
| **Version** | v1.0.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | [User Stories](user-stories.md) |
| **Referenced By** | [Canonical Document Index](index.md), [QA Workflows](../.ai/workflows/bugfix-workflow.md) |
| **Document Type** | QA Standards |
| **Audience** | Development Team, QA Team, AI Agents |

---

## 1. Authentication

### AC-101: User Registration
- **Scenario**: Successful account creation.
  - **Given** a user inputs a valid name, unique email, and password.
  - **When** they submit the form.
  - **Then** the system creates their record, hashes the password, and returns a `201` status.
- **Scenario**: Duplicate Email.
  - **Given** a user inputs an email that already exists.
  - **When** they submit the form.
  - **Then** the system returns a `400` status with error payload.

### AC-102: User Login
- **Scenario**: Valid credentials.
  - **Given** a user enters their registered email and password.
  - **When** they submit the login request.
  - **Then** the system returns a `200` status with a JWT token and user profile object.

---

## 2. Resource & Grouping Management

### AC-201: Parent Resource Creation
- **Scenario**: Creating a resource.
  - **Given** an authenticated user sends a POST request with a valid name.
  - **When** the resource is saved.
  - **Then** it automatically initializes with default stage grouping columns.

### AC-202: Group Column Deletion
- **Scenario**: Deleting a group column.
  - **Given** an authenticated user sends a DELETE request for a column.
  - **When** the column is deleted.
  - **Then** all child items in that column are cascade-deleted.

---

## 3. Item Reordering & Movement

### AC-301: Moving Item to a Different Group Column
- **Scenario**: Item moved via PATCH request `/sub-resources/:id/move`.
  - **Given** an authenticated user specifies a `targetGroupId` and `targetOrder`.
  - **When** the item updates its location.
  - **Then** the server updates the parent column ID and adjusts the order indices of surrounding items in both the source and target columns.
