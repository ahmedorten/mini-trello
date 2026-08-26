# Story 21 — Frontend: agent dashboard, ticket workspace, and the communication timeline (Story: 5)

## Prerequisites

- [Story 20 completed](20-story-frontend-design-system-i18n-rtl-5.md): the token set, `vue-i18n` with both catalogues, `useLocaleStore`, the ten shared components in `apps/web/src/components/`, the redesigned `AppLayout.vue`, and `meta.titleKey` all exist. **This story writes no CSS primitive and no shared component of its own** — if a screen here needs something the design system lacks, add it to `apps/web/src/components/` following Story 20's conventions and give it a spec.
- [Story 19 completed](19-story-tasks-quick-replies-communication-api-5.md) and [Story 18 completed](18-story-agent-dashboard-api-5.md): every endpoint this story calls exists and is permission-gated.
- Both dev servers running; `apps/web/.env` keeps `VITE_API_BASE_URL` empty in development.
- **No backend change is permitted in this story.**

---

## Story Goal

1. **Four new API modules** — `api/dashboard.ts`, `api/tasks.ts`, `api/quickReplies.ts`, `api/communication.ts` — mirroring the Story 18–19 DTOs.
2. **Two new Pinia stores** — `useDashboardStore`, `useTasksStore` — following `useTicketsStore`'s shape and its two race guards.
3. **`AgentDashboardView.vue`** replacing the `DashboardView.vue` placeholder at `/`: stat tiles, status/priority/category insight cards, three ticket lists, and a tasks-due panel.
4. **`AgentWorkspaceView.vue`** at `/workspace` and `/workspace/:id`: a three-region workspace — the workable queue, the selected ticket with its collaboration and communication timeline, and a context rail with customer info, tasks, and quick replies.
5. **`TasksView.vue`** at `/tasks`: the standalone task list with create/edit/complete.
6. **Five feature components** — `CommunicationTimeline.vue`, `TicketTasksPanel.vue`, `QuickReplyPicker.vue`, `CustomerSummaryCard.vue`, `ReassignControl.vue` — reused between the workspace and the existing detail pages.
7. **Additive changes to `TicketDetailView.vue`**: a fourth **Communication** tab (reusing `CommunicationTimeline.vue`) and a `ReassignControl` beside the status select. **The existing three tabs, their gates, and their behaviour are untouched.**

**Not in scope:** any backend change; a customer-facing portal; charting libraries (insight cards are CSS bar rows, see Product rules); polling, websockets, or auto-refresh; quick-reply administration UI beyond activate/deactivate; bulk actions, CSV export, print views; an automated end-to-end browser test.

---

## Context — Read These Files First

1. `apps/web/src/stores/tickets.ts` — the **whole file, 368 lines**, and the direct template for both new stores. Specifically: the `latestRequestId` guard in `load()` (**69–101**) and the **separate** `latestDetailRequestId` guard in `loadDetail()` (**103–140**, with the comment at 103–104 explaining why it must be a second counter); the `Promise.all` fan-out at **113–118**; the swallow-into-empty pattern in `loadAgents()` (**142–149**) and `loadCustomerOptions()` (**151–160**) — *"A plain support agent lacks users:read; the picker simply stays empty"* — which is exactly the shape every degradable read in this story uses; the uniform action contract (**197–324**): try/catch, `error.value = toErrorMessage(caught)`, return `false`/`null`/void, **never throw**; and `clearDetail()` (**326–332**), which resets the detail collections but **keeps** `agents`/`customerOptions`.
2. `apps/web/src/api/tickets.ts` — the **whole file, 207 lines.** The interface-mirrors-DTO convention with a `/** Mirrors XDto. */` comment on each; the enum string-union + display-order-constant pair at **5–16**; the reuse of `UserRef` from `./customers` and `PaginationMeta` from `./users` at **2–3** (**import them, do not redefine**); and the download mechanics at **185–197** with the explanatory comment in `api/customers.ts` at 228–232 about why a plain `<a href>` would 401.
3. `apps/web/src/views/TicketDetailView.vue` — the **whole file, 558 lines.** You edit this file. `activeTab` at **41** (`'comments' | 'attachments' | 'history'` — gains `'communication'`); `changeStatus` at **31–37**; the tabs block at **246–275**, which Story 20 replaced with `AppTabs` (read the post-Story-20 version); the three panels at **276–364**; `onMounted`/`onUnmounted` at **170–177**. **Every `auth.can(...)` gate, `isOwnComment`/`isOwnAttachment` check, and `window.confirm` in this file stays exactly as it is.**
4. `apps/web/src/views/CustomerDetailView.vue` — the **whole file, 620 lines.** The interaction form at **375–405** (channel `<select>`, direction `<select>`, subject, body, `datetime-local` `occurredAt`) and its `submitInteraction` at **158–176** are the direct template for `CommunicationTimeline.vue`'s composer, including `toLocalDatetimeInput` (now in `utils/format.ts`) and the `new Date(form.occurredAt).toISOString()` conversion at line 161. `removeInteraction` at **178–182** carries the `window.confirm('Delete this interaction?')` this story reuses.
5. `apps/web/src/views/TicketsView.vue` — the **whole file, 326 lines** (post-Story-20). The list-screen skeleton, and the source of the `overflow-x: auto` table wrapper pattern.
6. `apps/web/src/views/CustomerFormView.vue` — the **whole file, 252 lines.** The `onMounted` field-copy-from-store pattern at **45–68** (*"never bind inputs directly to the store object"*) and the create-vs-edit `submit()` branches at **70–120** (`form.X || undefined` on create, `form.X || null` on edit) — the template for the task create/edit form.
7. `apps/web/src/router/index.ts` — **139 lines** pre-Story-20; read the post-Story-20 version with `meta.titleKey`. The four ticket route objects at **63–86** are the template for the new routes; the static-before-dynamic ordering (`/tickets/new` at 69 **before** `/tickets/:id` at 75) is a rule the new `/workspace` routes must follow. The guard at **106–132** and the `RouteMeta` augmentation need no change.
8. `apps/web/src/layouts/AppLayout.vue` — post-Story-20. Its nav group structure (**Work** / **Records** / **Administration**) is where the Workspace and Tasks links land; Story 20's task 5 explicitly left those two slots for this story.
9. `apps/web/src/components/` — post-Story-20: `AppIcon`, `AppButton`, `AppCard`, `AppBadge`, `AppStateBlock`, `AppTabs`, `AppModal`, `AppPagination`, `StatTile`, `LocaleSwitcher`. `StatTile` was built in Story 20 **for this story's dashboard**; `AppModal` for this story's dialogs.
10. `apps/web/src/i18n/locales/en.json` / `ar.json` — post-Story-20. Every new string in this story is a new key in **both** files, and `i18n.spec.ts` (Story 20 test 1) fails the build if the sets diverge.
11. `apps/web/src/stores/auth.ts` — **135 lines.** `can(permission)` at **28–30** and `canAny(...permissions)` at **32–34**. `canAny` exists and is currently unused — this story is where it earns its keep (a control visible to either of two permissions).
12. `apps/web/src/api/client.ts` — **116 lines.** `toErrorMessage` at **223–251** including the `403` branch at 227–234, and the response interceptor's one-shot refresh with the comment at **180–184** explaining that `403` is deliberately re-thrown untouched.
13. `apps/web/src/api/users.ts` — grep `listAgents` (lines **122–126**). Reused unchanged for every assignee picker in this story.
14. `apps/web/src/api/customers.ts` — `listCustomerRefs` at **155–159**, `getCustomer` at **161–165**, `listInteractions`/`createInteraction`/`deleteInteraction` at **251–268**. Story 19 added `ticketId` to the create payload and `ticketId`/`ticket` to the response — **update these three functions' types in this story's task 1**, they are the customer-side half of the timeline.
15. [`.squad/plans/ticket-management/16-story-frontend-ticket-management-4.md`](../ticket-management/16-story-frontend-ticket-management-4.md) — the shape of a frontend story in this repo, and the source of every pattern the workspace reuses.
16. [`18-story-agent-dashboard-api-5.md`](18-story-agent-dashboard-api-5.md) and [`19-story-tasks-quick-replies-communication-api-5.md`](19-story-tasks-quick-replies-communication-api-5.md) — the DTO field lists this story's interfaces mirror, and the permission rules its controls must gate on. In particular Story 18's `AgentDashboardDto` field set and Story 19's task/quick-reply permission asymmetries.

