# agent-dashboard-and-collaboration-and-enhancement-ui — plan overview

Entry point for the **agent-dashboard-and-collaboration-and-enhancement-ui** feature. Stories execute in order by their `NN` prefix.

Azure DevOps work item **5 — "Agent Dashboard & Collaboration"** is split into five sequential stories. Work items 1–4 each split into four; this one needs a fifth because its intake carries three distinct requirement blocks — **Agent Dashboard & Workspace**, **Communication**, and a repo-wide **UI/UX** overhaul including English/Arabic localisation and RTL/LTR — and the UI/UX block is a foundation the workspace screens have to be built on top of, not alongside. All five share tracker id 5; each ends with a stop-and-report gate.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 17 | [17-story-agent-workspace-data-model-5.md](17-story-agent-workspace-data-model-5.md) | Agent workspace & communication data model | 5 | 16 |
| 18 | [18-story-agent-dashboard-api-5.md](18-story-agent-dashboard-api-5.md) | Agent dashboard API, workable-ticket scope, permissioned reassignment | 5 | 17 |
| 19 | [19-story-tasks-quick-replies-communication-api-5.md](19-story-tasks-quick-replies-communication-api-5.md) | Agent tasks, quick replies, and the unified communication timeline API | 5 | 18 |
| 20 | [20-story-frontend-design-system-i18n-rtl-5.md](20-story-frontend-design-system-i18n-rtl-5.md) | Frontend foundation: design system, shared components, i18n, RTL/LTR | 5 | 19 |
| 21 | [21-story-frontend-agent-dashboard-workspace-5.md](21-story-frontend-agent-dashboard-workspace-5.md) | Frontend: agent dashboard, ticket workspace, communication timeline | 5 | 20 |

## Dependency notes

**Strictly sequential.** Each story ends with a `STOP HERE` gate; do not start the next until the previous one's Done Criteria are met.

- **16 → 17.** This feature is built entirely on top of [work item 4](../ticket-management/00-overview.md). Story 17 extends `customer_interactions` (work item 3) and adds a nullable FK to `tickets` (work item 4); it inherits the `PermissionsGuard`/`@RequirePermissions()`/`@CurrentUser()` stack from [work item 2](../authentication-and-user-management/00-overview.md) and the NestJS + Prisma + Vue 3 shell from [work item 1](../init-porject/00-overview.md).
- **17 → 18, 19, 20, 21.** Story 17 is the **only** story in this feature that creates a migration. Every table and column Stories 18–21 read — `agent_tasks`, `quick_replies`, `customer_interactions.ticket_id`, the `AgentTaskStatus` enum, and the three new `InteractionChannel` values — is created there, and so are the seven new permission keys.
- **18 → 19.** Story 18's `GET /api/dashboard/agent` already reads `prisma.agentTask` for its `tasksDueSoon` list. Story 19 builds the CRUD that populates those rows, so the dashboard's task panel stays empty until Story 19 lands — this ordering is deliberate: the dashboard's degradation path (empty list, no error) is exercised for a whole story before real data exists.
- **19 → 20.** Story 20 is pure frontend infrastructure and calls **no** new endpoint, so it could technically run in parallel with 18–19. It is sequenced after them so the backend contracts are frozen before the frontend commits to translation keys for every enum value.
- **20 → 21.** Story 21 writes no CSS primitive and no shared component of its own. Every screen it builds is assembled from Story 20's tokens, `AppIcon`/`AppButton`/`AppCard`/`AppBadge`/`AppStateBlock`/`AppTabs`/`AppModal`/`AppPagination`/`StatTile`, and both locale catalogues. `StatTile` and `AppModal` exist in Story 20 *specifically* for Story 21 and have no consumer until it lands.

### Shared contracts

Changing any of these requires updating every story that references it, in the same commit.

