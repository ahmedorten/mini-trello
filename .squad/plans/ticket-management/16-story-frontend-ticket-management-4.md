# Story 16 — Frontend: ticket list, details page, and create/edit forms (Story: 4)

## Prerequisites

- [Story 15 completed](15-story-ticket-comments-attachments-history-4.md): every route this story calls (`/api/tickets`, `/api/tickets/:id`, `/api/tickets/:id/status`, and the three nested sub-resource route families) must exist and be permission-gated.
- Both dev servers running: `npm run dev:api` and `npm run dev:web` from the repo root, same as Story 12. `apps/web/.env` must keep `VITE_API_BASE_URL` empty in development so the Vite proxy carries auth/download requests correctly.
- **No backend change is permitted in this story.**

## Story Goal

1. Four new routes: `/tickets` (list), `/tickets/new` (create), `/tickets/:id` (detail), `/tickets/:id/edit` (edit).
2. One Pinia store, `useTicketsStore`, mirroring `useCustomersStore`'s shape.
3. One `TicketFormView.vue` for both create and edit, keyed on the route's `id` param, mirroring `CustomerFormView.vue`.
4. A "Tickets" nav link in `AppLayout.vue`, gated on `tickets:read`.

**Not in scope:** any backend change; a ticket portal for the `customer` role; bulk actions, CSV export, print views; optimistic UI updates; an end-to-end browser test (covered manually via Verification Steps, same as Story 12).

## Context — Read These Files First

