# AI Collaboration & Workspace Governance Protocol

| Metadata | Value |
| :--- | :--- |
| **Owner** | Principal Software Architect |
| **Reviewer** | Reviewer |
| **Status** | Approved |
| **Version** | v1.1.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | [Git Workflow](../docs/git-workflow.md), [AI Agent Capability Matrices](../.ai/capabilities/architect.md) |
| **Referenced By** | [AI Agent Protocol](../.ai/bootstrap/AI_PROTOCOL.md) |
| **Document Type** | Governance Standard |
| **Audience** | AI Agents, Development Team |

---

## 1. AI Memory & Context Freshness Strategy
To prevent context drift and ensure that AI agents are always working with the most up-to-date information:
1.  **Freshness Verification**: Before modifying any code, AI agents must read [PROJECT_STATUS.md](../PROJECT_STATUS.md) and cross-reference with the active Git branch to verify the target Task ID.
2.  **No Cached Assumptions**: Agents must query the database model schema [erd.md](../docs/erd.md) and route spec [api-contract.md](../docs/api-contract.md) files dynamically during each turn rather than relying on historical summaries.

---

## 2. Reusable Prompt Versioning Policy
Reusable prompts reside inside `.ai/prompts/` and must follow strict semantic versioning:
- **Major Version Bump**: When the target programming language or execution stack shifts.
- **Minor Version Bump**: When formatting rules, middleware integrations, or checklist requirements are modified.
- **Path Freezing**: Prompt filenames must never be modified or deleted without an approved Architecture Decision Record (ADR).

---

## 3. Agent Permissions & Allowed Tools
AI agents must respect the bounds established in their respective capability matrices inside `.ai/capabilities/`:
- **Allowed Tools**: File reads, file writes, grep search, and terminal executions.
- **Forbidden Actions**: Direct edits to rules or configurations, deletion of project files without explicit permission, and writing out-of-scope application code.

---

## 4. Operational Escalation Rules
If an AI agent is unable to resolve a linting issue, compilation error, or schema conflict in **two consecutive revision loops**:
1.  **Halt Operations**: Stop making code or document edits.
2.  **Generate Escalation Log**: Log the targeted task, error stack traces, files modified, and proposed alternative solutions.
3.  **Await Instruction**: Transition into idle state and wait for human supervisor review.

---

## 5. Audit & Logging Strategy
Every action taken by an AI agent must leave a clear, auditable trail:
- **Conventional Commits**: Agents must write descriptive commit messages detailing changes made and referencing the target Task ID.
- **Pull Request Templates**: PR descriptions must detail the scope of changes, testing performed, and checklists completed.
- **Project Status Updates**: Tasks must traverse the backlog queues inside `/tasks/` dynamically.
