# Enterprise AI Development Rules & Regulations

This document defines core behavioral constraints, code quality limits, and compliance expectations for any AI agent contributing to the workspace.

---

## 1. Absolute Architectural Constraints
- **Layer Isolation**: Keep Presentation (Routes/Controllers), Business Logic (Services), and Data Access (Repositories) layers strictly separated. Under no circumstances should database queries run directly inside controller actions.
- **REST Resource Standards**: Use plural endpoints for resource models (e.g. `/api/v1/resources`, `/api/v1/entities`).
- **Feature-Based Modularization**: Structure all feature implementations under module directories (`src/modules/<module_name>/`). Do not place domain-specific logic in global spaces.

---

## 2. Coding Guidelines
- **TypeScript Strict Mode**: Ensure strict compilation flags are set to true. Do not bypass checks with `any` or compile override statements.
- **Response Format**: Every successful API result must be wrapped in a standard success envelope `{ success: true, data }`.
- **Custom Application Errors**: Throw custom application errors rather than generic HTTP or runtime errors. The global handler middleware will translate them into `{ success: false, error }` with appropriate status codes.
- **Dependency Management**: Do not introduce third-party packages without verifying compatibility with alternative framework configurations.

---

## 3. Git & Branching
- **Granular Commits**: Keep one concern per commit. Provide descriptive messages matching Conventional Commits syntax.
- **Review Requirement**: Branches must be merged only via pull requests after obtaining QA validation and reviewer approvals.

---

## 4. Documentation Upkeep
- **Immediate Update**: If a code change modifies an API endpoint shape, input parameters, database schemas, or properties, the engineer is responsible for immediately updating files under `docs/` and `.ai/context/`.