1. [`.squad/plans/customer-management/12-story-frontend-customer-management-3.md`](../customer-management/12-story-frontend-customer-management-3.md) — the direct template for every task in this story. Its six tasks (API layer, store, routes, list view, form view, detail view) map one-to-one onto this story's tasks 1–6. Its Edge Cases and Test Plan sections are the template for this story's own, substituting `customer` → `ticket` throughout.
2. [`apps/web/src/api/customers.ts`](../../../apps/web/src/api/customers.ts) — full file (255 lines). This is the field-for-field template for the new `apps/web/src/api/tickets.ts`: the type/constant block (lines 4–13), `UserRef` (16–20, **reuse this interface directly** — `import type { UserRef } from './customers';` — do not redefine it), the `Customer`/`PaginatedCustomers`/`ListCustomersParams` shape (23–57) as the template for `Ticket`/`PaginatedTickets`/`ListTicketsParams`, `CreateCustomerPayload`/`UpdateCustomerPayload` (60–91) as the template for `CreateTicketPayload`/`UpdateTicketPayload`, and every exported function (141–254) as the template for the ticket equivalents — `uploadAttachment` (199–212) and `downloadAttachment` (214–231) especially, since the multipart-upload and blob-download mechanics are copied verbatim.
3. [`apps/web/src/stores/customers.ts`](../../../apps/web/src/stores/customers.ts) — full file (369 lines). The `latestRequestId` race guard in `load()` (lines 69–99) and the separate `latestDetailRequestId` guard in `loadDetail()` (101–138, note the comment at 101–102 explaining why it must be a **separate** counter) are copied verbatim into `useTicketsStore`. The action contract — every mutating action (172–327) wrapped in try/catch, `catch` sets `error.value = toErrorMessage(caught)` and returns `false`/`null`/void, never throws — is the pattern for every ticket store action.
4. [`apps/web/src/api/users.ts`](../../../apps/web/src/api/users.ts) — grep for `listAgents`. This function already exists (added in Story 12 for the customer form's agent picker) and is **reused unchanged** for the ticket form's assignee picker — no new function needed there.
5. [`apps/web/src/router/index.ts`](../../../apps/web/src/router/index.ts) — full file (116 lines). The four customer route objects (lines 39–62) are the exact template for four ticket route objects, inserted after them and before `forbidden` (line 63). The guard (82–108) and `RouteMeta` augmentation (4–12) need no changes — `meta.permissions` already drives the ticket routes the same way.
6. [`apps/web/src/layouts/AppLayout.vue`](../../../apps/web/src/layouts/AppLayout.vue) — read lines 1–40. The nav block (30–35) has a `Customers` link at line 34 gated on `auth.can('customers:read')`; add a `Tickets` link as the next sibling, gated on `auth.can('tickets:read')`. `auth = useAuthStore()` is already in scope at line 6.
7. [`apps/web/src/stores/auth.ts`](../../../apps/web/src/stores/auth.ts) — full file (136 lines). `can(permission: string): boolean` (lines 28–30) is called with the ticket permission keys (`tickets:read`, `tickets:write`, `tickets:manage`, `ticket-comments:write`, `ticket-attachments:write`) exactly as customer views call it with the customer keys.
8. [`apps/web/src/views/CustomersView.vue`](../../../apps/web/src/views/CustomersView.vue) — full file (276 lines). The debounced-search pattern (lines 21–38, `watch` + `setTimeout` + `onBeforeUnmount` cleanup), the filter-change handlers (40–46), the bounds-checked pagination (48–58), and the four-way exclusive template branch (loading/error/empty/table, ~101–169) are the direct template for `TicketsView.vue`.
9. [`apps/web/src/views/CustomerDetailView.vue`](../../../apps/web/src/views/CustomerDetailView.vue) — full file (621 lines). The tabs pattern (`activeTab` ref, `role="tab"`/`aria-selected"`, ~284–312), the Notes tab (author-only edit/delete controls, ~314–346) as the template for the Comments tab, the Attachments tab (~348–371, `formatBytes` helper ~125–140) as the template verbatim for the Attachments tab, and the Interactions/History tab (~373–438) as the **structural** template for the History tab — but note Product rule 3 below: the ticket History tab has no add-form, only a read-only list, unlike the customer Interactions tab.
10. [`apps/web/src/views/CustomerFormView.vue`](../../../apps/web/src/views/CustomerFormView.vue) — full file (253 lines). The `customerId`/`isEdit` computed pattern (lines 18–19), the `onMounted` field-copy-from-store pattern (45–68, "never bind inputs directly to the store object"), and the create-vs-edit `submit()` branches (70–120, `form.X || undefined` on create vs. `form.X || null` on edit for nullable fields) are the direct template for `TicketFormView.vue`.
11. [`apps/web/src/views/UsersView.vue`](../../../apps/web/src/views/UsersView.vue) lines 28–44 — the debounce-with-cleanup pattern Story 12 itself copied from; only needed if `CustomersView.vue`'s own version (item 8 above) is unclear on its own.

## Product rules (from story)

| # | Rule | Rationale |
|---|------|-----------|
| 1 | Permission gating is advisory in the UI (route `meta.permissions` + per-control `auth.can(...)`), same as work item 3 — the API is the authority. | Consistent with the `RouteMeta.permissions` doc comment in `router/index.ts` line 9. |
| 2 | One Pinia store, `useTicketsStore`, mirroring `useCustomersStore` — not split by sub-resource. | Matches the single-store-per-feature shape already established; a details page needs ticket + comments + attachments + history together, exactly as the customer details page needs customer + notes + attachments + interactions together. |
| 3 | The History tab has **no add-form** — it is a read-only list rendered from `GET /tickets/:id/history`. | `TicketHistory` rows are system-generated only (Story 15) — there is no `POST` route for the frontend to call, unlike the customer feature's Interactions tab. |
| 4 | The ticket create/edit form needs a customer picker. A new `listCustomerRefs()` function is added to the existing `apps/web/src/api/customers.ts`, wrapping `listCustomers({ pageSize: 100 })` and mapping to `{ id, name, email }`. | Follows the exact precedent Story 12 set with `listAgents()` in `api/users.ts` — a thin, page-size-capped list for a `<select>`, not the paginated customer list UI. |
| 5 | `customerId` is shown as read-only text on the edit form (not an editable `<select>`) and omitted from `UpdateTicketPayload`. | Mirrors the backend's Story 14 decision that a ticket's customer link is immutable after creation. |
| 6 | Ticket `status` gets its own inline `<select>` on the detail page (calling `setStatus`, mirroring the customer status control), with **no** option filtering — every `TicketStatus` value is always offered to anyone with `tickets:write`. | Unlike the customer status select, there is no `ARCHIVED`-style option to hide — Story 14 made no status value special. |
| 7 | `category`, `priority`, and `assignedAgentId` are edited only through `TicketFormView.vue` (the general update form), not via inline controls on the detail page. | Mirrors exactly how the customer detail page edits everything except `status` through `CustomerFormView.vue`. |
| 8 | History entries render `oldValue`/`newValue` as their raw string form (the enum literal, or the assignee's UUID if no matching entry exists in the currently-loaded `agents` list) — no historical name resolution. | Matches the backend decision in Story 14/15: `TicketHistory` does not snapshot display names. The frontend does a **best-effort** lookup against `ticketsStore.agents` (already loaded for the assignee picker) to show a name when the UUID happens to match a currently-active agent, falling back to the raw UUID otherwise. |
| 9 | Dates render via `new Date(value).toLocaleString()` inline, no date library — same as work item 3. | Consistency; no new dependency. |
| 10 | Deletes (comment, attachment) use `window.confirm(...)`, same as work item 3. | No new confirm-modal component introduced for one feature. |

## Frontend Tasks

### 1 — API layer

**Create file: `apps/web/src/api/tickets.ts`**, modelled on `apps/web/src/api/customers.ts`:

```ts
import { apiClient } from './client';
import type { PaginationMeta } from './users';
import type { UserRef } from './customers';

export type TicketCategory =
  | 'GENERAL' | 'TECHNICAL' | 'BILLING' | 'ACCOUNT' | 'FEATURE_REQUEST' | 'BUG_REPORT' | 'OTHER';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'RESOLVED' | 'CLOSED';

/** The values, in display order, for every picker in this feature. Keep in
 *  step with the Prisma enums in apps/api/prisma/schema.prisma. */
export const TICKET_CATEGORIES: TicketCategory[] = [
  'GENERAL', 'TECHNICAL', 'BILLING', 'ACCOUNT', 'FEATURE_REQUEST', 'BUG_REPORT', 'OTHER',
];
export const TICKET_PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const TICKET_STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED'];

/** Mirrors CustomerRefDto in apps/api/src/tickets/dto/ticket-response.dto.ts */
export interface CustomerRef {
  id: string;
  name: string;
  email: string | null;
}

/** Mirrors TicketResponseDto. */
export interface Ticket {
  id: string;
  customer: CustomerRef;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedAgent: UserRef | null;
  createdBy: UserRef | null;
  counts: { comments: number; attachments: number; history: number };
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTickets {
  items: Ticket[];
  meta: PaginationMeta;
}

export interface ListTicketsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  status?: TicketStatus;
  assignedAgentId?: string;
  customerId?: string;
}

/** Mirrors CreateTicketDto. */
export interface CreateTicketPayload {
  customerId: string;
  subject: string;
  description: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  assignedAgentId?: string;
}

/** Mirrors UpdateTicketDto. `assignedAgentId: null` clears it; an absent key
 *  leaves it alone. `customerId` is deliberately absent — immutable. */
export interface UpdateTicketPayload {
  subject?: string;
  description?: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  assignedAgentId?: string | null;
}

/** Mirrors CommentResponseDto. */
export interface TicketComment {
  id: string;
  ticketId: string;
  author: UserRef;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentPayload {
  body: string;
}

/** Mirrors ticket-attachment.dto.ts's AttachmentResponseDto shape. */
export interface TicketAttachment {
  id: string;
  ticketId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  uploadedBy: UserRef;
  createdAt: string;
}

/** Mirrors TicketHistoryResponseDto. */
export interface TicketHistoryEntry {
  id: string;
  ticketId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: UserRef;
  createdAt: string;
}

export async function listTickets(params: ListTicketsParams): Promise<PaginatedTickets> {
  const response = await apiClient.get<PaginatedTickets>('/tickets', { params });

  return response.data;
}

export async function getTicket(id: string): Promise<Ticket> {
  const response = await apiClient.get<Ticket>(`/tickets/${id}`);

  return response.data;
}

export async function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
  const response = await apiClient.post<Ticket>('/tickets', payload);

  return response.data;
}

export async function updateTicket(id: string, payload: UpdateTicketPayload): Promise<Ticket> {
  const response = await apiClient.patch<Ticket>(`/tickets/${id}`, payload);

  return response.data;
}

export async function setTicketStatus(id: string, status: TicketStatus): Promise<Ticket> {
  const response = await apiClient.patch<Ticket>(`/tickets/${id}/status`, { status });

  return response.data;
}

export async function listComments(ticketId: string): Promise<TicketComment[]> {
  const response = await apiClient.get<TicketComment[]>(`/tickets/${ticketId}/comments`);

  return response.data;
}

export async function createComment(ticketId: string, payload: CommentPayload): Promise<TicketComment> {
  const response = await apiClient.post<TicketComment>(`/tickets/${ticketId}/comments`, payload);

  return response.data;
}

export async function updateComment(ticketId: string, id: string, payload: CommentPayload): Promise<TicketComment> {
  const response = await apiClient.patch<TicketComment>(`/tickets/${ticketId}/comments/${id}`, payload);

  return response.data;
}

export async function deleteComment(ticketId: string, id: string): Promise<void> {
  await apiClient.delete(`/tickets/${ticketId}/comments/${id}`);
}

export async function listTicketAttachments(ticketId: string): Promise<TicketAttachment[]> {
  const response = await apiClient.get<TicketAttachment[]>(`/tickets/${ticketId}/attachments`);

  return response.data;
}

export async function uploadTicketAttachment(ticketId: string, file: File): Promise<TicketAttachment> {
  const form = new FormData();
  form.append('file', file);

  const response = await apiClient.post<TicketAttachment>(
    `/tickets/${ticketId}/attachments`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );

  return response.data;
}

export async function downloadTicketAttachment(ticketId: string, attachment: TicketAttachment): Promise<void> {
  const response = await apiClient.get<Blob>(
    `/tickets/${ticketId}/attachments/${attachment.id}/content`,
    { responseType: 'blob' },
  );

  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = attachment.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function deleteTicketAttachment(ticketId: string, id: string): Promise<void> {
  await apiClient.delete(`/tickets/${ticketId}/attachments/${id}`);
}

export async function listTicketHistory(ticketId: string): Promise<TicketHistoryEntry[]> {
  const response = await apiClient.get<TicketHistoryEntry[]>(`/tickets/${ticketId}/history`);

  return response.data;
}
```

**File: `apps/web/src/api/customers.ts`** — add one function (Product rule 4), after `listCustomers` (after line 145):

```ts
export interface CustomerRefOption {
  id: string;
  name: string;
  email: string | null;
}

/** A page-size-capped list for a <select>, not the paginated list UI.
 *  Mirrors listAgents() in api/users.ts. */
export async function listCustomerRefs(): Promise<CustomerRefOption[]> {
  const { items } = await listCustomers({ pageSize: 100 });

  return items.map((customer) => ({ id: customer.id, name: customer.name, email: customer.email }));
}
```

### 2 — The store

**Create file: `apps/web/src/stores/tickets.ts`**, modelled field-for-field on `apps/web/src/stores/customers.ts`:

- State: `items`, `meta`, `current`, `comments`, `attachments`, `history`, `agents`, `customerOptions` (populated via `listCustomerRefs()` for the create form), `isLoading`, `isSaving`, `error`.
- `filters`: `reactive({ page: 1, pageSize: 20, search: '', category: '' as TicketCategory | '', priority: '' as TicketPriority | '', status: '' as TicketStatus | '', assignedAgentId: '' })`.
- `currentParams()`: maps each empty-string filter to `undefined`, identical shape to `customers.ts`'s version.
- `load()`: copies the `latestRequestId` guard verbatim (customers.ts lines 69–99).
- `loadDetail(id)`: copies the separate `latestDetailRequestId` guard verbatim (customers.ts lines 101–138); fetches `Promise.all([getTicket(id), listComments(id), listTicketAttachments(id), listTicketHistory(id)])`.
- `loadAgents()`: calls the **existing** `listAgents()` from `api/users.ts` (no new function), same try/catch-swallow pattern as `customers.ts` lines 140–147.
- `loadCustomerOptions()`: calls `listCustomerRefs()`, same try/catch-swallow pattern (an agent without `customers:read` still needs to create tickets against customers they can already see via `tickets:read`'s embedded `customer` ref — so a failure here must not block ticket creation, it just leaves the picker empty, mirroring `loadAgents`'s failure mode).
- `setSearch`/`setCategoryFilter`/`setPriorityFilter`/`setStatusFilter`/`setAssignedAgentFilter`: each resets `filters.page = 1` and calls `void load()`, mirroring `setSearch`/`setStatusFilter`/`setTypeFilter`.
- `setPage(page)`: mirrors verbatim.
- `create(payload)`: returns `created.id` or `null`, `isSaving` toggling — mirrors `create()`.
- `update(id, payload)`: calls `updateTicket` then `await loadDetail(id)`, returns boolean, `isSaving` toggling — mirrors `update()`.
- `setStatus(id, status)`: calls `setTicketStatus` then `loadDetail(id)`, returns boolean, no `isSaving` toggle — mirrors `setStatus()`.
- `addComment`/`editComment`/`removeComment`: mirror `addNote`/`editNote`/`removeNote` exactly, refreshing `comments` (and `current` for add/remove, matching the customer pattern of refreshing `current` so `counts.comments` stays in sync).
- `uploadFile`/`downloadFile`/`removeAttachment`: mirror `uploadFile`/`downloadFile`/`removeAttachment` exactly, refreshing `attachments` and `current`.
- **No `addHistoryEntry`/`removeHistoryEntry` action** — history has no write endpoint (Product rule 3).
- `clearDetail()`: resets `current`, `comments`, `attachments`, `history`, `error` — mirrors `clearDetail()` (customers.ts lines 329–335), note it does **not** reset `agents` or `customerOptions`, same as the customer version not resetting `agents`.

### 3 — Routes and nav

**File: `apps/web/src/router/index.ts`** — insert four route objects after the customer routes (after line 62, before `forbidden` at line 63):

```ts
  {
    path: '/tickets',
    name: 'tickets',
    component: () => import('@/views/TicketsView.vue'),
    meta: { title: 'Tickets', permissions: ['tickets:read'] },
  },
  {
    path: '/tickets/new',
    name: 'ticket-create',
    component: () => import('@/views/TicketFormView.vue'),
    meta: { title: 'New ticket', permissions: ['tickets:write'] },
  },
  {
    path: '/tickets/:id',
    name: 'ticket-detail',
    component: () => import('@/views/TicketDetailView.vue'),
    meta: { title: 'Ticket', permissions: ['tickets:read'] },
  },
  {
    path: '/tickets/:id/edit',
    name: 'ticket-edit',
    component: () => import('@/views/TicketFormView.vue'),
    meta: { title: 'Edit ticket', permissions: ['tickets:write'] },
  },
```

`/tickets/new` is listed before `/tickets/:id` — same static-before-dynamic ordering the customer routes already demonstrate, so `router.resolve('/tickets/new')` resolves to `ticket-create`, not `ticket-detail` with `id: 'new'`.

**File: `apps/web/src/layouts/AppLayout.vue`** — add one link after line 34 (the Customers link):

```html
        <RouterLink v-if="auth.can('tickets:read')" to="/tickets" class="layout__link">Tickets</RouterLink>
```

### 4 — `TicketsView.vue`

**Create file: `apps/web/src/views/TicketsView.vue`**, modelled on `apps/web/src/views/CustomersView.vue`:

- Script setup: `categoryLabel`/`priorityLabel`/`statusLabel` helpers (sentence-case, same as `statusLabel`/`typeLabel` in `CustomersView.vue` lines 11–17); debounced search with `onBeforeUnmount` cleanup (copied verbatim from lines 21–38); `onCategoryFilterChange`/`onPriorityFilterChange`/`onStatusFilterChange` reading `(event.target as HTMLSelectElement).value`; `previousPage`/`nextPage` bounds-checked against `tickets.meta`; `onMounted(() => { void tickets.load(); })`.
- Template: header with `<h1>Tickets</h1>` + a "New ticket" `RouterLink` to `/tickets/new` gated on `auth.can('tickets:write')`; filters form (search, category, priority, status selects); four-way exclusive branch (loading/error/empty/table); table columns — Subject (`RouterLink` to `/tickets/${id}`), Customer (name, linking to `/customers/${customer.id}`), Category, Priority (badge span), Status (badge span), Assigned agent (`assignedAgent?.fullName ?? '—'`), Comments/Files (`counts.comments / counts.attachments`), Actions (View + Edit gated on `tickets:write`); pagination block identical in structure to `CustomersView.vue`'s (lines 154–168).
- Styles: `tickets__` prefixed classes; priority badge color variants via the same `color-mix(in srgb, var(--color-...) …%, white)` technique as the customer status badges — map `URGENT`/`HIGH` toward `--color-accent` or a warning token, `LOW`/`MEDIUM` toward neutral tokens (use whatever warning/danger CSS custom property already exists in `apps/web/src/assets/main.css`; if none exists beyond the tokens Story 12 used, reuse the same `--color-accent`/`--color-ok`/`--color-text-muted`/`--color-border` set `CustomersView.vue` uses for its status badges rather than inventing new tokens).

### 5 — `TicketFormView.vue`

**Create file: `apps/web/src/views/TicketFormView.vue`**, modelled on `apps/web/src/views/CustomerFormView.vue`:

- `ticketId`/`isEdit` computed exactly as `customerId`/`isEdit` (lines 18–19 of the customer form).
- Form state: `reactive({ customerId: '', subject: '', description: '', category: 'GENERAL' as TicketCategory, priority: 'MEDIUM' as TicketPriority, assignedAgentId: '' })`.
- `onMounted`: always `void tickets.loadAgents()` and `void tickets.loadCustomerOptions()`; if `ticketId.value`, `await tickets.loadDetail(ticketId.value)` then copy `subject`, `description`, `category`, `priority` from `tickets.current`, and `assignedAgentId: tickets.current.assignedAgent?.id ?? ''` — same copy-not-bind pattern as the customer form (never bind inputs directly to the store object).
- On edit, `customerId` is **not** copied into an editable field — instead render `tickets.current.customer.name` as static text (Product rule 5), and the customer `<select>` is only shown when `!isEdit`.
- `submit()`:
  - Edit branch: build `UpdateTicketPayload` with `subject`, `description`, `category`, `priority` always sent (non-nullable, always-present fields — same as customer's `type`/`name`), `assignedAgentId: form.assignedAgentId || null` (clears via explicit `null`, mirrors the customer form's comment about clearing needing an explicit `null`); call `tickets.update(id, payload)`; on success `await router.replace({ name: 'ticket-detail', params: { id: ticketId.value } })`.
  - Create branch: build `CreateTicketPayload` with `customerId: form.customerId`, `subject`, `description`, `category`, `priority` always sent, `assignedAgentId: form.assignedAgentId || undefined` (an untouched optional field is absent, not empty-string, mirrors the customer form's create branch); call `tickets.create(payload)`; on success `router.replace({ name: 'ticket-detail', params: { id: created } })`.
- `cancel()`: `router.back()`, identical.
- Template: error alert `v-if="tickets.error"`; fieldsets — "Ticket" (Customer select, shown only on create; static customer name on edit; Subject required minlength 2; Description required textarea), "Classification" (Category select, Priority select), "Assignment" (Assigned agent select over `tickets.agents`, "Unassigned" empty option — identical structure to the customer form's Assignment fieldset). Submit button `:disabled="tickets.isSaving || form.subject.trim().length < 2 || form.description.trim().length < 1"`.

### 6 — `TicketDetailView.vue`

**Create file: `apps/web/src/views/TicketDetailView.vue`**, modelled on `apps/web/src/views/CustomerDetailView.vue`:

- Header: subject, a link to the linked customer (`RouterLink :to="`/customers/${tickets.current.customer.id}`"`), Edit link gated on `auth.can('tickets:write')`.
- Status control: `<select v-if="auth.can('tickets:write')" @change="changeStatus">` iterating `TICKET_STATUSES` with **no filtering** (Product rule 6 — unlike the customer status select's `ARCHIVED`-hiding `statusOptions` computed, every value is always offered); `changeStatus(event)` calls `tickets.setStatus`.
- Overview `<dl>`: Category, Priority, Assigned to, Created by, Created, Last updated — every value rendered directly (category/priority/status always have a value, unlike the customer's many nullable contact fields, so no `?? '—'` fallback is needed except for `assignedAgent`/`createdBy`, which mirror the customer pattern of `?? '—'`).
- Description: rendered as its own block above or below the `<dl>`, preserving line breaks (`white-space: pre-wrap` in the `tickets__description` style rule) since it is free text up to 8000 characters, unlike any single `<dl>` value in the customer detail page.
- Tabs: `activeTab` ref `'comments' | 'attachments' | 'history'`, same `role="tab"`/`aria-selected` pattern as the customer detail page's three tabs.
- Comments tab: `isOwnComment(comment)` checks `comment.author.id === auth.user?.id`; comment-form `v-if="auth.can('ticket-comments:write')"`; each list item shows Edit/Delete gated on `isOwnComment(comment) || auth.can('tickets:manage')` (this **differs** from the customer Notes tab, whose Edit is author-only with no elevated override — Delete is the one gated on the elevated permission, mirror that split exactly: Edit only under `isOwnComment`, Delete under `isOwnComment(comment) || auth.can('tickets:manage')`); `window.confirm('Delete this comment?')` before delete.
- Attachments tab: upload block `v-if="auth.can('ticket-attachments:write')"` with hint text "Up to 10 MB. PDF, images, text, CSV, Word, and Excel." (identical wording to the customer feature, since the whitelist is identical); `formatBytes` helper copied verbatim; Download button unconditional, Delete gated on `isOwnAttachment(attachment) || auth.can('tickets:manage')` mirroring the comment split.
- History tab: **no add-form** (Product rule 3). Empty state "No history yet." Each list item renders: a human label for `field` (map `'status'` → "Status", `'priority'` → "Priority", `'category'` → "Category", `'assignedAgentId'` → "Assigned agent"), `oldValue`/`newValue` rendered via a small `resolveHistoryValue(field, value)` helper that: for `field === 'assignedAgentId'`, looks up `value` against `tickets.agents` (falling back to the raw UUID, or "Unassigned" for `null` — Product rule 8); for every other field, renders the raw enum literal (or "—" for `null`) — no further label-casing needed since enum literals like `TECHNICAL`/`URGENT` are already readable. Shows "Changed by X on <date>".
- `onMounted(() => { void tickets.loadDetail(ticketId.value); })`; `onUnmounted(() => { tickets.clearDetail(); })` — identical lifecycle to the customer detail page.

## Edge Cases & Failure Modes

- **Direct navigation to `/tickets` without `tickets:read`** → router guard redirects to `forbidden`, same mechanism as the customer routes (`router/index.ts` lines 97–105).
- **A `403` mid-session** (permission revoked between page load and an action) → `apiClient`'s response interceptor leaves `403` untouched (does not retry, does not sign out); `toErrorMessage` renders "You do not have permission to do this" — identical to the customer feature's handling.
- **A `401` mid-session** → the interceptor's one-shot refresh-and-retry applies identically; no ticket-specific handling needed.
- **Rapid search typing on `TicketsView.vue`** → the debounced `watch` + `latestRequestId` guard combination prevents a stale response from overwriting a fresher one — this is, per Story 12's own notes, "the single most likely bug in the story," and the guard is copied verbatim for that reason.
- **Rapidly navigating between two tickets' detail pages** → the separate `latestDetailRequestId` guard prevents ticket A's slow response from landing after ticket B's fast one and corrupting the displayed detail.
- **An invalid ticket UUID in the URL** (`/tickets/not-a-uuid`) → the API's `ParseUUIDPipe` returns `400`; there is no client-side UUID validation, so the detail page shows the API's error message via `toErrorMessage`.
- **All filters cleared** → `currentParams()` sends no query params beyond `page`/`pageSize`, matching the API's "all filters optional" contract.
- **An unrecognized query parameter reaching the API** (should not happen from the UI, but defensive) → `400` under `forbidNonWhitelisted`, surfaced via `toErrorMessage`.
- **A ticket attachment over 10 MB** → `413` from the API; no client-side size pre-check exists (same as the customer feature) — the error surfaces after the failed request, not before it.
- **An unsupported attachment mime type** → `400` from the whitelist check, surfaced the same way.
- **`window.URL.revokeObjectURL` called immediately after `anchor.click()`** → same timing as the customer feature's `downloadAttachment`; the browser has already started the download by the time the object URL is revoked, so this is not a race in practice, only in appearance.
- **A ticket assigned to a user who is later deactivated** → `assignedAgent` still resolves and renders (the API does not filter out inactive users from an already-set relation, only from the `assertAgentExists` check on write) — same behavior as a deactivated customer note author still resolving in work item 3.
- **A `TicketHistory` entry for `assignedAgentId` whose UUID no longer matches any entry in `tickets.agents`** (the agent was deactivated after the change, so `listAgents()` no longer returns them) → `resolveHistoryValue` falls back to rendering the raw UUID, per Product rule 8 — this is an accepted, documented limitation, not a bug to fix.
- **Long ticket descriptions (near the 8000-character cap)** → rendered with `white-space: pre-wrap` so line breaks the agent typed are preserved; no truncation or "show more" collapsing is added (not requested).
- **Unicode in `subject`/`description`/comment `body`** → no special handling needed; the API's `class-validator` string checks and PostgreSQL's UTF-8 storage handle it transparently, same as customer `name`/note `body`.
- **A `support-agent` role caller** (has `tickets:write`, `ticket-comments:write`, `ticket-attachments:write`, but not `tickets:manage`) sees Edit/Delete on their own comments and attachments, but no Delete control on anyone else's — verified manually in Verification Steps.
- **A `reporting-user` role caller** (has `tickets:read` only) sees the list and detail pages fully, but no "New ticket" link, no comment/attachment forms, no status select, no Edit link — every write control is hidden, matching `auth.can(...)` gating throughout.

## Test Plan

1. **`apps/web/src/stores/tickets.spec.ts`** (new). Modelled on `apps/web/src/stores/customers.spec.ts`. Cover: `load()` populates `items`/`meta`; `currentParams()` maps empty filters to `undefined`; `setSearch` resets `filters.page` to 1; the race-guard test (two overlapping `load()` calls, assert the later request's result wins); `loadDetail()` populates all four collections via `Promise.all`; `loadAgents()`/`loadCustomerOptions()` swallow errors into an empty array; `create()`/`update()`/`setStatus()` return contracts; `addComment()`/`removeAttachment()` refresh both the child collection and `current`; `clearDetail()` resets everything except `agents`/`customerOptions`.
2. **`apps/web/src/api/tickets.spec.ts`** (new). Modelled on `apps/web/src/api/customers.spec.ts`. Cover: `uploadTicketAttachment` builds `FormData` under the `'file'` key and sends the `multipart/form-data` header; `downloadTicketAttachment` requests `responseType: 'blob'`, creates and revokes an object URL, and sets `anchor.download` to the attachment's `fileName`; `listTickets` passes `params` through unmodified.
3. **`apps/web/src/router/index.spec.ts`** (extend). Add: the four new route resolutions; the static-over-dynamic proof for `/tickets/new` vs. `/tickets/:id` with `id: 'new'` (mirrors the existing customer-route proof); signed-out redirect to `/login` for each ticket route; permission-denied redirect to `/forbidden` for a caller lacking `tickets:read`/`tickets:write`; confirm the catch-all still resolves for an unrelated path.
4. **`apps/web/src/views/TicketsView.spec.ts`** (new). Modelled on `CustomersView.spec.ts`. Cover: row rendering; the four exclusive states (loading/error/empty/table); "New ticket" link gated on `tickets:write`; pagination button bounds; each filter's change handler calling the matching store action; debounced search via `vi.useFakeTimers()`; the Subject-cell link target.
5. **`apps/web/src/views/TicketFormView.spec.ts`** (new). Modelled on `CustomerFormView.spec.ts`. Cover: create-mode field defaults (`category: 'GENERAL'`, `priority: 'MEDIUM'`); edit-mode field population from `tickets.current`, including the static (non-editable) customer name; the create payload's `assignedAgentId` absent-vs-present proof; the edit payload's explicit-`null`-vs-omitted proof for `assignedAgentId`; `router.replace` target/args on success for both modes; error rendering on a failed submit; submit-disabled conditions (`isSaving`, short `subject`, empty `description`).
6. **`apps/web/src/views/TicketDetailView.spec.ts`** (new). Modelled on `CustomerDetailView.spec.ts`. Cover: field rendering including the description's `pre-wrap` block; error-only render when `tickets.error && !tickets.current`; tab switching across all three tabs; comment-form gated on `ticket-comments:write`; comment Edit gated on `isOwnComment` only, comment Delete gated on `isOwnComment || tickets:manage` (test both a plain author and a `tickets:manage` holder deleting someone else's comment); `window.confirm` gating on both comment and attachment delete; upload control gated on `ticket-attachments:write`; History tab has **no** form element at all (assert its absence, not just its gating); a history entry for `assignedAgentId` resolves a name when the UUID matches a loaded agent and falls back to the raw UUID otherwise; status `<select>` always offers all five `TicketStatus` values regardless of the caller's permissions beyond `tickets:write`; `onUnmounted` calls `tickets.clearDetail()`.
7. **`apps/web/src/layouts/AppLayout.spec.ts`** (extend). Add: Tickets link presence when `auth.can('tickets:read')` is true, absence when false.
8. **No new backend test** — Story 15 owns the backend.
9. **No end-to-end browser test** — covered manually via Verification Steps.

## Verification Steps

1. **Typecheck:** `npm run typecheck --workspace @crm/web`.
2. **Lint:** `npm run lint --workspace @crm/web`.
3. **Unit tests:** `npm run test --workspace @crm/web`.
4. **Build:** `npm run build --workspace @crm/web`.
5. **Grep check:** confirm no new `localStorage`/`sessionStorage` usage was introduced (`grep -rn "localStorage\|sessionStorage" apps/web/src/` should return zero matches related to this feature) — the access token lives in memory only, same constraint as work item 3.
6. **Both dev servers running**, sign in as the seeded administrator.
7. **Signed-out redirect:** navigate to `/tickets` in an incognito/private window, confirm redirect to `/login` with a `redirect` query param.
8. **Admin flow:** create a ticket against a fixture customer, confirm it appears in the list, open its detail page, add a comment, edit the comment, upload an attachment, download it, delete the attachment, change status through several values, edit category/priority/assignee via the Edit form, confirm the History tab shows entries for every changed field with correct old/new values.
9. **Search/filter flow:** search by subject substring, filter by each of category/priority/status/assignedAgentId individually and in combination, confirm pagination bounds behave correctly with a small `pageSize`.
10. **`support-agent` flow:** sign in as (or seed) a `support-agent`-role user, confirm they can create/edit tickets and their own comments/attachments, but see no Delete control on another user's comment or attachment.
11. **`crm-manager` flow:** confirm a `crm-manager`-role user (or the administrator) can delete another user's comment and attachment.
12. **`reporting-user` flow:** confirm a `reporting-user`-role user sees the list and detail pages but no write controls anywhere (no "New ticket" link, no status select, no comment/attachment forms).
13. **Forbidden-route check:** as a role lacking `tickets:read` entirely (if one exists among seeded roles — otherwise temporarily test via the `customer` role), confirm `/tickets` redirects to `/forbidden`.
14. **403-mid-session check:** confirm a `403` response from an action (e.g. attempting to delete someone else's comment as a `support-agent`) shows an inline error and does **not** sign the user out.
15. **Regression check:** confirm the Customers feature (list, detail, notes, attachments, interactions) still works unmodified — this story touches no backend file and only adds to `AppLayout.vue` and `router/index.ts`/`api/customers.ts` (the `listCustomerRefs` addition), never edits an existing customer view file.
16. **Full-repo:** `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` from the repo root.

## Done Criteria

- [ ] `api/tickets.ts`, `stores/tickets.ts`, `views/TicketsView.vue`, `views/TicketFormView.vue`, `views/TicketDetailView.vue` exist and follow the patterns above.
- [ ] `listCustomerRefs()` is added to the existing `api/customers.ts`; no other customer-feature file is modified.
- [ ] Four new routes are registered, static-before-dynamic, permission-gated via `meta.permissions`.
- [ ] "Tickets" nav link appears in `AppLayout.vue`, gated on `tickets:read`.
- [ ] The History tab has no add-form; comment/attachment Delete is gated on author-or-`tickets:manage`, Edit on author-only.
- [ ] Unit tests listed in the Test Plan pass.
- [ ] All 16 Verification Steps pass, including the three role-based manual flows (support-agent, crm-manager, reporting-user).
- [ ] Full-repo typecheck/lint/test/build pass.

This closes work item 4 — Ticket Management. All 11 acceptance criteria from the intake map onto this feature's four stories: data model (Story 13), API + status lifecycle (Story 14), comments/attachments/history (Story 15), search/filtering/list/detail/forms (Story 16, Verification Steps 8–9).
