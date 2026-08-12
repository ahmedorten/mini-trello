# Architecture Audit Reference

This document outlines the import directions, layer boundaries, and dependency restrictions enforced across the codebase.

---

## 1. Import Direction Rules

The dependency flow follows a strict one-way direction. Any import that violates these rules will fail circular checks:

```
[ Layer 5: Components ] ──> [ Layer 4: Composables ] ──> [ Layer 3: Pinia Stores ] ──> [ Layer 2: Services ] ──> [ Layer 1: API Adapters ]
```

* **Downward-Only Rule:** A lower layer (e.g. `shared/services/`) **must never** import code from a higher layer (e.g. `shared/composables/` or features components).
* **Self-Contained Features:** Feature folders do not cross-import directly. If features `boards` and `columns` need to exchange values, they communicate via:
  * URL query variables.
  * Explicit Bridge interfaces located in `src/shared/`.

---

## 2. Shared Layer Integrity

* **`/src/core`:** Restrict to system bootstrapping, singletons (Axios ApiClient, Auth SessionManager), global intercepts, and EnvSchema validation.
* **`/src/shared`:** Exposes components, composables, and services consumed by two or more feature domains (e.g. `BaseButton.vue`, `useToast.ts`).

---

## 3. Circular Dependency Gatekeeping

* **Tooling:** Visual dependency mapping is managed via the static report generated at `reports/dependency-graph.html`.
* **Remediation Action:** If a circular import is introduced, immediately resolve it by refactoring the shared dependency into a third separate utility helper, or passing variables via events/callbacks instead of static class mappings.
