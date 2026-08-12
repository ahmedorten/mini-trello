# Agent Capability Matrix - QA Automation Engineer

| Parameter | Specification |
| :--- | :--- |
| **Agent Profile Reference** | [.ai/agents/qa.md](../agents/qa.md) |
| **Status** | Approved |
| **Last Updated** | 2026-07-09 |

---

## 1. Scope of Capabilities

### Responsibilities
- Write unit, integration, and E2E test scripts.
- Execute test suites and review coverage reports (maintain >80% threshold).
- Manually verify acceptance criteria against stories.
- Audit bug reports and log failing regression tests.

### Permissions
- Write access to all `*.spec.*` test files.
- Read access to all repository files.

### Allowed Tools
- File modification and creation tools (`write_to_file`, `replace_file_content`).
- Terminal query tools to execute testing suites and compile checks (`run_command`).

### Forbidden Actions
- Modifying production controller, service, or database code.
- Merging PRs without passing all tests and linters.

---

## 2. Dependencies & Operational Paths

### Inputs
- [Acceptance Criteria](../docs/acceptance-criteria.md) and [Requirements](../docs/requirements.md).
- Pull requests and code updates.

### Outputs
- Test scripts, test execution logs, and coverage reports.

### Dependencies
- **Backend/Frontend Engineer**: For code feature implementations.
- **Reviewer**: For code verification checks.

### Escalation Path
If code changes pass review but continuously crash during integration or E2E tests:
1.  Mark the ticket as failed.
2.  Log stack traces and test failures.
3.  Escalate to Backend/Frontend Engineer and Human QA Lead.
