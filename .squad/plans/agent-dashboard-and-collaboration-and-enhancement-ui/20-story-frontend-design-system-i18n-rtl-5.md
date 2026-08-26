# Story 20 — Frontend foundation: design system, shared components, i18n, and RTL/LTR (Story: 5)

## Prerequisites

- [Story 19 completed](19-story-tasks-quick-replies-communication-api-5.md): the backend for work item 5 is finished. This story consumes **no new endpoint** — it is pure frontend infrastructure — but it must land before Story 21, which builds screens on top of it.
- Both dev servers running: `npm run dev:api` and `npm run dev:web` from the repo root. `apps/web/.env` keeps `VITE_API_BASE_URL` empty in development so the Vite proxy carries auth and download requests.
- **No backend change is permitted in this story.**

---

## Story Goal

The UI/UX half of work item 5, delivered as infrastructure plus a retrofit — so that Story 21 writes its screens against a finished design system rather than inventing one:

1. **A real token set** in `apps/web/src/assets/main.css`: spacing, radii, shadows, typography scale, focus ring, semantic colours (including the **warning** state the current palette lacks), and status/priority palettes. All layout written with **CSS logical properties** so RTL works without a second stylesheet.
2. **Localisation** — `vue-i18n` with `en` and `ar` message catalogues, every user-facing string in the existing eleven views moved to a translation key.
3. **RTL/LTR** — one `useLocaleStore` that owns `locale` and `dir`, writes `document.documentElement.lang`/`dir`, persists the choice, and is switchable at runtime with no reload.
4. **Shared components** — `apps/web/src/components/`: `AppIcon`, `AppButton`, `AppCard`, `AppBadge`, `AppStateBlock`, `AppTabs`, `AppModal`, `AppPagination`, `StatTile`, `LocaleSwitcher`.
5. **`AppLayout.vue` redesigned** — icon+label sidebar, grouped nav, responsive drawer, skip link, locale switcher, `aria-current`.
6. **Retrofit** of the eleven existing views onto the tokens, the shared components, and `t()` — **without changing what any of them does.**

**Not in scope:** any new route or screen (Story 21 owns `/workspace` and the dashboard rewrite); any new API call; any backend change; a component library dependency; an icon-font or icon-package dependency; dark mode; automated visual-regression or end-to-end browser tests.

---

## Context — Read These Files First

1. `apps/web/src/assets/main.css` — the **whole file, 35 lines.** The `:root` token block is lines **1–12** (twelve tokens: five greys, one accent, `--color-ok`, `--color-error`, `--radius`, `--font-sans`); `*  { box-sizing }` at 14–16; `body` at 18–23; `.sr-only` at 25–34. Everything in this story's task 1 is an extension of that block — **the existing token names must keep working**, because all eleven views reference them.
2. `apps/web/src/layouts/AppLayout.vue` — the **whole file, 150 lines.** Script 1–15 (`auth`, `router`, `showPasswordBanner`, `signOut`); header 19–27; the nav block **30–36** with five `RouterLink`s, three of them `v-if="auth.can(...)"`-gated (33, 34, 35); the `mustChangePassword` banner 41–48 with its explanatory comment at 39–40 (**keep that comment and that behaviour** — Story 07 never shipped the self-service password screen); `<RouterView />` at 50; scoped styles 56–149, including `.layout__nav` at 116–125 (a fixed `width: 220px`) and `.layout__link.router-link-active` at 141–144.
3. `apps/web/src/layouts/AppLayout.spec.ts` — the **whole file, 167 lines.** Read lines 1–40 closely: `useAuthStore` is `vi.mock`ed and `mockAuthStore()` builds a `reactive` stand-in with `can: (permission) => permissions.includes(permission)`. Every assertion in this spec must keep passing, and **any new store `AppLayout` reads must be mockable the same way** — that constraint decides how `useLocaleStore` is consumed in the layout.
4. `apps/web/src/main.ts` — the **whole file, 28 lines.** The comment at **14–17** is load-bearing: Pinia is installed and `useAuthStore(pinia)` instantiated *before* the router, because the auth store's setup body registers the axios session handlers and `router.beforeEach` calls `useAuthStore()`. `app.use(i18n)` and the locale-store bootstrap must slot into that order without disturbing it — see task 3.
5. `apps/web/src/router/index.ts` — the **whole file, 139 lines.** The `RouteMeta` augmentation at **4–12** (`title?`, `public?`, `permissions?`); thirteen route objects at 14–99, each carrying `meta.title`; the guard at **106–132**; and `afterEach` at **134–137**, which builds `document.title` from `to.meta.title` with the fallback `'Customer Support CRM'`. `meta.title` becomes `meta.titleKey` in task 6.
6. `apps/web/src/router/index.spec.ts` — 198 lines. It asserts route resolution, the signed-out redirect, the permission redirect, and the static-over-dynamic ordering for `/customers/new` vs `/customers/:id`. Extending `meta` means touching whatever in here reads `meta.title`; grep for `title` before editing.
7. `apps/web/src/views/CustomersView.vue` — the **whole file, 276 lines.** The reference "list screen": the debounced-search `watch` + `setTimeout` + `onBeforeUnmount` cleanup, the filter change handlers, the bounds-checked pagination, and the **four-way exclusive template branch** (loading / error / empty / table). That four-way branch is exactly what `AppStateBlock` replaces, in all four list and detail views.
8. `apps/web/src/views/TicketsView.vue` — the **whole file, 326 lines.** Its `<style scoped>` block at **207–326** is the most token-hungry in the repo: `.tickets__badge` at 280–286 plus **six** modifier rules at 288–325 built from `color-mix(in srgb, var(--color-accent) 12%, white)`. Those `color-mix(..., white)` calls are the concrete reason a real palette is needed — they hard-code `white` as the mix target, which is what `AppBadge` plus status/priority tokens replace. Also note `categoryLabel`/`priorityLabel`/`statusLabel` at 18–28: three `charAt(0) + slice(1).toLowerCase().replace(/_/g, ' ')` helpers that produce English from an enum literal and are **duplicated** in `TicketDetailView.vue` (19–29). Both are replaced by translation keys.
9. `apps/web/src/views/CustomerDetailView.vue` — the **whole file, 620 lines**, the largest view. Landmarks: `statusLabel` 23–25, `statusOptions` 27–31, the tabs block **284–312** (`role="tablist"`, `role="tab"`, `:aria-selected`) which `AppTabs` replaces, `formatBytes` **125–140** (duplicated verbatim in `TicketDetailView.vue` at 123–…, so it moves to a shared helper), `toLocalDatetimeInput` **144–148**, the interaction form 375–405, and the `window.confirm('Delete this interaction?')` at **179**.
10. `apps/web/src/views/TicketDetailView.vue` — the **whole file, 558 lines.** Tabs at **246–275**, panels at 276–364, `formatBytes` at 123, `onMounted`/`onUnmounted` at 170–177.
11. `apps/web/src/views/UsersView.vue` (519 lines) and `apps/web/src/views/LoginView.vue` (132 lines) — the other two string-dense views. `LoginView` is the only screen reachable while signed out, which makes it the one place the locale switcher must work **before** a session exists.
12. `apps/web/src/views/SystemStatusView.vue` (114), `CustomerFormView.vue` (252), `TicketFormView.vue` (216), `DashboardView.vue` (17), `ForbiddenView.vue` (11), `NotFoundView.vue` (10) — the remainder of the retrofit surface. `DashboardView.vue` is a three-paragraph placeholder about "this bootstrap delivers the application shell" — leave it in place here and let **Story 21** replace it; only its strings move to keys.
13. `apps/web/package.json` — the dependency list is exactly `vue`, `vue-router`, `pinia`, `axios`. One dependency is added in this story and nothing else.
14. `apps/web/eslint.config.js` — the **whole file.** `eslint-plugin-vue`'s `flat/recommended` is on, with `vue/multi-word-component-names`, `vue/max-attributes-per-line`, and `vue/singleline-html-element-content-newline` switched off. `npm run lint` runs with `--max-warnings 0`, so a `vue/…` warning fails the build.
15. `apps/web/vite.config.ts` — the `@` → `./src` alias, and the `test` block (`environment: 'jsdom'`, `globals: true`, `include: ['src/**/*.spec.ts']`). There is **no** vitest setup file; a global that every component spec needs must therefore be installed per-spec or added as a new `setupFiles` entry — task 3 chooses.
16. `apps/web/src/api/session.ts` lines **3–4** — "Never persisted: localStorage and sessionStorage are readable by any injected script." This constrains **what** may be persisted, not whether `localStorage` may be used at all; see Product rule 6.
17. [`.squad/plans/ticket-management/16-story-frontend-ticket-management-4.md`](../ticket-management/16-story-frontend-ticket-management-4.md) — the tone and task shape for a frontend story, and the source of the per-view patterns this story must preserve while restyling.

