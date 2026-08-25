# Story 12 — Frontend: customer list, details page, and create/edit forms (Story: 3)

## Prerequisites

- [Story 10 completed](10-story-customer-api-3.md): `GET/POST /api/customers`, `GET/PATCH /api/customers/:id`, and `PATCH /api/customers/:id/status`, with the `CustomerResponseDto` / `PaginatedCustomersDto` field sets this story mirrors.
- [Story 11 completed](11-story-customer-notes-attachments-interactions-3.md): the notes, attachments, and interactions routes, and the download route's `Content-Disposition` behaviour the browser flow depends on.
- [Story 08 completed](../authentication-and-user-management/08-story-frontend-auth-user-management-2.md): `apiClient` with its token and `401`-refresh interceptors, `toErrorMessage`, `useAuthStore` with `can()`, the router guard reading `meta.permissions`, and `UsersView.vue` — the template every screen here follows.
- **Both dev servers must be running** for manual verification. `apps/web/.env` keeps `VITE_API_BASE_URL` **empty** in development so the Vite proxy makes the SPA and the API one origin.
- **No backend change is permitted in this story.** If a screen needs a field the API does not return, the fix is a revision of Story 10 or 11, not a frontend workaround.

---

## Story Goal

Put the customer API in front of a support agent: a searchable list, a profile page with its full history, and forms to create and edit.

User-visible outcomes:

1. `/customers` — a paginated, searchable, filterable list with a "Create customer" button behind `customers:write`.
2. `/customers/:id` — a details page showing contact information, status, and assignment, with tabbed **Notes**, **Attachments**, and **History** panels.
3. `/customers/new` and `/customers/:id/edit` — one form component serving both, behind `customers:write`.
4. Status changes from the details page, with archive controls visible only to a caller holding `customers:archive`.
5. A "Customers" link in the sidebar, visible only with `customers:read`; typing `/customers` without it lands on the existing "Not allowed" page while **remaining signed in**.

**Not in scope:** any backend file. A customer portal. Bulk actions, CSV export, print views. Optimistic updates — every mutation re-reads from the server, exactly as `useUsersStore` does.

---

## Product rules (from story)