| Contract | Defined in | Consumed by |
|---|---|---|
| The seven permission keys (`dashboard:read`, `tasks:read`, `tasks:write`, `tasks:manage`, `quick-replies:read`, `quick-replies:write`, `tickets:assign`) | Story 17 tasks 7–8 (`prisma/seed.ts`) | Story 18 (`dashboard:read`, `tickets:assign`); Story 19 (`tasks:*`, `quick-replies:*`); Story 21 (nav visibility, route `meta.permissions`, per-control `auth.can()`) |
| `InteractionChannel` extended to eight values; `CHAT` **is** Live Chat | Story 17 task 1 | Story 19's `CHANNEL_REGISTRY`; Story 20's `interaction.channel.*` translation keys; Story 21's `api/customers.ts` union and `INTERACTION_CHANNELS` constant |
| `AgentTask` field set, `AgentTaskStatus`, and the `[assigneeId, status]` / `[assigneeId, dueAt]` indexes | Story 17 tasks 3, 5 | Story 18's `tasksDueSoon` query; Story 19's full CRUD; Story 21's `AgentTask` interface |
| `QuickReply` keyed `@@unique([key, locale])`, `channel` nullable | Story 17 task 4 | Story 19's list filter (`OR: [{ channel }, { channel: null }]`); Story 21's `en`-fallback picker |
| `OVERDUE_AFTER_HOURS`, `ACTIVE_TICKET_STATUSES`, `PENDING_TICKET_STATUS`, `DASHBOARD_LIST_LIMIT` in `apps/api/src/tickets/ticket-insights.ts` | Story 18 task 1 | Story 18's dashboard queries; Story 21's overdue badges and "showing N of M" footers, via `listLimit` on the response |
| `TicketScope` (`mine` \| `unassigned` \| `workable` \| `all`), default `all` on `/tickets` and `mine` on `/dashboard/agent` | Story 18 tasks 2, 5 | Story 21's `TICKET_SCOPES` constant, the workspace queue (defaults to `workable`), and the dashboard scope switcher |
| `AgentDashboardDto` field set, including `listLimit` and `generatedAt` | Story 18 task 5 | Story 21's `AgentDashboard` interface and every dashboard panel |
| `assertMayAssign` — the claim-and-release rule, enforced in `assign()`, `create()`, **and** `update()` | Story 18 tasks 3–4 | Story 21's `ReassignControl`, which renders Claim/Release instead of a full picker when the caller lacks `tickets:assign` |
| `PATCH /api/tickets/:id/assignment` writes `TicketHistory` with `field: 'assignedAgentId'` — the **same** literal `update()` already writes | Story 18 task 4 | Story 16's existing History tab, which maps that literal to "Assigned agent"; Story 20's `ticket.history.field.*` keys |
| `CHANNEL_REGISTRY` / `CHANNEL_ORDER`, `providerConfigured: false` for every channel | Story 19 task 1 | Story 21's composer channel list and the no-provider notice |
| `CustomerInteraction` gains `ticketId` + a `ticket` ref; `CreateInteractionDto` gains optional `ticketId` | Story 19 tasks 2–3 | Story 21's `CommunicationTimeline` three-case rendering (this ticket / another ticket / no ticket) and `api/customers.ts` type updates |
| `GET|POST /api/tickets/:ticketId/interactions`, `includeCustomerHistory` flag, no body `customerId` | Story 19 task 4 | Story 21's `listTicketInteractions` / `createTicketInteraction` |
| The design tokens, the ten shared components, `utils/format.ts`, and `useLocaleStore` | Story 20 tasks 1, 3, 4 | Story 21's three views and six feature components, exclusively |
| `en.json` / `ar.json` with identical key sets, enforced by `i18n.spec.ts` | Story 20 tasks 2, and Story 21 task 11 | Every component in Stories 20–21 |
| `meta.titleKey` replacing `meta.title` in `RouteMeta` | Story 20 task 6 | Story 21's four new/changed route objects |

### Product decisions

Resolved once, in each story's **Product rules (from story)** table. Summarised here so no later story re-litigates them.

