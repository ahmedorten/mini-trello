# State Management Guide

This document defines how Pinia stores are structured and reset across the application lifecycle.

---

## 1. Store Lifecycle & Resets

All Pinia stores are declared using the **Setup Store** syntax (functions returning state references and mutations), which is highly readable and aligns with Vue's Composition API.

### The Reset Pattern
Every store **must** expose a `reset()` method that restores all internal refs to their default states:

```typescript
export const useSearchStore = defineStore('search', () => {
  const query = ref('');
  const results = ref<SearchResultItem[]>([]);

  const reset = () => {
    query.value = '';
    results.value = [];
  };

  return { query, results, reset };
});
```

---

## 2. Authentication Logout Reset Coordination

During user logout (`AuthService.logout`), the service automatically coordinates state clearance across all modules to prevent data leakage in shared browser sessions.

The following stores are reset in sequence during logout:

```typescript
// inside AuthService.logout()
const { useSearchStore } = await import('@/features/search/stores/search.store');
const { useFilterStore } = await import('@/features/filters/stores/filter.store');
const { useStatisticsStore } = await import('@/features/statistics/stores/statistics.store');
const { useBoardStore } = await import('@/features/boards/stores/board.store');
const { useColumnStore } = await import('@/features/columns/stores/column.store');
const { useCardStore } = await import('@/features/cards/stores/card.store');

useSearchStore().reset();
useFilterStore().reset();
useStatisticsStore().reset();
useBoardStore().reset();
useColumnStore().reset();
useCardStore().reset();
```

---

## 3. Best Practices
* **State Mutability:** Components should not write directly to store properties (e.g. `store.query = 'value'`). Instead, call explicit action mutations (e.g. `store.setQuery('value')`) to trace mutations easily during debugging.
* **Keep Actions Stateless:** Avoid loading complex business algorithms inside Pinia actions. Delegate calculations to service classes first, then commit final values to the store.