---

## Product rules (from story)

| # | Rule | Rationale |
|---|------|-----------|
| 1 | **One new dependency: `vue-i18n` (v9 line, `^9.14.0`), in `dependencies`.** Nothing else is added — no component library, no icon package, no CSS framework, no date library, no RTL plugin. | "All user-facing text must be localization-ready" across eleven views with pluralisation and interpolation is not a job for a hand-rolled `t()`. Everything else on that list is replaceable by ~400 lines of local CSS and inline SVG, which is cheaper to own than a dependency. v9 is the long-stable line for Vue 3.4, which is what `package.json` pins. |
| 2 | Existing token names (`--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-ok`, `--color-error`, `--radius`, `--font-sans`) are **kept and keep their meaning.** New tokens are added beside them. | All eleven views reference them. Renaming would turn a styling story into an eleven-file breakage with no user-visible gain. |
| 3 | **Every direction-sensitive CSS property is logical**: `margin-inline`, `padding-inline`, `border-inline-start`, `inset-inline-start`, `text-align: start/end`. No `[dir='rtl']` override block is written for layout. | Logical properties are what make one stylesheet correct in both directions. A mirror-image override block is the thing that rots — every new rule needs a matching override and nobody remembers. The only legitimate `[dir='rtl']` rules are for things logical properties cannot express: `transform: scaleX(-1)` on a directional glyph. |
| 4 | **Icons are inline SVG in one `AppIcon.vue`** with a `name` prop and a local path registry. 24×24, `stroke="currentColor"`, `fill="none"`, `aria-hidden="true"`, `focusable="false"`. | Product rule 1. A registry in one file gives a compile-time-ish guarantee (a typed `IconName` union) that a nav item cannot reference a missing icon, and ships only the paths actually used. |
| 5 | **Directional icons are handled by name, not by CSS.** `AppIcon` exposes `chevron-start`/`chevron-end` (not `chevron-left`/`right`), resolved against the current `dir`. | A "Next page" chevron must point right in LTR and left in RTL; a "download" arrow must not flip. Blanket-flipping every icon under `[dir='rtl']` breaks the second case. Naming the *semantic* direction puts the decision in one place. |
| 6 | The **locale preference is persisted in `localStorage`** under `crm.locale`. The access token is still memory-only. | `api/session.ts`'s warning is about **secrets**, not about storage. A UI language is not a secret, and losing it on every reload is a defect an Arabic-speaking user hits immediately. Recorded explicitly because Story 16's Verification Steps included a blanket "no new `localStorage`" grep — that grep now has exactly one legitimate hit, in `stores/locale.ts`, and nowhere else. |
| 7 | Locale switching is **runtime, no reload**. `document.documentElement.lang` and `dir` are set imperatively by a `watch` in the locale store. | "Language switching must dynamically update the interface language and layout direction." A reload would drop the in-memory access token and sign the user out — an outright bug, not just a jarring UX. |
| 8 | `en` is the `fallbackLocale`. A missing `ar` key renders the English string, never the raw key. | A half-translated build must stay usable. `vue-i18n` also warns in the console on a fallback, which is the signal for finishing a catalogue. |
| 9 | **Enum labels come from translation keys, not from string manipulation.** `ticket.status.IN_PROGRESS`, `ticket.priority.URGENT`, `interaction.channel.WEB_FORM`, and so on. The `categoryLabel`/`priorityLabel`/`statusLabel` helpers duplicated across `TicketsView.vue` (18–28) and `TicketDetailView.vue` (19–29) are **deleted**. | `charAt(0) + slice(1).toLowerCase()` produces English word order and English capitalisation. It cannot produce Arabic at all. |
| 10 | Dates and numbers render through `vue-i18n`'s `d()` and `n()`, configured with `en` and `ar` `datetimeFormats`. The `new Date(x).toLocaleString()` calls scattered through the detail views are replaced. | Arabic locales format dates and numerals differently. `toLocaleString()` with no argument follows the *browser's* locale, not the app's — so an Arabic UI in an English browser shows English dates today. |
| 11 | **Arabic numerals stay Western (`0–9`)**, via `numberingSystem: 'latn'` in the `ar` formats. | Ticket counts, page numbers, and byte sizes sit next to Latin-script identifiers throughout. Eastern Arabic numerals here would be internally inconsistent, and the intake asks for a professional CRM look, not a full locale transformation. Documented so it is a decision, not an omission. |
| 12 | `AppStateBlock` covers the five states the intake names — **loading, empty, success, warning, error** — as one component with a `variant` prop. | The four-way exclusive branch in `CustomersView.vue`/`TicketsView.vue` is copy-pasted, and neither has a warning or success state at all. One component is how "clear loading, empty, success, warning, and error states" becomes checkable instead of aspirational. |
| 13 | Responsive breakpoints are **two**: `≥ 1200px` desktop, `768–1199px` tablet, `< 768px` mobile. The sidebar becomes an overlay drawer below 900px. | Two breakpoints is the fewest that satisfies "desktop, tablet, and mobile". The 900px drawer threshold is separate because the sidebar's fixed 220px width is what actually breaks first, before the content grid does. |
| 14 | **Accessibility baseline**, enforced by the retrofit: every interactive element is a real `<button>`/`<a>`/`<input>`; every form control has a programmatically associated `<label>`; the sidebar link for the current route carries `aria-current="page"`; a visible focus ring (`:focus-visible`) exists on every focusable element; a skip-to-content link is the first focusable thing on the page; `AppModal` traps focus, closes on `Escape`, and restores focus on close; every icon-only control has an `aria-label`. | This is the "basic a11y practices" requirement, written as things a reviewer can check in a diff. The existing views already use `role="tablist"`/`aria-selected` (`CustomerDetailView.vue` 284–312), so this extends an established habit rather than starting one. |
| 15 | **The retrofit changes appearance and strings only — never behaviour.** Every debounce, race guard, permission gate, `window.confirm`, payload shape, and store call survives byte-for-byte in intent. | The acceptance criteria demand no regression from work items 01–04. The existing view specs are the enforcement: they must pass with **no** assertion weakened. Where a spec asserts literal English text, it is updated to assert the rendered translation, not deleted. |
| 16 | `window.confirm` stays. No confirm-modal replacement, even though `AppModal` now exists. | Work item 4's overview recorded this decision; re-opening it would expand a styling story into re-testing eight destructive actions. `AppModal` exists for Story 21's task and quick-reply dialogs. |
| 17 | Component specs mount with a **real** `createI18n` instance carrying the real `en` catalogue, not a `$t: (k) => k` stub. | A stub makes every assertion pass against nonexistent keys. Mounting the real catalogue means a missing or misspelled key fails a test, which is the only automatic check on ~400 translation keys. |