---

## Product rules (from story)

| # | Rule | Rationale |
|---|------|-----------|
| 1 | The dashboard renders from **one** call to `GET /api/dashboard/agent`. It does **not** also call `/tickets` or `/tasks`. | Story 18 built that endpoint to be exactly this screen's payload, including its three capped lists. A second call would duplicate data and let two panels disagree. |
| 2 | **Insight "charts" are CSS bar rows**, not a charting library: a label, a proportional bar (`inline-size: {percent}%`), and a count. | Product rule 1 of Story 20 — one dependency, and it was `vue-i18n`. A horizontal bar row is ~20 lines of CSS, is readable by a screen reader as a list, and works in RTL for free with logical properties. A canvas chart does none of that. |
| 3 | Every insight bar row carries the **count as text**, not only as bar length, and the list is marked up as a `<dl>` or a table with real headers. | Bar length alone is inaccessible and unreadable at small widths. This is the a11y baseline from Story 20 Product rule 14 applied to the one genuinely new UI shape in this story. |
| 4 | The workspace defaults its queue to **`scope=workable`**. That is where the acceptance criterion "agent sees only tickets assigned to or workable by the current user" is satisfied. | Story 18 Product rule 4: `scope` is a filter, not a security boundary, and `/tickets` stays unrestricted so Story 16's list view does not regress. The *workspace* is the screen that expresses the agent-centric view. A scope switcher (`workable` / `mine` / `unassigned` / `all`) is offered so the agent can widen deliberately. |
| 5 | `/workspace/:id` is the canonical deep link; `/workspace` with no id renders the queue plus an **empty-selection state**, not a redirect to the first ticket. | Auto-selecting makes the URL lie about what the agent chose and makes back-navigation surprising. The empty state is a real state the intake asks for. |
| 6 | The workspace **reuses `useTicketsStore`** for the selected ticket, its comments, attachments, and history. It does not fork a second ticket store. | Story 16 built `loadDetail()` to fetch all four collections in one `Promise.all` with its own race guard. Duplicating it would duplicate the race guard, which is where the bug would be. The queue list, however, needs its **own** paginated state independent of `TicketsView.vue`'s filters — see rule 7. |
| 7 | The workspace queue keeps its state in **`useDashboardStore`** (as `queue*` fields with a third request-id guard), **not** in `useTicketsStore.items`/`filters`. | `TicketsView.vue` and the workspace are both mounted-and-unmounted independently and hold different filters. Sharing `useTicketsStore.filters` means opening the workspace silently rewrites the tickets page's filters — a real bug, invisible until a user navigates between the two. |
| 8 | The **communication timeline** is one component used in three places: the workspace centre region, a new `TicketDetailView.vue` tab, and (read-only) `CustomerSummaryCard.vue`'s recent-activity strip. It reads `GET /api/tickets/:id/interactions`. | "Provide a unified interaction timeline" — one implementation is what makes it unified. Three near-copies is how the channel badges drift apart. |
| 9 | The timeline offers a **`includeCustomerHistory` toggle**, off by default. When on, interactions from the customer's other tickets appear, visually distinguished by their `ticket` ref. | Story 19's route supports both. Defaulting to on would bury this ticket's conversation in unrelated history; not offering it at all loses the "communication history remains accessible from the relevant customer/ticket context" criterion. |
| 10 | Every timeline entry shows its **channel as an `AppBadge` with an `AppIcon`**, plus the direction, plus the localised `occurredAt`. The channel is never conveyed by colour alone. | "Clearly identify the communication channel for each interaction" — and colour-only encoding fails the a11y baseline. |
| 11 | The **Respond composer** renders only for channels whose `canRespond` is true in `GET /api/communication/channels`, and it carries a **standing notice** that responding records the interaction and does not transmit a message. | Story 19 Product rule 1: no provider exists. A Send button that silently only writes a database row is the single most misleading thing this story could ship. The notice is an `AppStateBlock variant="warning"`, and its text is a translation key so it can be softened when a provider does land. |
| 12 | The channel registry is fetched **once** per session into `useDashboardStore` and shared by every timeline instance; a failed fetch degrades to "all channels respondable". | It is static metadata. Re-fetching per mount is waste; failing closed would hide the composer everywhere on a transient error, which is worse than showing it and letting the `POST` fail visibly. |
| 13 | **Quick replies insert text into the focused composer** — they never send anything. The picker is offered on the internal-comment box and on the Respond composer. | A canned reply is a drafting aid. Auto-sending on selection is a mis-click away from an outbound record the agent did not mean to write. |
| 14 | The quick-reply picker requests the **current UI locale** and falls back to the `en` rows when the locale returns nothing. | Story 17 Product rule 7 allows a locale to be missing. An empty picker in Arabic would read as a broken feature. |
| 15 | `ReassignControl` is gated on **`tickets:write`** and offers the full agent list only when the caller also holds **`tickets:assign`**; otherwise it offers exactly two actions — **Claim** (assign to me) and **Release** (unassign, only when the ticket is assigned to me). | Mirrors Story 18 Product rule 5 exactly. Rendering a full picker that 403s on every choice but one is a worse experience than rendering the two actions that work. |
| 16 | `ReassignControl` calls `PATCH /api/tickets/:id/assignment`, **not** `PATCH /api/tickets/:id`. | Story 18's dedicated route is the documented path, writes the history row, and no-ops cleanly on an unchanged value. |
| 17 | The tasks panel inside the workspace is **scoped to the selected ticket** (`?ticketId=`); `TasksView.vue` is the unscoped list. Both use `useTasksStore`, with the panel reading a separate `ticketTasks` field so the two do not overwrite each other. | Same reasoning as rule 7, one level down. |
| 18 | Task create/edit uses **`AppModal`**, not a separate route. | A task is a small object created in the flow of working a ticket; a route change would lose the ticket context the agent is in. This is what Story 20 built `AppModal` for. |
| 19 | **Nothing polls.** Data refreshes on mount, on an explicit Refresh action, and after a mutation the screen itself performed. | No websocket or SSE exists on the backend, and a polling interval is a battery and quota cost with no requirement behind it. The dashboard shows its `generatedAt` so staleness is visible rather than hidden. |
| 20 | `DashboardView.vue` is **deleted** and its route repointed to `AgentDashboardView.vue`. | Story 20 explicitly deferred replacing the placeholder to this story. Leaving a dead file behind invites a future edit to the wrong one. |
| 21 | Every degradable read (`agents`, `customerOptions`, `channels`, `quickReplies`, `tasksDueSoon`) swallows its error into an empty value, exactly as `useTicketsStore.loadAgents()` does. Only the **primary** read of a screen sets `error`. | A `reporting-user` holds `dashboard:read` and little else; a `support-agent` lacks `users:read`. If a secondary picker's `403` blanked the screen, the dashboard would be unusable for two of six seeded roles. |

---

## Frontend Tasks

### 1 — API layer

**Create file: `apps/web/src/api/dashboard.ts`** — mirroring Story 18's `AgentDashboardDto`:

