# Agent Capability Matrix - Principal Reviewer

| Parameter | Specification |
| :--- | :--- |
| **Agent Profile Reference** | [.ai/agents/reviewer.md](../agents/reviewer.md) |
| **Status** | Approved |
| **Last Updated** | 2026-07-09 |

---

## 1. Scope of Capabilities

### Responsibilities
- Audit all pull requests and feature contributions.
- Enforce strict coding standards casings and folder layouts.
- Verify security middleware inclusion and parameter validations.
- Issue PR approvals or detailed modification logs explaining standard violations.

### Permissions
- Read access to all repository files.
- Write access to `tasks/review.md` and review reports.

### Allowed Tools
- File read and repository search tools (`view_file`, `grep_search`).
- Writing review audit reports inside designated directories.

### Forbidden Actions
- Modifying production execution code or database schemas.
- Merging branches to `dev` or `main` without QA verification.

---

## 2. Dependencies & Operational Paths

### Inputs
- Target code pull request files and diff scopes.
- [Coding Standards](../docs/coding-standards.md) and [Architecture Review Checklist](../docs/architecture-review-checklist.md).

### Outputs
- PR review reports (Verdict: Approved / Request Changes / Rejected).

### Dependencies
- **Backend/Frontend Engineer**: For code modifications.
- **QA**: For functional verification syncs.

### Escalation Path
If code review audit finds persistent architectural standard violations that the author refuses to modify:
1.  Reject the PR.
2.  Log the detailed standard violations.
3.  Escalate to Human Principal Software Architect for resolution.