---

## Frontend Tasks

### 1 — The token set

**File: `apps/web/src/assets/main.css`** — extend the `:root` block (lines 1–12); do not remove any existing token (Product rule 2).

Add, grouped and commented:

- **Greys / surfaces:** `--color-surface-raised`, `--color-surface-sunken`, `--color-border-strong`, `--color-overlay: rgb(16 24 32 / 45%)`.
- **Semantic:** keep `--color-ok`/`--color-error`; add `--color-warn: #b26a00`, `--color-info: var(--color-accent)`, and a `-soft` companion for each of ok/warn/error/info/accent — e.g. `--color-error-soft: #fdf0ee`. **Author the soft variants as literal hex values**, not `color-mix(..., white)`: the existing `color-mix(in srgb, var(--color-accent) 12%, white)` calls in `TicketsView.vue` 288–325 hard-code `white` as the mix target and are exactly what these tokens replace.
- **Status palette:** `--color-status-open`, `--color-status-in-progress`, `--color-status-on-hold`, `--color-status-resolved`, `--color-status-closed`, each with a `-soft` companion. Five statuses, matching `TicketStatus`.
- **Priority palette:** `--color-priority-low|medium|high|urgent` plus `-soft`. Four, matching `TicketPriority`.
- **Spacing scale:** `--space-1: 0.25rem` through `--space-8: 3rem`. Every margin/padding/gap in the retrofit uses one of these — no bare `rem` literals.
- **Radii:** keep `--radius`; add `--radius-sm: 4px`, `--radius-lg: 12px`, `--radius-pill: 999px` (replacing the `border-radius: 999px` literal at `TicketsView.vue` line 283).
- **Elevation:** `--shadow-1`, `--shadow-2`, `--shadow-overlay`.
- **Typography:** `--font-size-xs` … `--font-size-2xl`, `--line-height-tight`, `--line-height-body`, `--font-weight-medium`, `--font-weight-semibold`. Add `--font-sans-ar` with an Arabic-capable stack (`'Segoe UI', Tahoma, 'Noto Sans Arabic', system-ui, sans-serif`) — **no webfont is downloaded**; this only reorders the system stack.
- **Focus:** `--focus-ring: 0 0 0 3px color-mix(in srgb, var(--color-accent) 35%, transparent)`.
- **Layout:** `--sidebar-width: 15rem`, `--sidebar-width-collapsed: 4rem`, `--header-height: 3.5rem`, `--content-max-width: 88rem`.

Then, below the token block:

- `html[dir='rtl'] body { font-family: var(--font-sans-ar); }` — the **only** direction-conditional rule in this file.
- A global `*:focus-visible { outline: none; box-shadow: var(--focus-ring); }` (Product rule 14).
- `.skip-link` — visually hidden until `:focus`, then pinned to `inset-block-start`/`inset-inline-start`.
- Keep `.sr-only` (25–34) exactly as it is; `TicketsView.vue` line 137 and others use it on `<caption>`.
- A `@media (prefers-reduced-motion: reduce)` block zeroing transition durations.

**Do not** add utility classes. Views keep `<style scoped>`; they simply stop hard-coding values.

### 2 — `vue-i18n` and the catalogues

**File: `apps/web/package.json`** — add `"vue-i18n": "^9.14.0"` to `dependencies` (beside `vue-router`), then `npm install` from the repo root so the workspace lockfile updates.

**Create file: `apps/web/src/i18n/index.ts`**

```ts
import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import ar from './locales/ar.json';

export const SUPPORTED_LOCALES = ['en', 'ar'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

/** Layout direction per locale. The single source of truth for `dir`. */
export const LOCALE_DIRECTION: Record<AppLocale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl',
};

/** Western digits in Arabic too — Product rule 11. */
const datetimeFormats = {
  en: {
    short: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
  },
  ar: {
    short: { year: 'numeric', month: 'short', day: 'numeric', numberingSystem: 'latn' },
    long: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' },
  },
} as const;

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, ar },
  datetimeFormats,
  numberFormats: {
    en: { decimal: { style: 'decimal' } },
    ar: { decimal: { style: 'decimal', numberingSystem: 'latn' } },
  },
});
```

`legacy: false` is required — the Composition API `useI18n()` is what `<script setup>` components use. `globalInjection: true` makes `$t` available in templates without importing anything, which keeps the retrofit diff small.

**Create files: `apps/web/src/i18n/locales/en.json` and `ar.json`**, structured by domain, not by screen, so a shared component and a view can use the same key:

