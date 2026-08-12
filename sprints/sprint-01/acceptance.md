# Sprint 01 Acceptance Criteria

| Metadata | Value |
| :--- | :--- |
| **Owner** | QA Lead |
| **Reviewer** | Project Manager |
| **Status** | Approved |
| **Version** | v1.0.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | [Sprint Goals](goals.md) |
| **Referenced By** | None |
| **Document Type** | QA Checklist |
| **Audience** | Development Team, QA Team, AI Agents |

---

## 1. Acceptance Checklist

### 1.1 Backend Bootstrapping
- [ ] Backend workspace compiles without errors.
- [ ] Linters are green with no warnings.
- [ ] Local database service boots successfully.

### 1.2 User Authentication API
- [ ] Register endpoint creates a user and stores encrypted passwords.
- [ ] Login endpoint validates credentials and returns a secure token.
- [ ] Accessing profile endpoints with missing or invalid token returns `401 Unauthorized`.
- [ ] Accessing profile endpoints with a valid token returns `200 OK` and user details.

### 1.3 Parent Resource CRUD API
- [ ] Users can only list, create, edit, or delete resources they own.
- [ ] Accessing other users' resources returns `403 Forbidden`.
- [ ] Deleting a resource cascade-deletes all nested child structures.

### 1.4 Test Verification
- [ ] Integration test suite runs and passes.
- [ ] Test coverage reports meet the **80%** threshold.
