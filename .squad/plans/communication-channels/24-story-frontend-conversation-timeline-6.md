# Story 24 — Frontend: the conversation inbox and the unified timeline interface (Story: 6)

## Prerequisites

- [Story 23 completed](23-story-channel-dispatch-inbound-timeline-api-6.md): `POST /api/communication/messages`, `POST /api/communication/inbound/:channel`, `GET /api/communication/timeline`, and `GET /api/communication/conversations` all exist; `CustomerInteraction.createdBy` is already nullable in `apps/web/src/api/customers.ts` and already guarded in `CommunicationTimeline.vue` and `CustomerDetailView.vue`; `communication.systemAuthor` exists in both locale catalogues.
- [Story 22 completed](22-story-communication-abstraction-data-model-6.md): `GET /api/communication/channels` returns nine fields per channel, and `WEB_FORM.canRespond` is `false`.
- [Story 20 completed](../agent-dashboard-and-collaboration-and-enhancement-ui/20-story-frontend-design-system-i18n-rtl-5.md): the design tokens, `AppIcon`/`AppButton`/`AppCard`/`AppBadge`/`AppStateBlock`/`AppTabs`/`AppModal`/`AppPagination`/`StatTile`, `utils/format.ts`, `useLocaleStore`, and the `en`/`ar` catalogues with key parity enforced by `i18n.spec.ts`.
- [Story 21 completed](../agent-dashboard-and-collaboration-and-enhancement-ui/21-story-frontend-agent-dashboard-workspace-5.md): `CommunicationTimeline.vue`, `QuickReplyPicker.vue`, `useDashboardStore`, and the ticket workspace that mounts them.
- Both dev servers runnable: `npm run dev:api` and `npm run dev:web` from the repo root.
- **No backend file is touched in this story.** See Product rule 1.
- **No migration.**

---

## Story Goal

The intake's last two bullets — "unified interaction timeline" and "Vue conversation/timeline interface" — and its last two acceptance criteria — "unified timeline displays interactions in chronological order" and "frontend can display the communication history". Five outcomes:

1. **A conversation inbox at `/communication`.** Conversations on one side, the selected thread on the other, driven by `GET /api/communication/conversations` and `GET /api/communication/timeline`. Filterable by channel, direction, delivery status, and "my customers"; paginated. A nav entry in the **Work** group.
2. **One timeline component, three data sources.** `CommunicationTimeline.vue` currently requires a `ticketId`. It becomes source-agnostic: ticket-scoped, customer-scoped, or unscoped (the inbox), with one race guard and one rendering path for all three.
3. **A channel-aware composer.** The address field appears only when the channel's `requiresAddress` is true and pre-fills from the customer; the subject field disappears when `supportsSubject` is false; the body counter enforces the channel's `maxBodyLength`. Sending goes through `POST /api/communication/messages` for a caller holding `communication:send`, and falls back to the existing log route for one who does not.
4. **Delivery status made visible.** Every entry shows its channel, direction, and delivery status, and an ingested message shows it had no author. `providerConfigured: false` keeps its standing, non-dismissible notice.
5. **The customer profile stops hand-rolling its own list.** `CustomerDetailView.vue`'s bespoke interaction panel is replaced by the shared component, deleting roughly 60 lines of markup, script, and CSS.

**Not in scope:** any file under `apps/api/`. Real-time updates — nothing polls, no websocket, no SSE, consistent with work item 5's decision. Optimistic UI. A conversation-detail *route* per thread (the inbox holds selection in a query parameter, not a path segment). Any new npm dependency. Dark mode. Any change to how quick replies work.

---

## Context — Read These Files First

1. `apps/web/src/components/CommunicationTimeline.vue` — full file (393 lines). This is the file the story mostly rewrites, and every existing behaviour must survive:
   - props (**23–31**): `ticketId` required today, `customerId`, `readonly`, `maxItems`.
   - `load()` (**46–75**) — the `latestRequestId` race guard at **44** and **58–74**. Keep the pattern exactly; do not replace it with an `AbortController`.
   - the watches at **77–78** and `onMounted` at **80–83**, which calls `dashboard.loadChannels()`.
   - `respondableChannels` (**89**) — filters on `canRespond`, which is why `WEB_FORM` already disappeared from the picker in Story 22.
   - the composer (**95–156**), including the `toLocalDatetimeInput` / `new Date(...).toISOString()` round-trip at **136** and the comment explaining why.
   - `canDelete()` (**160–163**) and `remove()` (**165–178**), including the comment at **171–172** that there is no ticket-scoped delete route.
   - `isOtherTicket()` (**180–182**) and the three-case entry rendering it drives (**269**, **277–279**).
   - the template: toolbar **187–215**, composer form **217–256**, the state blocks **258–262**, the list **264–294**, the `maxItems` footer **296–300**.
   - the scoped styles **304–392**, which use logical properties (`border-inline-start` **352**, `margin-inline-start` **359**) — the RTL convention from Story 20.
