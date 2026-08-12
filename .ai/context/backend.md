# AI Quick Start: Backend Context

## 1. Purpose
This document provides a quick-start reference detailing the backend directory layout and layered code isolation rules for swappable API platforms.

## 2. Summary
*   **Layer Separation**: Strictly isolate Presentation (Routes/Controllers) → Business (Services) → Data Access (Repositories).
*   **Modularity**: Structure all backend code inside feature-modular folders under `/src/modules/[feature]/`.
*   **Envelopes**: Enforce `{ success: true, data }` and `{ success: false, error }` envelopes for all REST responses.

## 3. Canonical Source
- [Architecture Specification](../docs/architecture.md)
- [Coding Standards](../docs/coding-standards.md)
- [Folder Structure Guide](../docs/folder-structure-guide.md)

## 4. Related Documents
- [REST API Contract](../docs/api-contract.md)
- [Deployment Guide](../docs/deployment.md)
- [Backend Workflow](../.ai/workflows/backend-workflow.md)
