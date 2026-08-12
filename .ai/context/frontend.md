# AI Quick Start: Frontend Context

## 1. Purpose
This document provides a quick-start reference detailing the frontend application structure, state stores, and UI design systems constraints.

## 2. Summary
*   **State Separation**: Components communicate only with State Stores; Stores fetch data from HTTP Services.
*   **Aesthetics Constraint**: Visuals must look modern and premium. Use transition animations and cohesive CSS layout tokens.
*   **API Interceptor**: Standard Axios or fetch clients inject bearer headers dynamically and unwrap backend envelopes.

## 3. Canonical Source
- [Architecture Specification](../docs/architecture.md)
- [Coding Standards](../docs/coding-standards.md)
- [Folder Structure Guide](../docs/folder-structure-guide.md)

## 4. Related Documents
- [REST API Contract](../docs/api-contract.md)
- [Frontend Workflow](../.ai/workflows/frontend-workflow.md)
- [Tech Stack Specification](../docs/tech-stack.md)
