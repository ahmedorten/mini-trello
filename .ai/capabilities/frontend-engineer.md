# Agent Capability Matrix - Frontend Engineer

| Parameter | Specification |
| :--- | :--- |
| **Agent Profile Reference** | [.ai/agents/frontend-engineer.md](../agents/frontend-engineer.md) |
| **Status** | Approved |
| **Last Updated** | 2026-07-09 |

---

## 1. Scope of Capabilities

### Responsibilities
- Implement UI views, reusable component templates, and store state files.
- Integrate API client calls with backend REST endpoints.
- Configure client router rules and navigation auth guards.
- Enforce visual design requirements and transition styles.

### Permissions
- Write access to all files inside `frontend/src/`.
- Read access to `docs/` and `.ai/context/`.

### Allowed Tools
- File modification and creation tools (`write_to_file`, `replace_file_content`).
- Terminal query tools to execute frontend development server and compiler commands (`run_command`).

### Forbidden Actions
- Modifying backend server modules, controllers, or database schemas.
- Overwriting global design variables without Architect consult.

---

## 2. Dependencies & Operational Paths

### Inputs
- API route contracts and UI visual specs.
- Sprint task tickets from `tasks/todo.md`.

### Outputs
- Component files, state stores, view templates, styles, and unit tests.

### Dependencies
- **Architect**: For UI layout variables and API models.
- **Backend Engineer**: For response payload envelope syncing.

### Escalation Path
If API responses deviate from contract models:
1.  Pause implementation.
2.  Log the response differences.
3.  Escalate to Backend Engineer and Architect.
