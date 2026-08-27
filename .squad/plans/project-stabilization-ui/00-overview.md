# project-stabilization-ui — plan overview

Entry point for the **project-stabilization-ui** feature. Stories execute in order by their `NN` prefix.

Azure DevOps work item **13 — "User Story 6.5 — Project Stabilization, Final UI Enhancements & Handover"** is split into **five** sequential stories.

The split is shaped by what the pre-planning review of the existing code actually found, because the intake's central instruction is *"Do not assume that functionality is missing."* The review's conclusion is that **most of this work item is already done**, and the plan says so explicitly rather than re-specifying it:

- **The repository is green.** `npm run typecheck` exits 0; the API has **34 suites / 406 passing tests**; the web app has **50 files / 523 passing tests**. Verified by running all three before planning.
- **The design system exists.** Work item 5's Story 20 shipped `apps/web/src/assets/main.css` with 60+ tokens (spacing, radii, elevation, typography, focus ring, and full status/priority palettes) plus ten shared components: `AppIcon`, `AppButton`, `AppCard`, `AppBadge`, `AppStateBlock`, `AppTabs`, `AppModal`, `AppPagination`, `StatTile`, `LocaleSwitcher`.
- **Arabic, English, LTR and RTL all work.** `vue-i18n` carries **345 keys with exact `en`/`ar` parity**, enforced by a test. Direction switches at runtime with no reload. A repo-wide grep for `margin-left`, `padding-right`, `border-left`, `text-align: left`, or a bare `left:`/`right:` across every `.vue` file returns **zero** hits — the whole stylesheet is already written in logical properties.
- **The sidebar already has grouped, icon-bearing navigation** with `aria-current`, a responsive drawer, a skip link, and a keyboard-dismissible overlay.
- **Backend validation, error handling, and logging are already correct**: a global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`, an `AllExceptionsFilter` emitting a consistent body with a request id, `nestjs-pino` request logging, and a Swagger document covering seventeen tags.

So none of that is rebuilt. What the review found genuinely missing or broken is what the five stories deliver:

| Gap found | Story |
|---|---|
| **No list endpoint accepts a sort parameter.** All four paginated lists hard-code `orderBy`. | 25 |
| **A real pagination bug.** `tickets.service.ts:84` orders by `createdAt desc` alone, so rows sharing a timestamp can be duplicated across pages and others skipped. | 25 |
| **Two missing indexes on default orderings.** `Ticket` orders every page by `createdAt` with no index on it; `User` orders by `fullName` with no index on it. | 25 |
| **Only one seeded user exists.** The `support-agent` and `customer` roles are seeded but no account holds either. | 25 |
| **No page-size selection.** `pageSize` is hard-coded to 20 in all five list stores; the API accepts up to 100. | 26 |
| **Four duplicated table shells.** Near-identical scoped style blocks in four views. | 26 |
| **Two filter bars overflow on mobile.** `CustomersView.vue:184` and `UsersView.vue:432` declare `display: flex` with a gap and no `flex-wrap`. | 26 |
| **Form controls are almost entirely unstyled.** Exactly **two** files in the whole app style an input or select; every other field renders at browser default beside fully tokenised buttons. | 27 |
| **Nine native `window.confirm` dialogs.** | 27 |
| **A real bug in `UsersView`.** Four inline panels bind one `users.error` and none of the three `open…` functions closes the others, so a failed create surfaces inside a different user's edit form and two panels can be open at once. | 27 |
| **48 bare `<button>` elements** across ten files. | 27 |
| **No login test-user mechanism.** | 28 |
| **The README is 41 lines** and documents no architecture, database, environment, or scope; `docs/` holds one ADR. | 29 |

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 25 | [25-story-backend-list-sorting-indexes-dev-seed-13.md](25-story-backend-list-sorting-indexes-dev-seed-13.md) | Backend stabilization: deterministic list sorting, index review, and dev test-user seeding | 13 | 24 |
| 26 | [26-story-frontend-table-shell-sorting-page-size-13.md](26-story-frontend-table-shell-sorting-page-size-13.md) | Frontend: one table shell, sortable columns, and page-size selection | 13 | 25 |
| 27 | [27-story-frontend-dialogs-forms-consistency-13.md](27-story-frontend-dialogs-forms-consistency-13.md) | Frontend: confirmation dialogs, form-control consistency, and the accessibility sweep | 13 | 26 |
| 28 | [28-story-login-test-user-picker-13.md](28-story-login-test-user-picker-13.md) | The login test-user picker, development builds only | 13 | 25, 27 |
| 29 | [29-story-documentation-handover-verification-13.md](29-story-documentation-handover-verification-13.md) | Documentation, repository handover, and full-flow verification | 13 | 25, 26, 27, 28 |

## Dependency notes

**Strictly sequential.** Each of Stories 25–28 ends with a `STOP HERE` gate; do not start the next until the previous one's Done Criteria are met.

- **24 → 25.** This work item is a stabilization pass over everything work items 01–06 shipped, so it begins only once [work item 6](../communication-channels/00-overview.md) is complete.
- **25 → 26.** This is the **hard** dependency in the feature, and getting it backwards breaks the app. `apps/api/src/main.ts:30` sets `forbidNonWhitelisted: true`, so a frontend that sends `sort` against the pre-Story-25 API receives a **400 on every list request** — not a silently ignored parameter. Story 25 must be merged and running before Story 26 sends its first sorted request.
- **26 → 27.** Story 26 builds the table and filter-bar shells; Story 27 styles the controls that sit inside them and converts the buttons in their cells. Reversed, Story 27 would style controls into a layout Story 26 then replaces.
- **25 + 27 → 28.** Story 28 needs Story 25's three seeded persona accounts (a picker that fills credentials which do not authenticate is worse than no picker) and finishes the one error-block conversion Story 27 deliberately left behind in `LoginView.vue`.
- **All → 29.** Story 29 documents the system as it finally stands and runs the full verification matrix, so nothing it describes may still be in flight.
- **Story 25 owns the only migration in this work item.** Stories 26–29 must not create one.
- **Stories 26, 27, and 28 must not touch `apps/api/`; Story 25 must not touch `apps/web/`.** Both are checkable with `git diff --name-only`, and both are listed in the relevant Done Criteria.

### Shared contracts

Changing any of these requires updating every story that references it, in the same commit.

| Contract | Defined in | Consumed by |
|---|---|---|
| `SortOrder` (`asc` \| `desc`) in `common/dto/pagination.dto.ts` | Story 25 task 1 | Story 25's four query DTOs; mirrored as a literal union in Story 26's four API param interfaces |
| `CustomerSortField`, `TicketSortField`, `UserSortField`, `AgentTaskSortField` | Story 25 task 2 | Story 26's per-view column lists — the `field` prop on every `AppSortHeader` must be a member, or the request 400s |
| The four private static `SORT_COLUMNS` maps and their `SORT_FALLBACK` arrays | Story 25 task 3 | Nothing outside their own service. Deliberately private: the whitelist is not a shared surface |
| `{ id: 'asc' }` as the trailing tie-breaker on every list ordering | Story 25 Product rule 4 | The updated `orderBy` expectations in all four service specs |
| `PaginationMetaDto` — **unchanged**, no new field | Story 25 Product rule 6 | Story 26 reads `meta.pageSize` to drive the page-size select; that field already exists |
| The three dev persona emails: `dev.admin@crm.local`, `dev.agent@crm.local`, `dev.customer@crm.local` | Story 25 task 5 (`prisma/seed.ts`) | Story 28's `config/devTestUsers.ts`, duplicated on purpose with a comment in each file naming the other |
| `SEED_DEV_USERS`, `SEED_DEV_USER_PASSWORD` — seed-only, absent from `EnvironmentVariables` | Story 25 task 6 | Story 28's manual setup; Story 29's environment table |
| `VITE_DEV_TEST_USER_PASSWORD` — must equal `SEED_DEV_USER_PASSWORD` | Story 28 task 2 | Story 28's picker; Story 29's README warning about the fifteen-minute lockout |
| `.data-table-wrap`, `.data-table`, `.data-table__actions`, `.filter-bar` in `main.css` | Story 26 task 1 | All four list views; Story 27's converted `UsersView` row actions |
| `PAGE_SIZE_OPTIONS` (max 100, matching `MAX_PAGE_SIZE`) and the `pageSizeChange` emit on `AppPagination` | Story 26 task 3 | The four list views. The `/workspace` and `/communication` call sites keep the two-button form and are not edited |
| `AppSortHeader.vue` — `field`/`label`/`activeField`/`activeOrder` props, `sort` emit, `aria-sort` on the `<th>` | Story 26 task 2 | All four list tables |
| `setSort(field)` and `setPageSize(size)` on all four list stores, both resetting `page` to 1 | Story 26 task 5 | The four list views |
| `.form-error`, `.form-actions`, and the global form-control rules in `main.css` | Story 27 task 1 | Every form in the app; Story 28's login card |
| `AppConfirmDialog.vue` — `open`/`messageKey`/`messageParams`/`confirmLabelKey`/`busy`, `confirm` and `update:open` emits | Story 27 task 2 | Nine destructive call sites across six files |
| `en.json` / `ar.json` with identical key sets, enforced by `i18n/i18n.spec.ts` | Story 26 task 4, Story 27 task 3, Story 28 task 4 | Every component in Stories 26–28 |

## Product decisions

Resolved once, in each story's **Product rules (from story)** table. Summarised here so no later story re-litigates them.

- **The review's finding is the plan's foundation: this work item is mostly already satisfied.** The five stories close thirteen specific, verified gaps and explicitly leave the design system, the i18n/RTL layer, the sidebar, the guards, the validation pipeline, the error filter, the logging, and every existing table, relation, and constraint alone. The plan states what was checked and found correct, so "reviewed" is a record rather than a claim.
- **Sorting is opt-in and additive.** No `sort` parameter reproduces today's ordering exactly, so the API stays compatible with the frontend across the Story 25 → 26 boundary. The existing service specs are the enforcement.
- **Sortable columns are closed enums, not strings.** A free-form column name reaching `prisma.orderBy` would let a caller order by `passwordHash`. The whitelist is the type.
- **No generic sort helper.** Four private static maps, each typed against its own `Prisma.XOrderByWithRelationInput`. A generic version needs a cast, and a cast in the code that builds a database query is where a whitelist stops being one.
- **Every ordering ends in `{ id: 'asc' }`.** This is a behaviour fix, not a refactor: without it, `skip`/`take` over a non-unique order can return one row twice and never return another.
- **Nullable sort columns pin NULLs last in both directions.** Otherwise "newest due date first" opens with every task that has no due date.
- **Only indexes were added, and only where an ordering justifies one.** `Ticket.subject`, `AgentTask.title`, `Customer.city` are sortable without a new index; the omission is recorded rather than papered over by indexing everything.
- **One global `.data-table` class, not a generic table component.** The four tables share a shell; their cells contain `RouterLink`s, `AppBadge`s, and multi-button action groups that genuinely differ. A component would have rewritten four templates at once and put 38 passing view tests at risk inside a styling story.
- **One sort column at a time, and no third click that clears it.** The API accepts one `sort` value, so multi-column sorting would be a promise the backend cannot keep; a tri-state header is the control users misclick most.
- **Only API-sortable columns get a sortable header.** Relations, `_count` aggregates, and action columns stay plain `<th>`. A header that looks clickable and 400s is worse than one that looks static.
- **Sort and filter state is not persisted and not in the URL.** `crm.locale` remains the only browser-storage key the app writes — carried forward from work items 5 and 6. The consequence, that a sorted list is not shareable by link, is recorded as a known limitation rather than left to be discovered.
- **Form controls are styled by element selector, globally.** This is the one place the repo's scoped-styles convention is deliberately broken, because exactly two of roughly a dozen files style a control today and a class-based fix stays broken for the thirteenth file somebody adds.
- **`window.confirm` is replaced everywhere in one story, reversing Story 20's Product rule 16.** Work item 13 asks for improved confirmation dialogs; two mechanisms would be worse than one poor one, because a user who learns that Delete opens a dialog stops reading the native one.
- **Cancel comes before Confirm in the dialog's DOM.** `AppModal` focuses the first focusable element, so an accidental Enter cancels rather than deletes. It is the one design decision in a confirm dialog that actually prevents data loss.
- **`AppModal` is consumed, not modified.** It already traps focus, closes on `Escape`, and restores focus, and its seven tests must pass untouched.
- **No client-side field validation is added.** The API keeps `whitelist` + `forbidNonWhitelisted` and remains the authority; duplicating those rules in the browser creates two sources of truth that drift. Existing native `required` and `type="email"` attributes stay.
- **The test-user picker is gated on `import.meta.env.DEV` alone.** No runtime flag exists, so the feature is *excluded from* a production build by dead-code elimination rather than *disabled in* one — a property provable by grepping `apps/web/dist/`. That is the stronger of the two words the acceptance criteria offer.
- **No password literal in `apps/web/src`.** The emails are configuration; the password comes from a `VITE_` variable, and the picker still fills the email when it is unset.
- **Selecting a persona fills two refs and stops.** It never calls `auth.login`, never submits, and never navigates. The existing `LoginView` test asserting the password never appears in the rendered markup must keep passing unmodified.
- **Dev-user seeding refuses to run with `NODE_ENV=production`** and refuses to run without an explicitly set password. A flag alone is one pipeline typo away from three known-password accounts in production; a default password is a published credential.
- **Dev users get `mustChangePassword: false`,** because the banner it would otherwise raise has no screen to resolve it — Story 07 deferred the endpoint.
- **The seed never overwrites an existing password,** dev accounts included, matching the decision `seedBootstrapAdmin` already made and documented.
- **US07–US12 are documented but not designed.** Writing a design for unbuilt scope makes it look decided; the next person to pick up US07 should find a title they can plan against, not somebody else's plan made without the requirements.
- **The handover documentation is honest about limitations.** No channel sends anything, there is no rate limiting on the public inbound route, there is no self-service password change, Arabic search does not normalise alef variants, and there is no CI/CD. A handover that hides these transfers surprises instead of a system.
- **The verification pass is recorded as a filled-in matrix, not asserted.** "End-to-end core flows are verified" is only checkable if the record says which flows, in which language, at which width, as which role — and marks what could not be exercised, with the reason.

## Deliberate scope exclusions

Recorded so later work does not treat them as oversights.

- **No CI/CD**, no pipeline file, no container image, no deployment automation. Excluded by the intake and by the acceptance criteria.
- **No implementation, stub, route, column, translation key, or feature flag for US07–US12.** A stub is implementation: it has to be reviewed, tested, and eventually deleted or finished.
- **No new npm dependency on either side.** `apps/api/package.json` and `apps/web/package.json` are unchanged across all five stories — a checkable claim, and the reason the confirm dialog wraps the existing `AppModal` and the sort icons are two more paths in the existing registry.
- **No new endpoint, permission key, column, enum value, relation, or constraint.** Story 25's migration contains only `CREATE INDEX`.
- **No architectural change.** No new module, no repository layer, no service extraction, no state-management change. The intake asks for maintainability "without introducing unnecessary architectural changes".
- **No generic data-table, form, or field component.** See the product decisions above.
- **No card or stacked mobile table layout.** Tables scroll inside their own container below 768px, which is what the existing `__table-wrap` divs were built for.
- **No column reordering, hiding, resizing, multi-column sort, virtual scrolling, or CSV export.**
- **No toast notifications.** Errors keep surfacing through the existing `role="alert"` blocks bound to `store.error`; adding a second error channel would leave two.
- **No dark mode.** Excluded by work item 5 and not requested here.
- **No self-service password change.** Still deferred from Story 07; the `mustChangePassword` banner remains informational, and this is documented as a limitation rather than fixed.
- **No real-time updates and no polling.** Work item 5 chose to make staleness visible; nothing here becomes the first exception.
- **No automated end-to-end browser test and no visual-regression test.** RTL, responsive, and keyboard behaviour are verified by Story 29's manual matrix, consistent with work items 1–6.
- **No sorting on the dashboard queues, workspace panels, communication timeline, or unpaginated child lists** (notes, comments, attachments, history, interactions). Four paginated lists get it; the rest keep their fixed, purposeful ordering.
- **No screenshots, CHANGELOG, or licence change** in the handover documentation.

## Environment prerequisites

- Everything work items 1–6 required: Node.js **24 LTS**, npm 11+, PostgreSQL 16+ with the `CustomerCRM` database, `apps/api/.env` carrying `DATABASE_URL`, `JWT_ACCESS_SECRET`, `UPLOAD_DIR`, and `MAX_UPLOAD_BYTES`.
- **Three new environment variables**, all optional and all development-only:
  - `SEED_DEV_USERS` (`apps/api/.env`, seed-only) — `true` enables the three persona accounts. The seed **throws** if this is `true` while `NODE_ENV=production`.
  - `SEED_DEV_USER_PASSWORD` (`apps/api/.env`, seed-only) — **required** whenever `SEED_DEV_USERS=true`; there is no default.
  - `VITE_DEV_TEST_USER_PASSWORD` (`apps/web/.env`) — must equal `SEED_DEV_USER_PASSWORD`. A mismatch locks all three accounts for fifteen minutes after five clicks.
- None of the three is added to `apps/api/src/config/env.validation.ts`: the first two are read by `prisma/seed.ts` outside the Nest container, and the third is a Vite build-time variable.
- **One new migration**, in Story 25 only: `npm run prisma:migrate`, then `prisma:generate`, then `prisma:seed`. The seed is required for Story 28 but not by the schema change itself.
- **No new browser-storage key.** `crm.locale` remains the only one.
- Story 29's verification matrix needs both dev servers, all three seeded personas, at least one customer with an email address and one without, and at least two tickets sharing a `createdAt` value to confirm the pagination tie-breaker.
