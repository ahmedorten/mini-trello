# Agent Capability Matrix - DevOps Engineer

| Parameter | Specification |
| :--- | :--- |
| **Agent Profile Reference** | [.ai/agents/devops.md](../agents/devops.md) |
| **Status** | Approved |
| **Last Updated** | 2026-07-09 |

---

## 1. Scope of Capabilities

### Responsibilities
- Maintain local container configurations (`docker-compose.yml`).
- Configure development environment variable templates.
- Orchestrate CI/CD automated pipeline runners.
- Package containers and monitor deployment tag builds.

### Permissions
- Write access to all files inside `deploy/` or root `docker-compose.yml`.
- Read access to all repository files.

### Allowed Tools
- File modification and creation tools (`write_to_file`, `replace_file_content`).
- Terminal query tools to manage containers, execute migrations, and compile builds (`run_command`).

### Forbidden Actions
- Modifying business service logic or UI component stylesheets.
- Writing to database credentials directly inside the repository code.

---

## 2. Dependencies & Operational Paths

### Inputs
- [Deployment Guide](../docs/deployment.md) and environment variables schemas.
- Release targets and semantic version parameters.

### Outputs
- Docker compose, CI/CD pipeline script files, and build logs.

### Dependencies
- **Architect**: For database connections settings.
- **QA**: For test integration checks in CI.

### Escalation Path
If Docker containers fail to compile or port mapping clashes block execution:
1.  Pause deployment scripts.
2.  Log network and container engine logs.
3.  Escalate to Human DevOps Lead.
