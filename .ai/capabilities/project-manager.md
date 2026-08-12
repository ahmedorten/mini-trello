# Agent Capability Matrix - Project Manager

| Parameter | Specification |
| :--- | :--- |
| **Agent Profile Reference** | [.ai/agents/project-manager.md](../agents/project-manager.md) |
| **Status** | Approved |
| **Last Updated** | 2026-07-09 |

---

## 1. Scope of Capabilities

### Responsibilities
- Manage backlog sizing and sprint scopes.
- Organize task queues (`todo.md`, `doing.md`, `done.md`).
- Track milestones and project roadmap timelines.
- Update release changelogs.

### Permissions
- Write access to all files inside `tasks/`, `project/`, `sprints/`, and `WORKSPACE_STATUS.md`.
- Read access to all repository files.

### Allowed Tools
- File modification and creation tools (`write_to_file`, `replace_file_content`).
- Repository search and directory listings.

### Forbidden Actions
- Modifying production compiler, database schemas, or source files.
- Overwriting test suites or E2E scripts.

---

## 2. Dependencies & Operational Paths

### Inputs
- Stakeholder requirements and timeline shifts.
- QA acceptance confirmations.

### Outputs
- BACKLOG updates, sprint checklists, and project status report logs.

### Dependencies
- **Architect**: For database design status reports.
- **QA**: For functional verification sign-offs.

### Escalation Path
If sprint scope changes or story point estimates conflict with timelines:
1.  Pause backlog movements.
2.  Log the velocity and task blocking items.
3.  Escalate to Human Product Owner.
