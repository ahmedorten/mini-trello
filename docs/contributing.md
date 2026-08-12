# Developer Contributing Guide - Generic Template

| Metadata | Value |
| :--- | :--- |
| **Owner** | Project Manager |
| **Reviewer** | Principal Software Architect |
| **Status** | Approved |
| **Version** | v1.0.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | [Git Workflow](git-workflow.md) |
| **Referenced By** | [Canonical Document Index](index.md), [README](../README.md) |
| **Document Type** | Onboarding Standard |
| **Audience** | Development Team, AI Agents |

---

## 1. Onboarding Quick-Start

### 1.1 Local Workspace Setup
1.  **Clone the Repository**: Ensure you have designated runtime engines (Node, Docker, etc.) installed.
2.  **Start Database Containers**:
    ```bash
    docker-compose up -d
    ```
3.  **Bootstrap Backend**:
    - Install backend dependencies: `npm install`
    - Apply database migrations: `npx prisma migrate dev`
    - Generate Prisma Client: `npx prisma generate`
    - Start backend development server: `npm run dev`
4.  **Open API Collection** (for manual API testing):
    - Install [Bruno](https://www.usebruno.com/) desktop client.
    - Open the collection folder at `backend/http/`.
    - Select the `local` environment to activate `BASE_URL` and `JWT_TOKEN`.
    - See [API Testing Guide](api-testing.md) for the full authentication workflow.
5.  **Bootstrap Frontend**:
    - Install frontend dependencies.
    - Start frontend development server.

---

## 2. Contribution Rules

### 2.1 Implementing Code
- Follow the modular structure rules in the [Folder Structure Guide](folder-structure-guide.md).
- Follow variable, class, and method casings documented in [Coding Standards](coding-standards.md).
- Ensure all route modifications strictly align with the [API Contract](api-contract.md).

### 2.2 Testing
- Write tests for all new endpoints or helper methods.
- Verify test coverage locally (target >80%).

### 2.3 Submitting Pull Requests
1.  Create a branch naming it `feature/*` or `bugfix/*`.
2.  Commit changes using conventional commits formatting.
3.  Fill out the Review Template in the PR description.
4.  Assign the **Reviewer** for review and the **QA Engineer** for functional testing.