```
common.{save,cancel,edit,delete,create,close,search,loading,retry,none,yes,no,previous,next,actions,view,confirm,dismiss,unassigned,all}
common.pagination.summary            // "Page {page} of {totalPages} — {total} total"
common.state.{loading,empty,error,success,warning}
common.bytes.{b,kb,mb}               // for the shared formatBytes helper
a11y.{skipToContent,mainNavigation,openMenu,closeMenu,switchLanguage}
nav.{dashboard,workspace,tickets,customers,users,tasks,systemStatus}
nav.group.{work,records,administration}
auth.{signIn,signOut,email,password,mustChangePassword}
error.{forbidden,notFound,generic}
customer.field.*  customer.status.{PROSPECT,ACTIVE,INACTIVE,ARCHIVED}  customer.type.{INDIVIDUAL,COMPANY}
ticket.field.*    ticket.status.{OPEN,IN_PROGRESS,ON_HOLD,RESOLVED,CLOSED}
ticket.priority.{LOW,MEDIUM,HIGH,URGENT}
ticket.category.{GENERAL,TECHNICAL,BILLING,ACCOUNT,FEATURE_REQUEST,BUG_REPORT,OTHER}
ticket.tab.{comments,attachments,history}
ticket.history.field.{status,priority,category,assignedAgentId}
interaction.channel.{PHONE,EMAIL,CHAT,MEETING,OTHER,WHATSAPP,SMS,WEB_FORM}
interaction.direction.{INBOUND,OUTBOUND}
user.field.*  role.{system-administrator,crm-manager,support-supervisor,support-agent,customer,reporting-user}
attachment.{upload,download,hint}
systemStatus.*
```

`interaction.channel.CHAT` is **"Live Chat"** in `en` and the Arabic equivalent in `ar` — this is where Story 17's Product rule 1 ("`CHAT` is presented as Live Chat") is actually honoured.

Both files carry the **same key set**. `ar.json` is a complete translation; where a term is genuinely untranslated (a proper noun, `SMS`), keep the Latin form rather than transliterating.

### 3 — The locale store and the bootstrap

**Create file: `apps/web/src/stores/locale.ts`**

```ts
export const LOCALE_STORAGE_KEY = 'crm.locale';

export const useLocaleStore = defineStore('locale', () => {
  const locale = ref<AppLocale>(readStoredLocale());
  const dir = computed(() => LOCALE_DIRECTION[locale.value]);
  const isRtl = computed(() => dir.value === 'rtl');

  function setLocale(next: AppLocale): void {
    if (!SUPPORTED_LOCALES.includes(next)) {
      return;
    }

    locale.value = next;
  }

  // Product rule 7: imperative, no reload — a reload would drop the in-memory
  // access token and sign the user out.
  watch(
    locale,
    (value) => {
      i18n.global.locale.value = value;
      document.documentElement.lang = value;
      document.documentElement.dir = LOCALE_DIRECTION[value];
      writeStoredLocale(value);
    },
    { immediate: true },
  );

  return { locale, dir, isRtl, setLocale };
});
```

`readStoredLocale()`/`writeStoredLocale()` are module-private and **both wrapped in `try/catch`**: `localStorage` throws in a private window and in some embedded contexts, and a locale preference must never be able to stop the app booting. `readStoredLocale()` falls back to `navigator.language.startsWith('ar') ? 'ar' : 'en'`, then to `'en'`.

**File: `apps/web/src/main.ts`** — one insertion, respecting the ordering comment at 14–17:

```ts
  app.use(pinia);

  const auth = useAuthStore(pinia);
  // Locale before the router so the first rendered frame already has the right
  // dir and language — and before `restore()`, so the sign-in screen a
  // signed-out user lands on is already localised.
  useLocaleStore(pinia);

  app.use(i18n);

  await auth.restore();
```

`app.use(i18n)` must come **after** the locale store is instantiated (its `watch` runs `immediate: true` and sets `i18n.global.locale`) and **before** `app.use(router)`, so a lazily-loaded view never renders against the wrong locale.

**File: `apps/web/index.html`** line 2 — leave `<html lang="en">` as the pre-hydration default. The store overwrites both `lang` and `dir` on its first tick. Add `dir="ltr"` beside it so the attribute exists before JavaScript runs and there is no direction flash.

**File: `apps/web/vite.config.ts`** — add `setupFiles: ['src/test/setup.ts']` to the `test` block, and **create `apps/web/src/test/setup.ts`** which installs the real `i18n` instance globally for `@vue/test-utils`:

```ts
import { config } from '@vue/test-utils';
import { i18n } from '@/i18n';

config.global.plugins = [i18n];
```

This is what makes Product rule 17 cheap: every existing component spec gets `$t` with the **real** `en` catalogue and needs no per-file change beyond updated text assertions.

### 4 — Shared components

**Create directory: `apps/web/src/components/`.** Every component is `<script setup lang="ts">` with typed props via `defineProps<...>()`, and scoped styles built from task 1's tokens only.

