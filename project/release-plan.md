# Release Strategy & Versioning Policy - Generic Template

This document establishes the release pipelines, versioning metrics, and deployment policies.

---

## 1. Versioning Policy (SemVer)

The application uses Semantic Versioning (`vMAJOR.MINOR.PATCH`):
- **MAJOR**: Breakthrough changes or API contract changes breaking backwards compatibility.
- **MINOR**: Adding new feature modules or non-breaking endpoints.
- **PATCH**: Bug fixes, documentation revisions, or minor styles tweaks.

---

## 2. Release Strategy Pipeline

```
  Feature Branch ──► dev branch ──► Release Candidate (RC) ──► Main Branch ──► Tag (vX.Y.Z)
```

### 2.1 Release Stages
1.  **Staging Deploy (Release Candidate)**:
    -   When Sprint deliverables are complete, merge `dev` to `release/vX.Y.Z-rc`.
    -   DevOps deploys to Staging.
2.  **QA Validation**:
    -   QA runs the E2E verification checklists.
    -   If errors occur, hotfixes are applied directly to the release branch.
3.  **Production Release**:
    -   Merge the release branch into `main`.
    -   Tag the main branch commit (e.g. `v1.0.0`).
    -   Docker packages are pushed to registry.
