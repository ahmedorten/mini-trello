# Story 28 — The login test-user picker, development builds only (Story: 13)

## Prerequisites

- [Story 25 completed](25-story-backend-list-sorting-indexes-dev-seed-13.md): `prisma/seed.ts` seeds `dev.admin@crm.local`, `dev.agent@crm.local`, and `dev.customer@crm.local` behind `SEED_DEV_USERS=true`. **The picker is useless without those accounts** — it fills a form with credentials that must actually authenticate.
- [Story 27 completed](27-story-frontend-dialogs-forms-consistency-13.md): the global form-control rules and `.form-error` exist. This story is the one place Story 27 deliberately left alone (`LoginView.vue:46`'s `login__error`), so it finishes that conversion.
- The database has been seeded with `SEED_DEV_USERS=true` and a known `SEED_DEV_USER_PASSWORD`. You need that exact value for `apps/web/.env`.
- **No backend change is permitted in this story.** `apps/api/` is untouched — a checkable claim. The picker calls the existing `POST /api/auth/login` and nothing else; there is no new endpoint, no dev-only route, and no way to obtain a session other than the one every user already uses.
- **No new npm dependency.**

---

## Story Goal

A convenience on the sign-in screen for local and test environments: a short list of the three seeded personas, each labelled with its role, that fills the email and password fields when clicked. The user still presses Sign in. Authentication still goes through `auth.login()` → `POST /api/auth/login` → the real password check, the real lockout counter, the real JWT, the real httpOnly refresh cookie.

1. **A dev-only persona list** in its own module, gated on `import.meta.env.DEV`, which Vite replaces with the literal `false` in a production build — so the list, the markup, and the strings are removed by dead-code elimination rather than merely hidden.
2. **No password in the source tree.** The three emails are configuration; the shared password comes from `VITE_DEV_TEST_USER_PASSWORD`. With the variable unset the picker still works: it fills the email, focuses the password field, and says the password must be typed.
3. **The login card finished off** — the error block moves onto `.form-error`, the fields onto the global control styling, and the picker sits below the form as a clearly separated, clearly labelled development aid.

**Not in scope:** any change to `auth.login`, `api/auth.ts`, `api/session.ts`, or the router guard; auto-submit or one-click sign-in of any kind; a role switcher for an already-signed-in session; impersonation; remembering the last-used persona; a "remember me" checkbox; any new browser-storage key; seeding (Story 25 owns it); documentation (Story 29 owns it).

---

## Context — Read These Files First

1. `apps/web/src/views/LoginView.vue` — the **whole file, 133 lines.** Script 1–35: `auth`/`route`/`router`/`t` at 9–12, `email` and `password` refs at **14–15**, `redirectTarget` at **17–26** (read the open-redirect comment at 20–22 — it is load-bearing and must not be touched), `submit()` at **28–34**. Template 37–78: the locale switcher at 39–41, the `<form @submit.prevent="submit">` at **43**, the `role="alert"` error at **46–48**, the email field at **50–60** (note `autocomplete="username"`, `required`, `autofocus`), the password field at **62–71** (`autocomplete="current-password"`, `required`), and the submit `AppButton` at **73–75** with `:disabled="auth.isLoading || !email || !password"`. Styles 80–133, including `.login__field input` at **117–123** (the local rule Story 27 preserved) and `.login__error` at **125–132**.
2. `apps/web/src/views/LoginView.spec.ts` — the **whole file, 144 lines, 8 tests.** `vi.mock('@/stores/auth')` at 9–11; `mockAuthStore()` at 15–28 building a `reactive` stand-in with `error`, `isLoading`, and a `vi.fn()` `login`; `mountView()` at 30–47. **The last test, `'never renders the typed password outside the bound input value'` at 135–143, is the security assertion this story must not break** — it asserts `wrapper.html()` does not contain the typed password. A picker that renders the password as visible text, a `title`, or a `data-` attribute fails it. That test is the reason the picker must set `password.value` and nothing else.
3. `apps/web/src/env.d.ts` — the **whole file, 9 lines.** `ImportMetaEnv` declares exactly one member, `VITE_API_BASE_URL`. The new variable is added here or `import.meta.env.VITE_DEV_TEST_USER_PASSWORD` is a type error under `vue-tsc`.
4. `apps/web/.env.example` — 4 lines. The comment "*Vite only exposes variables prefixed with `VITE_` to client code*" is the rule the new variable follows, and the reason it must be understood as **public to anyone with the built bundle** in any environment where it is set.
5. `apps/web/vite.config.ts` — the **whole file, 27 lines.** The `@` → `./src` alias at 7–11; the dev proxy at 12–21; the `test` block at 22–27 (`environment: 'jsdom'`, `globals: true`, `setupFiles: ['src/test/setup.ts']`). **Under Vitest, `import.meta.env.DEV` is `true`**, which is what makes the picker testable at all; a production-build assertion is a build-output check, not a unit test.
6. Existing `import.meta.env` precedent — read all four call sites before adding the fifth: `api/client.ts:6` (`VITE_API_BASE_URL || '/api'`), `AppButton.vue:31` (`if (import.meta.env.DEV)` guarding a `console.warn`), `CommunicationTimeline.vue:136` (the same DEV guard), `router/index.ts:127` (`BASE_URL`). `AppButton.vue:31` is the exact pattern this story scales up: a `DEV`-guarded block that does not exist in a production bundle.
7. `apps/web/src/stores/auth.ts` — `login()` at **62–81**. It sets `isLoading`, clears `error`, calls `loginRequest`, stores the access token in memory via `setAccessToken`, then fetches the current user; on failure it calls `clear()` and sets `error` from `toErrorMessage`. **This function is not modified.** The picker's only interaction with authentication is that the user afterwards submits the form that calls it.
8. `apps/web/src/api/session.ts` lines **3–4** — "*Never persisted: localStorage and sessionStorage are readable by any injected script.*" The picker stores nothing. The selected persona is not remembered between reloads, deliberately.
9. `apps/api/prisma/seed.ts` — the `devTestUsers` array Story 25 added (after the `quickReplies` array). **The three emails in this story's frontend list must match it exactly.** Story 25's comment beside that constant says so from the other direction; both comments must name each other.
10. `apps/web/src/i18n/locales/en.json` / `ar.json` — the `auth` block currently holds six keys (`signIn`, `signingIn`, `signOut`, `email`, `password`, `mustChangePassword`). The **`role` block already contains all three persona keys** — `role.system-administrator`, `role.support-agent`, `role.customer` — translated in both catalogues. Reuse them; do not write new role labels. `AppLayout.vue:125` already renders role names this way.
11. `apps/web/src/components/AppButton.vue` — props at 6–28. The picker's entries are `variant="secondary"`, `size="sm"`, `type="button"` (the default — read the comment at 13–14 explaining why a bare button inside a form would submit it, which is exactly the failure mode a picker button inside `<form>` would hit).
12. `apps/web/src/components/AppIcon.vue` and `components/icons.ts` — `'user-check'` (line 33) and `'info'` (23) already exist in the registry; no new icon is needed.

---

## Product rules (from story)

| # | Rule | Rationale |
|---|------|-----------|
| 1 | **The only gate is `import.meta.env.DEV`.** There is no `VITE_ENABLE_TEST_USERS` flag, and the feature cannot be turned on in a production build by any environment variable. | Vite replaces `import.meta.env.DEV` with the literal `false` when building, so the branch, the persona list, and their strings are removed by dead-code elimination — a property provable by grepping `apps/web/dist/`. A runtime flag would keep the code in the bundle and make "is it enabled in production?" a deployment question instead of a compile-time fact. "Test-user functionality is disabled or excluded from production builds" is then *excluded*, which is the stronger of the two words the acceptance criteria offer. |
| 2 | **No password literal anywhere in `apps/web/src`.** The shared dev password comes from `VITE_DEV_TEST_USER_PASSWORD`. | "Do not hardcode production credentials or sensitive secrets in the frontend." A literal in the source tree is published the moment the repo is handed over, and it would be identical across every developer's database. |
| 3 | **With `VITE_DEV_TEST_USER_PASSWORD` unset the picker still works**: it fills the email, leaves the password empty, focuses the password input, and renders a translated hint. It is never hidden and never disabled for a missing password. | The email is the tedious half. A picker that vanishes when one optional variable is missing is a feature nobody can rely on, and a developer who has not set the variable is exactly the developer who most needs the email filled in. |
| 4 | **Selecting a persona sets `email.value` and `password.value` and nothing else. It does not call `auth.login`, does not submit the form, and does not touch the router.** | "The user must still explicitly submit the login form." "Do not bypass the existing authentication mechanism." One click that both fills and submits would make the picker a sign-in shortcut, which is the thing the intake rules out. It also keeps `LoginView.spec.ts:135–143` — the password-must-not-render assertion — meaningful. |
| 5 | **The password is written only into the bound `password` ref**, never into a `title`, `aria-label`, `data-` attribute, tooltip, or visible text. | `LoginView.spec.ts:135–143` asserts `wrapper.html()` does not contain the typed password. That test is the guard, and it must keep passing without modification. |
| 6 | **Each persona is labelled with its role using the existing `role.<key>` translation keys.** | All three already exist in both catalogues and are already how `AppLayout.vue:125` renders a role. "Clearly identify each test user's role/persona" is satisfied by reusing them; a second set of labels could drift from the first. |
| 7 | **The three emails are duplicated between `prisma/seed.ts` and the frontend list, on purpose, with a comment in each naming the other.** | The frontend cannot import from `apps/api` — separate workspaces, separate tsconfigs, and the seed is not a published module. A third shared package for three string literals is more machinery than the duplication costs. The comments are what make the coupling visible; a verification step checks it. |
| 8 | **The picker sits below the form, visually separated, and labelled as a development aid** — not styled as a primary action. | A prominent list of one-click logins on a screen that also exists in production-shaped builds trains the wrong habit. It should read as scaffolding. |
| 9 | **The picker stores nothing.** No last-used persona, no browser-storage key. `crm.locale` remains the only one. | Carried forward from Stories 20, 22, 26, and 27. Remembering a persona would also mean writing an email address to storage, which is the category `api/session.ts:3–4` warns about. |
| 10 | **Nothing else on the login screen changes behaviour.** `redirectTarget`'s open-redirect guard (`LoginView.vue:17–26`), `autofocus` on email, both `autocomplete` attributes, both `required` attributes, and the submit `:disabled` expression all survive byte-for-byte. | Six of the eight existing `LoginView` tests cover exactly these. They must pass unmodified. |

---

## Frontend Tasks

### 1 — The persona list

**Create file: `apps/web/src/config/devTestUsers.ts`**

```ts
/**
 * Development-only sign-in shortcuts for the login screen.
 *
 * Gated on `import.meta.env.DEV`, which Vite replaces with the literal `false`
 * in a production build — so this list, and the markup that renders it, are
 * removed by dead-code elimination rather than merely hidden at runtime
 * (Story 28 Product rule 1). There is deliberately no runtime flag that can
 * switch it back on.
 *
 * The three emails MUST match `devTestUsers` in apps/api/prisma/seed.ts, which
 * creates these accounts behind SEED_DEV_USERS=true. The duplication is
 * deliberate: apps/web cannot import from apps/api (Product rule 7).
 *
 * No password is stored here (Product rule 2). VITE_DEV_TEST_USER_PASSWORD
 * supplies one, and must be set to the same value as the API's
 * SEED_DEV_USER_PASSWORD. With it unset the picker fills the email only.
 */
export interface DevTestUser {
  email: string;
  fullName: string;
  /** A seeded role key. Rendered through the existing `role.<key>` i18n keys,
   *  so it must be one of them (Product rule 6). */
  roleKey: 'system-administrator' | 'support-agent' | 'customer';
}

const DEV_TEST_USERS: DevTestUser[] = [
  { email: 'dev.admin@crm.local', fullName: 'Dev System Administrator', roleKey: 'system-administrator' },
  { email: 'dev.agent@crm.local', fullName: 'Dev Support Agent', roleKey: 'support-agent' },
  { email: 'dev.customer@crm.local', fullName: 'Dev Customer', roleKey: 'customer' },
];

/** Empty in any production build, because the guard is a compile-time constant. */
export const devTestUsers: readonly DevTestUser[] = import.meta.env.DEV ? DEV_TEST_USERS : [];

/** The shared dev password, or '' when the variable is unset — Product rule 3. */
export const devTestUserPassword: string = import.meta.env.DEV
  ? (import.meta.env.VITE_DEV_TEST_USER_PASSWORD ?? '')
  : '';
```

Both exports are guarded, not just the array: a bundler that keeps `DEV_TEST_USERS` alive because a single export referenced it would defeat the point. Verify with the `dist/` grep in Verification Steps.

### 2 — Environment typing and documentation

**File: `apps/web/src/env.d.ts`** — add the member to `ImportMetaEnv`:

```ts
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** Development only. The password prefilled by the login test-user picker;
   *  must equal the API's SEED_DEV_USER_PASSWORD. Optional — the picker fills
   *  the email and leaves the password blank when it is absent. */
  readonly VITE_DEV_TEST_USER_PASSWORD?: string;
}
```

**File: `apps/web/.env.example`** — append:

```
# --- Login test users (development only, Story 28) ---
# The password the login test-user picker prefills for the three seeded dev
# personas. Set it to the SAME value as SEED_DEV_USER_PASSWORD in
# apps/api/.env, or the prefilled credentials will not authenticate.
#
# The picker is gated on import.meta.env.DEV: it does not exist in a production
# build, and no environment variable can switch it back on. Leave this UNSET
# outside local development — every VITE_ variable is readable by anyone with
# the built bundle.
VITE_DEV_TEST_USER_PASSWORD=ChangeMe_Dev_Only_1
```

### 3 — The picker in `LoginView.vue`

**File: `apps/web/src/views/LoginView.vue`**

Add to the script block, after `submit()` (34) — nothing above it changes:

```ts
import { devTestUsers, devTestUserPassword, type DevTestUser } from '@/config/devTestUsers';

const passwordInput = ref<HTMLInputElement | null>(null);

/**
 * Fills the form and stops. It does NOT call auth.login and does NOT submit —
 * the user still presses Sign in, and authentication still goes through the
 * existing POST /api/auth/login (Product rule 4).
 */
function useTestUser(user: DevTestUser): void {
  email.value = user.email;
  password.value = devTestUserPassword;

  // With no VITE_DEV_TEST_USER_PASSWORD the email is still the tedious half;
  // put the cursor where the remaining work is (Product rule 3).
  if (!devTestUserPassword) {
    passwordInput.value?.focus();
  }
}
```

Bind the ref on the existing password input at **64** by adding `ref="passwordInput"` — change nothing else about that element: `autocomplete="current-password"` and `required` stay.

Add to the template, **after** `</form>` (line 76) so the picker is outside the form element and its buttons cannot submit it:

```vue
    <!-- Development builds only. import.meta.env.DEV is a compile-time
         constant, so `devTestUsers` is an empty array and this whole block is
         eliminated in a production build (Product rule 1). -->
    <section v-if="devTestUsers.length" class="login__test-users" aria-labelledby="login-test-users-heading">
      <h2 id="login-test-users-heading" class="login__test-users-heading">
        <AppIcon name="info" :size="14" />
        {{ t('auth.testUsers.title') }}
      </h2>

      <p class="login__test-users-hint">{{ t('auth.testUsers.hint') }}</p>

      <ul class="login__test-users-list">
        <li v-for="user in devTestUsers" :key="user.email" class="login__test-user">
          <span class="login__test-user-identity">
            <span class="login__test-user-name">{{ user.fullName }}</span>
            <span class="login__test-user-role">{{ t(`role.${user.roleKey}`) }}</span>
            <span class="login__test-user-email" dir="ltr">{{ user.email }}</span>
          </span>
          <AppButton
            variant="secondary"
            size="sm"
            icon="user-check"
            :aria-label="t('auth.testUsers.useThisFor', { name: user.fullName })"
            @click="useTestUser(user)"
          >
            {{ t('auth.testUsers.useThis') }}
          </AppButton>
        </li>
      </ul>

      <p v-if="!devTestUserPassword" class="login__test-users-warning">
        {{ t('auth.testUsers.passwordMissing') }}
      </p>
    </section>
```

`dir="ltr"` on the email span matches the existing treatment of identifiers in tables (`CustomersView.vue:132–133`) so an address reads correctly in an Arabic UI.

The password is written only into `password.value`. It appears in **no** attribute and **no** text node — Product rule 5, and the reason `LoginView.spec.ts:135–143` keeps passing.

Add the scoped styles, and while in the file replace `class="login__error"` at **46** with `class="form-error"` and delete the `.login__error` rule at **125–132** — this is the one error block Story 27 left for this story. **Keep `.login__field input` at 117–123** (Story 27 Product rule 2).

```css
.login__test-users {
  inline-size: 100%;
  max-inline-size: 360px;
  padding: var(--space-4);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius);
  background: var(--color-surface-sunken);
}

.login__test-users-heading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-1);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
}

.login__test-users-hint,
.login__test-users-warning {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: var(--line-height-body);
}

.login__test-users-warning {
  margin-block: var(--space-3) 0;
  color: var(--color-warn);
}

.login__test-users-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.login__test-user {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.login__test-user-identity {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-inline-size: 0;
}

.login__test-user-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.login__test-user-role,
.login__test-user-email {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
```

The dashed border and sunken background are the whole of Product rule 8: it must not look like a primary action.

### 4 — Translation keys

**Files: `apps/web/src/i18n/locales/en.json` and `ar.json`** — add to the `auth` block in **both**. Parity is enforced by `i18n.spec.ts:39–47`, and the no-empty-string rule by `:49–54`.

`en.json`:

```json
    "testUsers": {
      "title": "Development test users",
      "hint": "Select an account to fill the form. You still need to sign in.",
      "useThis": "Use",
      "useThisFor": "Fill the form with {name}",
      "passwordMissing": "Set VITE_DEV_TEST_USER_PASSWORD in apps/web/.env to prefill the password too."
    }
```

`ar.json`:

```json
    "testUsers": {
      "title": "مستخدمو الاختبار للتطوير",
      "hint": "اختر حساباً لتعبئة النموذج. لا يزال عليك تسجيل الدخول.",
      "useThis": "استخدام",
      "useThisFor": "تعبئة النموذج بحساب {name}",
      "passwordMissing": "اضبط VITE_DEV_TEST_USER_PASSWORD في apps/web/.env لتعبئة كلمة المرور أيضاً."
    }
```

`passwordMissing` deliberately names the variable rather than translating it — it is a message for a developer, and the variable name is the actionable part.

---

## Edge Cases & Failure Modes

- **Production build** → `import.meta.env.DEV` is the literal `false`, `devTestUsers` is `[]`, the `v-if` is statically false, and the block plus the persona data are dropped. Verified by grepping `apps/web/dist/` for `dev.admin@crm.local` — see Verification Steps.
- **`VITE_DEV_TEST_USER_PASSWORD` unset in development** → `devTestUserPassword` is `''`, clicking a persona fills the email, leaves the password empty, focuses the password input, and the warning renders. The submit button stays disabled because its expression already includes `!password` (`LoginView.vue:73`) — which is correct, not a bug.
- **`VITE_DEV_TEST_USER_PASSWORD` set but wrong** (does not match the API's `SEED_DEV_USER_PASSWORD`) → the form submits, the API rejects, `auth.error` renders in the `role="alert"` block. **Five wrong attempts lock the account for fifteen minutes** (`apps/api/src/auth/auth.service.ts:7–8`, `MAX_FAILED_ATTEMPTS = 5`, `LOCKOUT_MINUTES = 15`). A picker with a stale password is a fast way to lock all three personas; call this out in the `.env.example` comment and in Story 29's README section.
- **The dev accounts were never seeded** (`SEED_DEV_USERS` unset when the database was seeded) → the picker fills the form, submit returns 401, and the user sees "Invalid email or password." The picker cannot detect this — it makes no API call before submit, by design (Product rule 4). Document the seeding prerequisite in Story 29's README.
- **Clicking a persona while a previous failed attempt's error is showing** → `auth.error` persists until the next `login()` call clears it (`stores/auth.ts:65`). The stale error sits above a freshly filled form. Acceptable and consistent with typing over a failed attempt manually; do not add an error-clearing side effect to `useTestUser`, which would be a behaviour change to the login screen for a cosmetic gain.
- **Clicking a persona twice** → idempotent; both refs are reassigned to the same values.
- **The picker's buttons submitting the form** → prevented two ways: the `<section>` is outside `</form>`, and `AppButton` defaults `type` to `'button'` (`AppButton.vue:13–14`). Either alone would do; both is deliberate, because moving the block inside the form later is a plausible edit.
- **`autofocus` on the email input** (`LoginView.vue:58`) → unaffected. The picker only moves focus when the password is missing, and only on click.
- **Password visible in the DOM** → it is not. Assert it: `LoginView.spec.ts:135–143` already does for typed input; add the equivalent for the picker path.
- **A persona `roleKey` with no `role.<key>` translation** → the `DevTestUser.roleKey` union restricts it to the three keys that exist, so this is a compile error rather than a rendered `role.something` string. That is why the field is a union and not `string`.
- **RTL** → the persona rows use `justify-content: space-between` with logical padding, so the identity block and the button swap sides correctly. The email keeps `dir="ltr"` so `dev.admin@crm.local` does not render with its parts reordered.
- **Narrow screen (320px)** → `.login__test-user` has `flex-wrap: wrap`, so the button drops below the identity block instead of overflowing.
- **A production user account named `dev.admin@crm.local`** → Story 25's seed would upsert `system-administrator` onto it. That risk is recorded in Story 25's Edge Cases and is why its production guard throws; nothing in this story changes it, but the emails chosen here are what make it concrete.

---

## Test Plan

1. **Unit — new `apps/web/src/config/devTestUsers.spec.ts`.** `'exposes exactly three personas under Vitest, where import.meta.env.DEV is true'`; `'covers the system-administrator, support-agent, and customer roles, one each'`; `'uses the dev.*@crm.local emails that prisma/seed.ts creates'` (assert the three literals, so a rename on either side fails a test — Product rule 7); `'contains no password literal'` (assert `devTestUserPassword` is driven by the env var, not a constant).
2. **Unit — `apps/web/src/views/LoginView.spec.ts`.** All **8 existing tests must pass unmodified**, including `'never renders the typed password outside the bound input value'` (135–143). Add: `'renders one entry per dev test user with its role label'`; `'clicking Use fills the email and password inputs'`; `'clicking Use does not call auth.login'` (the Product rule 4 assertion — assert the `vi.fn()` `login` from `mockAuthStore` has zero calls); `'clicking Use does not navigate'` (spy on `router.replace`); `'never renders the prefilled password anywhere in the markup'` (the picker-path counterpart of the existing security test); `'renders the missing-password warning and focuses the password input when the env var is empty'` (stub the module with `vi.mock('@/config/devTestUsers', …)` returning `devTestUserPassword: ''`); `'renders no picker section when devTestUsers is empty'` (the same stub with an empty array — this is how the production behaviour is unit-tested, since a real production build cannot be exercised from Vitest).
3. **Unit — `apps/web/src/i18n/i18n.spec.ts`.** No new test; the parity test covers the five new `auth.testUsers.*` keys automatically. Confirm it passes — that is the check that both catalogues were edited.
4. **No store, API, or router test changes.** Nothing in `stores/auth.ts`, `api/auth.ts`, `api/session.ts`, or `router/index.ts` is edited.
5. **No backend test changes.** All 406 must pass untouched.

---

## Verification Steps

1. **Frontend type checking:** from the repo root, `npm run typecheck`. Must exit 0. This is what catches a missing `env.d.ts` member.
2. **Frontend tests:** `npm run test --workspace @crm/web`. Must report at least the previously passing count, all green, plus the new cases.
3. **Frontend lint:** `npm run lint --workspace @crm/web` (`--max-warnings 0`).
4. **Frontend builds:** `npm run build --workspace @crm/web`.
5. **The picker is excluded from the production build — the central claim of this story.** After the build, from the repo root:
   ```bash
   grep -r "dev.admin@crm.local" apps/web/dist/ ; echo "exit: $?"
   grep -r "Development test users" apps/web/dist/ ; echo "exit: $?"
   ```
   Both must find **nothing** (grep exit code 1). If either matches, `import.meta.env.DEV` is not gating what you think it is — stop and fix before proceeding.
6. **No password literal in the source tree:** `grep -rn "ChangeMe_Dev_Only" apps/web/src/` must return nothing. The value belongs in `.env` and `.env.example` only.
7. **Backend untouched:** `git diff --name-only` lists no `apps/api/` path; `npm run test --workspace @crm/api` reports 406 passing.
8. **Prepare the environment:** confirm `apps/api/.env` has `SEED_DEV_USERS=true` and a `SEED_DEV_USER_PASSWORD`, run `npm run prisma:seed` from `apps/api`, then set `VITE_DEV_TEST_USER_PASSWORD` in `apps/web/.env` to the **same** value.
9. **Frontend runs:** `npm run dev:api` and `npm run dev:web` from the repo root; open `http://localhost:5173/login` signed out.
10. **All three personas authenticate:** for each, click Use, confirm the email fills and the password field shows dots (not empty, not plaintext), press Sign in, and confirm you land signed in. Then confirm the navigation matches the role — the administrator sees every sidebar group; `dev.agent@crm.local` sees Work and Records but **not** Users; `dev.customer@crm.local` sees only Dashboard and System Status, because the `customer` role holds zero permissions.
11. **Authorization is genuinely enforced, not just hidden:** signed in as `dev.customer@crm.local`, navigate directly to `/users`. The router guard must redirect (`/forbidden`), and if you reach an API call it must 403. The picker must not have widened anything.
12. **The form is not bypassed:** click Use and do **not** press Sign in. Confirm you are still signed out, no request was made to `/api/auth/login` in the network tab, and the URL is still `/login`.
13. **Missing-password path:** comment out `VITE_DEV_TEST_USER_PASSWORD` in `apps/web/.env`, restart the dev server, reload `/login`. Clicking Use must fill the email, leave the password blank, move focus into the password field, and show the warning. The submit button must stay disabled until a password is typed.
14. **Password is not in the DOM:** with a persona selected, open DevTools and inspect the picker markup and the password input. The value must appear only as the input's bound value — in no attribute, no text node, and no tooltip.
15. **RTL:** switch to Arabic on the login screen (the `LocaleSwitcher` at `LoginView.vue:39–41` works before a session exists). The picker heading, hint, and rows must align right; each email must still read left-to-right; the Use button must sit on the correct side; and the whole card must stay within the viewport.
16. **Responsive:** at 320px and 768px, the picker fits, each row wraps its button below the identity block rather than overflowing, and the page body does not scroll horizontally.
17. **Keyboard:** Tab from the password field into the picker, activate a Use button with Enter and with Space, then Tab back to Sign in and submit — all without a mouse.

---

## Done Criteria

- [ ] `apps/web/src/config/devTestUsers.ts` exists, exports three personas covering the System Administrator, Support Agent, and Customer roles, and gates **both** its exports on `import.meta.env.DEV`.
- [ ] The three emails match `devTestUsers` in `apps/api/prisma/seed.ts` exactly, and each file's comment names the other.
- [ ] No password literal exists anywhere under `apps/web/src`; the value comes from `VITE_DEV_TEST_USER_PASSWORD`, typed in `env.d.ts` and documented in `apps/web/.env.example`.
- [ ] A production build contains neither the persona emails nor the picker's strings — both greps in Verification Step 5 find nothing.
- [ ] The login page lists each persona with its full name, its role via the existing `role.<key>` key, and its email; each has a Use button.
- [ ] Clicking Use fills only the email and password refs. It does not call `auth.login`, does not submit the form, and does not navigate — each asserted by a test.
- [ ] With `VITE_DEV_TEST_USER_PASSWORD` unset, the picker fills the email, focuses the password input, and shows a translated warning; it is never hidden or disabled.
- [ ] The prefilled password never appears in the rendered markup; `LoginView.spec.ts`'s existing password assertion passes **unmodified**, and its picker-path counterpart passes too.
- [ ] `LoginView.vue`'s `redirectTarget` open-redirect guard, `autofocus`, both `autocomplete` attributes, both `required` attributes, and the submit `:disabled` expression are unchanged; all 8 original `LoginView` tests pass unmodified.
- [ ] `login__error` is replaced by the shared `.form-error`; `.login__field input` is preserved.
- [ ] `auth.testUsers.*` exists in both catalogues with identical key sets; `i18n.spec.ts` passes.
- [ ] All three personas sign in through the unmodified `POST /api/auth/login`, and each lands with navigation and API authorization matching its role.
- [ ] No file under `apps/api/` is modified; all 406 backend tests pass untouched.
- [ ] `npm run typecheck`, `npm run lint`, `npm run build`, and both test suites pass from the repo root.
- [ ] The picker is fully operable by keyboard and renders correctly at 320px in both `en` and `ar`.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 29.**