- **"Overdue" is derived, not stored.** One constant table maps `TicketPriority` to an age threshold in hours, measured from `updatedAt`, and only for `OPEN`/`IN_PROGRESS`/`ON_HOLD`. Work item 4's overview already recorded "No SLA tracking, due dates, or escalation rules" as a deliberate exclusion; the intake asks for an *indicator*, and a derived threshold delivers it with no schema surface, no admin UI, and no backfill. **Adding a comment does not clear the overdue flag** — `TicketComment` is a separate table, so it does not bump `Ticket.updatedAt`.
- **"Pending" means `ON_HOLD`.** The only status that reads as pending; inventing a sixth enum value would need a migration.
- **`scope` is a filter, not a security boundary.** `tickets:read` stays flat, exactly as work item 4 decided ("One read key"). The acceptance criterion "agent sees only tickets assigned to or workable by the current user" is satisfied by the *workspace defaulting* to `scope=workable`, not by removing read access from `GET /api/tickets` — which would break Story 16's list view and regress a shipped contract.
- **Tasks are the exception to that.** `GET /api/tasks?scope=all` **does** require `tasks:manage`. A personal to-do list is not shared data, unlike a support queue. The asymmetry with tickets is deliberate.
- **Reassignment is claim-and-release for front-line agents.** Without `tickets:assign`, a caller may set `assignedAgentId` only to their own id, or clear it only on a ticket already assigned to them. Enforced in **three** places — the new `assign()`, plus the existing `create()` and `update()` — because a guard on only the new route leaves `PATCH /api/tickets/:id` as the bypass. This is a knowing **breaking change** to a Story-14 route; the only affected seeded role is `support-agent`.
- **No external communication provider is implemented.** No SMTP client, no WhatsApp/Twilio SDK, no chat socket, no webhook receiver, and **no new npm dependency on the API side at all**. The intake is explicit that provider integrations are out unless already in scope, and nothing in work items 1–4 opens an outbound socket — so the existing abstraction **is** `CustomerInteraction`. "Responding through a channel" writes a row with `direction: OUTBOUND`. The UI carries a standing, non-dismissible notice saying so; shipping a Send button that silently only writes a database row would be the most misleading thing this feature could do.
- **`CHANNEL_REGISTRY` is the seam left for a future provider.** `providerConfigured` is `false` for all eight channels today; a later work item flips it and adds a sender behind it without the frontend changing shape. `canRespond` is a **UI hint**, not server-enforced.
- **`canRespond` is false for `PHONE` and `MEETING`.** A call and a meeting are logged after the fact, not replied to in a text box.
- **An interaction's `ticketId` must belong to the same customer**, enforced in the service with a `400`. The schema cannot express it, so there is no database guard — the same is true for an `AgentTask` linked to both a ticket and a mismatched customer.
- **Interactions still have no edit route.** Create and delete only, exactly as work item 3 decided; `ticketId` is corrected by deleting and re-logging.
- **`remindAt` stores a time and nothing sends anything.** No scheduler, no notification transport, no email. The dashboard surfaces it; that is the whole feature.
- **`completedAt` is stamped on `DONE` and cleared on any move out of `DONE`.** `CANCELLED` never stamps it — cancelling is not completing.
- **Task `dueAt`/`remindAt` may be in the past, with no validation.** Deliberately asymmetric with `CustomerInteraction.occurredAt`, which cannot be more than five minutes in the future: an interaction records something that *happened*, a task records an intention.
- **`vue-i18n` (v9 line) is the one and only new dependency in the whole feature.** No component library, no icon package, no CSS framework, no charting library, no date library, no RTL plugin. Icons are inline SVG in a single typed registry; insight "charts" are CSS bar rows with the count rendered as text.
- **RTL is delivered with CSS logical properties**, not a mirror-image `[dir='rtl']` override block. The only legitimate direction-conditional rules are for things logical properties cannot express (the Arabic font stack, a directional glyph). Directional icons are named `chevron-start`/`chevron-end` and resolved once, so pagination arrows flip while download arrows do not.
- **The locale preference lives in `localStorage`; the access token still does not.** `api/session.ts`'s warning is about secrets. Work item 4's blanket "no new `localStorage`" grep now has exactly one legitimate hit, in `stores/locale.ts`.
- **Locale switching is runtime with no reload** — a reload would drop the in-memory access token and sign the user out.
- **Arabic numerals stay Western (`0–9`)** via `numberingSystem: 'latn'`. Counts and page numbers sit beside Latin-script identifiers throughout; Eastern Arabic numerals there would be internally inconsistent.
- **Enum labels come from translation keys**, never from `charAt(0) + slice(1).toLowerCase()`. That construction produces English word order and cannot produce Arabic at all; the three helpers duplicated across the ticket views are deleted.
- **API error messages are not translated.** `toErrorMessage` surfaces the server's English text even in an Arabic UI. Translating it would need an error-code contract the backend does not have. A recorded limitation, not an oversight.
- **The Story-20 retrofit changes appearance and strings only — never behaviour.** Every debounce, race guard, permission gate, `window.confirm`, and payload asymmetry survives. The existing view specs are the enforcement: they pass with **updated**, never weakened, assertions.
- **`window.confirm` stays** for destructive actions, even though `AppModal` now exists. Work item 4 recorded that decision; `AppModal` exists for the task and quick-reply dialogs.
- **The workspace queue keeps its own state**, in `useDashboardStore`, not in `useTicketsStore.filters`. Sharing them means opening the workspace silently rewrites the tickets page's filters — a real bug, invisible until a user navigates between the two. There are **three** independent request-id race guards in play by Story 21; sharing any two lets one response cancel another's.
- **`/workspace` with no id shows an empty-selection state**, not a redirect to the first ticket. Auto-selecting makes the URL lie about what the agent chose.
- **The dashboard renders from one API call** and shows its `generatedAt`. **Nothing polls** — no websocket or SSE exists on the backend, and staleness is made visible rather than papered over with an interval.
- **Quick replies insert text; they never send.** A canned reply is a drafting aid, and auto-sending on selection is one mis-click from an outbound record the agent did not mean to write.
- **Every degradable read swallows its error into an empty value.** A `reporting-user` holds `dashboard:read` and little else; a `support-agent` lacks `users:read`. If a secondary picker's `403` blanked the screen, the dashboard would be unusable for two of six seeded roles. Only a screen's **primary** read sets `error`.
- **"No permission" and "nothing to show" are visually distinct.** A hidden card and an empty card mean different things to an agent, and the tasks panel is where that distinction is tested explicitly.

