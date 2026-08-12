# Agent Capability Matrix - Backend Engineer

| Parameter | Specification |
| :--- | :--- |
| **Agent Profile Reference** | [.ai/agents/backend-engineer.md](../agents/backend-engineer.md) |
| **Status** | Approved |
| **Last Updated** | 2026-07-09 |

---

## 1. Scope of Capabilities

### Responsibilities
- Implement backend REST API routes, controllers, services, and repositories.
- Define data validation schemas mapping to endpoints.
- Configure ORM schemas and run database migration syncs.
- Maintain test coverage on all backend API routes.

### Permissions
- Write access to all files inside `backend/src/modules/`.
- Read access to `docs/` and `.ai/context/`.

### Allowed Tools
- File modification and creation tools (`write_to_file`, `replace_file_content`).
- Terminal query tools to execute compiler, linting, and test commands (`run_command`).

### Forbidden Actions
- Modifying frontend views, components, or client services.
- Overwriting database schemas without Architect permission.
- Committing credentials, environment variables, or private API keys to repository.

---

## 2. Dependencies & Operational Paths

### Inputs
- API route contracts and database specifications.
- Sprint task tickets from `tasks/todo.md`.

### Outputs
- Code modules, routes, service files, repositories, schemas, and test specs.

### Dependencies
- **Architect**: For API route configurations and relational database designs.
- **QA**: For test validations.

### Escalation Path
If route validation schemas fail to compile or require conflicting libraries:
1.  Stop editing files.
2.  Document compile logs.
3.  Escalate to Architect for libraries resolution.