```ts
import { apiClient } from './client';
import type { Ticket, TicketCategory, TicketPriority, TicketStatus } from './tickets';

/** Mirrors TicketScope in apps/api/src/tickets/dto/list-tickets-query.dto.ts */
export type TicketScope = 'mine' | 'unassigned' | 'workable' | 'all';

export const TICKET_SCOPES: TicketScope[] = ['workable', 'mine', 'unassigned', 'all'];

/** Mirrors DashboardBucketDto. */
export interface DashboardBucket {
  key: string;
  count: number;
}

/** Mirrors AgentTicketCountsDto. */
export interface AgentTicketCounts {
  assigned: number;
  open: number;
  pending: number;
  overdue: number;
  unassigned: number;
  resolvedLast7Days: number;
}

/** Mirrors AgentTaskSummaryDto. */
export interface AgentTaskSummary {
  id: string;
  title: string;
  status: AgentTaskStatus;
  dueAt: string | null;
  remindAt: string | null;
  ticketId: string | null;
  customerId: string | null;
  isOverdue: boolean;
}

/** Mirrors AgentDashboardDto. */
export interface AgentDashboard {
  counts: AgentTicketCounts;
  byStatus: DashboardBucket[];
  byPriority: DashboardBucket[];
  byCategory: DashboardBucket[];
  focusTickets: Ticket[];
  overdueTickets: Ticket[];
  unassignedTickets: Ticket[];
  tasksDueSoon: AgentTaskSummary[];
  listLimit: number;
  generatedAt: string;
}

export async function getAgentDashboard(scope?: TicketScope): Promise<AgentDashboard> {
  const response = await apiClient.get<AgentDashboard>('/dashboard/agent', {
    params: scope ? { scope } : undefined,
  });

  return response.data;
}
```

`TicketCategory`/`TicketPriority`/`TicketStatus` are imported for the bucket-key typing used by the insight cards; keep the `DashboardBucket.key` as `string` (the API sends the raw enum literal) and narrow at the render site.

**Create file: `apps/web/src/api/tasks.ts`** — `AgentTaskStatus` union + `AGENT_TASK_STATUSES` display-order constant; `AgentTask`, `PaginatedAgentTasks`, `ListAgentTasksParams` (`page`, `pageSize`, `scope`, `status`, `assigneeId`, `ticketId`, `customerId`, `dueBefore`, `overdueOnly`), `CreateAgentTaskPayload`, `UpdateAgentTaskPayload` (nullable fields typed `X | null` for the explicit-clear contract, exactly as `UpdateTicketPayload` does at `api/tickets.ts` 69–75); and `listTasks`, `getTask`, `createTask`, `updateTask`, `setTaskStatus`, `deleteTask`.

**Create file: `apps/web/src/api/quickReplies.ts`** — `QuickReply` interface, `ListQuickRepliesParams` (`locale`, `channel`, `includeInactive`), and `listQuickReplies`, `createQuickReply`, `updateQuickReply`, `deleteQuickReply`.

**Create file: `apps/web/src/api/communication.ts`** — `ChannelDescriptor` (`key`, `canRespond`, `isRealtime`, `providerConfigured`) and `listChannels(): Promise<ChannelDescriptor[]>`, unwrapping the `{ items }` envelope Story 19 returns.

**File: `apps/web/src/api/tickets.ts`** — add the ticket-scoped timeline functions and the `scope` param:

```ts
export interface ListTicketInteractionsParams {
  channel?: InteractionChannel;
  direction?: InteractionDirection;
  includeCustomerHistory?: boolean;
}

export async function listTicketInteractions(
  ticketId: string,
  params: ListTicketInteractionsParams = {},
): Promise<CustomerInteraction[]> {
  const response = await apiClient.get<CustomerInteraction[]>(
    `/tickets/${ticketId}/interactions`,
    { params },
  );

  return response.data;
}

export async function createTicketInteraction(
  ticketId: string,
  payload: CreateTicketInteractionPayload,
): Promise<CustomerInteraction> {
  const response = await apiClient.post<CustomerInteraction>(
    `/tickets/${ticketId}/interactions`,
    payload,
  );

  return response.data;
}

export async function assignTicket(
  id: string,
  assignedAgentId: string | null,
): Promise<Ticket> {
  const response = await apiClient.patch<Ticket>(`/tickets/${id}/assignment`, { assignedAgentId });

  return response.data;
}
```

`CustomerInteraction`, `InteractionChannel`, and `InteractionDirection` are **imported from `./customers`** — do not redefine them (the `UserRef` precedent at `api/tickets.ts` line 3). `CreateTicketInteractionPayload` is `CreateInteractionPayload` minus `ticketId`; declare it with `Omit<CreateInteractionPayload, 'ticketId'>`.

Also add `scope?: TicketScope` to `ListTicketsParams` (currently 46–55).

**File: `apps/web/src/api/customers.ts`** — Story 19 changed two shapes here:

- `CustomerInteraction` (120–130) gains `ticketId: string | null` and `ticket: { id: string; subject: string } | null`.
- `CreateInteractionPayload` (133–139) gains `ticketId?: string`.
- `INTERACTION_CHANNELS` (line 13) is currently `['PHONE', 'EMAIL', 'CHAT', 'MEETING', 'OTHER']` and the `InteractionChannel` union (line 6) matches. **Both must gain `'WHATSAPP' | 'SMS' | 'WEB_FORM'`** to match Story 17's extended enum, in the display order Story 19's `CHANNEL_ORDER` uses: `EMAIL, WHATSAPP, CHAT, SMS, WEB_FORM, PHONE, MEETING, OTHER`. **This is a change to a work-item-3 file and the one place a stale union would silently hide the three new channels from every picker.**
- `listInteractions` (251–255) takes an optional params object (`channel`, `direction`, `ticketId`).

### 2 — `useDashboardStore`

**Create file: `apps/web/src/stores/dashboard.ts`** — modelled on `stores/tickets.ts`.

State: `dashboard: AgentDashboard | null`, `scope: TicketScope` (default `'mine'`), `channels: ChannelDescriptor[]`, `isLoading`, `error`; plus the workspace queue (Product rule 7): `queueItems: Ticket[]`, `queueMeta: PaginationMeta | null`, `queueFilters` (reactive: `page`, `pageSize`, `search`, `status`, `priority`, `scope` defaulting to **`'workable'`**), `isQueueLoading`, `queueError`.

Actions:

- `load()` — the primary read (`getAgentDashboard(scope)`), guarded by `latestRequestId` **copied verbatim** from `stores/tickets.ts` 69–101, including the "a stale list must never sit next to an error message" clearing at 92–94.
- `setScope(next)` — sets and reloads.
- `loadChannels()` — degradable (Product rule 12/21): on failure, fall back to a locally-constructed array marking every channel `canRespond: true`, and comment why. Called once; guarded by an `areChannelsLoaded` flag so remounting a timeline does not refetch.
- `loadQueue()` — a **third**, independent request-id counter (`latestQueueRequestId`). Comment it the way `stores/tickets.ts` 103–104 comments its second one: three concurrent list-ish reads exist in this store and sharing a counter would let the dashboard's response cancel the queue's.
- `setQueueSearch` / `setQueueScope` / `setQueueStatusFilter` / `setQueuePriorityFilter` / `setQueuePage` — each resets `queueFilters.page` to 1 (except `setQueuePage`) and calls `loadQueue()`, mirroring `stores/tickets.ts` 162–195.
- `queueParams()` — mirrors `currentParams()` (57–67), mapping `''` to `undefined`.

Expose everything; add a `refresh()` that runs `load()` and `loadQueue()` in parallel for the Refresh button (Product rule 19).

### 3 — `useTasksStore`

**Create file: `apps/web/src/stores/tasks.ts`** — same conventions.

State: `items`, `meta`, `filters` (`page`, `pageSize`, `scope` default `'mine'`, `status`, `overdueOnly`), `ticketTasks: AgentTask[]` (Product rule 17), `isLoading`, `isSaving`, `error`, plus `agents: UserSummary[]` for the assignee picker.

