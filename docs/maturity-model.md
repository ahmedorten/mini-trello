# Repository Maturity Model

| Metadata | Value |
| :--- | :--- |
| **Owner** | Principal Software Architect |
| **Reviewer** | Enterprise Engineering Reviewer |
| **Status** | Approved |
| **Version** | v1.0.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | None |
| **Referenced By** | [Canonical Document Index](index.md), [README](../README.md) |
| **Document Type** | Governance Guidelines |
| **Audience** | Project Stakeholders, Development Team, AI Agents |

---

## 1. Maturity Stage Matrix

This repository uses a structured maturity framework to control code evolution and quality gates.

| Stage | Name | Description | Coding Allowed? | Relational Constraints | Testing Scope |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **1** | Idea | Preliminary requirements gathering and goals. | No | Draft schema entities | None |
| **2** | Planning | **(Current Stage)** Specs, scopes, architectures, and templates frozen. | **No** | relational tables defined | Template verifications |
| **3** | Architecture | Folder trees, ORM configurations, DB services boot. | Yes (Infra only) | Migrations configured | Docker verification |
| **4** | Development | API controller routes, state stores, views, styling. | Yes | Data transactions active | Jest unit/integration tests |
| **5** | Testing | QA E2E verification cycles on stable release candidates. | Bugfixes only | Live schema active | QA checklists and E2E runs |
| **6** | Production | Stable tagging, semantic version packaging, registry. | No | Read replicas | Real-world validation |
| **7** | Maintenance | Package updates, lint checks, dependency review. | Minor tweaks | Schema patches | Regression test suite runs |

---

## 2. Planning Stage Readiness Rules
As the repository is locked in the **Planning** maturity stage:
- Under no circumstances write application controller logic, express routes, vue scripts, or SQL migrations.
- Focus exclusively on refining requirements, hardening guidelines, mapping epics, and configuring prompt blueprints.