2. `apps/web/src/components/CommunicationTimeline.spec.ts` **lines 1–55** — the mocking shape: `vi.mock` on `@/stores/auth`, on `@/api/tickets` and `@/api/customers` with `importActual` spreads (**12–22**), on `@/api/communication` with a three-channel stub (**24–30**), and on `@/api/quickReplies` (**33–35**). The `makeInteraction()` factory at **42–56** gains the Story 22/23 fields.
3. `apps/web/src/api/communication.ts` — full file (22 lines). `ChannelDescriptor` (**11–16**) and `listChannels()` (**18–22**). Extended, not replaced.
4. `apps/web/src/api/customers.ts` — `InteractionChannel` (**6–7**), `INTERACTION_CHANNELS` (**15–17**) with its "matches CHANNEL_ORDER" comment (**14**), `UserRef` (**20–24**), `InteractionTicketRef` (**125–128**), `CustomerInteraction` (**131–143**, with `createdBy` already nullable from Story 23), `CreateInteractionPayload` (**147–154**), `ListInteractionsParams` (**266–270**), `listInteractions` (**272–282**), `createInteraction` (**284–291**), `deleteInteraction` (**293–295**).
5. `apps/web/src/api/tickets.ts` **lines 219–250** — `ListTicketInteractionsParams` (**219–223**), `CreateTicketInteractionPayload` (**225–228**) and its comment, `listTicketInteractions` (**230–240**), `createTicketInteraction` (**242–250**).
6. `apps/web/src/stores/dashboard.ts` — full file (202 lines). `channels` (**19**), `loadChannels()` (**87–110**) including the `areChannelsLoaded` latch (**87–94**) and the fail-open fallback at **98–109** with its four-line comment. Both move in task 3; the comment moves with them. The three independent race counters (**52**, **115**) and the "queue keeps its own state" comment (**23–26**) are the precedent for how the new store is structured.
7. `apps/web/src/views/CustomerDetailView.vue` — imports **7–21**; the interactions script block **147–181** (`interactionForm` **149–155**, `submitInteraction` **157–175**, `removeInteraction` **177–181**); the template panel **339–405** (the form **340–373**, the empty line **375**, the list **377–401**, the ticketing note **403–405**); the `customer-detail__interaction*` styles at **461–495**. Task 6 deletes all of it.
8. `apps/web/src/stores/customers.ts` — `interactions` (**41**), the parallel load at **111–125**, the two reload points (**304**, **318**), the reset (**333**), and the return (**343**). Task 6 removes the interaction slice, so check every one of those five sites plus `customers.spec.ts`.
9. `apps/web/src/layouts/AppLayout.vue` — `NavGroup` (**26–30**) and `navGroups` (**32–67**): the Work group's items at **38–42**, the Records group at **45–51**, `visible` gating with `auth.can(...)`, and the empty-group filter at **64–66**.
10. `apps/web/src/router/index.ts` — the `RouteMeta` declaration (**5–13**) with `titleKey`, `public`, and `permissions`; the route objects from **15** onward, e.g. `/customers` at **41–45** with `meta: { titleKey: 'nav.customers', permissions: ['customers:read'] }`.
11. `apps/web/src/components/icons.ts` — `ICON_PATHS` (**4–34**) with `communication` at **11** and `send` at **32**; `IconName` (**36**) is `keyof typeof ICON_PATHS`, which is why a typo in a name is a compile error. Task 7 adds four entries.
12. `apps/web/src/i18n/i18n.spec.ts` — full file (112 lines). The key-parity test (**34–42**), the empty-value test (**44–49**), the per-enum key tests (**51–98**) that task 8's new test copies, and the `CHAT` → `'Live Chat'` assertion (**100–102**).
13. `apps/web/src/i18n/locales/en.json` — the `communication` block (nine keys today, plus `systemAuthor` from Story 23) and the `interaction.channel` / `interaction.direction` blocks. `apps/web/src/i18n/locales/ar.json` mirrors it exactly; both are edited in the same commit or `i18n.spec.ts` fails.
14. `apps/web/src/components/AppStateBlock.vue` **lines 7–29** — the five variants (`loading`, `empty`, `error`, `success`, `warning`) and the `common.state.*` default messages. `AppPagination.vue` **5–11** — props `page`/`totalPages`/`total` and the single `change` event. `AppBadge.vue` **6–20** — the six tones.
15. `apps/web/src/components/QuickReplyPicker.vue` **lines 10–17** — props `channel`, `modelValue`, `mode`. It already takes the channel, so the composer passes the selected one through unchanged.
16. `apps/web/src/views/TasksView.vue` and `apps/web/src/views/TicketsView.vue` — the two existing "filter bar + paginated list" views, and therefore the layout precedent `CommunicationView.vue` follows. `apps/web/src/views/AgentWorkspaceView.vue` is the two-pane precedent (list on one side, detail on the other).
17. `apps/web/src/stores/tasks.ts` — the store shape for a paginated, filtered list: a `filters` reactive, a `params()` builder, a request-id guard, and `setX()` mutators that reset `page` to 1.
18. [`.squad/plans/agent-dashboard-and-collaboration-and-enhancement-ui/21-story-frontend-agent-dashboard-workspace-5.md`](../agent-dashboard-and-collaboration-and-enhancement-ui/21-story-frontend-agent-dashboard-workspace-5.md) — the precedent for a frontend story in this repo: no CSS primitives of its own, every screen assembled from Story 20's components, both catalogues updated, one spec per touched file.

---

## Product rules (from story)