| Topic | **Decision** | Why |
|---|---|---|
| Permission gating | Route `meta.permissions` **and** per-control `auth.can(...)`, both advisory | The API is the authority (Story 08's rule). The frontend hides what the user cannot do so the UI does not present dead buttons. |
| List state | One Pinia store, `useCustomersStore`, holding filters, items, and meta — the shape of `useUsersStore` | A second state pattern in one application is a maintenance tax with no benefit. |
| Detail state | The **same** store, with a `current` customer plus `notes`, `attachments`, and `interactions` arrays | A separate detail store would duplicate the error and loading plumbing for one screen. |
| Create and edit | **One** `CustomerFormView.vue` keyed on the presence of a route `id` | The field set is identical; two components would drift the moment a field is added. |
| Navigation after save | `router.replace` to the details page of the saved customer | The form is a step, not a destination — the back button must not return to a stale form. |
| Attachment download | `apiClient` with `responseType: 'blob'`, then an object URL and a synthetic anchor click | A plain `<a href>` sends no `Authorization` header, so the endpoint would 401. This is the only way to download an authenticated file from an SPA holding its token in memory. |
| Deleting things | `window.confirm` before any destructive action, matching `UsersView.vue`'s deactivate flow | A modal component library does not exist in this application, and inventing one is not this story's job. |
| Empty states | Every list renders explicit copy when empty, never a bare region | "No notes yet." is information; a blank panel is a bug report. |
| Dates | `new Date(value).toLocaleString()` inline, as `UsersView.vue` line 313 does | A shared formatting utility is one function and a new directory; not worth it until a third screen needs it. |

---

## Context — Read These Files First

1. `apps/web/src/views/UsersView.vue` — **all 519 lines, and this is the single most important read in the story.** Script setup at **lines 1–205** (debounced search with `onBeforeUnmount` cleanup at **lines 28–44**, the create / edit / roles / reset panel pattern, `onMounted` at **lines 202–205**), template at **lines 208–423** (filters form, loading / error / empty / table branches, `users__pagination`, panels), scoped styles at **lines 426–519**. Every class name, state branch, and control layout in this story is derived from it.
2. `apps/web/src/stores/users.ts` — all 204 lines. **Copy the structure exactly**: the `filters` reactive object (**lines 30–37**), `currentParams()` mapping empty strings to `undefined` (**lines 39–48**), the `latestRequestId` race guard (**lines 50–82**) which is what keeps a slow search response from overwriting a fast one, `loadLookups` swallowing its own error (**lines 84–94**), and the action pattern of "call the API, `await load()`, return a boolean" (**lines 119–182**).
3. `apps/web/src/api/users.ts` — all 118 lines. The "mirrors `<DtoName>`" comment on every interface, and the thin `async` wrapper per endpoint returning `response.data`.
4. `apps/web/src/api/client.ts` — `apiClient` (**lines 8–36**), the `401` retry that leaves **`403` untouched** (**lines 42–75**), and `toErrorMessage` (**lines 88–116**), whose `403` branch already renders "You do not have permission to do this (…)". Every store action funnels errors through it.
5. `apps/web/src/router/index.ts` — the `RouteMeta` declaration (**lines 4–12**), the route array (**lines 14–51**) where new routes go **before** the catch-all at **lines 46–50**, and the guard (**lines 58–84**) that redirects a permission failure to `forbidden` rather than returning `false`.
6. `apps/web/src/layouts/AppLayout.vue` — **line 33**, the `v-if="auth.can('users:read')"` nav link. The customers link is its sibling.
7. `apps/web/src/views/UsersView.spec.ts` — all 225 lines. `vi.mock` of both stores (**lines 9–13**), the `mockAuth` / `mockUsers` reactive-stub helpers (**lines 42–87**), and the `describe`/`beforeEach` at **lines 88–89**. Every component spec here follows it.
8. `apps/web/src/stores/health.spec.ts` **lines 1–36** — `vi.mock('@/api/…')`, `setActivePinia(createPinia())` in `beforeEach`, and the typed `vi.mocked(...)` handle.
9. `apps/web/src/assets/main.css` — the CSS custom properties (`--color-surface`, `--color-border`, `--color-accent`, `--color-error`, `--color-ok`, `--radius`) and `.sr-only` (**lines 25–35**). Use these tokens; **do not** introduce a hard-coded colour.
10. `apps/web/tsconfig.app.json` — `strict`, `noUnusedLocals`, and `noUnusedParameters` are on. An unused import fails `npm run typecheck`, not just lint.
11. Open `http://localhost:3000/api/docs` with the API running and read the **customers**, **customer-notes**, **customer-attachments**, and **customer-interactions** tags. The DTOs there are the contract; mirror them field for field.

---

## Frontend Tasks

### 1 — The API layer

**Create file: `apps/web/src/api/customers.ts`**

Mirror the backend DTOs exactly, with the same "mirrors X" comments `apps/web/src/api/users.ts` uses.

```ts
import { apiClient } from './client';

export type CustomerStatus = 'PROSPECT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type CustomerType = 'INDIVIDUAL' | 'COMPANY';
export type InteractionChannel = 'PHONE' | 'EMAIL' | 'CHAT' | 'MEETING' | 'OTHER';
export type InteractionDirection = 'INBOUND' | 'OUTBOUND';

/** The values, in display order, for every picker in this feature. Keep in step
 *  with the Prisma enums in apps/api/prisma/schema.prisma. */
export const CUSTOMER_STATUSES: CustomerStatus[] = ['PROSPECT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'];
export const CUSTOMER_TYPES: CustomerType[] = ['INDIVIDUAL', 'COMPANY'];
export const INTERACTION_CHANNELS: InteractionChannel[] = ['PHONE', 'EMAIL', 'CHAT', 'MEETING', 'OTHER'];

/** Mirrors UserRefDto in apps/api/src/customers/dto/customer-response.dto.ts */
export interface UserRef {
  id: string;
  fullName: string;
  email: string;
}

/** Mirrors CustomerResponseDto. */
export interface Customer {
  id: string;
  type: CustomerType;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  country: string | null;
  postalCode: string | null;
  status: CustomerStatus;
  assignedAgent: UserRef | null;
  createdBy: UserRef | null;
  counts: { notes: number; attachments: number; interactions: number };
  createdAt: string;
  updatedAt: string;
}
```

Plus `PaginatedCustomers` (reuse `PaginationMeta` by importing it from `./users`, which already mirrors `PaginationMetaDto` at **lines 24–29** — one definition, not two), `CustomerNote`, `CustomerAttachment`, `CustomerInteraction`, and the payload types.

`ListCustomersParams` may declare **only** `page`, `pageSize`, `search`, `status`, `type`, `assignedAgentId`, and `city`. Story 10's `forbidNonWhitelisted` turns any other key into a `400`.

Functions — one thin wrapper each: `listCustomers`, `getCustomer`, `createCustomer`, `updateCustomer`, `setCustomerStatus`, `listNotes`, `createNote`, `updateNote`, `deleteNote`, `listAttachments`, `uploadAttachment`, `deleteAttachment`, `downloadAttachment`, `listInteractions`, `createInteraction`, `deleteInteraction`.

The two that are not boilerplate:

```ts
export async function uploadAttachment(customerId: string, file: File): Promise<CustomerAttachment> {
  const form = new FormData();
  form.append('file', file);

  // The instance defaults to application/json; multipart needs its own type so
  // the browser can attach the boundary.
  const response = await apiClient.post<CustomerAttachment>(
    `/customers/${customerId}/attachments`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );

  return response.data;
}

/**
 * The download endpoint needs the Authorization header, so a plain <a href>
 * would 401 — the access token lives in memory, not in a cookie. Fetch the
 * bytes through apiClient, then hand the browser an object URL.
 */
export async function downloadAttachment(customerId: string, attachment: CustomerAttachment): Promise<void> {
  const response = await apiClient.get<Blob>(
    `/customers/${customerId}/attachments/${attachment.id}/content`,
    { responseType: 'blob' },
  );

  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = attachment.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
```

Also add `listAgents()` to **`apps/web/src/api/users.ts`** — a thin call to `listUsers({ pageSize: 100 })` returning `items`, used to populate the assigned-agent picker. Put it there, not in `customers.ts`: it is a users endpoint, and the file already owns `/users`.

### 2 — The store

**Create file: `apps/web/src/stores/customers.ts`**

`defineStore('customers', () => { … })`, setup style, mirroring `apps/web/src/stores/users.ts` throughout.

State: `items`, `meta`, `current`, `notes`, `attachments`, `interactions`, `agents`, `isLoading`, `isSaving`, `error`.

Filters, exactly as `users.ts` **lines 30–48**:

```ts
  const filters = reactive({
    page: 1,
    pageSize: 20,
    search: '',
    status: '' as CustomerStatus | '',
    type: '' as CustomerType | '',
    city: '',
  });

  function currentParams(): ListCustomersParams {
    return {
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.search || undefined,
      status: filters.status || undefined,
      type: filters.type || undefined,
      city: filters.city || undefined,
    };
  }
```

**The empty-string-to-`undefined` mapping is load-bearing**: axios omits an `undefined` param, and sending `status=''` would be a `400` from the enum validator.

`load()` — **copy the `latestRequestId` guard from `users.ts` lines 50–82 verbatim.** On failure it clears `items` and `meta` so a stale list never sits beside an error message.

`loadDetail(id)` — sets `isLoading`, fetches the customer and its three child collections concurrently:

```ts
      const [customer, noteList, attachmentList, interactionList] = await Promise.all([
        getCustomer(id),
        listNotes(id),
        listAttachments(id),
        listInteractions(id),
      ]);
```

On failure, set `error` and leave `current` **null** — the view branches on that. Guard it with the same request-id technique so switching customers quickly cannot cross-populate.

`loadAgents()` — swallows its own error like `loadLookups` (**lines 84–94**): a caller without `users:read` gets a `403` here, and the assigned-agent picker simply stays empty rather than breaking the whole form. **This is expected for a plain `support-agent` and must not surface as an error.**

Actions, each following the "call, refresh, return boolean" contract of `users.ts` **lines 119–182**:

- `create(payload)` → returns the new customer's **id** or `null`, because the view navigates to it.
- `update(id, payload)`, `setStatus(id, status)` → `await loadDetail(id)`, return boolean.
- `addNote`, `editNote`, `removeNote`, `uploadFile`, `removeAttachment`, `addInteraction`, `removeInteraction` → refresh only the collection they touched (`notes.value = await listNotes(id)`), not the whole page. Also refresh `current` after a note or attachment change so `counts` stays truthful.
- `clearDetail()` — resets `current`, the three arrays, and `error`. Called from `onUnmounted` in the detail view so a stale customer never flashes on the next visit.

Every `catch` sets `error.value = toErrorMessage(caught)` and returns `false`/`null`. Never throw out of a store action.

### 3 — Routes and navigation

**File: `apps/web/src/router/index.ts`** — insert **before** the `forbidden` route (**line 39**), keeping the catch-all last:

```ts
  {
    path: '/customers',
    name: 'customers',
    component: () => import('@/views/CustomersView.vue'),
    meta: { title: 'Customers', permissions: ['customers:read'] },
  },
  {
    path: '/customers/new',
    name: 'customer-create',
    component: () => import('@/views/CustomerFormView.vue'),
    meta: { title: 'New customer', permissions: ['customers:write'] },
  },
  {
    path: '/customers/:id',
    name: 'customer-detail',
    component: () => import('@/views/CustomerDetailView.vue'),
    meta: { title: 'Customer', permissions: ['customers:read'] },
  },
  {
    path: '/customers/:id/edit',
    name: 'customer-edit',
    component: () => import('@/views/CustomerFormView.vue'),
    meta: { title: 'Edit customer', permissions: ['customers:write'] },
  },
```

`/customers/new` is declared before `/customers/:id` for readability; vue-router ranks a static segment above a dynamic one regardless of order, and the spec below pins that behaviour so a future reorder cannot break it.

**File: `apps/web/src/layouts/AppLayout.vue`** — add beside the Users link at **line 33**:

```html
        <RouterLink v-if="auth.can('customers:read')" to="/customers" class="layout__link">Customers</RouterLink>
```

Change nothing else in this file.

### 4 — `CustomersView.vue` (the list)

**Create file: `apps/web/src/views/CustomersView.vue`**

Structurally `UsersView.vue` with a different noun. Reuse its class-name scheme with a `customers__` prefix and copy the scoped styles at **lines 426–519**, renaming the prefix.

Script setup:

- `const auth = useAuthStore(); const customers = useCustomersStore();`
- The debounced `searchTerm` watcher with `onBeforeUnmount` cleanup — **copy `UsersView.vue` lines 28–44**, including the `clearTimeout` on unmount. Without it a pending timer fires against a dead component.
- `onStatusFilterChange` / `onTypeFilterChange` handlers reading `(event.target as HTMLSelectElement).value`.
- `previousPage` / `nextPage` bounded by `customers.meta` (**lines 56–66**).
- `statusLabel(status)` mapping the enum to sentence case: `PROSPECT` → "Prospect", and so on. The API returns SCREAMING_CASE; **users never see it**.
- `onMounted(() => { void customers.load(); })`.

Template, in this order:

1. `customers__header` with `<h1>Customers</h1>` and a `RouterLink` to `customer-create` styled as a button, `v-if="auth.can('customers:write')"`.
2. A `customers__filters` form with Search (`type="search"`, placeholder "Name, company, email or phone"), Status, and Type selects, each label wrapping its control.
3. The four exclusive branches, in the order `UsersView.vue` uses at **lines 282–290**: loading, error (`role="alert"`), empty ("No customers match these filters."), then the table.
4. The table with a `<caption class="sr-only">Customers</caption>` and columns: Name, Type, Email, Phone, City, Status, Notes/Files, Actions. The "Name" cell is a `RouterLink` to `customer-detail`. The Actions cell holds a "View" link and an "Edit" link (`v-if="auth.can('customers:write')"`).
5. The pagination block copied from **lines 339–353**, with both buttons bounds-disabled.

Render the status as a `<span class="customers__badge" :class="'customers__badge--' + customer.status.toLowerCase()">`, with four rules in the scoped styles built from `--color-ok`, `--color-accent`, `--color-text-muted`, and `--color-border` via `color-mix`, the way `AppLayout.vue` line 99 already does.

### 5 — `CustomerFormView.vue` (create and edit)

**Create file: `apps/web/src/views/CustomerFormView.vue`**

One component, both modes:

```ts
const route = useRoute();
const router = useRouter();
const customerId = computed(() => (route.params.id as string | undefined) ?? null);
const isEdit = computed(() => customerId.value !== null);
```

- `onMounted`: `void customers.loadAgents();` and, when `isEdit`, `await customers.loadDetail(customerId.value)` then copy `customers.current` into the local `reactive` form. **Never bind inputs straight to the store object** — a cancelled edit would have already mutated the list.
- The form fields: Name (required), Type (select), Company name, Email, Phone, Alternate phone, Address line 1, Address line 2, City, Country, Postal code, Assigned agent (select over `customers.agents`, with a "Unassigned" empty option). On create only, a Status select defaulting to `PROSPECT`.
- Submit: build the payload mapping every empty string to `null` on edit (so clearing a field actually clears it) and to `undefined` on create (so an untouched field is simply absent). **This asymmetry is deliberate and follows Story 10's null-versus-absent contract** — write a comment saying so.
- On success: `await router.replace({ name: 'customer-detail', params: { id } })`. On failure, stay put and render `customers.error` in a `role="alert"` block above the fields.
- A Cancel button calls `router.back()`.
- Disable submit while `customers.isSaving` and when Name is under two characters — the same client-side floor the API enforces.

Group the fields into three `<fieldset>`s with legends "Identity", "Contact", and "Assignment" so the form is navigable rather than one long column.

### 6 — `CustomerDetailView.vue` (the profile)

**Create file: `apps/web/src/views/CustomerDetailView.vue`**

The largest component in the story. Sections:

**Header.** Name, company name, a status badge, and the controls: "Edit" (`RouterLink`, `v-if="auth.can('customers:write')"`), a status `<select>` bound to a `changeStatus` handler (`v-if="auth.can('customers:write')"`), and — only when `auth.can('customers:archive')` — the `ARCHIVED` option is offered at all. Build the status option list as a computed:

```ts
const statusOptions = computed(() =>
  CUSTOMER_STATUSES.filter((status) => status !== 'ARCHIVED' || auth.can('customers:archive')),
);
```

When the customer is **already** `ARCHIVED` and the caller lacks `customers:archive`, disable the whole select — every transition away from archived would `403` (Story 10's both-directions rule), and a control that always fails is worse than no control.

**Overview panel.** A definition list of contact fields, each rendering `—` when null, plus "Assigned to", "Created by", and "Created" / "Last updated" timestamps.

**Tabs.** `const activeTab = ref<'notes' | 'attachments' | 'history'>('notes');` rendered as buttons with `role="tab"`, `:aria-selected`, and a `customers__tab--active` class. Do **not** pull in a tab library.

- **Notes tab.** An "Add note" `<textarea>` + Save, `v-if="auth.can('notes:write')"`. Then the list, newest first, each showing the author's name, the timestamp, and the body. Edit and Delete buttons appear only when `note.author.id === auth.user?.id` (Story 11 rejects anything else with a `403`, and offering the button would be a lie). Delete goes through `window.confirm`. Empty state: "No notes yet."
- **Attachments tab.** A file `<input type="file">` + Upload, `v-if="auth.can('attachments:write')"`. The list shows `fileName`, a human size (`formatBytes`, a five-line local helper), the uploader, and the date, with a "Download" button calling the store's download action and a "Delete" button behind `attachments:write` and `window.confirm`. Empty state: "No attachments yet." Show a client-side hint under the input: "Up to 10 MB. PDF, images, text, CSV, Word, and Excel." — **the API is still the authority**; this only saves a round trip.
- **History tab.** An "Log interaction" form (`v-if="auth.can('interactions:write')"`) with Channel, Direction, Subject, Body, and an `<input type="datetime-local">` for `occurredAt` defaulting to now. Convert to an ISO string with `new Date(value).toISOString()` on submit — `datetime-local` yields a local, zoneless string the API will not accept as-is. Then the timeline, newest first, each entry showing the channel, direction, subject, body, who logged it, and when it occurred.
  Below the timeline, render this note **verbatim** as a `<p class="customers__muted">`:
  > "Support tickets will appear in this timeline once ticketing ships. Interactions logged here are the current history."
  This is honest scoping, not a placeholder to be cleaned up later.

`onUnmounted(() => customers.clearDetail())`.

When `customers.error` is set and `customers.current` is null, render only the error block — a half-populated profile is worse than an error.

---

## Edge Cases & Failure Modes

- **Direct navigation to `/customers` without `customers:read`.** The guard at `apps/web/src/router/index.ts` **lines 77–81** redirects to `forbidden`; the user **stays signed in**. This is Story 08's contract and the spec below re-asserts it for the new routes.
- **A `403` from any customer call.** `apiClient`'s interceptor leaves `403` untouched (**lines 45–50**) and `toErrorMessage` renders "You do not have permission to do this (…)" (**lines 92–98**). It must **never** trigger a refresh or a sign-out.
- **An expired access token mid-session.** The `401` interceptor refreshes and replays once. Nothing in this story may special-case `401`.
- **A slow search response arriving after a faster later one.** The `latestRequestId` guard copied from `users.ts` **lines 50–82** discards it. Without that guard, typing "ort" then "orten" can leave the "ort" results on screen — this is the single most likely bug in the story.
- **Switching customers faster than the detail loads.** The same guard applied to `loadDetail`. Otherwise customer A's notes render under customer B's header.
- **`/customers/not-a-uuid`.** The API's `ParseUUIDPipe` returns `400`; the view shows the message and no profile. Do **not** validate uuids in the router — a second source of truth for what an id is.
- **An empty filter value.** `status: ''` must become `undefined` in `currentParams()`, or the API rejects the request with `400` from `@IsEnum`. Covered by a store test.
- **An unknown query parameter.** Impossible if `ListCustomersParams` stays limited to the seven declared keys. Adding an eighth without a backend change is an instant `400`.
- **Uploading a 12 MB file.** The API answers `413`; `toErrorMessage` renders its message. The input carries no `accept` filter narrow enough to prevent it, and no client-side size check is added — one enforcement point, and it is the server's.
- **Uploading an SVG.** `400` from Story 11's whitelist, surfaced as-is.
- **A download while the session has expired.** The blob request goes through `apiClient`, so the `401` interceptor refreshes and replays it like any other call. That is precisely why the download must **not** use a bare `<a href>`.
- **`URL.revokeObjectURL` timing.** Revoking immediately after `anchor.click()` is safe in current browsers — the download has already been handed off. If a browser is found where it is not, move the revoke into a `setTimeout(…, 0)` and note why.
- **A `datetime-local` value in a non-UTC zone.** `new Date(local).toISOString()` converts correctly. Sending the raw field value would be off by the offset and could trip Story 11's five-minute future check for anyone east of UTC. **This is a real trap; the spec pins it.**
- **A `support-agent` opening the form.** They hold `customers:write` but **not** `users:read`, so `loadAgents()` gets a `403`. It is swallowed, the picker stays empty, and the rest of the form works. Verified manually in step 14.
- **Archiving as a `support-supervisor`.** The `ARCHIVED` option is not offered, and if reached by other means the API returns `403` and the store surfaces it. The UI is not the enforcement.
- **`counts` going stale.** After adding a note the store re-reads `current`, so the tab badges stay honest. A missed refresh here is invisible in testing and obvious to a user.
- **A note author who was deactivated.** `note.author` still resolves (users are never deleted, Story 07) and the name renders normally.
- **Unicode names and filenames.** Arabic customer names render right-to-left inside the cell; no special handling is added and none is needed. A downloaded file keeps its Arabic name via Story 11's `filename*=UTF-8''` header.

---

## Test Plan

1. **Unit — new file `apps/web/src/stores/customers.spec.ts`.** `vi.mock('@/api/customers')`, `setActivePinia(createPinia())` per `apps/web/src/stores/health.spec.ts` **lines 1–36**.
   - `load` populates `items` and `meta`; a rejection sets `error` **and clears `items` and `meta`**.
   - `currentParams` omits every empty filter — assert `listCustomers` was called with an object containing **no** `status`, `type`, `search`, or `city` key when they are `''`.
   - `setSearch` resets `page` to 1; so do the status and type setters.
   - **The race test:** issue two `load()` calls with controlled promises, resolve the **second** first, then the first, and assert `items` holds the second response. This is the `latestRequestId` guard.
   - `loadDetail` populates `current`, `notes`, `attachments`, and `interactions`; a rejection leaves `current` **null** and sets `error`.
   - `loadAgents` failing leaves `error` **null** and `agents` empty — a `403` there is expected, not an error.
   - `create` returns the new id on success and `null` on failure.
   - `addNote` refreshes `notes` **and** `current`; on failure it does neither and returns `false`.
   - `clearDetail` empties `current` and all three collections.
2. **Unit — `apps/web/src/api/customers.spec.ts`** (new). Mock `apiClient`.
   - `uploadAttachment` posts a `FormData` containing the file under the key `file`, with a `multipart/form-data` content type.
   - `downloadAttachment` requests `responseType: 'blob'`, creates an object URL, clicks an anchor carrying the `fileName` as `download`, and calls `revokeObjectURL`. Stub `URL.createObjectURL` / `URL.revokeObjectURL` — jsdom does not implement them.
   - `listCustomers` passes its params object through untouched.
3. **Unit — `apps/web/src/router/index.spec.ts`** (extend; keep every existing test).
   - `/customers`, `/customers/new`, `/customers/abc`, and `/customers/abc/edit` resolve to `customers`, `customer-create`, `customer-detail`, and `customer-edit`.
   - **`/customers/new` resolves to `customer-create`, not `customer-detail` with `id: 'new'`** — the static-over-dynamic proof.
   - Signed out, `/customers` redirects to `login` with `query.redirect === '/customers'`.
   - Signed in **without** `customers:read`, `/customers` redirects to `forbidden`.
   - Signed in with `customers:read` but **without** `customers:write`, `/customers/new` redirects to `forbidden`.
   - The catch-all still resolves `/nope` to `not-found`.
4. **Component — `apps/web/src/views/CustomersView.spec.ts`** (new). Follow `UsersView.spec.ts` **lines 1–90** for the mocked-store helpers.
   - One table row per item, showing name, email, and the sentence-case status.
   - Loading, error (`[role="alert"]`, no table), and empty states each render exclusively.
   - "Create customer" is absent without `customers:write` and present with it.
   - Previous is disabled on page 1; Next is disabled on the last page.
   - Changing the status filter calls the store's setter.
   - Typing in the search box calls `setSearch` **once** after the debounce — advance with `vi.useFakeTimers()`.
   - The name cell links to `/customers/<id>`.
5. **Component — `apps/web/src/views/CustomerFormView.spec.ts`** (new).
   - In create mode (no route `id`), fields start empty and `loadDetail` is **not** called.
   - In edit mode, `loadDetail` is called and the fields are pre-filled from `current`.
   - Submit in create mode calls `create` with the typed values, and empty optional fields are **absent** from the payload.
   - Submit in edit mode sends emptied fields as **`null`**, not `''`. **The null-versus-absent proof.**
   - A successful create calls `router.replace` with `{ name: 'customer-detail', params: { id } }`.
   - A failed submit renders `error` in `[role="alert"]` and does **not** navigate.
   - Submit is disabled while `isSaving` and when the name is one character.
6. **Component — `apps/web/src/views/CustomerDetailView.spec.ts`** (new).
   - Renders the customer's name, status badge, and contact fields, with `—` for null values.
   - Renders only the error block when `error` is set and `current` is null.
   - The three tabs switch panels; only the active panel's content is in the DOM.
   - The note form is absent without `notes:write`.
   - Note Edit/Delete controls appear only on a note whose `author.id` matches the signed-in user.
   - Deleting a note calls the store action only when `window.confirm` is stubbed `true`.
   - The upload control is absent without `attachments:write`; Download is present for every caller.
   - The interaction form converts a `datetime-local` value to an ISO string before calling `addInteraction`. **Pin this**: assert the argument matches `/\d{4}-\d{2}-\d{2}T.*Z$/`.
   - The status select **omits** `ARCHIVED` without `customers:archive` and **includes** it with.
   - An `ARCHIVED` customer viewed without `customers:archive` renders the status select **disabled**.
   - The ticketing note is rendered in the History tab.
   - `onUnmounted` calls `clearDetail`.
7. **Component — `apps/web/src/layouts/AppLayout.spec.ts`** (extend; keep every existing assertion). The Customers link is present with `customers:read` and absent without it.
8. **No new backend test.** Stories 10 and 11 cover every endpoint consumed here.
9. **No end-to-end browser test.** Consistent with the recorded exclusion in the init-porject and authentication overviews. The browser path is covered manually by Verification Steps 5–18.

---

## Verification Steps

1. **Frontend type-checks:** from `apps/web`, `npm run typecheck`. Exit code 0. `noUnusedLocals` and `noUnusedParameters` are on, so an unused import fails here.
2. **Frontend lints:** from `apps/web`, `npm run lint`. Exit code 0 with `--max-warnings 0`.
3. **Frontend tests:** from `apps/web`, `npm test`. Every spec green, and the process **exits** rather than watching.
4. **Frontend builds:** from `apps/web`, `npm run build`. `vue-tsc` clean and `apps/web/dist/index.html` written.
5. **No token in web storage:** grep `apps/web/src` for `localStorage` and `sessionStorage`. Expect **zero** matches — Story 08's security property must survive this story.
6. **Signed-out redirect:** with both dev servers running, open `http://localhost:5173/customers` in a fresh private window. Expect `/login?redirect=%2Fcustomers`.
7. **Sign in as the administrator.** Expect a redirect to `/customers` and a "Customers" link in the sidebar.
8. **Create a customer:** click "Create customer", fill in name, type Company, email, phone, city, and an assigned agent. Save. Expect a redirect to the details page showing everything entered. **This is the acceptance criterion "Customer can be created, updated and viewed."**
9. **Edit it:** from the details page click Edit, change the name, **clear the city**, and save. Expect the details page to show the new name and `—` for city. Clearing must actually clear — this is the null-versus-absent contract working end to end.
10. **Search and filter:** create a second customer, then search a lower-cased fragment of the first one's name. Expect one row. Filter by Status and by Type. Then search by a phone fragment. **This is the acceptance criterion "Customer search and filtering work."**
11. **Notes:** on the details page, add a note, edit it, and add a second one. Expect newest first, your name as author, and the tab count updating. Then delete one through the confirm dialog.
12. **Attachments:** upload a PDF. Expect it listed with a human-readable size and your name. Click Download — expect the browser to **save** the file (not display it) and the file to open correctly. Then delete it through the confirm dialog. **Together with step 11 this is the acceptance criterion "Customer notes and attachments can be managed."**
13. **Interactions:** log a phone call with `occurredAt` set to yesterday, then an email set to now. Expect the email first in the timeline, both with the right channel and direction, and the ticketing note visible below. **This is the acceptance criterion "Customer ticket/history information is accessible from the profile", within this work item's scope.**
14. **As a support agent:** create a user with only `support-agent`, sign in as them. Expect the Customers link present; the list, details, notes, attachments, and interactions all working; the assigned-agent picker on the form **empty** with no error banner; and **no** "Archive" option in the status select.
15. **As a reporting user:** create one with only `reporting-user`. Expect the list and details to be readable, and **no** create, edit, note, upload, or log controls anywhere.
16. **Forbidden route:** as that reporting user, type `http://localhost:5173/customers/new`. Expect the "Not allowed" page and confirm you are **still signed in** — the header still shows your name and `/customers` still works.
17. **A 403 does not sign you out:** as the reporting user, open DevTools and confirm no request to `/api/auth/refresh` and no redirect to `/login` follows any denied action.
18. **Details are complete:** compare the details page field by field against `GET /api/customers/{id}` in `/api/docs`. Every DTO field is either displayed or deliberately omitted (`storageKey` does not exist client-side). **This is the acceptance criterion "Customer details are displayed correctly."**
19. **Regression:** `/users` still works with all its controls; `/system-status` still reports the API healthy; `/nope` still shows "Page not found"; `document.title` still updates on every navigation.
20. **Regression:** from the repo root, `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`. All four green across both workspaces.
21. **Regression:** from `apps/api`, `npm test` and `npm run test:e2e`. Both green — this story changed **no** backend file, so a failure here means something was edited that should not have been.

---

## Done Criteria

- [ ] `apps/web/src/api/customers.ts` mirrors `CustomerResponseDto`, `NoteResponseDto`, `AttachmentResponseDto`, and `InteractionResponseDto` field for field, and `ListCustomersParams` declares only the seven parameters Story 10 accepts.
- [ ] `PaginationMeta` is imported from `@/api/users` rather than redefined.
- [ ] `uploadAttachment` sends a `FormData` under the field name `file`; `downloadAttachment` goes through `apiClient` with `responseType: 'blob'` and revokes its object URL.
- [ ] `useCustomersStore` mirrors `useUsersStore`'s structure, maps empty filters to `undefined`, and carries the `latestRequestId` race guard on **both** `load` and `loadDetail`.
- [ ] `loadAgents` swallows its `403` and leaves `error` null.
- [ ] Every store action returns a boolean (or an id) and routes its failures through `toErrorMessage`; none of them throw.
- [ ] Four routes exist with `meta.permissions` of `customers:read` (list, detail) and `customers:write` (create, edit), all declared **before** the catch-all, which is still last.
- [ ] The sidebar shows "Customers" only with `customers:read`, and nothing else in `AppLayout.vue` changed.
- [ ] `CustomersView.vue` renders loading, error, empty, and table states exclusively; supports debounced search, status and type filters, and bounds-disabled pagination; and shows statuses in sentence case, never `SCREAMING_CASE`.
- [ ] `CustomerFormView.vue` serves both create and edit from one component, copies the store's customer into a **local** form object, sends cleared fields as `null` on edit and omits them on create, and `router.replace`s to the details page on success.
- [ ] `CustomerDetailView.vue` shows contact information with `—` for nulls, three working tabs, and per-permission controls; note Edit/Delete appear only for the note's author; `ARCHIVED` is offered only with `customers:archive`, and the select is disabled for an already-archived customer without it.
- [ ] The interaction form converts `datetime-local` to an ISO string before sending.
- [ ] The History tab carries the verbatim ticketing note.
- [ ] `clearDetail()` runs on unmount.
- [ ] All specs in the Test Plan exist and pass, including the load race, the null-versus-absent payload, the ISO conversion, the static-over-dynamic route resolution, and the author-only note controls.
- [ ] A grep for `localStorage` and `sessionStorage` across `apps/web/src` still returns **zero** matches.
- [ ] **No backend file was modified**, and `apps/api`'s unit and e2e suites still pass.
- [ ] From the repo root, `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` are green across both workspaces.

---

**All four stories for work item 3 are now complete.** The work item's acceptance criteria map to Verification Steps 8 and 9 (created, updated, viewed), 10 (search and filtering), 18 (details displayed correctly), 11 and 12 (notes and attachments managed), and 13 (history accessible from the profile).

**STOP HERE. Report to the user.**
