# Frontend Clean Architecture Guide

This document defines the 5-layer enterprise-grade clean architecture directory rules configured for the Mini Trello application.

---

## 1. Architectural Layers

We decouple business logic, state management, UI presentations, and network operations into five strict, isolated horizontal layers:

```
[ Vue Component (Presentational Layouts) ]
               ↓
[ Composables (Vue Composition API Hooks) ]
               ↓
[ Pinia Stores (Reactive Shared State) ]
               ↓
[ Services (Pure TypeScript Business Logic) ]
               ↓
[ API Wrapper & ApiClient (Network Adapters) ]
```

### Layer 1: API Layer & ApiClient
* **Directory:** `features/<feature>/api/` and `core/api/`
* **Responsibilities:**
  * Defines raw HTTP requests, endpoints, parameters, and response DTO schemas.
  * Extends the global Axios base instance wrapper `ApiClient.ts` which injects headers.
  * No component or store should bypass this layer to call Axios directly.

### Layer 2: Service Layer
* **Directory:** `features/<feature>/services/` and `shared/services/`
* **Responsibilities:**
  * Exposes pure, stateless TypeScript classes managing business logic rules, data transformations, error mappings, and cache management.
  * Services do not contain Vue reactive states (`ref`, `computed`). They are 100% testable in vanilla Node/Vitest environments.

### Layer 3: Store Layer (Pinia State)
* **Directory:** `features/<feature>/stores/` and `shared/stores/`
* **Responsibilities:**
  * Coordinates reactive shared states accessed across multiple views.
  * Contains simple mutations and state resets (e.g. `reset()` called during auth logout).
  * Business rules should be delegated to the Service layer rather than coded inline within Pinia actions.

### Layer 4: Composable Layer
* **Directory:** `features/<feature>/composables/` and `shared/composables/`
* **Responsibilities:**
  * Exposes Vue-specific lifecycle hooks (`onMounted`), local UI flags, debounced operations, and computed getters wrapping stores.
  * Standardizes state accessors for the view components.

### Layer 5: Component Layer (Presentational Viewport)
* **Directory:** `features/<feature>/components/`, `features/<feature>/pages/`, and `shared/components/`
* **Responsibilities:**
  * Focuses 100% on HTML templates and Tailwind CSS styling.
  * Business calculations, API calls, and state mutations **must never exist inside Vue components**. Components must remain purely presentational, reading data from composables and emitting user events.

---

## 2. Cross-Feature Communication Rules

* **Direct Imports Forbidden:** A feature directory (e.g., `features/cards/`) **must never** import code directly from another feature directory (e.g., `features/boards/`).
* **Shared Layer Bridge:** Shared utilities, domain models, or helper services must reside in `src/shared/`.
* **Bridge Composables:** If two features must coordinate (such as clicking a global search result card directing to a board column drawer), communication occurs via URL state queries, router parameters, or a clean bridge interface.
