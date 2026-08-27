# Story 26 — Frontend: one table shell, sortable columns, and page-size selection (Story: 13)

## Prerequisites

- [Story 25 completed](25-story-backend-list-sorting-indexes-dev-seed-13.md): the four list endpoints accept `sort` and `order`. This story **cannot** be started before it — `main.ts:30` sets `forbidNonWhitelisted: true`, so a frontend that sends `sort` against the pre-Story-25 API gets a **400 on every list request**, not a silently ignored parameter.
- Both dev servers running: `npm run dev:api` and `npm run dev:web` from the repo root. `apps/web/.env` keeps `VITE_API_BASE_URL` empty so the Vite proxy carries auth.
- The design system from [Story 20](../agent-dashboard-and-collaboration-and-enhancement-ui/20-story-frontend-design-system-i18n-rtl-5.md) is in place and is **not** rebuilt here: `apps/web/src/assets/main.css` already ships 60+ tokens, `AppIcon`/`AppButton`/`AppCard`/`AppBadge`/`AppStateBlock`/`AppTabs`/`AppModal`/`AppPagination`/`StatTile`/`LocaleSwitcher` all exist, `vue-i18n` carries **345 keys with full `en`/`ar` parity** enforced by `i18n/i18n.spec.ts`, and every direction-sensitive CSS property in the repo is already logical — a grep for `margin-left`, `padding-right`, `border-left`, `text-align: left`, or a bare `left:`/`right:` across `apps/web/src/**/*.vue` returns **zero** hits. Do not re-do that work; extend it.
- **No backend change is permitted in this story.** `apps/api/` is untouched — a checkable claim.
- **No new npm dependency**, on either side.

---

## Story Goal

The table half of work item 13's UI objectives. Four list screens each hand-roll their own table shell, none can be sorted, none lets the user change the page size, and two have a filter bar that overflows on a phone. This story replaces the duplication with one shell and adds the two missing interactions:

1. **One table shell.** `.data-table` in `main.css`, replacing four near-identical scoped blocks: `CustomersView.vue:202–219`, `TasksView.vue:191–208`, `TicketsView.vue:221–238`, `UsersView.vue:459–476`. Consistent header treatment, zebra rows, hover state, a sticky header inside the scroll container, and readable column padding — written once.
2. **Sortable columns.** A new `AppSortHeader.vue` renders a `<th>` whose label is a real `<button>`, carries `aria-sort`, and shows the active direction. Wired into all four tables against the `sort`/`order` parameters Story 25 shipped.
3. **Page-size selection.** `AppPagination.vue` gains an optional page-size `<select>`, additively, so its five existing call sites keep working unchanged. Options `10 / 20 / 50 / 100`, capped at the API's `MAX_PAGE_SIZE = 100`.
4. **Two responsive defects fixed.** `CustomersView.vue:184` and `UsersView.vue:432` declare `display: flex` with a `gap` and **no `flex-wrap`**, so their filter bars overflow horizontally below roughly 700px. `TicketsView.vue:202–206` and `TasksView.vue:169–173` already wrap — these two were missed.

**Not in scope:** confirmation dialogs, the nine `window.confirm` call sites, the four inline `users__panel` forms, and the row-action button styling — all of those are [Story 27](27-story-frontend-dialogs-consistency-a11y-13.md). The login page is [Story 28](28-story-login-test-user-picker-13.md). Documentation is [Story 29](29-story-documentation-handover-verification-13.md). Also excluded: sorting on the dashboard queues, the workspace panels, the communication timeline, or any unpaginated child list; column reordering, column hiding, resizable columns, multi-column sort, a card/stacked mobile table layout, virtual scrolling, CSV export, and dark mode.

---

## Context — Read These Files First

