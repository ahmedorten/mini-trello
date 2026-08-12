# Git Workflow & Branching Strategy - Generic Template

| Metadata | Value |
| :--- | :--- |
| **Owner** | Project Manager |
| **Reviewer** | Reviewer |
| **Status** | Approved |
| **Version** | v1.0.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | None |
| **Referenced By** | [Canonical Document Index](index.md), [Contributing Guide](contributing.md) |
| **Document Type** | Workflow Strategy |
| **Audience** | Development Team, AI Agents |

---

## 1. Branching Model

```
  main      ─────────────────────────────────── (Production Stable Tags)
               ▲
               │ Merge Release
  dev       ───┴─────────────────────────────── (Integration Branch)
               ▲             ▲
               │ Feature     │ Bugfix
  feature/* ───┘             └─── bugfix/*
```

### 1.1 Branch Classifications
- **`main`**: Production-ready branch. All commits must be tagged with a semantic version number (`vX.Y.Z`).
- **`dev`**: Daily integration branch. Features and bug fixes merge into `dev` after passing reviews.
- **`feature/<module-name>-<summary>`**: Used for implementing new requirements (e.g. `feature/auth-registration`).
- **`bugfix/<issue-id>-<summary>`**: Used for fixing defects (e.g. `bugfix/issue-204-jwt-expiry`).

---

## 2. Commit Message Conventions
We enforce the **Conventional Commits** standard. Commit messages must use the following format:
```
<type>(<scope>): <short-description>
```
### 2.1 Types
- **`feat`**: A new user story or functional code implementation.
- **`fix`**: A bug fix.
- **`docs`**: Changes to documentation files (no application code affected).
- **`style`**: Layout formatting changes (whitespace, semi-colons, no logic change).
- **`refactor`**: Reorganizing code paths without changing public behavior.
- **`test`**: Adding or updating specs.

---

## 3. Merge Requirements & Pull Requests
- Under no circumstances merge code directly into `dev` or `main`.
- Pull Requests must be approved by the **Reviewer** and signed off by the **QA Engineer**.
- Automated test checks (linter, unit specs) must pass before merging is permitted.