### Deliberate scope exclusions

Recorded so later stories do not treat them as oversights.

- **No SLA engine, due-date field on `Ticket`, or escalation timer.** Continues work item 4's exclusion; "overdue" is the derived indicator described above.
- **No outbound message delivery of any kind.** No email send, no SMS send, no WhatsApp send, no live-chat socket, no inbound webhook. `CHANNEL_REGISTRY.providerConfigured` is the declared seam.
- **No reminder delivery.** `remindAt` is stored and displayed; nothing is scheduled, pushed, or emailed.
- **No real-time updates.** No polling, websockets, or SSE. Refresh is on mount, on an explicit action, and after a mutation the screen itself performed.
- **No charting library.** Insight cards are CSS bar rows with counts as text — accessible, RTL-correct for free, and one fewer dependency.
- **No dark mode.** Not requested; the token set is structured so it could be added by redefining `:root` under a media query, but no dark palette is authored.
- **No quick-reply administration screen** beyond activate/deactivate through the API. Full catalogue management with translation workflow is a separate concern.
- **No customer-facing portal.** Every route requires staff permissions, continuing work item 4's exclusion.
- **No pagination on the interaction timeline.** Carried forward from work item 3, where `GET /customers/:id/interactions` was never paginated. The mitigations are the channel/direction filters and the timeline component's own `maxItems` render cap with a "showing N of M" footer — the cap must be implemented, not assumed.
- **No optimistic UI updates.** Last write wins, consistent with work items 3–4.
- **No automated end-to-end browser test and no visual-regression test.** RTL, responsive, and keyboard behaviour are covered by the manual Verification Steps in Stories 20 and 21, consistent with work items 1–4.
- **No CI/CD.** The intake excludes it explicitly.

### Environment prerequisites

- Everything work item 4 required: Node.js **24 LTS**, npm 11+, PostgreSQL running, the seeded administrator's password known, `UPLOAD_DIR` and `MAX_UPLOAD_BYTES` present in `apps/api/.env`.
- **No new environment variables.** Nothing in this feature reads configuration the API does not already validate in `apps/api/src/config/env.validation.ts`.
- **One new npm dependency, frontend only:** `vue-i18n` (`^9.14.0`) in `apps/web/package.json`. The API side adds none — a consequence of the no-external-provider decision, and a checkable one: `apps/api/package.json` must be unchanged across Stories 17–19.
- **One new migration**, in Story 17 only. `npm run prisma:migrate`, then `prisma:generate`, then `prisma:seed`, in that order.
- **One new browser-storage key:** `crm.locale`. Not sensitive, read defensively, absence is a normal state.
- Stories 20 and 21 need both dev servers running, and Story 21's manual verification needs fixture users for the `support-agent`, `support-supervisor`, `reporting-user`, and `crm-manager` roles.