1. `apps/web/src/components/AppPagination.vue` — the **whole file, 68 lines.** Props `page`/`totalPages`/`total` at 5–9; `emit('change', number)` at 11; `previous()`/`next()` with their bounds checks at 15–25; the summary at 40–42 rendering `common.pagination.summary` with three interpolations; styles 56–68. Task 3 extends this **additively** — every existing prop, the `change` emit, and the summary must behave identically when the new props are absent.
2. `apps/web/src/components/AppPagination.spec.ts` — 5 tests: `'disables Previous on page 1'` (12), `'disables Next on the last page'` (20), `'emits change with page + 1 on Next and page - 1 on Previous'` (28), `'renders the interpolated summary'` (39), `'swaps the Previous chevron path under ar'` (45). **All five must pass unmodified.** That last one is the RTL contract on the chevrons; do not disturb it.
3. `apps/web/src/views/CustomersView.vue` — the **whole file, 226 lines.** The reference list screen. Debounced search `watch` at 29–37 with `onBeforeUnmount` cleanup at 39–43; filter handlers 45–51; `onPageChange` at **53–55**; the four-way `AppStateBlock` branch at **99–108**; the table at **111–148** (`<caption class="sr-only">` at 113, eight `<th scope="col">` at 116–123); pagination at 150–158; styles 163–226, including the **unwrapped** `.customers__filters` at **184–188** and the table block at **202–219**.
4. `apps/web/src/views/TicketsView.vue` — 245 lines. Table at **126–166**, eight headers at 129–136 (`subject`, `customer`, `category`, `priority`, `status`, `assignedAgent`, `commentsFiles`, `actions`). Note rows 146 and 149 use `<AppBadge :priority>` and `<AppBadge :status>` — the badge already owns the enum-to-tone mapping, so the sortable header must not touch cell rendering. `.tickets__filters` at 202–206 **already wraps**; the table block is 221–238.
5. `apps/web/src/views/UsersView.vue` — 514 lines, the largest list screen. Table at **295–342**, seven headers at 299–305 (`name`, `email`, `roles`, `department`, `status`, `lastLogin`, `actions`); pagination 346–354. `onPageChange` at **62**. `.users__filters` at **432–436** is the second **unwrapped** bar. Table block at 459–476. The four `users__panel` blocks at 241, 357, 387, 404 are **Story 27's**, not this story's — leave them alone beyond the table shell change.
6. `apps/web/src/views/TasksView.vue` — 215 lines. Table at **107–147**, seven headers at 110–116; pagination at 148–154 (note: **not** wrapped in a `__pagination` div, unlike the other three). `.tasks__filters` at 169–173 already wraps; table block 191–208.
7. `apps/web/src/stores/customers.ts` — the **whole file, 329 lines.** `filters` at **41–48** (`page: 1`, `pageSize: 20`, plus the filter fields); `currentParams()` at **50–59**, the single place params are assembled; the `latestRequestId` race guard at **63–93** with its comment at 61–62; `setSearch`/`setStatusFilter`/`setTypeFilter` at 141–157, each resetting `filters.page = 1` before `void load()`; `setPage` at **159–162**; the returned surface at 300–328. Every store change in task 5 follows this exact shape.
8. `apps/web/src/stores/tickets.ts` (`filters` 47–, `setPage` **192**), `apps/web/src/stores/users.ts` (`filters` **30–33** — note the `Required<Pick<…>>` type annotation, the only store that types its filters explicitly; `setPage` **114**), `apps/web/src/stores/tasks.ts` (`filters` 32–, `setPage` **119**). All four hard-code `pageSize: 20`.
9. `apps/web/src/api/customers.ts` — `ListCustomersParams` at **58–66**. The hand-written mirror of `ListCustomersQueryDto`; `sort`/`order` are added here. Also read **193–197**: `listCustomerOptions()` calls `listCustomers({ pageSize: 100 })` with the comment "*A page-size-capped list for a `<select>`, not the paginated list UI*" — that call must keep working and must **not** grow a sort.
10. `apps/web/src/api/tickets.ts` (`ListTicketsParams` at 58–), `apps/web/src/api/users.ts` (`ListUsersParams` at 38–; also `listUsers({ pageSize: 100 })` at **123**), `apps/web/src/api/tasks.ts` (`ListTasksParams` at 45–). The other three param mirrors.
11. `apps/web/src/assets/main.css` — the **whole file, 159 lines.** The `:root` token block is **1–95**; `body` 101–106; the single `html[dir='rtl']` font rule at **111–113**; `*:focus-visible` 115–118; `.sr-only` 120–130; `.skip-link` 132–148; the `prefers-reduced-motion` block 150–159. `.data-table` goes after `.skip-link` and before the motion block. Tokens you will need already exist: `--color-surface`, `--color-surface-sunken`, `--color-border`, `--color-border-strong`, `--color-text-muted`, `--color-accent`, `--color-accent-soft`, `--space-1`…`--space-8`, `--radius`, `--font-size-xs`/`-sm`, `--font-weight-semibold`, `--shadow-1`.
12. `apps/web/src/components/icons.ts` — the **whole file, 41 lines.** The `ICON_PATHS` registry and the `IconName` union. `'chevron-down'` (line 30) and the direction-aware `'chevron-start'`/`'chevron-end'` (28–29) already exist. Task 2 adds **two** entries; read the header comment at 1–3 and `AppIcon.vue`'s handling of the `start`/`end` pair before adding anything.
13. `apps/web/src/components/AppIcon.spec.ts` — **33 tests**, one per registry entry plus the RTL swap cases. Adding an icon means adding to this spec; read how it enumerates the registry first.
14. `apps/web/src/i18n/locales/en.json` and `ar.json` — **345 keys each, exact parity, enforced by `i18n/i18n.spec.ts:39–47`.** Read the existing `common` block: it already has `search`, `previous`, `next`, `actions`, `all`, `showingOfTotal`, and `pagination.summary`. New keys go under `common.sort.*` and `common.pageSize.*`. **Both catalogues, same keys, or the test fails.**
15. `apps/web/src/test/setup.ts` — 4 lines. `config.global.plugins = [i18n]` installs the **real** `en` catalogue into every mounted component, which is why a misspelled translation key fails a test instead of rendering blank. Story 20 Product rule 17.
16. `apps/web/src/views/CustomersView.spec.ts` (9 tests), `TicketsView.spec.ts` (10), `UsersView.spec.ts` (11), `TasksView.spec.ts` (8) — the four list-view specs. Read how each mocks its store before writing task 7.