| # | Rule | Rationale |
|---|------|-----------|
| 1 | **No backend file is modified.** Every contract this story consumes shipped in Stories 22–23. | If a screen needs a field the API does not return, that is a Story 23 gap to report, not a reason to reach across the boundary mid-story. |
| 2 | **One timeline component, three data sources.** `CommunicationTimeline.vue` takes `ticketId?` and `customerId?`; `ticketId` selects `listTicketInteractions`, `customerId` alone selects `listInteractions`, neither selects `listCommunicationTimeline`. | Three near-identical components is how the customer profile ended up hand-rolling its own list in the first place. One component means the delivery-status badge, the ticket-link rendering, and the race guard are written once. |
| 3 | **Both props optional, and a dev-time assertion that the pair makes sense.** Passing `ticketId` without `customerId` is legal (the ticket knows its customer); passing neither means the inbox. | The alternative — a discriminating `mode` prop — makes every call site state twice what one prop already implies. |
| 4 | **The composer sends through `POST /api/communication/messages` when the caller holds `communication:send`, and through the existing log route otherwise.** The channel picker, address field, and validation come from the channel descriptors either way. | A `support-agent` holds both keys after Story 22's seed, so the dispatch path is the normal one. The fallback is what keeps the composer working for a role that can log but not send — and losing that would be a regression against work item 5. |
| 5 | **The no-provider notice stays, and stays non-dismissible.** Its text still says no message is sent to the customer. | Nothing changed: `providerConfigured` is `false` for all eight channels. A Send button whose only effect is a database row must say so every time, not once. |
| 6 | **Delivery status renders as a badge on every entry**, `LOGGED` included, with `FAILED` in the `error` tone and `failureReason` shown beneath it. | Once a status column exists, hiding the common value trains the eye to ignore the badge entirely. Showing all five keeps `FAILED` legible when it eventually happens. |
| 7 | **The inbox keeps its own store and its own request-id guards** — `useCommunicationStore`, with separate counters for conversations and for the timeline. | Work item 5's decision, and the same bug it was avoiding: sharing a counter between two lists that load concurrently lets one response cancel the other. |
| 8 | **Channel descriptors move from `useDashboardStore` to `useCommunicationStore`**, fail-open fallback and comment included, and `dashboard.channels` / `dashboard.loadChannels` are **deleted**. | Two stores owning one cached list is a stale-data bug waiting for a second consumer. The descriptors were in the dashboard store because Story 21 had nowhere else to put them; now there is somewhere else. |
| 9 | **The selected conversation lives in a query parameter** (`?customerId=&channel=&thread=`), not a path segment. | A thread key is derived, opaque, and can be `null` — three properties that make a bad URL segment. A query parameter still makes a selection shareable and back-button-able, which is the point. |
| 10 | **Nothing polls.** The inbox refreshes on mount, on a filter change, on an explicit Refresh, and after a send it performed itself. | No websocket or SSE exists on the backend. Work item 5 chose to make staleness visible rather than paper over it with an interval; a timer here would be the first exception. |
| 11 | **A `threadKey: null` conversation is labelled, not hidden**, with a translated "Earlier history" label. | Story 22 Product rule 7: every pre-existing interaction lands there. Hiding the group would hide the bulk of a real deployment's history on the day the feature ships. |
| 12 | **The address field is pre-filled from the customer and editable.** An empty pre-fill for a channel with `requiresAddress: true` disables Send with an inline explanation rather than letting the request 400. | The API's 400 message is English-only (`toErrorMessage` surfaces server text untranslated — work item 5's recorded limitation), so a preventable error should be prevented in a translated UI. |
| 13 | **The body counter enforces `maxBodyLength` client-side with `maxlength`,** and the API's per-channel check stays the authority. | `maxlength` on the textarea is one attribute and it stops the mistake before it is made. It is not a substitute for the server check, which is why both exist. |
| 14 | **`interaction.channelAddress` is rendered with `dir="ltr"`.** | Email addresses, E.164 numbers, and session ids are Latin-script identifiers. In an Arabic UI they need the same treatment `CustomerDetailView.vue` already gives a filename at **325**. |
| 15 | **No component or CSS primitive is invented.** Every new screen is assembled from Story 20's components and tokens. | Story 21's rule, unchanged. If a card needs a new visual treatment, it needs a token, not a bespoke stylesheet. |

---

## Backend Tasks

**No backend changes required.** Every route, field, and permission key this story consumes shipped in Stories 22–23 (Product rule 1). If a screen needs something the API does not return, stop and report it as a Story 23 gap rather than reaching across the boundary — and confirm before finishing that `git status` shows no modified file under `apps/api/`.

---

## Frontend Tasks

### 1 — `apps/web/src/api/communication.ts`: the client

**File: `apps/web/src/api/communication.ts`**

Extend `ChannelDescriptor` (**11–16**) with the five fields Story 22 added, keeping the existing doc comment (**4–10**) and updating its last sentence to mention `addressKind`:

```ts
export type ChannelAddressKind = 'email' | 'phone' | 'session' | 'none';

export interface ChannelDescriptor {
  key: InteractionChannel;
  canRespond: boolean;
  isRealtime: boolean;
  providerConfigured: boolean;
  acceptsInbound: boolean;
  addressKind: ChannelAddressKind;
  requiresAddress: boolean;
  maxBodyLength: number | null;
  supportsSubject: boolean;
}
```

Add, below `listChannels()` (**18–22**):

```ts
/** Mirrors SendMessageDto. No `direction`: the route always writes OUTBOUND. */
export interface SendMessagePayload {
  customerId: string;
  ticketId?: string;
  channel: InteractionChannel;
  subject?: string;
  body: string;
  address?: string;
  occurredAt?: string;
}

export interface ListTimelineParams {
  page?: number;
  pageSize?: number;
  channel?: InteractionChannel;
  direction?: InteractionDirection;
  deliveryStatus?: InteractionDeliveryStatus;
  customerId?: string;
  ticketId?: string;
  assignedAgentId?: string;
  mine?: boolean;
  occurredFrom?: string;
  occurredTo?: string;
  search?: string;
  ticketLinkedOnly?: boolean;
}

export interface PaginatedTimeline {
  items: CustomerInteraction[];
  meta: PaginationMeta;
}

/** Mirrors ConversationDto. `threadKey` is null for interactions logged before
 *  the delivery columns existed — the UI labels that group "Earlier history". */
export interface Conversation {
  customer: InteractionCustomerRef;
  channel: InteractionChannel;
  threadKey: string | null;
  messageCount: number;
  lastOccurredAt: string;
  lastMessage: CustomerInteraction;
}

export interface ConversationList {
  items: Conversation[];
  meta: PaginationMeta;
}

export interface ListConversationsParams {
  page?: number;
  pageSize?: number;
  customerId?: string;
  channel?: InteractionChannel;
  assignedAgentId?: string;
  mine?: boolean;
}

export async function sendMessage(payload: SendMessagePayload): Promise<CustomerInteraction> { ... }
export async function listCommunicationTimeline(params: ListTimelineParams): Promise<PaginatedTimeline> { ... }
export async function listConversations(params: ListConversationsParams): Promise<ConversationList> { ... }
```

**File: `apps/web/src/api/customers.ts`**

- Add `export type InteractionDeliveryStatus = 'LOGGED' | 'RECEIVED' | 'QUEUED' | 'SENT' | 'FAILED';` beside `InteractionDirection` (**8**), and `export const INTERACTION_DELIVERY_STATUSES: InteractionDeliveryStatus[] = [...]` beside `INTERACTION_CHANNELS` (**15–17**), with a comment pointing at the Prisma enum the way **10–11** and **14** already do.
- Add `export interface InteractionCustomerRef { id: string; name: string; email: string | null; }` beside `InteractionTicketRef` (**125–128**), mirroring `InteractionCustomerRefDto`.
- Extend `CustomerInteraction` (**131–143**) with `customer: InteractionCustomerRef`, `deliveryStatus: InteractionDeliveryStatus`, `channelAddress: string | null`, `externalId: string | null`, `failureReason: string | null`, `threadKey: string | null`. `createdBy: UserRef | null` is already there from Story 23.
- Extend `ListInteractionsParams` (**266–270**) with `deliveryStatus?: InteractionDeliveryStatus`.

