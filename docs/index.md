# Canonical Documentation Index

| Metadata | Value |
| :--- | :--- |
| **Owner** | Project Manager |
| **Reviewer** | Principal Software Architect |
| **Status** | Approved |
| **Version** | v1.0.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | None |
| **Referenced By** | [README](../README.md) |
| **Document Type** | Docs Index |
| **Audience** | Development Team, QA Team, AI Agents |

---

## 1. Project Specifications

| Document | Purpose | Owner | Status | Version | Dependencies |
| :--- | :--- | :--- | :--- | :---: | :--- |
| [charter.md](charter.md) | High-level project definition, constraints, and business case. | PM | Approved | v1.0.0 | None |
| [requirements.md](requirements.md) | Functional and non-functional product specifications. | PM | Approved | v1.0.0 | [charter.md](charter.md) |
| [scope.md](scope.md) | Explicit boundaries, exclusions, and tech swap limits. | PM | Approved | v1.0.0 | [charter.md](charter.md) |
| [project-vision.md](project-vision.md) | Platform core values, educational goals, and success indicators. | PM | Approved | v1.0.0 | None |
| [user-stories.md](user-stories.md) | User stories mapped in standard Agile formats. | PM | Approved | v1.0.0 | [requirements.md](requirements.md) |
| [acceptance-criteria.md](acceptance-criteria.md) | Given/When/Then scenarios for story verification. | PM | Approved | v1.0.0 | [user-stories.md](user-stories.md) |

---

## 2. Technical & Architecture Specifications

| Document | Purpose | Owner | Status | Version | Dependencies |
| :--- | :--- | :--- | :--- | :---: | :--- |
| [architecture.md](architecture.md) | Feature-modular layouts and layered separations rules. | Architect | Approved | v1.0.0 | [requirements.md](requirements.md) |
| [erd.md](erd.md) | Relational database schema fields, types, and indexes. | Architect | Approved | v1.0.0 | [architecture.md](architecture.md) |
| [api-contract.md](api-contract.md) | REST API endpoints, query params, JSON envelopes, and status codes. | Architect | Approved | v1.0.0 | [architecture.md](architecture.md) |
| [decisions.md](decisions.md) | Architecture Decision Records (ADRs) and trade-off rationales. | Architect | Approved | v1.0.0 | None |
| [technical-debt.md](technical-debt.md) | Register mapping identified debt, impact, and scheduled remediations. | Architect | Approved | v1.0.0 | [architecture.md](architecture.md) |
| [architecture-review-checklist.md](architecture-review-checklist.md) | Audit guidelines validating layer isolation compliance. | Architect | Approved | v1.0.0 | [architecture.md](architecture.md) |
| [folder-structure-guide.md](folder-structure-guide.md) | Detailed directory maps for both frontend and backend projects. | Architect | Approved | v1.0.0 | [architecture.md](architecture.md) |

---

## 3. Engineering Operations & Quality

| Document | Purpose | Owner | Status | Version | Dependencies |
| :--- | :--- | :--- | :--- | :---: | :--- |
| [coding-standards.md](coding-standards.md) | ESLint, TypeScript, naming, and transaction rules. | Architect | Approved | v1.0.0 | None |
| [roadmap.md](roadmap.md) | Timelines, release phases, and technology swap validations. | PM | Approved | v1.0.0 | None |
| [tech-stack.md](tech-stack.md) | Precise versions of package dependencies and compilers. | Architect | Approved | v1.0.0 | None |
| [security.md](security.md) | Password hashing, CORS, XSS, and SQLi preventions. | Architect | Approved | v1.0.0 | [architecture.md](architecture.md) |
| [testing.md](testing.md) | Unit, integration, E2E spec rules and coverage thresholds. | QA | Approved | v1.0.0 | [architecture.md](architecture.md) |
| [api-testing.md](api-testing.md) | Manual API testing workflow, Bruno collection setup, and Prisma Studio guide. | PM | Draft | v1.0.0 | [api-contract.md](api-contract.md) |
| [deployment.md](deployment.md) | Local compose builds and migrations execution guides. | DevOps | Approved | v1.0.0 | None |
| [quality-checklists.md](quality-checklists.md) | Audit checklists for security, performance, and documentation. | QA | Approved | v1.0.0 | None |
| [glossary.md](glossary.md) | Shared vocabularies and acronym definitions. | PM | Approved | v1.0.0 | None |
| [git-workflow.md](git-workflow.md) | Branch classification, commit naming, and merge pipelines. | PM | Approved | v1.0.0 | None |
| [contributing.md](contributing.md) | Local setup steps and onboarding guide for developers. | PM | Approved | v1.0.0 | [git-workflow.md](git-workflow.md) |
