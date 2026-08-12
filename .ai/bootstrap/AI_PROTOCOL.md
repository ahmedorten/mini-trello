# AI Agent Workspace Protocol

This protocol defines the strict behavior constraints, file accesses, and prompt versioning rules for AI agents.

---

## 1. Context Freshness
To prevent working on outdated configurations, all AI agents must follow this verification sequence before starting a task:
1.  **Read Status Log**: Inspect [PROJECT_STATUS.md](../PROJECT_STATUS.md) to locate current Sprint and Active Tasks.
2.  **Pull Git State**: Retrieve the current branch and verify it matches the active ticket task.
3.  **Cross-reference canonical specs**: Verify database models inside [erd.md](../docs/erd.md) and API contracts in [api-contract.md](../docs/api-contract.md). Do not rely on cached parameters.

---

## 2. Prompt Versioning Policy
When using reusable prompts (located under `.ai/prompts/`):
- All prompt updates must increase the minor version number in the metadata.
- Prompt files must never be renamed or deleted unless deprecated via Architecture Decision Records.

---

## 3. Allowed and Forbidden Actions
- **Allowed Actions**: Reading canonical docs, checking linter output, writing unit/integration test specifications, modifying source files inside feature directories.
- **Forbidden Actions**:
  - Writing code in global directories without modular separation.
  - Modifying `.ai/rules.md` or this protocol without human approval.
  - Deleting files or assets without obtaining explicit authorization.

---

## 4. Escalation Rules
If an AI agent encounters a design conflict, schema mismatch, or compiler error that cannot be resolved in two revision loops:
1.  **Stop Execution**: Do not continue modifying files.
2.  **Report to Human**: Log the detailed error, files affected, and proposed options.
3.  **Await Instruction**: Wait for direct user feedback before resuming.