Actions: `load()` (with its own request-id guard), `loadForTicket(ticketId)` (writes only `ticketTasks`, degradable — a caller without `tasks:read` gets `[]` and the panel hides), `loadAgents()` (**reuse `listAgents` from `@/api/users`**, degradable, verbatim comment from `stores/tickets.ts` 146), `create`, `update`, `setStatus`, `remove`, `setScopeFilter`, `setStatusFilter`, `setOverdueOnly`, `setPage`, `clearTicketTasks`.

Every mutating action follows the `stores/tickets.ts` 197–324 contract: try/catch, `error.value = toErrorMessage(caught)`, return `false`/`null`, never throw. After a mutation that came from the ticket panel, refresh **`ticketTasks`** only; after one from `TasksView`, refresh `items` only — a mutation must not stomp the other surface's state.

### 4 — `AgentDashboardView.vue`

**Create file: `apps/web/src/views/AgentDashboardView.vue`.** **Delete `apps/web/src/views/DashboardView.vue`** (Product rule 20).

Layout, top to bottom:

- **Header** — the localised greeting with `auth.user?.fullName`, a scope `<select>` bound to `dashboard.scope`, an `AppButton icon="clock"` Refresh, and the `generatedAt` timestamp rendered with `d(…, 'long')` (Product rule 19).
- **Stat tiles** — a responsive grid of six `StatTile`s from `dashboard.counts`: assigned, open, pending, overdue, unassigned, resolved-last-7-days. `overdue` uses `tone="error"` when non-zero and `tone="neutral"` at zero; `pending` uses `tone="warn"`. Each tile that maps to a filterable list gets a `to` target (`/tickets?status=OPEN`, `/workspace`) so it is a real link, not a decoration.
- **Insight cards** — three `AppCard`s (Status, Priority, Category), each a bar-row list (Product rules 2–3). Percentage is `count / max(1, total)`; a zero-count bucket renders a zero-length bar **and still shows its label and `0`** — that is the visible proof of Story 18's "all buckets, including zeroes" contract. Bar colour comes from Story 20's status/priority palette tokens for those two cards; the category card uses `--color-accent` at varying opacity.
- **Ticket lists** — three `AppCard`s: **Focus** (`focusTickets`), **Overdue** (`overdueTickets`), **Unassigned** (`unassignedTickets`). Each row: subject linking to `/workspace/{id}`, customer name linking to `/customers/{id}`, `AppBadge` for status and priority, relative-ish `updatedAt` via `d()`. Each card's footer says `common.showingOfTotal` with `dashboard.listLimit` and the matching count — **the "no silent truncation" requirement made visible.** Each empty list renders `AppStateBlock variant="empty"` with its own message key.
- **Tasks due** — an `AppCard` listing `tasksDueSoon`, each with an overdue `AppBadge` when `isOverdue`, a link to its ticket when `ticketId` is set, and a Complete `AppButton` calling `tasks.setStatus(id, 'DONE')` then `dashboard.load()`. Rendered only when `auth.can('tasks:read')`; when the caller holds it but the list is empty, an empty state (**not** a hidden card — the distinction between "you can't see this" and "you have nothing due" matters).
- **States** — `AppStateBlock variant="loading"` while `isLoading && !dashboard`; `variant="error"` when `error && !dashboard`; content otherwise. Same three-way exclusivity as `CustomersView.vue`.

`onMounted(() => { void dashboard.load(); if (auth.can('tasks:read')) void tasks.loadForTicket === undefined; })` — concretely: call `dashboard.load()`, and nothing else (Product rule 1). The tasks list comes from the dashboard payload.

### 5 — `AgentWorkspaceView.vue`

**Create file: `apps/web/src/views/AgentWorkspaceView.vue`.**

A three-region CSS grid, all logical properties:

- Desktop (≥1200px): `grid-template-columns: 20rem minmax(0, 1fr) 22rem`.
- Tablet (768–1199px): queue collapses to a toggleable panel above the centre; the rail moves below.
- Mobile (<768px): single column, `AppTabs` switching Queue / Ticket / Context.

**Region 1 — Queue.** A search input (debounced 300 ms with the `watch` + `setTimeout` + `onBeforeUnmount` cleanup copied from `TicketsView.vue`), a scope `<select>` over `TICKET_SCOPES` bound to `dashboard.queueFilters.scope` (**default `workable`**, Product rule 4), status and priority filters, then the compact ticket rows. The selected row carries `aria-current="true"`. `AppPagination` at the bottom. Each row is a `RouterLink` to `/workspace/{id}` — so selection is a navigation and the URL always names the selection (Product rule 5).

**Region 2 — Centre.** When `route.params.id` is absent: `AppStateBlock variant="empty"` with a "pick a ticket" message (Product rule 5). When present:

- A header with subject, customer link, `AppBadge`s, the inline status `<select>` (calling `tickets.setStatus`, **the existing control from `TicketDetailView.vue` 31–37, unchanged in behaviour**), `ReassignControl`, and an Edit link to `/tickets/{id}/edit`.
- The description in a `white-space: pre-wrap` block.
- `AppTabs` with **Internal notes** (the existing comments UI: add/edit/delete with `isOwnComment`, `auth.can('ticket-comments:write')`, `auth.can('tickets:manage')`, and `window.confirm` — all preserved), **Communication** (`CommunicationTimeline`), **Files** (the existing attachments UI), **History** (the existing read-only list).
- The internal-notes composer gets a `QuickReplyPicker` (Product rule 13).

**Region 3 — Context rail.** `CustomerSummaryCard`, then `TicketTasksPanel`, then a `QuickReplyPicker` in browse mode.

Lifecycle: `onMounted` calls `dashboard.loadQueue()`, `dashboard.loadChannels()`, and — when `route.params.id` is present — `tickets.loadDetail(id)`. A `watch` on `route.params.id` reloads the detail on selection change and calls `tickets.clearDetail()` when the id disappears. `onUnmounted` calls `tickets.clearDetail()` and `tasks.clearTicketTasks()`. **`loadDetail`'s existing `latestDetailRequestId` guard is what makes fast queue-clicking safe — do not add a second guard, and do not remove the reliance on it.**

### 6 — `CommunicationTimeline.vue`

**Create file: `apps/web/src/components/CommunicationTimeline.vue`.** Props: `ticketId: string`, `customerId: string`, `readonly?: boolean`, `maxItems?: number`.