---

## Product rules (from story)

| # | Rule | Rationale |
|---|------|-----------|
| 1 | **`AppPagination` grows only optional props.** With `pageSize` absent it renders exactly what it renders today. | **Seven call sites across six views:** `CustomersView` 151, `TicketsView` 169, `UsersView` 347, `TasksView` 148, `CommunicationView` **262 and 309** (two in one file), `AgentWorkspaceView` 321. This story wires the page-size select into the four list screens only; the three workspace and communication call sites keep the two-button form, and they must not need editing to keep it. |
| 2 | **Page-size options are `10 / 20 / 50 / 100`, and 100 is the ceiling.** | `MAX_PAGE_SIZE = 100` in `apps/api/src/common/dto/pagination.dto.ts:5`. An option above it is a guaranteed 400. Defining the list in one exported constant in `AppPagination.vue` means the ceiling is stated once. |
| 3 | **Changing the page size resets to page 1.** | Page 4 of 20-row pages does not exist once the pages hold 100 rows. Every existing filter setter already resets `filters.page = 1` (`stores/customers.ts:143`, `149`, `155`); page size is a filter by that logic. |
| 4 | **Sorting is a `<button>` inside a `<th scope="col">`, and the `<th>` carries `aria-sort`.** Never a click handler on a bare `<th>` or a `<div>`. | Story 20 Product rule 14 requires every interactive element to be a real control. `aria-sort="ascending" \| "descending" \| "none"` on the header cell is the one attribute a screen reader actually announces; putting it on the button instead announces nothing. |
| 5 | **One sort column at a time.** Clicking a new column sorts by it ascending; clicking the active column flips the direction; there is no third click that clears the sort. | The API accepts one `sort` value (Story 25 task 2), so a multi-column UI would be a promise the backend cannot keep. "No third state" is deliberate: a tri-state header is the control users misclick most, and the unsorted state is already reachable by reloading the screen. |
| 6 | **The default view sends no `sort` at all.** `filters.sort` starts as `''`, and `currentParams()` maps `''` to `undefined`. | Story 25 Product rule 1: an absent `sort` reproduces the legacy ordering. Sending `sort=name` on first load would look identical for customers but would change the ticket list's order on day one, which is a regression dressed as a feature. |
| 7 | **A sortable column's `sort` value is the API enum value, spelled exactly.** `name`, `createdAt`, `fullName`, `lastLoginAt`, `dueAt` — camelCase, as declared in Story 25's four enums. | The API rejects anything else with a 400. Declaring each view's column list as a typed `const` array whose `sort` field is the imported `CustomerSortField`-shaped union makes a typo a compile error rather than a runtime 400. |
| 8 | **Only columns the API can actually sort get a sortable header.** Non-sortable headers stay plain `<th scope="col">`. | `ticket.customer` (a relation), `user.roles` (a many-to-many), `customer.notesFiles` and `ticket.commentsFiles` (`_count` aggregates), `task.linkedTicket`/`linkedCustomer` (relations), and every `Actions` column have no enum member in Story 25. A header that looks clickable and 400s is worse than a header that looks static. |
| 9 | **`.data-table` is a global class in `main.css`, not a wrapper component.** Views keep their own `<table>`, `<thead>`, and `<td>` markup. | A generic table component would have to accept columns, cell slots, row keys, and per-cell rendering for four tables whose cells contain `RouterLink`s, `AppBadge`s, and multi-button action groups — and it would rewrite all four templates at once, putting 38 passing view tests at risk in a styling story. A shared class removes the duplication that actually exists (the shell) and leaves the part that legitimately differs (the cells) alone. |
| 10 | **The sticky header is `position: sticky` on `th` inside the existing `overflow-x: auto` wrapper.** No JavaScript, no fixed heights. | The four `__table-wrap` divs already exist and already scroll (`CustomersView.vue:202–204`). Sticky is one property inside a container that is already correct. |
| 11 | **Every direction-sensitive property in the new CSS is logical**, and the sort indicator is chosen **by name** (`sort-asc` / `sort-desc`), never by a `[dir='rtl'] { transform: scaleX(-1) }` flip. | Story 20 Product rules 3 and 5. An up/down arrow means the same thing in both directions, so it must not flip; the horizontal chevrons in the pagination must. Keeping the two decisions in different mechanisms is what stops one from breaking the other. |
| 12 | **Sort state is per-store, in `filters`, and is not persisted or put in the URL.** | `crm.locale` stays the only browser-storage key in the app (Story 22's overview records this). The existing filters are not in the URL either; making sort the one exception would be an inconsistency with no requirement behind it. Note it as a known limitation: a sorted list is not shareable by link. |
| 13 | **The retrofit changes appearance and adds two interactions. It changes nothing else.** Every debounce, race guard, permission gate, `window.confirm`, payload shape, and store call survives intact. | The acceptance criteria demand no regression across US01–06. The 38 existing list-view tests are the enforcement: they pass with **no** assertion weakened. Where one asserts a rendered header, it is updated to match the new markup, not deleted. |

---

## Frontend Tasks

### 1 — The shared table shell

**File: `apps/web/src/assets/main.css`** — add after `.skip-link:focus` (line 148), before the `prefers-reduced-motion` block at 150.

```css
/* --- Data tables -------------------------------------------------------------
 * One shell for every list screen. Replaces the four near-identical scoped
 * blocks in CustomersView / TicketsView / UsersView / TasksView. Views keep
 * their own cells; only the shell is shared (Product rule 9). */
.data-table-wrap {
  overflow-x: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-1);
}

.data-table {
  inline-size: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--font-size-sm);
}

.data-table th,
.data-table td {
  /* `start`, not `left` — Product rule 11. */
  text-align: start;
  padding: var(--space-3) var(--space-4);
  border-block-end: 1px solid var(--color-border);
  vertical-align: middle;
}

.data-table thead th {
  /* Sticky inside .data-table-wrap, which already scrolls. No JS, no fixed
   * heights (Product rule 10). */
  position: sticky;
  inset-block-start: 0;
  z-index: 1;
  background: var(--color-surface-sunken);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
  border-block-end: 1px solid var(--color-border-strong);
}

.data-table tbody tr:last-child td {
  border-block-end: 0;
}

.data-table tbody tr:hover td {
  background: var(--color-bg);
}

.data-table__actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

/* Filter bars above a table. Two views were missing flex-wrap entirely and
 * overflowed below ~700px; this makes the rule shared so a third cannot. */
.filter-bar {
  display: flex;
  align-items: flex-end;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-block-end: var(--space-5);
}

.filter-bar label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

@media (max-width: 767px) {
  .data-table th,
  .data-table td {
    padding: var(--space-2) var(--space-3);
  }

  .filter-bar label {
    inline-size: 100%;
  }
}
```

Do **not** add any other utility class. Views keep `<style scoped>` for what is genuinely theirs.

### 2 — `AppSortHeader.vue`

**File: `apps/web/src/components/icons.ts`** — add two entries to `ICON_PATHS`, keeping the existing alphabetical-ish grouping and the file's one-`<path>`-per-icon rule (header comment, lines 1–3):

```ts
  'sort-asc': 'M12 19V5M6 11l6-6 6 6',
  'sort-desc': 'M12 5v14M6 13l6 6 6-6',
```

These are **vertical** arrows and are chosen by name, never flipped under RTL (Product rule 11).

**Create file: `apps/web/src/components/AppSortHeader.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps<{
  /** The API sort value this column maps to — e.g. 'name', 'createdAt'. */
  field: string;
  /** Column label, already translated by the caller. */
  label: string;
  /** The field the list is currently sorted by; '' when unsorted. */
  activeField: string;
  activeOrder: 'asc' | 'desc';
}>();

const emit = defineEmits<{ sort: [string] }>();

const isActive = computed(() => props.activeField === props.field);

/** The one attribute a screen reader announces for a sortable column, and it
 *  belongs on the <th>, not on the button (Product rule 4). */
const ariaSort = computed(() => {
  if (!isActive.value) {
    return 'none';
  }

  return props.activeOrder === 'asc' ? 'ascending' : 'descending';
});
</script>

<template>
  <th scope="col" :aria-sort="ariaSort" class="sort-header">
    <button type="button" class="sort-header__button" @click="emit('sort', field)">
      <span>{{ label }}</span>
      <AppIcon
        v-if="isActive"
        :name="activeOrder === 'asc' ? 'sort-asc' : 'sort-desc'"
        :size="14"
        class="sort-header__icon"
      />
    </button>
  </th>
</template>

<style scoped>
.sort-header__button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-transform: inherit;
  letter-spacing: inherit;
  cursor: pointer;
}

.sort-header__button:hover {
  color: var(--color-text);
}

.sort-header[aria-sort='ascending'] .sort-header__button,
.sort-header[aria-sort='descending'] .sort-header__button {
  color: var(--color-accent);
}
</style>
```

`font: inherit` plus the three `inherit`s are what let the button sit inside a `.data-table thead th` and look identical to a plain header until it is active. The global `*:focus-visible` rule in `main.css:115–118` gives it a focus ring for free.

### 3 — Page-size selection in `AppPagination.vue`

**File: `apps/web/src/components/AppPagination.vue`** — extend, do not rewrite. The existing `page`/`totalPages`/`total` props, the `change` emit, both buttons, and the summary stay exactly as they are.

Add the exported option list and two optional props:

```ts
/** The API caps pageSize at MAX_PAGE_SIZE = 100
 *  (apps/api/src/common/dto/pagination.dto.ts:5). An option above it is a
 *  guaranteed 400, so the ceiling is stated here, once. */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
```

`PAGE_SIZE_OPTIONS` must be declared in a separate `<script lang="ts">` block above the `<script setup>` block, because `<script setup>` cannot export bindings. Then:

```ts
const props = withDefaults(
  defineProps<{
    page: number;
    totalPages: number;
    total: number;
    /** Omit to render the two-button pagination exactly as before
     *  (Product rule 1). */
    pageSize?: number;
    pageSizeOptions?: readonly number[];
  }>(),
  { pageSize: undefined, pageSizeOptions: () => PAGE_SIZE_OPTIONS },
);

const emit = defineEmits<{ change: [number]; pageSizeChange: [number] }>();
```

And in the template, **before** the Previous button:

```vue
    <label v-if="pageSize !== undefined" class="app-pagination__page-size">
      {{ t('common.pageSize.label') }}
      <select :value="pageSize" @change="onPageSizeChange">
        <option v-for="option in pageSizeOptions" :key="option" :value="option">{{ option }}</option>
      </select>
    </label>
```

with

```ts
function onPageSizeChange(event: Event): void {
  emit('pageSizeChange', Number((event.target as HTMLSelectElement).value));
}
```

`:value` + `@change`, not `v-model` — the parent store owns the value, exactly as the existing filter selects in `CustomersView.vue:80` and `90` do.

### 4 — Translation keys

**Files: `apps/web/src/i18n/locales/en.json` and `apps/web/src/i18n/locales/ar.json`** — add to the existing `common` block in **both** files. `i18n.spec.ts:39–47` fails the build on any key present in one catalogue and not the other, and `:49–54` fails on an empty string.

`en.json`:

```json
    "pageSize": { "label": "Rows per page" },
    "sort": {
      "sortBy": "Sort by {column}",
      "ascending": "ascending",
      "descending": "descending"
    },
```

`ar.json`:

```json
    "pageSize": { "label": "عدد الصفوف في الصفحة" },
    "sort": {
      "sortBy": "ترتيب حسب {column}",
      "ascending": "تصاعدي",
      "descending": "تنازلي"
    },
```

`common.sort.sortBy` is for the button's `aria-label` if you choose to add one; `ascending`/`descending` are for an `sr-only` announcement. Add the keys either way — a column header whose only sort cue is a 14px arrow needs a text equivalent.

### 5 — Store changes (four stores, identical shape)

**File: `apps/web/src/stores/customers.ts`**

In `filters` (41–48), add two fields beside `pageSize`:

```ts
    sort: '' as CustomerSortField | '',
    order: 'asc' as 'asc' | 'desc',
```

In `currentParams()` (50–59), add — mapping `''` to `undefined`, which is what makes the default view send no sort at all (Product rule 6):

```ts
      sort: filters.sort || undefined,
      order: filters.sort ? filters.order : undefined,
```

`order` is gated on `sort` deliberately: sending a direction with no column is meaningless, and Story 25's resolver ignores it anyway.

Add two setters beside `setPage` (159–162), following the existing `filters.page = 1; void load();` shape:

```ts
  /** One column at a time. A new column sorts ascending; the active column
   *  flips. There is no third click that clears the sort (Product rule 5). */
  function setSort(field: CustomerSortField): void {
    if (filters.sort === field) {
      filters.order = filters.order === 'asc' ? 'desc' : 'asc';
    } else {
      filters.sort = field;
      filters.order = 'asc';
    }

    filters.page = 1;
    void load();
  }

  function setPageSize(pageSize: number): void {
    filters.pageSize = pageSize;
    // Page 4 of 20-row pages does not exist at 100 rows a page (Product rule 3).
    filters.page = 1;
    void load();
  }
```

Add both to the returned object (300–328).

Repeat identically in **`stores/tickets.ts`** (setters beside `setPage` at 192; the sort union is the ticket one), **`stores/users.ts`** (beside `setPage` at 114 — note this store's `filters` carries an explicit `Required<Pick<ListUsersParams, 'page' | 'pageSize'>>` type at line 30, so widen that annotation rather than fighting it), and **`stores/tasks.ts`** (beside `setPage` at 119).

The `latestRequestId` race guard (`stores/customers.ts:63–93`) already protects these: a fast double-click on a header cannot let the first response overwrite the second. Do not add a second guard.

### 6 — API param mirrors

**File: `apps/web/src/api/customers.ts`** — add to `ListCustomersParams` (58–66):

```ts
/** Mirrors CustomerSortField in
 *  apps/api/src/customers/dto/list-customers-query.dto.ts. The API 400s on any
 *  other value, so this union is the whitelist on this side too. */
export type CustomerSortField =
  | 'name'
  | 'type'
  | 'email'
  | 'city'
  | 'status'
  | 'createdAt'
  | 'updatedAt';

export interface ListCustomersParams {
  // … existing fields unchanged …
  sort?: CustomerSortField;
  order?: 'asc' | 'desc';
}
```

Confirm the request builder in this file forwards new params generically (it builds `params` from the object); if it enumerates keys explicitly, add the two. Leave `listCustomerOptions()` at **193–197** alone — it passes only `pageSize: 100` and must keep doing so.

Repeat in **`api/tickets.ts`** (`TicketSortField`: `subject | category | priority | status | createdAt | updatedAt`), **`api/users.ts`** (`UserSortField`: `fullName | email | isActive | lastLoginAt | createdAt`; leave the `listUsers({ pageSize: 100 })` call at line **123** alone), **`api/tasks.ts`** (`AgentTaskSortField`: `title | status | dueAt | createdAt`).

### 7 — The four views

For each of the four list views, four edits. **Nothing else in the file changes.**

**a. Table shell.** Replace `class="customers__table-wrap"` with `class="data-table-wrap"` and `class="customers__table"` with `class="data-table"`, then **delete** the now-dead scoped rules: `.customers__table-wrap` (202–204), `.customers__table` (206–212), `.customers__table th, .customers__table td` (214–219), and `.customers__actions` (221–225) — the last replaced by `class="data-table__actions"` on the `<td>` at line 139. Keep the `<caption class="sr-only">` at 113 exactly as it is. Same four deletions in `TicketsView.vue` (221–238 + 240–244), `UsersView.vue` (459–476 + 478–482), `TasksView.vue` (191–208 + 210–214).

**b. Filter bar.** Replace `class="customers__filters"` with `class="filter-bar"` and delete `.customers__filters` (184–188) and `.customers__filters label` (190–196). This is the **fix for the missing `flex-wrap`**. Do the same in `UsersView.vue` (432–436 and its `label` rule) — the other unwrapped bar — and in `TicketsView.vue` (202–…) and `TasksView.vue` (169–…), which already wrap but should not keep their own copy of the rule.

**c. Sortable headers.** Import `AppSortHeader` and declare the column map in `<script setup>`. For `CustomersView.vue`, replace the eight `<th>`s at 116–123 with five sortable headers and three plain ones:

```vue
            <tr>
              <AppSortHeader field="name" :label="t('customer.field.name')" :active-field="customers.filters.sort" :active-order="customers.filters.order" @sort="customers.setSort" />
              <AppSortHeader field="type" :label="t('customer.field.type')" :active-field="customers.filters.sort" :active-order="customers.filters.order" @sort="customers.setSort" />
              <AppSortHeader field="email" :label="t('customer.field.email')" :active-field="customers.filters.sort" :active-order="customers.filters.order" @sort="customers.setSort" />
              <th scope="col">{{ t('customer.field.phone') }}</th>
              <AppSortHeader field="city" :label="t('customer.field.city')" :active-field="customers.filters.sort" :active-order="customers.filters.order" @sort="customers.setSort" />
              <AppSortHeader field="status" :label="t('customer.field.status')" :active-field="customers.filters.sort" :active-order="customers.filters.order" @sort="customers.setSort" />
              <th scope="col">{{ t('customer.field.notesFiles') }}</th>
              <th scope="col">{{ t('common.actions') }}</th>
            </tr>
```

`phone` has no `CustomerSortField` member, `notesFiles` is a `_count` aggregate, `actions` is not data — all three stay plain (Product rule 8).

The other three, by Product rule 8:

| View | Sortable | Plain |
|---|---|---|
| `TicketsView.vue` (129–136) | `subject`, `category`, `priority`, `status` | `customer` (relation), `assignedAgent` (relation), `commentsFiles` (`_count`), `actions` |
| `UsersView.vue` (299–305) | `fullName` → the `user.field.name` label, `email`, `isActive` → the `user.field.status` label, `lastLoginAt` → the `user.field.lastLogin` label | `roles` (many-to-many), `department` (relation), `actions` |
| `TasksView.vue` (110–116) | `title`, `status`, `dueAt` → the `task.due` label | `linkedTicket`, `linkedCustomer`, `assignee` (all relations), `actions` |

Note the three places where the column label and the API field name differ (`isActive`/Status, `lastLoginAt`/Last login, `dueAt`/Due) — the `field` prop must carry the **API** value.

**d. Page size.** Add two props and one handler to the existing `<AppPagination>` (`CustomersView.vue:151–157`):

```vue
        <AppPagination
          v-if="customers.meta"
          :page="customers.meta.page"
          :total-pages="customers.meta.totalPages"
          :total="customers.meta.total"
          :page-size="customers.meta.pageSize"
          @change="onPageChange"
          @page-size-change="onPageSizeChange"
        />
```

with, beside `onPageChange` (53–55):

```ts
function onPageSizeChange(pageSize: number): void {
  customers.setPageSize(pageSize);
}
```

`meta.pageSize` is the server's echo of the applied size (`PaginationMetaDto`), so the select cannot drift from what was actually used. Same in the other three views.

---

## Edge Cases & Failure Modes

- **A sort request 400s** (a typo in a `field` prop, or Story 25 not deployed) → `load()`'s `catch` in each store (`stores/customers.ts:79–88`) clears `items`, clears `meta`, and sets `error`, so the view falls into the `AppStateBlock variant="error"` branch (`CustomersView.vue:101–106`) with the server message. The list is not left showing stale rows next to an error — that guard already exists and its comment at 84 says why.
- **Clicking a header twice quickly** → two `load()` calls; `latestRequestId` (`stores/customers.ts:63–93`) discards the first response. No new guard.
- **Sorting while a debounced search is pending** → the `setTimeout` at `CustomersView.vue:34–36` still fires and calls `setSearch`, which resets `page` to 1 but leaves `filters.sort` untouched. Sort and search compose. Assert this.
- **Page size raised while on a high page** → `setPageSize` resets `filters.page = 1` before loading, so the request is always in range. Without the reset, `skip` would exceed `total` and the user would land on a legitimately empty page — not an error, but an empty table with rows available.
- **A `pageSizeOptions` value above 100** → the API returns 400 from `@Max(MAX_PAGE_SIZE)`. `PAGE_SIZE_OPTIONS` is the single place this can go wrong; it is exported so a test can assert `Math.max(...PAGE_SIZE_OPTIONS) <= 100`.
- **`meta` is `null`** (a fresh error state) → `v-if="customers.meta"` on `AppPagination` already prevents the select from rendering with an undefined size. Unchanged behaviour.
- **RTL** → the sort indicator is a **vertical** arrow chosen by name, so it does not flip; the pagination chevrons are `chevron-start`/`chevron-end` and do flip, which `AppPagination.spec.ts:45` already asserts. The sticky header, the table padding, and the filter bar all use logical properties. Verify by eye under `ar`: the header text aligns to the right, the arrow stays vertical, and the table scrolls from the right edge.
- **Sticky header inside a horizontally scrolling table** → `position: sticky` with `inset-block-start: 0` sticks vertically while scrolling horizontally with the row. `z-index: 1` keeps it above `td` backgrounds. If a `td` ever gets its own stacking context, the header will slip under it — the hover rule at `.data-table tbody tr:hover td` is a background change only, so it does not.
- **A very narrow screen (320px)** → `.data-table-wrap` scrolls horizontally; `white-space: nowrap` on `thead th` keeps headers from wrapping into unreadable stacks; the `@media (max-width: 767px)` block tightens cell padding and makes each filter label full-width so the bar stacks rather than squeezing. Check all four screens at 320, 768, and 1200px.
- **A screen reader on a sorted table** → the active `<th>` announces "ascending"/"descending" via `aria-sort`; inactive ones announce "none". Verify the attribute is on the `<th>`, not the `<button>` — this is the single most common way this control is built wrong.
- **`prefers-reduced-motion`** → no animation is added, so the existing block at `main.css:150–159` has nothing new to suppress.
- **Sort state is lost on navigation away and back**, and a sorted list cannot be shared by URL (Product rule 12). Accepted; recorded here so it is not filed as a bug.

---

## Test Plan

1. **Unit — new `apps/web/src/components/AppSortHeader.spec.ts`.** `'renders a th with aria-sort="none" when not the active field'`; `'renders aria-sort="ascending" and the sort-asc icon when active and asc'`; `'renders aria-sort="descending" and the sort-desc icon when active and desc'`; `'emits sort with its field on click'`; `'renders no icon when inactive'`; `'puts aria-sort on the th, not the button'`. Mount inside a `<table><thead><tr>` host so the `<th>` is valid; follow the mounting shape in `AppTabs.spec.ts`.
2. **Unit — `apps/web/src/components/AppPagination.spec.ts`.** All 5 existing tests pass **unmodified**. Add: `'renders no page-size select when pageSize is omitted'`; `'renders the select with the current pageSize when supplied'`; `'emits pageSizeChange with a number on select'`; `'offers no option above the API MAX_PAGE_SIZE of 100'`.
3. **Unit — `apps/web/src/components/AppIcon.spec.ts`.** Extend to cover `sort-asc` and `sort-desc` following the existing enumeration; assert neither is flipped under `ar` (contrast with the existing `chevron-start` case).
4. **Unit — `apps/web/src/stores/customers.spec.ts`** (19 tests today). Add: `'setSort sets the field ascending and resets page to 1'`; `'setSort on the active field flips the direction'`; `'setSort on a new field resets the direction to asc'`; `'setPageSize resets page to 1'`; `'currentParams omits sort and order when sort is empty'`; `'currentParams omits order when sort is empty but order is set'`.
5. **Unit — `stores/tickets.spec.ts`, `stores/users.spec.ts`, `stores/tasks.spec.ts`.** The same six cases in each, against that store's fields.
6. **Unit — `apps/web/src/api/customers.spec.ts`** (6 tests today). Add one asserting `listCustomers({ sort: 'name', order: 'desc' })` puts both on the query string, and one asserting `listCustomerOptions()` still sends **only** `pageSize=100`. Mirror in `api/tickets.spec.ts` and `api/tasks.spec.ts`.
7. **Unit — `views/CustomersView.spec.ts`, `TicketsView.spec.ts`, `UsersView.spec.ts`, `TasksView.spec.ts`.** All 38 existing tests must pass, with any header assertion **updated** to the new markup rather than removed. Add per view: `'renders a sortable header for each API-sortable column and a plain th for the rest'`; `'calls store.setSort with the API field name when a header button is clicked'`; `'calls store.setPageSize when the page-size select changes'`.
8. **Unit — `apps/web/src/i18n/i18n.spec.ts`.** No new test needed; the existing parity test at 39–47 covers the new keys automatically. Confirm it still passes — that is the check that both catalogues were edited.
9. **Nothing in `apps/api` changes**, so all 406 backend tests must pass untouched.

---

## Verification Steps

1. **Frontend type checking:** from the repo root, `npm run typecheck`. Must exit 0. This is what catches a `field` prop that is not a member of the mirrored sort union.
2. **Frontend tests:** `npm run test --workspace @crm/web`. Must report **at least** the 523 that passed before, all green, plus the new cases.
3. **Frontend lint:** `npm run lint --workspace @crm/web`. It runs with `--max-warnings 0`, so a `vue/…` warning fails the build.
4. **Frontend builds:** `npm run build --workspace @crm/web` (this runs `vue-tsc` then `vite build`).
5. **Backend untouched:** `git diff --name-only` must list no path beginning `apps/api/`; `npm run test --workspace @crm/api` reports 406 passing.
6. **Frontend runs:** `npm run dev:api` and `npm run dev:web` from the repo root, then sign in as the administrator.
7. **Sorting, all four screens:** on `/customers`, `/tickets`, `/users`, `/tasks` — click each sortable header. Confirm the order changes, a second click reverses it, the arrow appears only on the active column, and the network tab shows `sort=` and `order=` with the **camelCase API value**. Confirm the first load of each screen sends **no** `sort` parameter at all.
8. **Non-sortable headers:** confirm `Customer`, `Roles`, `Notes / Files`, `Comments / Files`, `Assignee`, and every `Actions` header is not clickable and shows no arrow.
9. **Page size:** change Rows per page to 100 on each screen. Confirm the row count grows, the summary line updates, the page resets to 1, and `pageSize=100` appears in the request. Set it to 10 while on page 3 and confirm you land on page 1.
10. **Sort + filter + search together:** on `/tickets`, set a status filter, type a search term, then sort by Priority. All three must appear in one request and the result must respect all three.
11. **Regression:** `Regression:` on `/workspace` and `/communication`, confirm the `AppPagination` instances there still render the two-button form with **no** page-size select and still page correctly — those call sites were not edited.
12. **RTL:** switch to Arabic with the `LocaleSwitcher`. On every list screen confirm the header text aligns to the right, the sort arrow stays **vertical** (not mirrored), the pagination chevrons **do** mirror, the sticky header still sticks, and the table scrolls from the correct edge.
13. **Responsive:** at 320px, 768px, and 1200px on all four screens — the filter bar wraps instead of overflowing (this is the `CustomersView`/`UsersView` fix; compare against the pre-change behaviour), the table scrolls inside its own container, and the page body never scrolls horizontally.
14. **Keyboard and screen reader:** Tab to a sort header and press Enter and Space — both must sort. Confirm a visible focus ring. With a screen reader, confirm the active column announces "ascending" or "descending".

---

## Done Criteria

- [ ] `.data-table-wrap`, `.data-table`, `.data-table__actions`, and `.filter-bar` exist in `main.css`; all four views use them, and the four duplicated table blocks plus the four duplicated filter blocks are **deleted**.
- [ ] `CustomersView.vue`'s and `UsersView.vue`'s filter bars wrap on a narrow screen — the missing-`flex-wrap` defect at the old lines 184 and 432 is gone.
- [ ] `AppSortHeader.vue` exists, renders a `<th scope="col">` with `aria-sort` on the **cell**, a real `<button>` inside, and a name-selected vertical arrow that is not flipped under RTL.
- [ ] `sort-asc` and `sort-desc` are in `ICON_PATHS` and covered by `AppIcon.spec.ts`.
- [ ] `AppPagination.vue` exports `PAGE_SIZE_OPTIONS` (max value 100), renders the select only when `pageSize` is supplied, emits `pageSizeChange`, and passes all 5 of its original tests unmodified.
- [ ] All four stores carry `sort`/`order` in `filters`, expose `setSort` and `setPageSize`, reset `page` to 1 on both, and omit `sort`/`order` from the request when no column is selected.
- [ ] All four API param interfaces declare a `sort` union mirroring Story 25's enum plus `order`; `listCustomerOptions()` and `listAgents()` still send only `pageSize: 100`.
- [ ] Every sortable column in all four tables sorts correctly over HTTP; every non-sortable column renders as a plain, non-interactive `<th>`.
- [ ] `common.pageSize.*` and `common.sort.*` exist in **both** catalogues with identical key sets; `i18n.spec.ts` passes.
- [ ] No file under `apps/api/` is modified; all 406 backend tests pass untouched.
- [ ] All 523 previously passing web tests still pass, with header assertions updated rather than weakened, plus the new cases.
- [ ] `npm run typecheck`, `npm run lint`, `npm run build`, and both test suites pass from the repo root.
- [ ] All four list screens are usable at 320px, and the page body never scrolls horizontally at any of the three checked widths, in both `en` and `ar`.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 27.**
