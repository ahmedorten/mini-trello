# Testing Strategy & Guidelines - Generic Template

| Metadata | Value |
| :--- | :--- |
| **Owner** | QA Lead |
| **Reviewer** | Principal Software Architect |
| **Status** | Approved |
| **Version** | v1.0.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | [Architecture Specification](architecture.md) |
| **Referenced By** | [Canonical Document Index](index.md), [Quality Checklists](quality-checklists.md) |
| **Document Type** | Testing Strategy |
| **Audience** | Development Team, QA Team, AI Agents |

---

## 1. Testing Hierarchy & Boundaries

### 1.1 Backend Unit & Integration Tests
- **Feature Tests**: Place unit test files next to the feature code they verify.
- **Mocking**: Mock database connections during unit testing.
- **Integration Tests**: Execute requests against the active routing dispatcher to verify routing configuration, payload parser middlewares, database writes, and expected responses.

### 1.2 Frontend Store & Component Tests
- **Component Tests**: Mount component templates and assert visual output, CSS states, and emitted events.
- **Store Tests**: Import state stores and execute actions, asserting that state variables mutate appropriately. Mock API client calls to prevent actual network requests during testing.

---

## 2. Test Execution Blueprint (Example)

### Backend Verification (Node)
- Run all tests:
  ```bash
  npm run test
  ```

### Frontend Verification (Vue/Vite)
- Run unit test suite:
  ```bash
  npm run test
  ```

---

## 3. Test Coverage & Quality Gates

> [!IMPORTANT]
> To merge code changes:
> 1. Total Code Coverage must meet or exceed **80%** (Statements, Branches, Functions, and Lines).
> 2. Critical modules (auth validation, authorization checks) must have **100%** coverage.