- **`AppIcon.vue`** — `props: { name: IconName; size?: number; label?: string }`. A module-local `const ICON_PATHS: Record<IconName, string>` holds the `<path d="…">` data; `IconName` is `keyof typeof ICON_PATHS`, so a typo is a type error (Product rule 4). Needed names: `dashboard`, `workspace`, `tickets`, `customers`, `users`, `tasks`, `communication`, `status`, `search`, `plus`, `edit`, `trash`, `download`, `upload`, `close`, `check`, `alert-triangle`, `alert-circle`, `info`, `clock`, `globe`, `logout`, `menu`, `chevron-start`, `chevron-end`, `chevron-down`, `paperclip`, `send`, `user-check`. `chevron-start`/`chevron-end` resolve through `useLocaleStore().isRtl` (Product rule 5). `aria-hidden="true"` and `focusable="false"` unless `label` is given, in which case `role="img"` + `aria-label`.
- **`AppButton.vue`** — `variant: 'primary' | 'secondary' | 'ghost' | 'danger'`, `size: 'sm' | 'md'`, `icon?: IconName`, `iconOnly?: boolean`, `loading?: boolean`, `disabled?: boolean`, `type?: 'button' | 'submit'` (**default `'button'`** — a bare `<button>` inside a form submits it, and several retrofit sites are inside forms). Renders a real `<button>`; `loading` implies `disabled` and shows a spinner; `iconOnly` **requires** an `aria-label` (Product rule 14) — enforce it with a dev-only `console.warn` when missing.
- **`AppCard.vue`** — `title?`, `subtitle?`, plus `header`/`actions`/`footer`/default slots. Renders `<section>` with the title in an `<h2>` when given.
- **`AppBadge.vue`** — `tone: 'neutral' | 'accent' | 'ok' | 'warn' | 'error' | 'info'`, or `status: TicketStatus` / `priority: TicketPriority` which map to the task-1 palettes. This is what deletes the six `.tickets__badge--*` rules at `TicketsView.vue` 288–325.
- **`AppStateBlock.vue`** — `variant: 'loading' | 'empty' | 'error' | 'success' | 'warning'`, `message?`, `icon?`, plus an `actions` slot. Defaults its message from `common.state.*`. `error`/`warning` render `role="alert"`; `loading` renders `role="status"` with `aria-live="polite"`.
- **`AppTabs.vue`** — `tabs: { key: string; labelKey: string; count?: number }[]`, `v-model` on the active key. Reproduces the existing `role="tablist"`/`role="tab"`/`:aria-selected` markup from `CustomerDetailView.vue` 284–312 **and adds** arrow-key navigation and `tabindex` management (roving tabindex). `ArrowStart`/`ArrowEnd` semantics follow `dir`.
- **`AppModal.vue`** — `open` (v-model), `titleKey`. `<dialog>`-free implementation (jsdom's `<dialog>` support is patchy and the specs run in jsdom): a fixed overlay using `--color-overlay`, `role="dialog"` + `aria-modal="true"` + `aria-labelledby`, focus moved to the first focusable child on open, focus **trapped** on `Tab`/`Shift+Tab`, `Escape` closes, and focus restored to the previously active element on close. Used by Story 21.
- **`AppPagination.vue`** — `page`, `totalPages`, `total`; emits `change`. Uses `chevron-start`/`chevron-end` and `common.pagination.summary`. Replaces the identical pagination blocks in `CustomersView.vue`, `TicketsView.vue`, and `UsersView.vue`.
- **`StatTile.vue`** — `labelKey`, `value: number`, `icon?`, `tone?`, `to?` (a router target, making the tile a link). For Story 21's dashboard; built here so the whole design system lands in one story.
- **`LocaleSwitcher.vue`** — a `<select>` (not a custom dropdown) labelled from `a11y.switchLanguage`, listing `SUPPORTED_LOCALES` with each language's name **in that language** ("English", "العربية"), calling `localeStore.setLocale`.

**Create file: `apps/web/src/utils/format.ts`** — the shared home for `formatBytes(bytes)`, currently duplicated at `CustomerDetailView.vue` 125–140 and `TicketDetailView.vue` 123–…, and for `toLocalDatetimeInput(date)` from `CustomerDetailView.vue` 144–148. `formatBytes` becomes i18n-aware by returning a `{ value, unitKey }` pair the caller renders with `n()` + `t()`, rather than a pre-concatenated English string.

### 5 — `AppLayout.vue` redesign

**File: `apps/web/src/layouts/AppLayout.vue`.** Keep the script's existing pieces (`auth`, `router`, `showPasswordBanner`, `signOut`) and add `useLocaleStore()`, an `isNavOpen` ref, and a `navGroups` computed.

Structure:

- A **skip link** as the first element: `<a href="#main-content" class="skip-link">{{ $t('a11y.skipToContent') }}</a>`.
- **Header** — a `menu` icon-button (visible below 900px) toggling `isNavOpen`; the brand; then, on the inline-end side, `LocaleSwitcher`, the user's name, their role, and a `logout` `AppButton`. All spacing via logical properties, so the identity cluster lands on the correct side in both directions with no override.
- **Sidebar** — `<nav aria-label="$t('a11y.mainNavigation')">` with three groups (Product rule 14 puts a `<h2 class="sr-only">` on each group; the visible group label is an `aria-hidden` caption):
  - **Work** — Dashboard (`dashboard`, `/`), Tickets (`tickets`, `/tickets`, gated `tickets:read`). Story 21 adds Workspace and Tasks to this group.
  - **Records** — Customers (`customers`, `/customers`, gated `customers:read`).
  - **Administration** — Users (`users`, `/users`, gated `users:read`), System status (`status`, `/system-status`).
  Each item is a `RouterLink` rendering `<AppIcon :name>` plus a label span, and carries `aria-current="page"` when active. **Preserve the exact `auth.can(...)` gate on each of the three currently-gated links** (lines 33, 34, 35) — `AppLayout.spec.ts` asserts them.
  Below 900px the sidebar is an overlay drawer: `isNavOpen` toggles a class, the overlay closes it on click and on `Escape`, and `router.afterEach` closes it so navigating on mobile does not leave it open.
- **Main** — `<main id="main-content" tabindex="-1">` wrapping the `mustChangePassword` banner (**keep the comment at 39–40 and the behaviour verbatim**, now as an `AppStateBlock variant="warning"` — the first genuine use of the warning state) and `<RouterView />`, with `max-inline-size: var(--content-max-width)`.

### 6 — Router: `meta.titleKey`

**File: `apps/web/src/router/index.ts`.**

- In the `RouteMeta` augmentation (4–12), replace `title?: string` with `titleKey?: string`, keeping the `public?` and `permissions?` fields and the doc comment at line 9 unchanged.
- Every route object (14–99): `meta: { title: 'Dashboard' }` becomes `meta: { titleKey: 'nav.dashboard' }`, and so on for all thirteen. Reuse the `nav.*` keys where one exists; add `route.title.*` keys for the rest (`New customer`, `Edit customer`, `Ticket`, `New ticket`, `Edit ticket`, `Sign in`, `Not allowed`, `Not found`).
- `afterEach` (134–137) becomes:
  ```ts
  router.afterEach((to) => {
    const appName = i18n.global.t('app.name');
    const titleKey = to.meta.titleKey;
    document.title = titleKey ? `${i18n.global.t(titleKey)} · ${appName}` : appName;
  });
  ```
  Import `i18n` from `@/i18n` — **not** `useI18n()`, which is only valid inside a component's setup.
- The guard (106–132) is **unchanged.**
- **File: `apps/web/src/router/index.spec.ts`** — grep for `title` and update whatever reads `meta.title`. Every routing, redirect, and permission assertion stays as it is.

### 7 — Retrofit the eleven views

For each view: replace hard-coded strings with `$t(...)`, replace bare CSS values with tokens, replace the state branches with `AppStateBlock`, replace pagination with `AppPagination`, replace badge markup with `AppBadge`, replace tabs with `AppTabs`, replace bare `<button>`/`<a class="…">` with `AppButton`, and switch every direction-sensitive property to its logical form. **Behaviour is untouched** (Product rule 15).

- **`LoginView.vue`** (132) — plus `LocaleSwitcher` in the corner: the only screen a signed-out user sees, so it must be switchable there.
- **`CustomersView.vue`** (276) / **`TicketsView.vue`** (326) / **`UsersView.vue`** (519) — the three list screens. Keep the debounced `watch` + `onBeforeUnmount` cleanup and the bounds-checked pagination handlers exactly as they are; only the markup they drive changes. In `TicketsView.vue`, **delete** `categoryLabel`/`priorityLabel`/`statusLabel` (18–28) in favour of `$t('ticket.category.' + ticket.category)` etc. (Product rule 9), and delete the six `.tickets__badge--*` rules (288–325). Wrap every table in an `overflow-x: auto` container (`TicketsView.vue` already has `.tickets__table-wrap` at 248–250 — copy that to the other two) so no page scrolls horizontally on mobile.
- **`CustomerDetailView.vue`** (620) / **`TicketDetailView.vue`** (558) — swap the hand-rolled tabs (284–312 and 246–275) for `AppTabs`; move `formatBytes`/`toLocalDatetimeInput` to `utils/format.ts`; render every date through `d()`; render history `field` labels from `ticket.history.field.*` and interaction channels from `interaction.channel.*`. **Keep** every `auth.can(...)` gate, every `isOwn*` check, and every `window.confirm` (Product rule 16).
- **`CustomerFormView.vue`** (252) / **`TicketFormView.vue`** (216) — labels, placeholders, validation hints, and submit-button text to keys. **Do not touch** the `onMounted` field-copy-from-store pattern or the create-vs-edit payload branches (`|| undefined` on create, `|| null` on edit) — that asymmetry is a documented backend contract.
- **`SystemStatusView.vue`** (114) — strings to keys; the health-status colours to the semantic tokens.
- **`DashboardView.vue`** (17) — strings to keys only. **Story 21 replaces this view**; do not pre-empt it.
- **`ForbiddenView.vue`** (11) / **`NotFoundView.vue`** (10) — `error.forbidden` / `error.notFound`, rendered through `AppStateBlock`.

### 8 — Update the existing specs

Nine spec files assert literal English text. With the real `en` catalogue installed globally (task 3), **update the expected strings to the catalogue's values; never weaken an assertion into a truthiness check** (Product rule 15): `AppLayout.spec.ts`, `router/index.spec.ts`, `LoginView.spec.ts`, `CustomersView.spec.ts`, `CustomerDetailView.spec.ts`, `CustomerFormView.spec.ts`, `TicketsView.spec.ts`, `TicketDetailView.spec.ts`, `TicketFormView.spec.ts`, `UsersView.spec.ts`, `SystemStatusView.spec.ts`.

`AppLayout.spec.ts`'s `mockAuthStore` helper (lines 22–40) stays as it is. `useLocaleStore` is a **real** Pinia store, so those specs need `createTestingPinia()` or `setActivePinia(createPinia())` — check whether each already does; `stores/*.spec.ts` files do, view specs may not.

---

## Edge Cases & Failure Modes

- **`localStorage` throwing** (private window, embedded webview, site-data blocked) → `readStoredLocale`/`writeStoredLocale` are both in `try/catch`, so the app boots in `en` and the switcher still works for the session. A locale preference must never be able to break startup.
- **A stored locale that is no longer supported** (`crm.locale === 'fr'` after a downgrade) → `readStoredLocale` validates against `SUPPORTED_LOCALES` and falls back; `setLocale` also rejects unknown values. Without the read-side check the app renders every key raw.
- **A missing `ar` key** → `fallbackLocale: 'en'` renders the English string plus a console warning (Product rule 8). It never renders the raw key path.
- **A missing key in `en` too** → `vue-i18n` renders the key path itself. This is the failure Product rule 17 exists to catch: a spec mounting the real catalogue and asserting the rendered text fails, rather than a screen shipping with `ticket.status.OPN` in it.
- **Switching locale while a request is in flight** → nothing breaks; error messages come from the API in English (`toErrorMessage` in `api/client.ts`) and are **not** translated. **This is a known limitation**: server-side validation text stays English in an Arabic UI. Translating it would need an error-code contract the backend does not have. Recorded, not fixed.
- **Switching locale with a modal open** → `AppModal`'s trapped focus survives; its title re-renders. Assert this once, because a naive implementation that keys the modal on locale would remount and lose focus.
- **A directional icon in RTL** — `chevron-start`/`chevron-end` resolve through the store, so pagination arrows flip. `download`, `upload`, `send`, `check` do **not** flip. A blanket `[dir='rtl'] svg { transform: scaleX(-1) }` would break the second group and is forbidden by Product rule 3.
- **A table wider than a mobile viewport** → the `overflow-x: auto` wrapper scrolls **the table**, never the page body. `TicketsView.vue`'s `.tickets__table-wrap` is the working precedent; the other two lists lack it today and gain it here.
- **The sidebar drawer left open across a navigation** → `router.afterEach` closes it. Without that, tapping a mobile nav link navigates behind a still-covering drawer.
- **`Escape` with both the drawer and a modal open** → the modal handles it first and stops propagation, so one `Escape` closes one layer. Pin the ordering in a test; it is exactly the kind of thing that regresses silently.
- **Focus after the skip link** → `<main id="main-content" tabindex="-1">` must have `tabindex="-1"`, or the browser moves the URL fragment without moving focus and the link does nothing for a keyboard user.
- **`AppButton` inside a `<form>` with no explicit `type`** → defaults to `type="button"`, so it does **not** submit. Several retrofit sites sit inside forms (the interaction form at `CustomerDetailView.vue` 375–405, the comment forms, the filter forms which already use `@submit.prevent`). Getting this default backwards turns every Cancel button into a submit.
- **`AppBadge` given an enum value with no palette token** (a ninth `TicketStatus` added later) → falls back to `tone: 'neutral'` rather than rendering unstyled. Keep the fallback branch and test it.
- **`color-mix` support** — already used in the current codebase (`AppLayout.vue` line 101, `TicketsView.vue` 290–324), so the baseline is established. New `-soft` tokens are literal hex, which reduces reliance on it rather than increasing it.
- **`vue-i18n` v9 with `legacy: false` and `globalInjection: true`** → `$t` works in templates while `useI18n()` works in setup. If `globalInjection` is dropped, every template `$t` becomes undefined at runtime and nothing fails at compile time.
- **`i18n` imported into `router/index.ts`** → this couples the router module to the i18n module at import time. `i18n` is created at module scope in `i18n/index.ts` with no dependency on Pinia or the app instance, so there is no cycle. Verify by starting the dev server; a cycle shows as an undefined import, not a compile error.
- **A view spec that does not install Pinia** now failing because `AppLayout`/`LocaleSwitcher` call `useLocaleStore()` → add `setActivePinia(createPinia())` (or `createTestingPinia`) to that spec. Expect a handful of these; the failure message is `getActivePinia()" was called but there was no active Pinia`.
- **`npm run lint` with `--max-warnings 0`** → `eslint-plugin-vue`'s `flat/recommended` flags things like `vue/require-default-prop` and attribute ordering in new components. Fix the components; **do not** widen the rule set in `eslint.config.js` — the three existing rule exemptions were deliberate and adding a fourth to dodge a real warning is a regression in code quality.
- **Arabic text mixed with Latin identifiers** (a uuid, an email, a `TKT` subject) → bidirectional text can render with confusing punctuation placement. Wrap raw identifiers in `<span dir="ltr">`. Applies to uuid columns, email addresses, and file names in the attachment lists.

---

## Test Plan

1. **`apps/web/src/i18n/i18n.spec.ts`** (new). **The catalogue-integrity test, and the most valuable spec in this story.** Recursively flatten both JSON files and assert: the `en` and `ar` key sets are **identical** (report the symmetric difference on failure, so the message names the missing keys); no value is an empty string; every `ticket.status.*`, `ticket.priority.*`, `ticket.category.*`, `customer.status.*`, `customer.type.*`, `interaction.channel.*`, and `interaction.direction.*` key exists for **every** enum member (import the value lists from `@/api/tickets` and `@/api/customers` so adding a backend enum value fails here); `LOCALE_DIRECTION` covers every `SUPPORTED_LOCALES` entry and maps `ar` to `rtl`.
2. **`apps/web/src/stores/locale.spec.ts`** (new). `setLocale('ar')` sets `dir` to `'rtl'`, `isRtl` to true, `document.documentElement.dir` to `'rtl'`, `lang` to `'ar'`, and `i18n.global.locale.value` to `'ar'`; `setLocale('fr')` is a no-op; the choice is written to `localStorage['crm.locale']` and read back on a fresh store; a `localStorage.getItem` that **throws** still yields a booting store defaulting to `en` (mock the throw); a `navigator.language` of `'ar-EG'` with empty storage defaults to `ar`.
3. **`apps/web/src/components/AppIcon.spec.ts`** (new). Every `IconName` renders a non-empty `<path d>`; `aria-hidden="true"` with no `label`; `role="img"` + `aria-label` with one; `chevron-start` renders a different path from `chevron-end`, and swaps when the locale store is `ar`.
4. **`apps/web/src/components/AppButton.spec.ts`** (new). Renders a `<button>`; **default `type` is `'button'`**; `loading` sets `disabled` and renders the spinner; each `variant` applies its class; `iconOnly` without `aria-label` warns in dev; the click event does not fire while disabled.
5. **`apps/web/src/components/AppStateBlock.spec.ts`** (new). Each of the five variants renders its default message from `common.state.*`; `error` and `warning` carry `role="alert"`; `loading` carries `role="status"` and `aria-live="polite"`; a custom `message` overrides the default; the `actions` slot renders.
6. **`apps/web/src/components/AppTabs.spec.ts`** (new). `role="tablist"` with one `role="tab"` per entry; `aria-selected` tracks the model; clicking emits the new key; **roving tabindex** (only the active tab is `tabindex="0"`); `ArrowRight` advances in LTR and **retreats** in RTL; `count` renders when supplied.
7. **`apps/web/src/components/AppModal.spec.ts`** (new). `role="dialog"` + `aria-modal="true"` + `aria-labelledby` pointing at the rendered title; focus moves inside on open; `Tab` from the last focusable child wraps to the first; `Escape` emits close; focus is restored to the trigger on close; nothing renders when `open` is false.
8. **`apps/web/src/components/AppPagination.spec.ts`** (new). Previous is disabled on page 1, Next on the last page; `change` emits the right page; the summary renders `common.pagination.summary` with interpolated numbers; the chevrons swap under `ar`.
9. **`apps/web/src/components/AppBadge.spec.ts`** (new). Each `TicketStatus` and `TicketPriority` maps to its palette class; an unknown value falls back to `neutral`; the label comes from the translation catalogue, not from string manipulation.
10. **`apps/web/src/components/LocaleSwitcher.spec.ts`** (new). Renders one `<option>` per supported locale, each labelled in its own language; selecting calls `setLocale`; the `<select>` has an accessible name.
11. **`apps/web/src/utils/format.spec.ts`** (new). `formatBytes` at 0, 1023, 1024, 1 MiB, and 10.5 MiB returns the right `{ value, unitKey }`; `toLocalDatetimeInput` round-trips through an `<input type="datetime-local">`-shaped string in a fixed timezone.
12. **`apps/web/src/layouts/AppLayout.spec.ts`** (extend, keeping every existing assertion). Add: the skip link is the first focusable element and targets `#main-content`; each nav item renders an icon **and** a label; the three permission gates still hide their links (the pre-existing assertions, updated for the new text); the active link carries `aria-current="page"`; the drawer toggle appears and `isNavOpen` flips; `router.afterEach` closes the drawer; `LocaleSwitcher` is present; the `mustChangePassword` banner still renders and still dismisses.
13. **`apps/web/src/router/index.spec.ts`** (extend). `document.title` uses `meta.titleKey` translated, and the fallback when a route has no `titleKey`; switching the locale changes the title on the next navigation. Every existing routing/redirect/permission assertion unchanged.
14. **The nine existing view specs** (extend/update). Text assertions updated to the `en` catalogue; **no assertion removed or weakened**; add a Pinia instance wherever the locale store now makes one necessary.
15. **`apps/web/src/views/TicketsView.spec.ts`** (extend specifically). Assert badge labels come from the catalogue (e.g. mount under `ar` and confirm the Arabic status label renders) — the direct regression test for deleting `statusLabel`.
16. **An RTL smoke spec** — mount `AppLayout` with the locale store set to `ar` and assert `document.documentElement.dir === 'rtl'` and that no component throws. A jsdom test cannot verify visual mirroring; that is covered manually in Verification Steps, and this spec exists to catch the crash case.
17. **No new backend test.** No backend file is touched.
18. **No automated end-to-end or visual-regression test** — consistent with work items 1–4; RTL and responsive behaviour are verified manually below.

---

## Migration / Rollback

**One new dependency.** `vue-i18n@^9.14.0` in `apps/web/package.json` `dependencies`. `npm install` from the repo root updates the workspace lockfile. No native build step, no peer-dependency conflict with Vue 3.4.

**One new `localStorage` key.** `crm.locale`. It is not sensitive, is read defensively, and its absence is a normal state. This is the single legitimate exception to work item 4's "no new `localStorage`" check (Product rule 6) — Verification Step 6 below re-runs that grep and asserts exactly one hit, in `stores/locale.ts`.

**One breaking internal contract.** `meta.title` → `meta.titleKey` in `RouteMeta`. Purely internal: only `router/index.ts` writes it and only its `afterEach` reads it. Story 21's new routes must use `titleKey`.

**What could go wrong on a half-applied retrofit.** The retrofit is per-view, so a partially-completed task 7 leaves some views localised and others hard-coded English. That state **builds and runs** — which is the risk: it is easy to call the story done with two views missed. Verification Step 8 is the check that closes it: grep the views for user-visible string literals.

**Rollback.** Revert `main.css`, `AppLayout.vue`, `router/index.ts`, `main.ts`, `index.html`, `vite.config.ts`, `package.json`, and the eleven views; delete `src/i18n/`, `src/components/`, `src/stores/locale.ts`, `src/utils/`, `src/test/`, and the new specs. No persisted state matters — a stale `crm.locale` key in a browser is inert once the store reading it is gone. Nothing on the server is involved.

---

## Verification Steps

1. **Install:** `npm install` from the repo root; confirm `vue-i18n` resolves and no peer warning appears.
2. **Typecheck:** `npm run typecheck --workspace @crm/web`.
3. **Lint:** `npm run lint --workspace @crm/web` — must pass at `--max-warnings 0` **without** editing `eslint.config.js`.
4. **Unit tests:** `npm run test --workspace @crm/web`.
5. **Build:** `npm run build --workspace @crm/web` (this runs `vue-tsc` first).
6. **Storage grep:** `grep -rn "localStorage\|sessionStorage" apps/web/src/` — expect hits only in `stores/locale.ts` and its spec, plus the pre-existing **comment** at `api/session.ts` lines 3–4. **Any hit in `api/`, `stores/auth.ts`, or a view is a defect.**
7. **Hard-coded-colour grep:** `grep -rn "#[0-9a-fA-F]\{3,6\}" apps/web/src/views/ apps/web/src/layouts/ apps/web/src/components/` — expect zero hits outside `assets/main.css` (and `#ffffff` on a token definition line, if any). Every colour must come from a token.
8. **Hard-coded-string sweep:** grep the eleven views for user-visible text outside `$t(...)`/`t(...)` — check `>text<` between tags, and `placeholder=`, `aria-label=`, `title=`, `alt=` attributes. Expect zero. **This is the check that catches a half-finished retrofit.**
9. **Physical-property grep:** `grep -rn "margin-left\|margin-right\|padding-left\|padding-right\|border-left\|border-right\|text-align: *left\|text-align: *right\|left:\|right:" apps/web/src` — expect zero hits in `components/`, `layouts/`, and `views/` (Product rule 3).
10. **Dev server:** `npm run dev:web` with `npm run dev:api` running; sign in as the seeded administrator.
11. **LTR pass, desktop (≥1200px):** walk Dashboard, Tickets (list, detail with all three tabs, create, edit), Customers (list, detail with all three tabs, create, edit), Users, System status. Confirm consistent spacing, one focus-ring style, no clipped content, and that **everything still works** — search debounce, filters, pagination, status change, comment add/edit/delete, attachment upload/download/delete, interaction logging.
12. **RTL pass:** switch to Arabic. Confirm on **every** screen from step 11: the sidebar moves to the right; nav icons sit before their labels on the correct side; table columns and headers reverse; form labels and inputs align to the start; the tabs strip reverses and `ArrowRight`/`ArrowLeft` move as expected; pagination chevrons point the correct way while download/upload icons do **not** flip; dialogs and the drawer open from the correct side; the page body does **not** scroll horizontally anywhere. **Then switch back to English and confirm every one of those reverses cleanly** — no reload, and still signed in (Product rule 7).
13. **Locale persistence:** switch to Arabic, reload; confirm the UI is still Arabic, still `dir="rtl"`, and the session survived.
14. **Signed-out locale:** open a private window, land on `/login`, switch to Arabic there, confirm the sign-in form is Arabic and RTL, then sign in and confirm the locale carries through.
15. **Responsive pass:** at 1200px, 900px, 768px, and 375px, in **both** directions. Confirm the sidebar becomes a drawer below 900px, the drawer closes on navigation and on `Escape`, tables scroll inside their own container, and no control overlaps another.
16. **Keyboard pass:** `Tab` from a fresh load — the skip link is first and moves focus into `<main>`; every interactive element is reachable and shows a visible ring; tabs are operable with arrow keys; a modal traps focus, closes on `Escape`, and returns focus to its trigger.
17. **Screen-reader smoke:** with the OS reader on one screen per shape (list, detail, form), confirm the nav announces as a navigation landmark, the active link announces as current, form fields announce their labels, and `AppStateBlock`'s error announces as an alert.
18. **Regression, role-based:** repeat the `support-agent`, `crm-manager`, and `reporting-user` flows from Story 16's Verification Steps 10–12 and confirm **identical** permission behaviour — every write control still hidden or shown exactly as before.
19. **Regression, 403 mid-session:** trigger a `403` (a `support-agent` deleting someone else's comment) and confirm it renders as an inline error and does **not** sign the user out.
20. **Full-repo:** `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` from the repo root.

---

## Done Criteria

- [ ] `apps/web/src/assets/main.css` carries the full token set; all ten original token names still exist with their original meaning.
- [ ] `vue-i18n` is the **only** dependency added.
- [ ] `en.json` and `ar.json` have **identical** key sets, both complete, with a translation key for every enum value of every enum the UI renders — proven by `i18n.spec.ts`.
- [ ] `useLocaleStore` owns `locale`/`dir`/`isRtl`, sets `lang` and `dir` on `<html>`, persists to `crm.locale` defensively, and switches at runtime **without a reload and without losing the session**.
- [ ] The ten shared components exist in `apps/web/src/components/`, each with a spec.
- [ ] `AppLayout.vue` has a skip link, icon+label grouped nav with `aria-current`, a locale switcher, and a responsive drawer below 900px; **every pre-existing permission gate and the `mustChangePassword` banner still behave identically.**
- [ ] `meta.titleKey` replaces `meta.title` on all thirteen routes; the guard is unchanged.
- [ ] All eleven views are retrofitted: no user-visible string literal, no hard-coded colour, no physical direction property — proven by Verification Steps 7–9.
- [ ] `formatBytes` and `toLocalDatetimeInput` exist once, in `utils/format.ts`; the three enum-label helpers are deleted.
- [ ] The nine existing view specs pass with **updated, not weakened,** assertions.
- [ ] `grep -rn "localStorage" apps/web/src/` returns hits only in `stores/locale.ts`, its spec, and the pre-existing comment in `api/session.ts`.
- [ ] **No backend file was modified.**
- [ ] All 20 Verification Steps pass, including the full RTL walkthrough (step 12), the responsive matrix (step 15), the keyboard pass (step 16), and the role-based regression (step 18).
- [ ] Full-repo typecheck/lint/test/build pass.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 21.**