- Local state (not a store: three instances can be mounted with different props): `interactions`, `isLoading`, `error`, `includeCustomerHistory` (default **false**, Product rule 9), `channelFilter`, `directionFilter`. Its own request-id guard, same shape as the stores'.
- Fetch via `listTicketInteractions(ticketId, { channel, direction, includeCustomerHistory })`. Refetch on any filter change.
- Render a vertical timeline, **newest first** (the API already sorts `occurredAt desc, createdAt desc` — do **not** re-sort client-side and risk disagreeing with it). Each entry: an `AppBadge` with the channel `AppIcon` and the `interaction.channel.*` label (Product rule 10), the direction as a second badge, subject, `body` in a `pre-wrap` block, `occurredAt` via `d(…, 'long')`, and "logged by {name}". An entry belonging to a **different** ticket (its `ticket.id !== ticketId`) is visually distinguished and shows a link to that ticket (Product rule 9).
- **Composer**, hidden when `readonly` or when `!auth.can('interactions:write')`:
  - A channel `<select>` listing only channels whose `canRespond` is true in `dashboard.channels` (Product rule 11).
  - A **standing `AppStateBlock variant="warning"`** with the key `communication.noProviderNotice` — "Recording this response logs it in the interaction history. No message is sent to the customer." (Product rule 11.) It is **always** visible while the composer is open, not a dismissible one-off.
  - Direction fixed to `OUTBOUND` and rendered as read-only text — a *response* is by definition outbound; offering the choice invites a wrong record. (Logging an inbound interaction is still possible from the customer page's existing form.)
  - Subject, body, and an `occurredAt` `datetime-local` defaulting to now via `toLocalDatetimeInput` — copied from `CustomerDetailView.vue` 150–176, including the `new Date(form.occurredAt).toISOString()` conversion.
  - A `QuickReplyPicker` bound to the body field, filtered to the chosen channel (Product rule 13).
  - Submit calls `createTicketInteraction`, then refetches. **Do not** send `customerId` — Story 19's DTO rejects it under `forbidNonWhitelisted`.
- Delete, gated on `auth.can('interactions:write')` and authorship-or-`customers:archive` (matching Story 11's rule), behind `window.confirm` with the existing key.
- States: loading / error / empty, all `AppStateBlock`.

### 7 — The four remaining feature components

**`CustomerSummaryCard.vue`** — props `customerId`. Fetches `getCustomer(customerId)` once (degradable: a caller without `customers:read` gets an `AppStateBlock variant="empty"` with a "no access" message rather than a broken card). Renders name, type, status badge, email, phone, city, assigned agent, and the three counts, with a link to `/customers/{id}`. Wrap the email in `<span dir="ltr">` (Story 20's bidi edge case).

**`TicketTasksPanel.vue`** — props `ticketId`, `customerId`. Renders only when `auth.can('tasks:read')`. Lists `tasks.ticketTasks` with an inline complete checkbox and an edit `AppButton`; an Add button opens `TaskFormModal` prefilled with `ticketId`/`customerId`, gated on `auth.can('tasks:write')`. Empty state when the caller can read but has no tasks here.

**`TaskFormModal.vue`** — an `AppModal` wrapping the create/edit form (Product rule 18): `title`, `notes`, `status`, `dueAt`, `remindAt` (both `datetime-local`), and an assignee `<select>` shown **only** when `auth.can('tasks:manage')` (Story 19 Product rule 10 — without it the API rejects a foreign assignee, so offering the picker would be a control that always fails). Follow `CustomerFormView.vue`'s copy-into-a-local-`reactive` pattern (45–68) — **never bind inputs to the store object** — and its create-vs-edit payload asymmetry (`|| undefined` on create, `|| null` on edit).

**`QuickReplyPicker.vue`** — props `channel?: InteractionChannel`, `modelValue: string` (the composer's text), plus a `mode: 'insert' | 'browse'`. Fetches `listQuickReplies({ locale: localeStore.locale, channel })`; if the result is empty **and** the locale is not `en`, refetches with `locale: 'en'` (Product rule 14). Degradable on `403`. Selecting a reply **appends** its body to `modelValue` at the caret (or at the end) and emits `update:modelValue` — it never sends (Product rule 13). `browse` mode is read-only with a copy-to-clipboard `AppButton`.

**`ReassignControl.vue`** — props `ticket: Ticket`. Renders nothing without `tickets:write`. With `tickets:assign`: an agent `<select>` (from `tasks.agents` / `listAgents`, degradable) plus an Unassign action. Without it: exactly two `AppButton`s — **Claim** (always, when not already assigned to the caller) and **Release** (only when `ticket.assignedAgent?.id === auth.user?.id`) — per Product rule 15. Both paths call `assignTicket(ticket.id, value)` (Product rule 16), then `tickets.loadDetail(ticket.id)`. On `403`, surface the message inline via `toErrorMessage`; do not hide the control retroactively.

### 8 — `TasksView.vue`

**Create file: `apps/web/src/views/TasksView.vue`.** A standard list screen modelled on `TicketsView.vue`: header with a New task `AppButton` (opens `TaskFormModal`), filters (scope, status, overdue-only), the four-way state branch via `AppStateBlock`, a table with title / status badge / due date / linked ticket / linked customer / assignee / actions, and `AppPagination`. The scope `<select>` offers `all` **only** when `auth.can('tasks:manage')` — Story 19 Product rule 9 makes `scope=all` a `403` otherwise, and offering an option that always fails is the same defect Product rule 15 avoids for reassignment.

### 9 — Routes and navigation

**File: `apps/web/src/router/index.ts`** — repoint the root route and add three, keeping **static before dynamic**:

```ts
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/views/AgentDashboardView.vue'),
    meta: { titleKey: 'nav.dashboard', permissions: ['dashboard:read'] },
  },
  {
    path: '/workspace',
    name: 'workspace',
    component: () => import('@/views/AgentWorkspaceView.vue'),
    meta: { titleKey: 'nav.workspace', permissions: ['tickets:read'] },
  },
  {
    path: '/workspace/:id',
    name: 'workspace-ticket',
    component: () => import('@/views/AgentWorkspaceView.vue'),
    meta: { titleKey: 'nav.workspace', permissions: ['tickets:read'] },
  },
  {
    path: '/tasks',
    name: 'tasks',
    component: () => import('@/views/TasksView.vue'),
    meta: { titleKey: 'nav.tasks', permissions: ['tasks:read'] },
  },
```

Adding `permissions: ['dashboard:read']` to `/` is a **behaviour change**: a signed-in user without that key now lands on `/forbidden`. Every seeded role except `customer` holds it (Story 17 task 8), and the `customer` role has no permissions at all so it was already forbidden everywhere. Recorded in Migration / Rollback.

**File: `apps/web/src/layouts/AppLayout.vue`** — in the **Work** group Story 20 left open, add **Workspace** (`workspace` icon, `/workspace`, gated `tickets:read`) after Dashboard and before Tickets, and **Tasks** (`tasks` icon, `/tasks`, gated `tasks:read`) after Tickets.

### 10 — Additive changes to `TicketDetailView.vue`

**File: `apps/web/src/views/TicketDetailView.vue`.** Two additions only:

1. Widen `activeTab` (line 41) to include `'communication'` and add the tab to the `AppTabs` list **between** attachments and history, rendering `<CommunicationTimeline :ticket-id customer-id />`.
2. Add `<ReassignControl :ticket="tickets.current" />` beside the existing status `<select>`.

**Change nothing else.** Every existing gate, `isOwn*` check, `window.confirm`, and store call in this file stays byte-for-byte. `TicketDetailView.spec.ts` must pass with only additions to its assertions.

### 11 — Translation keys

**Files: `apps/web/src/i18n/locales/en.json` and `ar.json`** — both, with identical key sets (Story 20's `i18n.spec.ts` enforces it):

```
nav.{workspace,tasks}
dashboard.{greeting,refresh,generatedAt,scope}
dashboard.scope.{workable,mine,unassigned,all}
dashboard.stat.{assigned,open,pending,overdue,unassigned,resolvedLast7Days}
dashboard.insight.{status,priority,category}
dashboard.list.{focus,overdue,unassigned,tasksDue}
dashboard.empty.{focus,overdue,unassigned,tasksDue}
common.showingOfTotal              // "Showing {shown} of {total}"
workspace.{queue,selectPrompt,tab.queue,tab.ticket,tab.context}
workspace.tab.{notes,communication,files,history}
communication.{title,respond,send,includeCustomerHistory,otherTicket,noProviderNotice,empty,filterChannel,filterDirection}
task.{title,new,edit,complete,reopen,due,remind,assignee,linkedTicket,linkedCustomer,empty,confirmDelete}
task.status.{OPEN,IN_PROGRESS,DONE,CANCELLED}
task.scope.{mine,all}
task.overdueOnly
quickReply.{title,insert,copy,empty,noAccess}
assign.{claim,release,reassign,unassign,assignTo}
customerSummary.{title,noAccess,viewProfile}
```

`communication.noProviderNotice` is the Product rule 11 notice and must be a full, plain sentence in both languages — not an abbreviation.

---

## Edge Cases & Failure Modes

- **`/` without `dashboard:read`** → redirect to `/forbidden` via the existing guard. Only the `customer` role is affected, which holds no permissions and was already forbidden on every other route.
- **A `reporting-user` on the dashboard** (holds `dashboard:read` and `tickets:read`, **not** `tasks:read`) → the tasks card does not render at all; every other panel renders. `tasksDueSoon` also comes back `[]` from the API (Story 18 Product rule 8), so the UI must not depend on the array being non-empty to decide visibility — **decide on `auth.can('tasks:read')`, not on `length`.**
- **A `support-agent` in the workspace** (no `users:read`) → `loadAgents()` degrades to `[]`, so `ReassignControl` falls back to Claim/Release, which is what Product rule 15 requires anyway. The two paths agree by construction; assert that in a test.
- **`GET /api/communication/channels` failing** → `loadChannels()` falls back to all-respondable (Product rule 12). The composer renders, and a `POST` to a genuinely unsupported channel would still succeed, because Story 19 does not validate `canRespond` server-side — `canRespond` is a UI hint only. Note this in the fallback's code comment so nobody later assumes it is enforced.
- **Selecting a queue ticket, then immediately another** → `loadDetail`'s `latestDetailRequestId` guard (`stores/tickets.ts` 103–140) prevents A's slow response landing after B's. The workspace **relies** on that guard; adding a fourth counter in the view would fight it.
- **Rapid typing in the queue search while the dashboard is also loading** → three independent counters (`latestRequestId`, `latestDetailRequestId`, `latestQueueRequestId`). Sharing any two lets one response cancel another's. This is the single most likely bug in this story, and the reason Product rule 7 exists.
- **`/workspace/not-a-uuid`** → the API's `ParseUUIDPipe` returns `400`; the centre region shows the error via `toErrorMessage`, the queue still renders. No client-side uuid validation, matching Story 16.
- **`/workspace/<valid uuid of a deleted ticket>`** → tickets are never deleted in this project, so in practice this is only reachable with a fabricated uuid → `404`, rendered as an inline error.
- **Navigating from `/workspace/:id` to `/workspace`** → the `watch` on `route.params.id` sees `undefined` and calls `clearDetail()`. Without that branch the previous ticket stays rendered next to an empty-selection queue.
- **Opening `/workspace` then `/tickets`** → `TicketsView.vue`'s filters are **untouched**, because the queue lives in `useDashboardStore` (Product rule 7). Assert this explicitly: mount the workspace, change its scope, then mount `TicketsView` and confirm `useTicketsStore.filters` is unchanged.
- **A timeline entry from another ticket with `includeCustomerHistory` on** → distinguished visually and links to that ticket. Its `ticket` ref is non-null and differs from the current `ticketId`; an entry logged directly against the customer has `ticket: null` and is a third visual case. All three must be distinguishable, not two.
- **The composer's `occurredAt` set to a future time** → `400` from Story 19's 5-minute guard, surfaced inline. There is **no** client-side pre-check, matching how the customer interaction form already behaves.
- **A quick reply inserted into an empty body vs. a non-empty one** → appends, with a newline separator when the field is non-empty. Never replaces: an agent who has typed two sentences and picks a closing must keep both.
- **A quick reply catalogue empty in Arabic** → falls back to `en` (Product rule 14). Empty in both → `AppStateBlock variant="empty"` with `quickReply.empty`, not a blank panel.
- **A `support-agent` clicking Claim on a ticket a supervisor reassigns in the same second** → last write wins; the response is the authoritative ticket and `loadDetail` refreshes from it. No optimistic update, consistent with work items 3–4.
- **Claim on a ticket already assigned to the caller** → Story 18's no-op branch returns 200 and writes no history row. The Claim button should be hidden in that state anyway (Product rule 15); the server-side no-op is the safety net.
- **Release on a ticket assigned to someone else** → the button is not rendered; if reached by other means, `403` inline.
- **Completing a task from the dashboard** → `setStatus(id, 'DONE')` then `dashboard.load()`. Without the reload the tile counts and the list disagree until the next mount.
- **Re-opening a `DONE` task** → Story 19 clears `completedAt`; the UI must re-read rather than assume, because `isOverdue` can flip back to true.
- **`TaskFormModal` submitted with a `ticketId` whose customer differs from a manually chosen `customerId`** → `400` from Story 19's guard. The modal avoids it by **deriving** `customerId` from the ticket when prefilled from a ticket context and not offering a separate customer picker there.
- **A task assigned to a deactivated user** → still listed (Story 17 Edge Cases: no `isActive` filter). The assignee's name renders normally; there is no "inactive" marker, because `UserRef` carries no `isActive`. Accepted limitation, recorded.
- **The workspace on a 375px viewport** → the three-region grid collapses to `AppTabs`. All three regions must remain reachable; no region may become unreachable at any width. Verified manually.
- **RTL in the workspace** → the queue moves to the inline-end side, the timeline's connector line and entry indent mirror, and the tabs strip reverses. Built with logical properties only (Story 20 Product rule 3), so no override block.
- **A very long timeline (`includeCustomerHistory` on a customer with hundreds of interactions)** → the API is unpaginated (Story 19's carried-forward limitation). The component's `maxItems` prop caps what it renders and shows a "showing N of M" footer with a link to the customer page. **This is the mitigation and it must be implemented, not assumed** — otherwise a busy customer freezes the workspace.
- **A `403` on any secondary read** → swallowed to an empty value (Product rule 21). A `403` on a screen's **primary** read renders `AppStateBlock variant="error"`. A `403` on a mutation renders inline and does **not** sign the user out (`api/client.ts` 180–184).
- **`AppModal` open while the locale switches** → focus stays trapped, content re-renders (Story 20 edge case). Assert once here too, since this story is where modals actually get used.

---

## Test Plan

1. **`apps/web/src/api/dashboard.spec.ts`** (new). `getAgentDashboard()` sends no `params` when `scope` is omitted and `{ scope }` when given; the response passes through unmodified.
2. **`apps/web/src/api/tasks.spec.ts`** (new). Modelled on `api/customers.spec.ts`. `listTasks` forwards params unmodified; `createTask`/`updateTask` post the payload verbatim; `setTaskStatus` patches `/tasks/{id}/status` with `{ status }`; `deleteTask` issues a `DELETE`.
3. **`apps/web/src/api/tickets.spec.ts`** (extend). `listTicketInteractions` forwards its three params; `createTicketInteraction` posts to `/tickets/{id}/interactions` and the payload contains **no** `customerId`; `assignTicket` patches `/tickets/{id}/assignment` with `{ assignedAgentId }` (and with `null`).
4. **`apps/web/src/api/customers.spec.ts`** (extend). `INTERACTION_CHANNELS` has **eight** entries including `WHATSAPP`, `SMS`, `WEB_FORM`, in `CHANNEL_ORDER` order; `listInteractions` forwards an optional params object and sends none when called with no argument (**the Story-11 backward-compat proof**).
5. **`apps/web/src/stores/dashboard.spec.ts`** (new). `load()` populates `dashboard`; the race-guard test (two overlapping `load()` calls — the later result wins); `load()` failure clears `dashboard` and sets `error`; `setScope` reloads; `loadChannels()` populates on success and falls back to all-respondable on failure **without** setting `error`; `loadChannels()` called twice issues one request; `loadQueue()` has its **own** counter — assert that an in-flight `load()` resolving does not cancel a `loadQueue()` result and vice versa; `queueParams()` maps `''` to `undefined`; `queueFilters.scope` defaults to `'workable'`; every `setQueue*` resets `page` to 1.
6. **`apps/web/src/stores/tasks.spec.ts`** (new). `load()` populates `items`/`meta` with its race guard; `loadForTicket` writes **only** `ticketTasks` and leaves `items` untouched; `loadForTicket` swallows a rejection into `[]` without setting `error`; `loadAgents` swallows into `[]`; `create`/`update`/`setStatus`/`remove` return contracts and never throw; a mutation originating from the ticket panel refreshes `ticketTasks` and **not** `items`.
7. **`apps/web/src/views/AgentDashboardView.spec.ts`** (new). Six stat tiles render from `counts`; `overdue` gets the error tone when non-zero and the neutral tone at zero; each insight card renders one row per bucket **including zero-count buckets** with the count as text; each of the three ticket lists renders its rows and its "showing N of M" footer; each empty list renders an empty state; the tasks card is **absent** without `tasks:read` and renders an **empty state** with `tasks:read` and an empty array (the two cases must be distinguishable); Complete calls `setStatus` then `dashboard.load()`; the three-way loading/error/content exclusivity; the scope select calls `setScope`; **only one API module is called on mount** (assert `getAgentDashboard` was called and `listTickets`/`listTasks` were not — Product rule 1).
8. **`apps/web/src/views/AgentWorkspaceView.spec.ts`** (new). With no route id: the queue renders and the centre shows the empty-selection state (**not** a redirect); with an id: `loadDetail` is called with it; changing the route id calls `loadDetail` again; navigating to `/workspace` calls `clearDetail`; `onUnmounted` calls `clearDetail` and `clearTicketTasks`; the queue scope select defaults to `workable`; debounced search via `vi.useFakeTimers()`; the four centre tabs render and switch; the internal-notes composer is gated on `ticket-comments:write`; `ReassignControl` and the context rail render; **mounting the workspace and changing its scope leaves `useTicketsStore.filters` unchanged** (Product rule 7's regression test).
9. **`apps/web/src/components/CommunicationTimeline.spec.ts`** (new). Entries render newest-first **as returned** (feed an out-of-order array and assert the component does not re-sort); each entry shows a channel badge with its localised label and an icon; the three visual cases (this ticket / another ticket / no ticket) are distinguishable; `includeCustomerHistory` defaults to **false** and toggling it refetches with the flag; the channel filter refetches; the composer is hidden with `readonly` and without `interactions:write`; the composer's channel select lists only `canRespond` channels; **`communication.noProviderNotice` is always visible while the composer is open** (Product rule 11 — assert its presence, not just that a warning component exists); direction is fixed to `OUTBOUND` and not editable; submit posts without `customerId`; delete is behind `window.confirm`; `maxItems` caps rendering and shows the footer; loading/error/empty states.
10. **`apps/web/src/components/ReassignControl.spec.ts`** (new). Renders nothing without `tickets:write`; with `tickets:assign` renders the agent select and Unassign; without it renders **exactly** Claim and/or Release per Product rule 15 (test all four combinations of assigned-to-me / assigned-to-other / unassigned × has-permission); Claim is hidden when already assigned to the caller; every path calls `assignTicket` (**never** `updateTicket` — assert the latter was not called, that is Product rule 16's test); a `403` renders inline and the control stays mounted.
11. **`apps/web/src/components/QuickReplyPicker.spec.ts`** (new). Fetches with the current locale; refetches with `en` when a non-`en` locale returns `[]` and not when the locale **is** `en`; selecting **appends** to a non-empty `modelValue` with a separator and emits `update:modelValue`; selecting never triggers a send (assert no POST); a `403` degrades to an empty state; `browse` mode renders no insert action.
12. **`apps/web/src/components/TicketTasksPanel.spec.ts`** (new). Hidden without `tasks:read`; empty state with it and no tasks; the Add button is gated on `tasks:write`; completing calls `setStatus` and refreshes `ticketTasks` only.
13. **`apps/web/src/components/TaskFormModal.spec.ts`** (new). Create-mode defaults; edit-mode population from a local copy (**mutating a field does not mutate the store object** — the `CustomerFormView` pattern's regression test); the assignee select is present only with `tasks:manage`; create payload uses `undefined` for empty optionals and edit payload uses `null`; `customerId` is derived from `ticketId` when prefilled from a ticket and no separate customer picker is offered; `Escape` closes; success closes and refreshes.
14. **`apps/web/src/components/CustomerSummaryCard.spec.ts`** (new). Renders the fields; a `403` renders the no-access empty state rather than an error; the email is wrapped in `dir="ltr"`.
15. **`apps/web/src/views/TasksView.spec.ts`** (new). The four exclusive states; the scope select offers `all` **only** with `tasks:manage`; filters call their store actions; pagination bounds; New task opens the modal and is gated on `tasks:write`.
16. **`apps/web/src/views/TicketDetailView.spec.ts`** (extend, **adding only**). The fourth Communication tab exists and renders `CommunicationTimeline`; `ReassignControl` renders beside the status select; **every pre-existing assertion still passes unchanged** — this is the no-regression proof for the one existing view this story edits.
17. **`apps/web/src/router/index.spec.ts`** (extend). The four new/changed route resolutions; `/` now requires `dashboard:read` and redirects a caller without it to `/forbidden`; `/workspace` and `/workspace/:id` both resolve and both require `tickets:read`; `/tasks` requires `tasks:read`; the signed-out redirect for each; the catch-all still resolves.
18. **`apps/web/src/layouts/AppLayout.spec.ts`** (extend). Workspace and Tasks links appear with their permissions and are absent without them; every Story-20 assertion still passes.
19. **`apps/web/src/i18n/i18n.spec.ts`** — no change needed, but it **must still pass**: it is what proves every key added in task 11 exists in both catalogues.
20. **No new backend test.** No backend file is touched.
21. **No automated end-to-end browser test** — consistent with work items 1–4; covered manually below.

---

## Migration / Rollback

**No new dependency.** Everything is built from Story 20's design system.

**Two behaviour changes to record:**

1. **`/` now requires `dashboard:read`.** A signed-in user without it lands on `/forbidden` instead of a placeholder page. Every seeded role except `customer` holds the key, and `customer` holds no permissions at all, so no seeded role loses access it previously had. If a custom role exists in a deployed database without `dashboard:read`, its users lose the landing page — the fix is a role grant, not a code change.
2. **`DashboardView.vue` is deleted.** Only `router/index.ts` referenced it.

**One work-item-3 file is edited for correctness:** `apps/web/src/api/customers.ts`'s `InteractionChannel` union and `INTERACTION_CHANNELS` constant gain the three channels Story 17 added. Leaving them stale would hide WhatsApp, SMS, and Web Forms from every picker in the app — including the pre-existing customer interaction form — so this is a fix, not scope creep. It is additive: the five original values keep their positions in the union and no existing row's channel becomes unrenderable.

**What a half-applied state looks like.** Every task in this story compiles independently, so a partial implementation runs. The two states to watch for: (a) the workspace queue accidentally sharing `useTicketsStore.filters`, which only shows up when navigating between `/workspace` and `/tickets` — Test 8's last assertion is the guard; (b) the composer shipped without the no-provider notice, which is not a crash but is the most misleading possible outcome — Test 9 asserts the notice specifically for that reason.

**Rollback.** Delete the four new API modules, the two new stores, the three new views, the six new components, and their specs; revert `router/index.ts`, `AppLayout.vue`, `TicketDetailView.vue`, `api/tickets.ts`, `api/customers.ts`, and both locale files; restore `DashboardView.vue`. Nothing is persisted client-side beyond Story 20's `crm.locale`, and no backend state was written that becomes invalid — task and interaction rows created during testing simply stay in the database, reachable through the API.

---

## Verification Steps

1. **Typecheck:** `npm run typecheck --workspace @crm/web`.
2. **Lint:** `npm run lint --workspace @crm/web` (at `--max-warnings 0`, without editing `eslint.config.js`).
3. **Unit tests:** `npm run test --workspace @crm/web`.
4. **Build:** `npm run build --workspace @crm/web`.
5. **Storage grep:** `grep -rn "localStorage\|sessionStorage" apps/web/src/` — still exactly Story 20's hits (`stores/locale.ts`, its spec, the comment in `api/session.ts`). No new hit.
6. **Token/logical-property greps:** re-run Story 20's Verification Steps 7 and 9 over the new files — zero hard-coded colours, zero physical direction properties in `components/` and `views/`.
7. **Hard-coded-string sweep** over the three new views and six new components: every user-visible string, `aria-label`, `placeholder`, and `title` goes through `$t`/`t`. Zero literals.
8. **Both dev servers running**, signed in as the seeded administrator.
9. **Dashboard walkthrough:** confirm six tiles with plausible numbers; three insight cards where the bar lengths are proportional and **every** bucket appears including zeroes; three ticket lists each with a "showing N of M" footer; the tasks card. Switch scope across all four values and confirm the numbers move. Click Refresh and confirm `generatedAt` advances.
10. **Overdue proof:** back-date one `URGENT` `OPEN` ticket's `updated_at` by five days (via `npm run prisma:studio`), reload the dashboard, and confirm it appears in the Overdue list and increments the overdue tile; set it `CLOSED` and confirm it leaves both.
11. **Workspace walkthrough:** open `/workspace` and confirm the empty-selection state with the queue populated. Confirm the queue defaults to `workable`. Select a ticket via the URL bar and via a queue click; confirm both work and the URL always names the selection. Exercise all four centre tabs, the status select, `ReassignControl`, and the context rail.
12. **Queue-isolation proof:** in `/workspace`, set the scope to `all` and type a search term. Navigate to `/tickets` and confirm **its** filters are untouched. Navigate back and confirm the queue kept its own state.
13. **Race proof:** click five different queue tickets in rapid succession and confirm the centre region ends on the **last** one clicked, with matching comments/attachments/history.
14. **Communication walkthrough:** on a ticket, log an outbound response via the composer for `EMAIL`, then `WHATSAPP`, `SMS`, `CHAT`, and `WEB_FORM`. Confirm each appears immediately with the right channel badge and icon. Confirm the no-provider notice is visible the whole time. Confirm `PHONE` and `MEETING` are **not** offered in the composer's channel list but **do** render correctly when present in the timeline (log one from the customer page to produce it).
15. **Timeline linkage proof:** confirm an interaction logged from the workspace also appears on the customer's page with a link back to the ticket; toggle `includeCustomerHistory` and confirm interactions from a second ticket of the same customer appear, visually distinguished, with a link to that ticket; confirm an interaction logged directly on the customer appears as the third, ticket-less case.
16. **Quick replies:** insert a reply into an internal note and into a Respond composer; confirm it appends rather than replaces, that nothing is sent on selection, and that switching to Arabic shows the Arabic bodies. Deactivate one via the API and confirm it disappears from the picker.
17. **Tasks walkthrough:** create a task from the ticket panel (confirm it is prefilled with the ticket and customer), complete it, re-open it, edit it, delete it. Repeat from `/tasks`. Confirm a task created in the panel appears in `/tasks` and vice versa, and confirm the dashboard's tasks card and tile counts update after a completion.
18. **`support-agent` flow:** confirm the dashboard renders; the workspace queue defaults to `workable`; `ReassignControl` offers **only** Claim/Release; Claim works and assigning to a colleague is not offered anywhere; `/tasks` offers no `all` scope; own-task CRUD works; the internal-notes and files tabs behave exactly as they did in Story 16.
19. **`support-supervisor` flow:** confirm `ReassignControl` offers the full agent picker and reassignment to a colleague succeeds and shows up in the History tab with the "Assigned agent" label.
20. **`reporting-user` flow:** confirm the dashboard renders **without** the tasks card, no `/tasks` nav link appears, the workspace renders read-only (no composer, no note form, no status select, no reassign control), and nothing on the screen errors.
21. **`customer` flow:** confirm `/` redirects to `/forbidden`.
22. **RTL walkthrough:** switch to Arabic and repeat steps 9, 11, 14, and 17. Confirm the workspace regions mirror, the timeline connector and indents mirror, the tabs strip reverses, the queue moves to the correct side, modals open from the correct side, and the page body never scrolls horizontally. Switch back to English and confirm it all reverses.
23. **Responsive pass:** 1200px, 900px, 768px, 375px, in both directions. Confirm all three workspace regions stay reachable at every width and the dashboard grid reflows without clipping.
24. **Keyboard and a11y pass:** tab through the dashboard and the workspace — every control reachable with a visible focus ring; the centre tabs operable with arrow keys; `TaskFormModal` traps focus, closes on `Escape`, and restores focus; every icon-only button announces a label; the insight bar rows read as a list with their counts.
25. **403 mid-session:** as a `support-agent`, attempt to delete another user's comment and to reassign to a colleague. Confirm both show an inline error, neither signs the user out, and the surrounding screen stays usable.
26. **Regression:** walk every work-item-1-to-4 screen — Login, Users, Customers (list, detail with all three tabs, create, edit), Tickets (list, detail with **all four** tabs now, create, edit), System status — and confirm identical behaviour, including the debounced search, the pagination bounds, the status changes, and all eight destructive `window.confirm` prompts.
27. **Full-repo:** `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` from the repo root.

---

## Done Criteria

- [ ] Four new API modules mirror Story 18–19's DTOs; `UserRef`, `PaginationMeta`, `CustomerInteraction`, and the interaction enums are **imported**, never redefined.
- [ ] `api/customers.ts`'s `InteractionChannel` union and `INTERACTION_CHANNELS` constant carry all **eight** channels.
- [ ] `useDashboardStore` and `useTasksStore` follow `useTicketsStore`'s action contract; the store holds **three independent request-id counters** and the workspace queue does **not** share `useTicketsStore.filters`.
- [ ] `AgentDashboardView.vue` renders from **one** API call, shows all buckets including zeroes with counts as text, caps every list and says so, and distinguishes "no permission" from "nothing due" on the tasks card.
- [ ] `AgentWorkspaceView.vue` exists at `/workspace` and `/workspace/:id`, defaults its queue to `workable`, shows an empty-selection state rather than auto-selecting, and reuses `useTicketsStore.loadDetail`'s race guard.
- [ ] `CommunicationTimeline.vue` is the **single** timeline implementation, used in three places; it renders channel as badge+icon+label, distinguishes all three ticket-linkage cases, offers the `includeCustomerHistory` toggle off by default, caps long timelines, and shows the **no-provider notice whenever the composer is open**.
- [ ] The Respond composer offers only `canRespond` channels, fixes direction to `OUTBOUND`, and sends no `customerId`.
- [ ] `ReassignControl.vue` calls `PATCH /tickets/:id/assignment` (never `PATCH /tickets/:id`) and offers Claim/Release only, without `tickets:assign`.
- [ ] `QuickReplyPicker.vue` inserts text and never sends; it falls back to `en` when the current locale is empty.
- [ ] `TasksView.vue` and `TicketTasksPanel.vue` exist; `scope=all` is offered only with `tasks:manage`; panel and list state do not overwrite each other.
- [ ] `TicketDetailView.vue` gained a Communication tab and a `ReassignControl` and **nothing else** — every pre-existing spec assertion still passes.
- [ ] Four routes registered static-before-dynamic with `titleKey` and permissions; Workspace and Tasks nav links gated correctly; `DashboardView.vue` deleted.
- [ ] Every new string is a key in **both** locale files; `i18n.spec.ts` passes.
- [ ] Every degradable read swallows its error; only a screen's primary read sets `error`.
- [ ] **No backend file was modified.**
- [ ] All 27 Verification Steps pass, including the four role-based flows (18–21), the full RTL walkthrough (22), the responsive matrix (23), the a11y pass (24), and the work-items-1-to-4 regression (26).
- [ ] Full-repo typecheck/lint/test/build pass.

---

This closes work item 5 — Agent Dashboard & Collaboration. The intake's three requirement blocks map onto this feature's five stories: the data model for tasks, quick replies, and channel/ticket linkage (Story 17); the dashboard API, workable scope, and permissioned reassignment (Story 18); tasks, quick replies, and the unified interaction timeline (Story 19); the design system, localisation, and RTL/LTR foundation (Story 20); and the agent dashboard, workspace, and communication UI (Story 21).