**File: `apps/web/src/api/tickets.ts`** — extend `ListTicketInteractionsParams` (**219–223**) with `deliveryStatus?: InteractionDeliveryStatus`.

### 2 — `Create file: apps/web/src/components/channels.ts`

The one place a channel maps to an icon, so no component derives it:

```ts
/** One icon per InteractionChannel. Typed as a full Record so a ninth channel
 *  is a compile error here — the same guarantee ICON_PATHS gives icon names. */
export const CHANNEL_ICONS: Record<InteractionChannel, IconName> = {
  EMAIL: 'mail',
  WHATSAPP: 'message-circle',
  CHAT: 'communication',
  SMS: 'smartphone',
  WEB_FORM: 'clipboard',
  PHONE: 'phone',
  MEETING: 'users',
  OTHER: 'info',
};

/** Badge tone per delivery status. FAILED is the only one that must stand out. */
export const DELIVERY_TONES: Record<InteractionDeliveryStatus, 'neutral' | 'info' | 'ok' | 'warn' | 'error'> = {
  LOGGED: 'neutral',
  RECEIVED: 'info',
  QUEUED: 'warn',
  SENT: 'ok',
  FAILED: 'error',
};
```

### 3 — `Create file: apps/web/src/stores/communication.ts`

Owns three things: the channel descriptors (moved from `useDashboardStore`), the conversation list, and the timeline list. Two independent request-id counters (Product rule 7).

```ts
export const useCommunicationStore = defineStore('communication', () => {
  const channels = ref<ChannelDescriptor[]>([]);

  const conversations = ref<Conversation[]>([]);
  const conversationsMeta = ref<PaginationMeta | null>(null);
  const isConversationsLoading = ref(false);
  const conversationsError = ref<string | null>(null);

  const interactions = ref<CustomerInteraction[]>([]);
  const timelineMeta = ref<PaginationMeta | null>(null);
  const isTimelineLoading = ref(false);
  const timelineError = ref<string | null>(null);

  const selected = ref<{ customerId: string; channel: InteractionChannel; threadKey: string | null } | null>(null);

  const filters = reactive({
    page: 1,
    pageSize: 20,
    search: '',
    channel: '' as InteractionChannel | '',
    direction: '' as InteractionDirection | '',
    deliveryStatus: '' as InteractionDeliveryStatus | '',
    mine: false,
  });

  ...
});
```

- `loadChannels()` — **moved verbatim** from `stores/dashboard.ts` **87–110**, including the `areChannelsLoaded` latch and the entire four-line fail-open comment at **98–102**. The fallback object at **103–108** gains the five new fields; use permissive defaults (`acceptsInbound: false`, `addressKind: 'none'`, `requiresAddress: false`, `maxBodyLength: null`, `supportsSubject: true`) so a descriptor fetch failure never *blocks* a compose — matching the existing comment's reasoning exactly.
- `channelDescriptor(key)` — a getter returning the descriptor or `undefined`. Every consumer that needs `requiresAddress` or `maxBodyLength` goes through it.
- `respondableChannels` — a computed filtering on `canRespond`, replacing the local computed at `CommunicationTimeline.vue` **89**.
- `loadConversations()` / `loadTimeline()` — each with its own counter, each mirroring `stores/dashboard.ts` `loadQueue()` (**117–144**): clear the list and set the error on failure so a stale list never sits beside an error message.
- `select(conversation | null)` — sets `selected`, resets `filters.page` to 1, and reloads the timeline.
- `params()` builders mapping `''` to `undefined` and folding `selected` into the timeline params (`customerId`, `channel`, and — when `threadKey` is non-null — nothing extra: the API has no `threadKey` filter, so a selected thread is approximated by `customerId` + `channel`. **Say so in a comment**; it means a customer with two threads on one channel shows both, which is honest and better than a filter the API does not offer.)
- `setSearch` / `setChannel` / `setDirection` / `setDeliveryStatus` / `setMine` / `setPage`, each resetting `page` to 1 except `setPage`, following `stores/tasks.ts`.
- `reset()` clearing everything except `channels` (the descriptor cache is deployment-static).

**File: `apps/web/src/stores/dashboard.ts`** — delete `channels` (**19**), `loadChannels()` and its `areChannelsLoaded` latch (**87–110**), and both entries from the returned object (**182**, **192**). Nothing else in that store changes.

### 4 — `CommunicationTimeline.vue`: three sources, one component

**File: `apps/web/src/components/CommunicationTimeline.vue`**

Props (**23–31**) become:

```ts
const props = withDefaults(
  defineProps<{
    /** Ticket-scoped source. With customerId absent, the ticket supplies it. */
    ticketId?: string;
    /** Customer-scoped source when ticketId is absent; the compose target always. */
    customerId?: string;
    readonly?: boolean;
    maxItems?: number;
    /** Rows to render instead of loading any. The inbox owns its own paging. */
    items?: CustomerInteraction[];
  }>(),
  { ticketId: undefined, customerId: undefined, readonly: false, maxItems: undefined, items: undefined },
);
```

`items` is what lets `CommunicationView.vue` reuse the entry rendering without a fourth data source: when it is supplied, `load()` is never called and the toolbar's own filters are hidden (the inbox has its own). Add a dev-only guard in `onMounted` — `import.meta.env.DEV && !props.ticketId && !props.customerId && !props.items` logs a warning naming the component — because a silently empty timeline is the failure mode this component has.

`load()` (**46–75**) keeps the `latestRequestId` guard **exactly** as written and only changes which call it awaits:

```ts
    const result = props.ticketId
      ? await listTicketInteractions(props.ticketId, { ...filterParams(), includeCustomerHistory: includeCustomerHistory.value })
      : props.customerId
        ? await listInteractions(props.customerId, filterParams())
        : (await listCommunicationTimeline({ ...filterParams(), pageSize: props.maxItems ?? 20 })).items;
```

