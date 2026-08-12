# AI Workspace Guide

Welcome to the AI-assisted development workspace for the Mini Trello application. This workspace serves as the operational model, governance standard, and workflow orchestration mechanism for all AI agents and human developers collaborating on this project.

## 1. Purpose of the AI Workspace
The AI Workspace defines the guardrails, processes, and documentation structures that allow autonomous software agents to plan, implement, review, test, and document features safely and predictably. It guarantees:
- **Auditability**: Complete trace of decisions, tool usage, session histories, and QA checks.
- **Role Isolation**: Clear separation of responsibilities between specialized AI agents.
- **Quality Gates**: Strict lifecycle transitions from planning to task closure.

---

## 2. Folder Overview
All AI coordination artifacts are stored under the `.ai/` directory:

```
.ai/
├── agents/                  # Configuration files documenting agent roles and constraints
│   ├── project-manager.md
│   ├── architect.md
│   ├── backend-engineer.md
│   ├── frontend-engineer.md
│   ├── reviewer.md
│   ├── devops.md
│   └── qa.md
├── logs/                    # Audit trails and trackers
│   ├── sessions/            # Individual development session files
│   ├── templates/           # Reusable logging templates
│   ├── ai-usage.md          # Append-only list of agent session records
│   └── decision-log.md      # Architect ADR records
├── prompts/                 # Standard prompt blueprints
└── workflows/               # Architectural workflows guidelines
```

---

## 3. Agent Lifecycle & Handoff Chain
Development follows a sequential handoff chain where each role has distinct responsibilities, inputs, and outputs.

```
Project Manager (PM)
      ↓
  Architect
      ↓
   Engineer
      ↓
   Reviewer
      ↓
      QA
      ↓
Documentation
```

### Role Specifications

#### Project Manager (PM)
- **Purpose**: Defines task objectives, scope, and schedules.
- **Inputs**: Backlog tickets, user requirements.
- **Outputs**: Detailed task requirements and sprint updates.
- **Allowed Actions**: Prioritizing tasks, writing goals.
- **Forbidden Actions**: Writing code, defining database structures.
- **Required Logs**: Task summary updates.
- **Next Handoff**: Architect.

#### Architect
- **Purpose**: Translates PM requirements into technical designs.
- **Inputs**: Scope documents, system design guides, ERDs.
- **Outputs**: Technical designs and implementation plans (`plan-log.md`).
- **Allowed Actions**: Deciding design patterns, choosing libraries, creating ADRs.
- **Forbidden Actions**: Direct implementation of features.
- **Required Logs**: Decision Log entries (`decision-log.md`).
- **Next Handoff**: Engineer.

#### Engineer (Backend / Frontend / DevOps)
- **Purpose**: Implements the approved architectural plan.
- **Inputs**: Approved plan (`plan-log.md`), coding standards.
- **Outputs**: Code modifications and local runs verification.
- **Allowed Actions**: Modifying code, compiling, formatting, local testing.
- **Forbidden Actions**: Deviating from approved design, skipping validation checks.
- **Required Logs**: Session Logs (`logs/sessions/`).
- **Next Handoff**: Reviewer.

#### Reviewer
- **Purpose**: Audits the code against coding standards and architectural rules.
- **Inputs**: Changed files, implementation plans.
- **Outputs**: Review reports (`review-log.md`).
- **Allowed Actions**: Standard inspections, requesting changes, approving.
- **Forbidden Actions**: Modifying code to fix review findings.
- **Required Logs**: Review Log.
- **Next Handoff**: QA.

#### QA
- **Purpose**: Validates runtime code and verifies definitions of done.
- **Inputs**: Code builds, test specs, QA checklist.
- **Outputs**: Test run results (`qa-log.md`).
- **Allowed Actions**: Running test frameworks, query validation, regression tests.
- **Forbidden Actions**: Approving builds with failing tests or unformatted code.
- **Required Logs**: QA verification logs.
- **Next Handoff**: Documentation.

#### Documentation
- **Purpose**: Summarizes task outcomes and documents usage.
- **Inputs**: Walkthrough logs, README guidelines.
- **Outputs**: Walks and markdown guides (`walkthrough-log.md`).
- **Allowed Actions**: Writing guides, updating API specifications.
- **Forbidden Actions**: Writing code or modifying config logic.
- **Required Logs**: Walkthrough markdown files.
- **Next Handoff**: Task Closed (PM).

---

## 4. Workflow Lifecycle
Every task must go through these seven stages in order. **No stage may be skipped.**

```
Planning ──► Architecture Review ──► Implementation ──► Code Review ──► QA Verification ──► Documentation ──► Task Closed
```

1. **Planning**: PM sets goals. Architect writes the design in `plan-log.md`.
2. **Architecture Review**: Technical design is inspected and approved.
3. **Implementation**: Engineer writes code and updates daily session logs.
4. **Code Review**: Reviewer audits files and records feedback in `review-log.md`.
5. **QA Verification**: QA tests the build, running validation commands, and records in `qa-log.md`.
6. **Documentation**: Walkthrough guides are compiled using `walkthrough-log.md`.
7. **Task Closed**: Final status is updated and task is marked as done.

---

## 5. Logging Strategy
The AI Workspace tracks work using three key logs:

### 5.1 Session Logs
Track individual development sessions.
- **Path**: `.ai/logs/sessions/YYYY-MM-DD-task-XXX.md`
- **Purpose**: Records work done, decisions made, files changed, and lessons learned per day/session.

### 5.2 AI Usage Log
An append-only log listing every AI task invocation.
- **Path**: `.ai/logs/ai-usage.md`
- **Purpose**: Chronological overview of who did what, when, and with what tool/model.

### 5.3 Decision Log
Track architectural changes (Architectural Decision Records - ADRs).
- **Path**: `.ai/logs/decision-log.md`
- **Purpose**: Captures context, decisions, alternatives, and downstream impacts.

---

## 6. Repository Conventions

### Task Identifiers
Use upper-case kebab-case:
`TASK-XXX` (e.g. `TASK-101`, `TASK-102`)

### Session Log Filenames
Format: `YYYY-MM-DD-task-XXX.md` (e.g. `2026-07-09-task-101.md`)

### Decision Identifiers
Format: `ADR-XXX` (e.g. `ADR-001`, `ADR-002`)

---

## 7. How to Start a New Task
1. Check the backlog for the active Task ID (e.g. `TASK-103`).
2. Create the plan log using the Plan Template (`.ai/logs/templates/plan-log.md`).
3. Complete architecture review before writing code.
4. Log the initialization in `.ai/logs/ai-usage.md`.

## 8. How to Close a Task
1. Complete all coding, code reviews, and QA verification logs.
2. Compile the closing task summary using the Task Summary template.
3. Update `WORKSPACE_STATUS.md` in the repository root.
4. Log the completion in `.ai/logs/ai-usage.md` with status `COMPLETED`.
