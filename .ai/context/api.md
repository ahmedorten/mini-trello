# AI Quick Start: REST API Context

## 1. Purpose
This document provides a quick-start reference detailing the REST API spec, payload contract structures, and JSON envelope standardizations.

## 2. Summary
*   **Security Header**: Bearer token is required for all endpoints except public authentication routes: `Authorization: Bearer <TOKEN>`.
*   **API Response Formats**: All responses must use `{ success: true, data }` or `{ success: false, error }` JSON envelopes.
*   **Route Setup**: Core endpoints map to registration, credentials verification, parent resources query/creation, child grouping adjustments, and leaf item positioning.

## 3. Canonical Source
- [REST API Contract](../docs/api-contract.md)
- [Architecture Specification](../docs/architecture.md)

## 4. Related Documents
- [Requirements Specification](../docs/requirements.md)
- [Testing Strategy](../docs/testing.md)
- [Security Guidelines](../docs/security.md)