`includeCustomerHistory` (**40**) and its toolbar toggle (**188–191**) are **ticket-only** — hide the checkbox when `ticketId` is absent, because the concept does not exist for the other two sources. The watch at **77–78** gains `() => props.customerId` and `() => props.items`.

`filterParams()` adds `deliveryStatus` to the existing channel/direction pair, and the toolbar (**193–210**) gains a third `<select>` over `INTERACTION_DELIVERY_STATUSES` in the same shape as the two beside it.

**The composer** (**95–156**) is where most of the new work lands:

```ts
const selectedDescriptor = computed(() =>
  composerForm.channel ? communication.channelDescriptor(composerForm.channel) : undefined,
);

const needsAddress = computed(() => selectedDescriptor.value?.requiresAddress ?? false);
const showSubject = computed(() => selectedDescriptor.value?.supportsSubject ?? true);
const bodyLimit = computed(() => selectedDescriptor.value?.maxBodyLength ?? 8000);
const canSendThroughChannel = computed(() => auth.can('communication:send') && !!props.customerId);

const addressMissing = computed(() => needsAddress.value && composerForm.address.trim().length === 0);
```

- `composerForm` gains `address: ''`. A `watch` on `composerForm.channel` pre-fills it from the customer for `addressKind: 'email'` / `'phone'` (Product rule 12) — the component needs the customer's email and phone, so accept them as an optional `customerContact?: { email: string | null; phone: string | null }` prop that `CustomerDetailView.vue` and `AgentWorkspaceView.vue` pass and the inbox fills from `conversation.customer`. When it is absent, the field starts empty and the user types it.
- The address `<label>` renders only when `needsAddress`, with `dir="ltr"` on the input (Product rule 14) and an `AppStateBlock variant="warning"` beneath it when `addressMissing`.
- The subject `<label>` (**233–236**) renders only when `showSubject`.
- The body `<textarea>` (**238–241**) gains `:maxlength="bodyLimit"` and a character counter reading `{{ n(composerForm.body.length) }} / {{ n(bodyLimit) }}` through the i18n `n()` helper (already destructured in views that use it — add it to this component's `useI18n()` call).
- Submit is disabled while `addressMissing` or `isSubmitting`.
- `submitComposer()` (**124–156**) keeps the `toLocalDatetimeInput` → `toISOString()` round-trip at **136** and its comment **133–135** verbatim, then branches:

```ts
    // The payload the two fallback routes take: exactly what Story 21 sent.
    const logged = {
      channel: composerForm.channel,
      direction: 'OUTBOUND' as InteractionDirection,
      subject: composerForm.subject,
      body: composerForm.body || undefined,
      occurredAt: occurredAtIso,
    };

    if (canSendThroughChannel.value) {
      await sendMessage({
        customerId: props.customerId!,
        ticketId: props.ticketId,
        channel: composerForm.channel,
        subject: showSubject.value ? composerForm.subject : undefined,
        body: composerForm.body,
        address: needsAddress.value ? composerForm.address.trim() : undefined,
        occurredAt: occurredAtIso,
      });
    } else if (props.ticketId) {
      // Product rule 4: a caller who can log but not send keeps the Story 21
      // behaviour exactly, payload included.
      await createTicketInteraction(props.ticketId, logged);
    } else if (props.customerId) {
      await createInteraction(props.customerId, logged);
    }
```

`CreateTicketInteractionPayload` is `Omit<CreateInteractionPayload, 'ticketId'>` (`api/tickets.ts` **228**), so it still carries `direction` — the same shape the existing `submitComposer` sends at **138–144**. Only the `sendMessage` payload omits it (Story 23 Product rule 3).

**The entry rendering** (**264–294**) gains three things, keeping the existing badge row (**271–280**), subject (**282**), body (**283**), meta line (**285–288**), and delete button (**290–292**):

- a delivery-status `AppBadge` with `:tone="DELIVERY_TONES[interaction.deliveryStatus]"` and label `t('interaction.delivery.' + interaction.deliveryStatus)`;
- the channel badge's icon becomes `CHANNEL_ICONS[interaction.channel]` instead of the fixed `'communication'` at **273**;
- a `channelAddress` line with `dir="ltr"`, and a `failureReason` line in the error tone when present.

When `props.items` is absent **and** `ticketId` is absent (the customer-scoped case), also render the customer name as a `RouterLink` to `/customers/:id` on each entry — the customer-scoped list is the one place an entry's customer is *not* implied by context. `isOtherTicket()` (**180–182**) is unchanged.

### 5 — `Create file: apps/web/src/views/CommunicationView.vue`

Two panes, following `AgentWorkspaceView.vue`'s layout and `TasksView.vue`'s filter bar.

- **Header:** `t('communication.inbox.title')`, a Refresh `AppButton` with `icon="communication"` (an existing entry — task 7's four new icons are for channels, and the header needs no fifth), and the timeline's `meta.total` rendered through `n()`.
- **Filter bar:** a debounced search input (copy the debounce from `TicketsView.vue`), a channel `<select>` over `INTERACTION_CHANNELS`, a direction `<select>`, a delivery-status `<select>` over `INTERACTION_DELIVERY_STATUSES`, and a "my customers" checkbox bound to `filters.mine`.
- **Left pane — conversations:** `AppStateBlock` for loading / error / empty, then a list of `AppCard`s, each showing the channel icon and label, the customer name, `messageCount` through `n()`, `d(new Date(lastOccurredAt), 'long')`, and the `lastMessage.subject` clipped by CSS. A `threadKey: null` group is labelled `t('communication.earlierHistory')` (Product rule 11). The selected card carries an `aria-current="true"` and a token-driven highlight. Then `AppPagination` bound to `conversationsMeta`.
- **Right pane — thread:** when nothing is selected, an `AppStateBlock variant="empty"` with `t('communication.inbox.selectPrompt')`. When something is, the customer name as a `RouterLink` to `/customers/:id`, then `<CommunicationTimeline :customer-id="selected.customerId" :items="communication.interactions" :customer-contact="..." />`, then `AppPagination` bound to `timelineMeta`.
- **Selection ↔ URL** (Product rule 9): read `route.query.customerId` / `channel` / `thread` in `onMounted` to restore a selection, and `router.replace` on every selection change. Use `replace`, not `push`, so clicking through five conversations does not fill the back stack.
- `onMounted` calls `communication.loadChannels()`, `loadConversations()`, and — only when a selection was restored — `loadTimeline()`.

**File: `apps/web/src/router/index.ts`** — add, after the `/customers` route (**41–45**):

```ts
  {
    path: '/communication',
    name: 'communication',
    component: () => import('@/views/CommunicationView.vue'),
    meta: { titleKey: 'nav.communication', permissions: ['customers:read'] },
  },
```

**File: `apps/web/src/layouts/AppLayout.vue`** — add to the Work group's items (**38–42**), after `/tasks`:

```ts
        { to: '/communication', icon: 'communication', labelKey: 'nav.communication', visible: auth.can('customers:read') },
```

The Work group, not Records: an inbox is something an agent works, not a record they look up.

### 6 — `CustomerDetailView.vue`: delete the hand-rolled list

**File: `apps/web/src/views/CustomerDetailView.vue`**

- Delete the interactions script block **147–181** in full: `interactionForm` (**149–155**), `submitInteraction` (**157–175**), `removeInteraction` (**177–181**).
- Replace the template panel body **340–401** (the form, the empty paragraph, and the list) with:

```vue
        <CommunicationTimeline
          :customer-id="customerId"
          :customer-contact="{ email: customers.customer?.email ?? null, phone: customers.customer?.phone ?? null }"
        />
```

Keep the `<div v-else class="customer-detail__panel">` wrapper (**339**) and the `customer.detail.ticketingNote` paragraph (**403–405**) — the note is still true and still belongs there.

- Delete the `customer-detail__interaction*` style rules (**461–495**).
- Prune the now-unused imports at **7–21**: `INTERACTION_CHANNELS`, `CustomerInteraction`, `InteractionChannel`, `InteractionDirection`, and `toLocalDatetimeInput` if nothing else in the file uses it (check the notes and attachments blocks first — grep before deleting). Add the `CommunicationTimeline` import.

**File: `apps/web/src/stores/customers.ts`** — remove the interaction slice: `interactions` (**41**), its load in the `Promise.all` (**111–125**), the two reload calls (**304**, **318**), the reset (**333**), the return entry (**343**), and the `addInteraction` / `removeInteraction` actions the view was calling. The timeline component fetches its own data, so keeping a second copy in the store is exactly the two-owners bug Product rule 8 removes elsewhere. Check `apps/web/src/stores/customers.spec.ts` for every test touching those and delete or retarget them.

**File: `apps/web/src/views/AgentWorkspaceView.vue`** and `apps/web/src/views/TicketDetailView.vue`** — wherever `CommunicationTimeline` is mounted, add the `customer-contact` prop. Grep for `CommunicationTimeline` across `apps/web/src` and fix every call site; the props are all optional, so a missed one compiles and silently loses the address pre-fill.

### 7 — Icons

**File: `apps/web/src/components/icons.ts`**

Add four entries to `ICON_PATHS` (**4–34**), matching the existing 24×24 stroke-only, single-`<path>` style:

```ts
  mail: 'M3 6h18v12H3zM3 6l9 7 9-7',
  'message-circle': 'M21 11.5a8.5 8.5 0 0 1-12.2 7.7L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5z',
  smartphone: 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM10 18h4',
  clipboard: 'M9 4h6v3H9zM7 6h2M15 6h2a1 1 0 0 1 1 1v13H6V7a1 1 0 0 1 1-1M9 12h6M9 16h4',
  phone: 'M6 3h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 5 4a1 1 0 0 1 1-1z',
```

None is directional, so none needs the `chevron-start`/`chevron-end` treatment (`icons.ts` **1–3**, **28–29**).

### 8 — i18n

**Files: `apps/web/src/i18n/locales/en.json` and `apps/web/src/i18n/locales/ar.json`** — both, in the same commit.

Add to `interaction`:

```json
  "delivery": {
    "LOGGED": "Logged",
    "RECEIVED": "Received",
    "QUEUED": "Queued",
    "SENT": "Sent",
    "FAILED": "Failed"
  }
```

Arabic: `"مُسجَّل"`, `"وارد"`, `"في الانتظار"`, `"مُرسل"`, `"فشل"`.

Add to `communication`, beside the nine existing keys and `systemAuthor`: `filterDeliveryStatus`, `address`, `addressRequired`, `addressLtrHint` (only if the UI actually shows one — do not add an unused key, `i18n.spec.ts` **44–49** will not catch it but a reviewer will), `bodyCounter`, `earlierHistory`, `failureReason`, `messageCount`, and an `inbox` sub-block with `title`, `selectPrompt`, `conversations`, `thread`, `refresh`, `mine`, `empty`.

Add `nav.communication` ("Communication" / "التواصل") and `route.title.communication`.

**File: `apps/web/src/i18n/i18n.spec.ts`** — add one test in the shape of the block at **86–98**:

```ts
  it('has an interaction.delivery key for every InteractionDeliveryStatus member', () => {
    for (const status of INTERACTION_DELIVERY_STATUSES) {
      expect(enFlat.has(`interaction.delivery.${status}`)).toBe(true);
      expect(arFlat.has(`interaction.delivery.${status}`)).toBe(true);
    }
  });
```

importing the constant from `@/api/customers` alongside the existing imports at **5**.

---

## Edge Cases & Failure Modes

- **`CommunicationTimeline` mounted with no `ticketId`, no `customerId`, and no `items`.** It would render an unfiltered global feed capped at 20. The dev-only warning in task 4's `onMounted` names it; the alternative (throwing) would take down a screen over a prop mistake.
- **`ticketId` present, `customerId` absent.** Legal (Product rule 3) and it is how `AgentWorkspaceView.vue` may already mount it. `canSendThroughChannel` is false without a `customerId`, so the composer falls back to the ticket log route — which is correct, and means the dispatch path is only used where a customer id is actually known. Verify this at every existing call site (task 6's grep) and pass `customerId` wherever it is available.
- **Deleting an interaction from the inbox.** `remove()` (**165–178**) calls `deleteInteraction(interaction.customerId, ...)` — which works from all three sources, because every interaction now carries its `customerId` (it always did, `CustomerInteraction.customerId`). The comment at **171–172** stays accurate.
- **An interaction with `createdBy: null` and the delete button.** Story 23 already made `canDelete` fall through to the `customers:archive` branch. Confirm the button is hidden for a plain `support-agent` looking at an ingested message — and that this matches the server, which would 403.
- **A conversation selected, then filtered out.** Selecting a `WHATSAPP` thread and then setting the channel filter to `EMAIL` leaves `selected` pointing at a conversation no longer in the list. Keep the selection and keep the thread pane populated; do not silently clear it. Clearing would look like data loss on a filter change.
- **A `threadKey: null` conversation.** Labelled "Earlier history" (Product rule 11). Selecting it filters the thread pane by `customerId` + `channel` only, so it shows the same rows as any other thread on that channel — a known imprecision of the query-parameter approach, noted in the store comment from task 3.
- **A customer with two threads on one channel.** Both appear as separate conversations in the left pane, but selecting either shows the union in the right pane, because the API has no `threadKey` filter. Documented, not worked around: adding one is a Story 23 change and this story does not touch the backend (Product rule 1).
- **`listChannels()` fails.** The moved fail-open fallback keeps the composer usable with permissive capabilities, so the channel picker still lists everything and a genuinely invalid send fails visibly at the API. This is the behaviour Story 21's comment (`stores/dashboard.ts` **98–102**) argued for; do not tighten it while moving it.
- **`maxBodyLength: null`.** `bodyLimit` falls back to `8000`, the DTO's global cap, so the counter always has a denominator.
- **A pasted body longer than `maxlength`.** Browsers truncate a paste to `maxlength`, silently. The counter showing `1600 / 1600` is the only signal; that is the same behaviour every other length-capped input in this app has, and the API's own check is still there.
- **An Arabic UI and an email address.** `dir="ltr"` on the address span and input (Product rule 14) keeps `nour@crm.local` from rendering with its parts reordered.
- **Numbers in the Arabic UI.** `messageCount`, the body counter, and the pagination all go through `n()`, which Story 20 configured with `numberingSystem: 'latn'`. Do not interpolate a raw number into a translated string.
- **An API error message in an Arabic UI.** `toErrorMessage` surfaces the server's English text — work item 5's recorded limitation, unchanged. Product rule 12's client-side address check exists precisely to avoid the most likely one.
- **`?customerId=` in the URL for a customer the caller cannot see.** `loadTimeline()` returns an empty page (the API filters, it does not 403 on a filter value), so the thread pane shows the empty state. No leak, no crash.
- **Two panes on a narrow viewport.** The conversation list stacks above the thread. Use the same container-query-free flex/grid wrapping `AgentWorkspaceView.vue` uses; do not add a breakpoint token.
- **`stores/customers.ts` pruning.** Removing the interaction slice touches five sites plus its spec. Missing the reset at **333** leaves stale interactions in a store nothing reads any more — harmless but confusing. Missing the `Promise.all` entry at **111–125** is a runtime error. Grep for `interactions` across `apps/web/src/stores/` and `apps/web/src/views/` after the edit.

---

## Test Plan

1. **`apps/web/src/api/communication.spec.ts`** (new). Mock `apiClient` as `apps/web/src/api/customers.spec.ts` does. `sendMessage` POSTs to `/communication/messages` with the payload verbatim; `listCommunicationTimeline` GETs `/communication/timeline` with the params object; `listConversations` GETs `/communication/conversations`; `listChannels` still unwraps `{ items }`.
2. **`apps/web/src/stores/communication.spec.ts`** (new). `loadChannels` caches after one call (the latch) and falls back to permissive descriptors on rejection; `loadConversations` and `loadTimeline` each clear their list and set their own error on failure without touching the other's; a stale response is discarded (fire two loads, resolve them out of order, assert the second wins); `setChannel` resets `page` to 1 and `setPage` does not; `params()` maps `''` to `undefined`; `select()` sets the selection and resets the page.
3. **`apps/web/src/stores/dashboard.spec.ts`** (modify). Remove every `channels` / `loadChannels` test. The remaining dashboard and queue tests must pass **unchanged** — that is the check that task 3's deletion was surgical.
4. **`apps/web/src/components/CommunicationTimeline.spec.ts`** (modify, and the largest test change in the story). Extend `makeInteraction()` (**42–56**) with the six new fields. Then, keeping every existing test passing:
   - source selection: with `ticketId` it calls `listTicketInteractions`; with only `customerId` it calls `listInteractions`; with neither it calls `listCommunicationTimeline`; with `items` it calls none of the three;
   - the `includeCustomerHistory` toggle renders only for the ticket source;
   - a delivery-status badge renders per entry, `FAILED` in the error tone with its `failureReason` visible;
   - the channel icon comes from `CHANNEL_ICONS`;
   - composer, with a stubbed descriptor list: the address field renders for `EMAIL` and not for `PHONE`; it pre-fills from `customerContact`; Send is disabled while a required address is empty; the subject field is hidden for a `supportsSubject: false` channel; the textarea's `maxlength` equals the channel's `maxBodyLength`;
   - submit routing: a caller with `communication:send` and a `customerId` calls `sendMessage`; without the permission it calls `createTicketInteraction` (ticket source) or `createInteraction` (customer source); the payload never contains a `direction` on the `sendMessage` path;
   - the `createdBy: null` fallback from Story 23 still renders.
5. **`apps/web/src/views/CommunicationView.spec.ts`** (new). Mount with a mocked store. Loading, error, and empty states for each pane; a conversation card renders the channel label, customer name, count, and last subject; a `threadKey: null` card shows the "Earlier history" label; clicking a card calls `select()` and `router.replace` with the three query parameters; a query parameter present on mount restores the selection and triggers `loadTimeline`; the search input debounces; both `AppPagination`s emit into the right setter; the Refresh button reloads both panes.
6. **`apps/web/src/views/CustomerDetailView.spec.ts`** (modify). Delete every test for the removed form and list. Add one asserting the interactions tab renders `CommunicationTimeline` with `customerId` and `customerContact`. Every note, attachment, status, and tab test must pass **unchanged**.
7. **`apps/web/src/stores/customers.spec.ts`** (modify). Remove the interaction tests and the `addInteraction`/`removeInteraction` tests. Assert the parallel load in `load()` now performs three reads, not four.
8. **`apps/web/src/router/index.spec.ts`** (modify). `/communication` resolves, carries `permissions: ['customers:read']` and `titleKey: 'nav.communication'`, and redirects to the forbidden view for a caller without the permission — following whatever assertion shape the existing route tests use.
9. **`apps/web/src/layouts/AppLayout.spec.ts`** (modify). The Communication nav item renders for a caller with `customers:read`, is absent without it, and sits in the Work group.
10. **`apps/web/src/i18n/i18n.spec.ts`** (modify). The new `interaction.delivery.*` test from task 8. The existing key-parity (**34–42**) and no-empty-value (**44–49**) tests cover the rest and must pass without modification — if they fail, a key was added to one catalogue only.

---

## Verification Steps

1. **Frontend builds:** from `apps/web`, `npm run typecheck`, then `npm run lint`, then `npm run build`. All clean. `npm run lint` runs with `--max-warnings 0`, so an unused import from task 6's pruning fails it.
2. **Frontend tests:** from `apps/web`, `npm test`. All pass.
3. **Backend untouched:** `git status` shows no modified file under `apps/api/`. From `apps/api`, `npm test` and `npm run test:e2e` still pass — they should not have been able to break, and confirming it costs one command.
4. **Run it:** `npm run dev:api` and `npm run dev:web`. Sign in as the seeded administrator.
5. **The inbox:** open `/communication`. Conversations list on the left, empty-selection prompt on the right. Select one — the thread renders newest first with a channel icon, a direction badge, and a delivery-status badge per entry. Confirm the URL now carries `?customerId=…&channel=…`, then reload the page and confirm the same conversation is still selected.
6. **Filters and paging:** set the channel filter to Email — the conversation list narrows and page resets to 1. Type in the search box — one request fires after the debounce, not one per keystroke (check the network panel). Page through both panes independently and confirm neither resets the other.
7. **Dispatch through the UI:** open a ticket workspace for a customer who has an email. Open the composer, pick Email — the address field appears pre-filled and left-to-right, the subject field is present, the counter shows a limit. Send. The entry appears with `Logged` as its status and the standing no-provider notice is still visible above the composer. Pick SMS — the subject field disappears and the counter's limit becomes 1600.
8. **The address guard:** pick a customer with **no** email, choose Email — Send is disabled with the inline "address required" message, and no request is made.
9. **The customer profile:** open a customer's Interactions tab. It renders the shared timeline, with filters, the delivery badge, and a working composer. The "ticketing note" paragraph is still there. There is no second, hand-rolled list.
10. **An ingested message:** using the Story 23 verification step 6 `curl`, ingest an inbound email for that customer, then reload the profile. The entry shows `Received`, "Received automatically" instead of an agent name, and no Delete button for a non-archive role.
11. **Arabic and RTL:** switch to Arabic with the locale switcher. Both panes mirror, the channel and delivery labels are translated, counts and page numbers stay in Western digits, and every email address and phone number still reads left-to-right. Narrow the window to a phone width — the panes stack and nothing overflows horizontally.
12. **Permissions:** sign in as a `reporting-user` (holds `customers:read` and `dashboard:read`). The Communication nav item is present, the inbox loads, and **no composer appears** on any timeline. Sign in as a `support-agent` — the composer appears and sends through the dispatch route.

---

## Done Criteria

- [ ] `apps/web/src/api/communication.ts` exposes `sendMessage`, `listCommunicationTimeline`, `listConversations`, and the nine-field `ChannelDescriptor`; `apps/web/src/api/customers.ts` mirrors every field Story 22 added, including `InteractionDeliveryStatus` and `INTERACTION_DELIVERY_STATUSES`.
- [ ] `useCommunicationStore` owns the channel descriptors, the conversation list, and the timeline, with **two** independent request-id guards; `dashboard.channels` and `dashboard.loadChannels` are deleted and every other dashboard-store test passes unchanged.
- [ ] `CommunicationTimeline.vue` takes `ticketId?`, `customerId?`, `items?`, and `customerContact?`, selects among three data sources, keeps its `latestRequestId` guard and the `datetime-local` → ISO comment verbatim, and warns in dev when given no source.
- [ ] Every entry shows a channel icon from `CHANNEL_ICONS`, a direction badge, and a delivery-status badge; `FAILED` renders in the error tone with its `failureReason`; `channelAddress` renders with `dir="ltr"`.
- [ ] The composer's address field, subject field, and body limit all derive from the selected channel's descriptor; Send is disabled while a required address is empty; submit routes to `sendMessage` for a `communication:send` holder with a known customer and to the existing log routes otherwise; the no-provider notice is unchanged and non-dismissible.
- [ ] `/communication` exists with `meta.permissions: ['customers:read']`, a nav entry in the Work group, two panes, both paginated, and the selection round-trips through `?customerId=&channel=&thread=` with `router.replace`.
- [ ] A `threadKey: null` conversation is labelled with a translated "Earlier history" rather than hidden.
- [ ] `CustomerDetailView.vue`'s bespoke interaction form, list, script block, and CSS are deleted and replaced by `CommunicationTimeline`; the interaction slice is gone from `useCustomersStore`; the ticketing note survives.
- [ ] Four icons added to `ICON_PATHS`; no directional icon among them.
- [ ] `interaction.delivery.*`, `nav.communication`, `route.title.communication`, and the `communication.inbox.*` keys exist in **both** catalogues; `i18n.spec.ts` has a new per-status test and its parity and no-empty-value tests pass unmodified.
- [ ] Nothing polls: no `setInterval`, no `setTimeout`-driven refresh, no websocket. (`grep -rn "setInterval\|WebSocket\|EventSource" apps/web/src` returns nothing new.)
- [ ] `apps/web/package.json` is **unchanged** — no new dependency. No file under `apps/api/` is modified.
- [ ] From `apps/web`: `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` all pass. From `apps/api`: `npm test` and `npm run test:e2e` still pass.
- [ ] Manual verification steps 5–12 all confirmed, including the Arabic/RTL pass and both permission scenarios.
