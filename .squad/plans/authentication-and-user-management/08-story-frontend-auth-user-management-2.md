# Story 08 — Frontend: login, protected routes, and the user management screen (Story: 2)

## Prerequisites

- [Story 06 completed](06-story-jwt-authentication-2.md): `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, and `GET /api/auth/me` all working, with the refresh token in an **httpOnly** `crm_refresh` cookie scoped to `Path=/api/auth`.
- [Story 07 completed](07-story-rbac-user-management-api-2.md): the users, roles, departments, and branches API, returning **`403`** (not `401`) when a permission is missing.
- [Story 04 completed](../init-porject/04-story-frontend-vue-connectivity-1.md): Vue 3 + Pinia + vue-router, the `@` → `./src` alias, the `/api` → `localhost:3000` Vite proxy, `apiClient` and `toErrorMessage` in `apps/web/src/api/client.ts`, and the `AppLayout` shell.
- **Both servers must be running** for every verification step: `npm run dev:api` and `npm run dev:web`. The API alone is not enough — the refresh cookie only works through the Vite proxy, which makes the SPA and the API one origin.
- The seeded administrator's password. Several steps sign in as them.

---

## Story Goal

Close work item 2 from the browser: a real sign-in, routes that cannot be reached without a session, a navigation that only shows what the signed-in user may do, and a working user management screen.

User-visible outcomes:

1. Visiting any application route while signed out lands on `/login`, with the intended destination preserved and restored after sign-in.
2. Signing in with the seeded administrator's credentials lands on the dashboard and shows their name in the header.
3. A **page reload keeps the session** — the app silently re-authenticates from the httpOnly cookie before it renders.
4. "Sign out" clears the session server-side and client-side and returns to `/login`; the back button does not restore the app.
5. `/users` lists accounts with search, filters, and pagination, and supports create, edit, role assignment, deactivate/reactivate, and password reset.
6. A `support-agent` signing in sees no "Users" link, and typing `/users` manually gets a clear "not allowed" page rather than a broken screen or a logout.
7. An expired access token is refreshed transparently mid-session — the user notices nothing.

**Not in scope:** self-service password change and forgot-password (no endpoint exists — Story 07 deferred it), department/branch management screens (the API exists; the screens are a follow-up), MFA, and any styling system beyond the CSS custom properties already in `apps/web/src/assets/main.css`.

---

## Product rules (from story)

| Topic | **Decision** | Why |
|---|---|---|
| Access token storage | A **module-level variable** in `apps/web/src/api/session.ts`. Never `localStorage`, never `sessionStorage`, never a non-httpOnly cookie | Story 06's whole design assumes a script cannot read the credential. Persisting it to storage undoes that. |
| Session survival across reload | One **silent refresh** against the httpOnly cookie before the app mounts | The only way to keep a memory-only token *and* survive F5. |
| Concurrent refresh | All callers await **one shared promise** | Story 06's rotation revokes the presented token, and a replay triggers reuse detection that revokes every session. Two parallel refreshes would log the user out. This is not an optimisation; it is a correctness requirement. |
| `401` handling | Refresh **once**, replay the original request, and log out only if the refresh itself fails | A `401` on a protected route mid-session almost always means "access token expired". |
| `403` handling | Show a "not allowed" state. **Never** log out, never refresh | The token is fine; the permission is not. Logging out on `403` produces an infinite sign-in loop. |
| Route protection default | **Deny by default.** Routes opt out with `meta.public: true` | Mirrors the backend's global-guard posture, so a new route is protected before anyone thinks about it. |
| Permission checks in the UI | Advisory only — they hide links and pre-empt dead ends. The **server** is the authority | Hiding a button is UX, not security. Story 07's guards are the enforcement. |

---

## Context — Read These Files First

1. `apps/web/src/api/client.ts` — all 44 lines. You extend this file. `baseURL` falls back to `/api` with `||` (line 5), the 10-second timeout (line 9), the `ApiErrorBody` interface (lines 14–21) which **already matches** the backend envelope, and `toErrorMessage` (lines 24–44) which already handles `string`, `string[]`, timeouts, and no-response. Task 2 adds interceptors; **do not rewrite what is there**.
2. `apps/web/src/api/health.ts` — all 29 lines. The `validateStatus` override at line 25 and the "mirrors the API DTO" comment at line 9 are the house pattern for every API module you add.
3. `apps/web/src/stores/health.ts` — all 31 lines. The **setup-store** shape: `ref` state, `computed` derivations, an async action with `try`/`catch`/`finally`, and a flat return object. `useAuthStore` and `useUsersStore` follow it exactly.
4. `apps/web/src/router/index.ts` — all 34 lines. The `routes` array, the **last-declared** catch-all at lines 16–21, and the `afterEach` title hook at lines 29–32. Task 4 adds a `beforeEach` guard and new routes **before** the catch-all.
5. `apps/web/src/layouts/AppLayout.vue` — all 84 lines. The header at lines 7–9, the `nav[aria-label="Main navigation"]` at lines 12–15, and the `.layout__link.router-link-active` rule at lines 75–78. Task 7 edits the header and the nav; keep every existing class name.
6. `apps/web/src/views/SystemStatusView.vue` — lines 1–63. The four-state render (`loading` / `error` with `role="alert"` / data / empty), the `:disabled` on the action button, and the `status__ok` / `status__error-text` classes. `LoginView` and `UsersView` reuse this vocabulary rather than inventing one.
7. `apps/web/src/assets/main.css` — all 23 lines. The complete token set: `--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-ok`, `--color-error`, `--radius`, `--font-sans`. **Use only these**; do not add hard-coded colours.
8. `apps/web/src/stores/health.spec.ts` — all 116 lines. The `vi.mock('@/api/health')` + `setActivePinia(createPinia())` pattern (lines 6–10, 33–36) and the resolve/reject-controlled-promise technique at lines 81–97 — which is exactly how you test the shared-refresh promise.
9. `apps/web/src/router/index.spec.ts` — all 16 lines. Router tests resolve paths without mounting anything.
10. `apps/web/vite.config.ts` — lines 12–21. `strictPort: true` on 5173 and the `/api` proxy with **no** path rewrite. This proxy is what makes the httpOnly cookie work in development; understand that before debugging any cookie problem.
11. `apps/api/src/auth/dto/current-user.dto.ts` and `apps/api/src/users/dto/user-response.dto.ts` (Stories 06 and 07) — the two shapes task 1's TypeScript interfaces mirror **field for field**.

---

## Backend Tasks

No backend changes required. Every endpoint this story consumes was delivered by Stories 06 and 07. If you find yourself wanting to change the API, stop and confirm with the user — a shape change breaks that story's tests.

---

## Frontend Tasks

### 1 — Auth and user API types

**Create file: `apps/web/src/api/auth.ts`**

```ts
import { apiClient, rawClient } from './client';

/** Mirrors CurrentUserDto in apps/api/src/auth/dto/current-user.dto.ts */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  mustChangePassword: boolean;
  departmentId: string | null;
  branchId: string | null;
  roles: string[];
  permissions: string[];
}

/** Mirrors LoginResponseDto. There is deliberately no refreshToken field: it
 *  lives only in the httpOnly cookie and JavaScript must not be able to read it. */
export interface LoginResponse {
  accessToken: string;
  expiresInSeconds: number;
  tokenType: string;
}

/**
 * login, refresh, and logout all use `rawClient`, NOT `apiClient`.
 * apiClient's response interceptor reacts to 401 by refreshing — pointing it at
 * the refresh endpoint itself would recurse.
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await rawClient.post<LoginResponse>('/auth/login', { email, password });

  return response.data;
}

export async function refreshSession(): Promise<LoginResponse> {
  const response = await rawClient.post<LoginResponse>('/auth/refresh');

  return response.data;
}

export async function logout(): Promise<void> {
  await rawClient.post('/auth/logout');
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await apiClient.get<AuthUser>('/auth/me');

  return response.data;
}
```

**Create file: `apps/web/src/api/users.ts`**

```ts
import { apiClient } from './client';

/** Mirrors OrgUnitRefDto in apps/api/src/users/dto/user-response.dto.ts */
export interface OrgUnitRef {
  id: string;
  key: string;
  name: string;
}

/** Mirrors UserResponseDto. Note what is absent: no password field of any kind. */
export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  department: OrgUnitRef | null;
  branch: OrgUnitRef | null;
  roles: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedUsers {
  items: UserSummary[];
  meta: PaginationMeta;
}

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  roleKey?: string;
  departmentId?: string;
  isActive?: 'true' | 'false';
}

/** Mirrors RoleResponseDto. */
export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissions: string[];
  userCount: number;
}

export interface CreateUserPayload {
  email: string;
  fullName: string;
  password: string;
  roleKeys: string[];
  departmentId?: string;
  branchId?: string;
}

export interface UpdateUserPayload {
  email?: string;
  fullName?: string;
  departmentId?: string | null;
  branchId?: string | null;
}

export async function listUsers(params: ListUsersParams): Promise<PaginatedUsers> {
  const response = await apiClient.get<PaginatedUsers>('/users', { params });

  return response.data;
}

export async function createUser(payload: CreateUserPayload): Promise<UserSummary> {
  const response = await apiClient.post<UserSummary>('/users', payload);

  return response.data;
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<UserSummary> {
  const response = await apiClient.patch<UserSummary>(`/users/${id}`, payload);

  return response.data;
}

export async function setUserStatus(id: string, isActive: boolean): Promise<UserSummary> {
  const response = await apiClient.patch<UserSummary>(`/users/${id}/status`, { isActive });

  return response.data;
}

export async function setUserRoles(id: string, roleKeys: string[]): Promise<UserSummary> {
  const response = await apiClient.put<UserSummary>(`/users/${id}/roles`, { roleKeys });

  return response.data;
}

export async function resetUserPassword(id: string, password: string): Promise<void> {
  await apiClient.post(`/users/${id}/password`, { password });
}

export async function listRoles(): Promise<Role[]> {
  const response = await apiClient.get<Role[]>('/roles');

  return response.data;
}

export async function listDepartments(): Promise<OrgUnitRef[]> {
  const response = await apiClient.get<OrgUnitRef[]>('/departments');

  return response.data;
}
```

`ListUsersParams.isActive` is typed `'true' | 'false'`, matching Story 07's `@IsBooleanString` query field. Sending a real boolean produces `?isActive=false`, which the backend reads correctly — but typing it as `boolean` here invites a `false` that axios drops from the query string entirely. The literal union makes the wire format explicit.

Only **`listDepartments`** is added, not branches: the create/edit form offers a department dropdown, and adding the branch picker without a branch management screen is scope the story does not ask for. Note it in a comment so the omission reads as deliberate.

---

### 2 — Session holder and axios interceptors

**Create file: `apps/web/src/api/session.ts`**

This module exists to break a cycle: the interceptor in `client.ts` needs the token and the refresh routine, while the Pinia store that owns both needs `client.ts`. A tiny dependency-free holder in the middle keeps both imports one-directional.

```ts
/**
 * The access token lives here and nowhere else — a module variable, wiped on
 * page unload by the browser itself. Never persisted: localStorage and
 * sessionStorage are readable by any injected script, which would defeat the
 * httpOnly refresh cookie the backend went to the trouble of setting.
 */
let accessToken: string | null = null;

let handlers: SessionHandlers | null = null;

export interface SessionHandlers {
  /** Resolves to a fresh access token, or null when the session is gone. */
  refresh: () => Promise<string | null>;
  /** Clears client state after an unrecoverable 401. */
  onSessionLost: () => void;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Called once by useAuthStore so the interceptor can reach the store's logic. */
export function registerSessionHandlers(next: SessionHandlers): void {
  handlers = next;
}

export function getSessionHandlers(): SessionHandlers | null {
  return handlers;
}

/** Test-only reset. */
export function resetSession(): void {
  accessToken = null;
  handlers = null;
}
```

**File: `apps/web/src/api/client.ts`**

Keep lines 1–44 as they are, and add to them.

First, `withCredentials` and a second instance:

```ts
export const apiClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
  // Required so the httpOnly crm_refresh cookie is sent. Same-origin in dev via
  // the Vite proxy, cross-origin in a deployment with an absolute base URL.
  withCredentials: true,
});

/**
 * No interceptors. Used by login, refresh, and logout: those must not trigger
 * the 401-refresh logic, or a failed refresh would refresh, recursively.
 */
export const rawClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});
```

Then the request interceptor:

```ts
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
```

Then the response interceptor. This is the most delicate code in the story — read the comments before changing anything:

```ts
interface RetriableConfig extends InternalAxiosRequestConfig {
  _authRetried?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!(error instanceof AxiosError) || error.response?.status !== 401) {
      // 403 lands here and is re-thrown untouched. A missing permission is not
      // a stale token: refreshing would succeed and change nothing, and
      // logging out would trap the user in a sign-in loop.
      return Promise.reject(error);
    }

    const config = error.config as RetriableConfig | undefined;
    const handlers = getSessionHandlers();

    // Retry exactly once. Without this flag a permanently-401 endpoint would
    // refresh and replay forever.
    if (!config || config._authRetried || !handlers) {
      handlers?.onSessionLost();
      return Promise.reject(error);
    }

    config._authRetried = true;

    const token = await handlers.refresh();

    if (!token) {
      handlers.onSessionLost();
      return Promise.reject(error);
    }

    config.headers.Authorization = `Bearer ${token}`;

    return apiClient.request(config);
  },
);
```

Add `AxiosError`, `type InternalAxiosRequestConfig` to the existing `axios` import at line 1, and import `getAccessToken` / `getSessionHandlers` from `./session`.

Finally, extend `toErrorMessage` (lines 24–44) with one branch, placed **before** the `body?.message` check so a `403` reads as a permission problem rather than echoing the raw permission key:

```ts
    if (error.response?.status === 403) {
      const detail = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;

      return detail
        ? `You do not have permission to do this (${detail}).`
        : 'You do not have permission to do this.';
    }
```

**Do not** touch the existing `ECONNABORTED` and no-response branches — Story 04's tests assert their exact strings.

---

### 3 — Auth store

**Create file: `apps/web/src/stores/auth.ts`**

```ts
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
  type AuthUser,
} from '@/api/auth';
import { toErrorMessage } from '@/api/client';
import { getAccessToken, registerSessionHandlers, setAccessToken } from '@/api/session';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isRestored = ref(false);

  /**
   * The single in-flight refresh. Story 06 rotates the refresh token and
   * revokes EVERY session when a consumed token is replayed, so two parallel
   * refreshes would log the user out. Every caller awaits this one promise.
   */
  let refreshInFlight: Promise<string | null> | null = null;

  const isAuthenticated = computed(() => user.value !== null);

  function can(permission: string): boolean {
    return user.value?.permissions.includes(permission) ?? false;
  }

  function canAny(...permissions: string[]): boolean {
    return permissions.some((permission) => can(permission));
  }

  function clear(): void {
    setAccessToken(null);
    user.value = null;
  }

  async function refresh(): Promise<string | null> {
    refreshInFlight ??= (async () => {
      try {
        const tokens = await refreshSession();
        setAccessToken(tokens.accessToken);

        return tokens.accessToken;
      } catch {
        clear();

        return null;
      } finally {
        // Cleared in `finally` so the NEXT expiry starts a fresh refresh
        // rather than resolving instantly from a stale promise.
        refreshInFlight = null;
      }
    })();

    return refreshInFlight;
  }

  async function login(email: string, password: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const tokens = await loginRequest(email, password);
      setAccessToken(tokens.accessToken);
      user.value = await fetchCurrentUser();

      return true;
    } catch (caught) {
      clear();
      error.value = toErrorMessage(caught);

      return false;
    } finally {
      isLoading.value = false;
      isRestored.value = true;
    }
  }

  /**
   * Called once before the app mounts. Trades the httpOnly cookie for an access
   * token. A failure is the normal signed-out case — it must never surface an
   * error to the user.
   */
  async function restore(): Promise<void> {
    if (isRestored.value) {
      return;
    }

    try {
      const token = await refresh();

      if (token) {
        user.value = await fetchCurrentUser();
      }
    } catch {
      clear();
    } finally {
      isRestored.value = true;
    }
  }

  async function logout(): Promise<void> {
    try {
      await logoutRequest();
    } catch {
      // A failed server-side logout must not strand the user in a signed-in
      // UI. Clear locally regardless; the refresh token expires on its own.
    } finally {
      clear();
      error.value = null;
    }
  }

  registerSessionHandlers({ refresh, onSessionLost: clear });

  return {
    user,
    isLoading,
    error,
    isRestored,
    isAuthenticated,
    can,
    canAny,
    login,
    logout,
    refresh,
    restore,
    // Exposed for tests only; components must never read the raw token.
    peekToken: getAccessToken,
  };
});
```

**Details that matter:**

- `refreshInFlight ??= …` is the shared-promise guard. Ten simultaneous `401`s produce **one** `POST /api/auth/refresh`. Test Plan item 3 asserts exactly that, and it is the difference between a working app and one that logs users out under load.
- `refreshInFlight = null` in `finally`, not after the `await`. Leaving it set would make the second expiry resolve instantly with an already-expired token.
- `registerSessionHandlers` is called in the store's **setup body**, so it runs once when the store is first instantiated — which `restore()` in `main.ts` guarantees happens before any component.
- `logout` clears locally even when the request fails. A logout button that can fail is worse than no logout button.
- `isRestored` exists so the router guard can distinguish "not signed in" from "we have not looked yet". Without it, the first navigation races the silent refresh and bounces a signed-in user to `/login`.

---

### 4 — Router: protected routes and the navigation guard

**File: `apps/web/src/router/index.ts`**

Extend the `RouteRecordRaw` meta with a typed module augmentation at the top of the file:

```ts
declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    /** Reachable without a session. Everything else requires one. */
    public?: boolean;
    /** Permission keys the caller needs. Advisory — the API is the authority. */
    permissions?: string[];
  }
}
```

Add three routes **before** the catch-all at lines 16–21 (order matters — the catch-all must stay last):

```ts
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: 'Sign in', public: true },
  },
  {
    path: '/users',
    name: 'users',
    component: () => import('@/views/UsersView.vue'),
    meta: { title: 'Users', permissions: ['users:read'] },
  },
  {
    path: '/forbidden',
    name: 'forbidden',
    component: () => import('@/views/ForbiddenView.vue'),
    meta: { title: 'Not allowed' },
  },
```

Mark the existing `system-status` and `not-found` routes `public: true`? **No** — leave `dashboard` and `system-status` protected, and mark **only** `login` public. `not-found` stays protected too, so an unknown path while signed out sends you to sign in rather than showing a 404 shell to an anonymous visitor.

Add the guard, **before** the existing `afterEach` at lines 29–32:

```ts
router.beforeEach(async (to) => {
  const auth = useAuthStore();

  // First navigation after a hard reload can arrive before main.ts finished
  // restoring. Awaiting here makes the guard correct on its own, independent of
  // the bootstrap order.
  if (!auth.isRestored) {
    await auth.restore();
  }

  if (to.meta.public) {
    // A signed-in user has no business on the sign-in page.
    return auth.isAuthenticated ? { name: 'dashboard' } : true;
  }

  if (!auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  const required = to.meta.permissions ?? [];

  if (required.length > 0 && !required.every((permission) => auth.can(permission))) {
    return { name: 'forbidden' };
  }

  return true;
});
```

Import `useAuthStore` from `@/stores/auth`. **Pinia must be installed on the app before the first navigation** — task 8 handles the ordering; calling `useAuthStore()` with no active Pinia throws `getActivePinia()` was called with no active Pinia.

Returning `{ name: 'forbidden' }` rather than `false` matters: `false` aborts the navigation and leaves the user on the previous page with no explanation, and on a fresh load there is no previous page at all.

---

### 5 — Login view

**Create file: `apps/web/src/views/LoginView.vue`**

A single centred card. Requirements, not a full listing — follow `SystemStatusView.vue`'s structure and class-naming style:

- A `<form>` with `@submit.prevent`, an `<h1>Sign in</h1>`, and `<label for>`-bound `email` (`type="email"`, `autocomplete="username"`, `required`, `autofocus`) and `password` (`type="password"`, `autocomplete="current-password"`, `required`) inputs bound with `v-model`.
- A submit button reading `Sign in`, or `Signing in…` while `auth.isLoading`, and `:disabled="auth.isLoading || !email || !password"`.
- `auth.error` rendered in a `<div role="alert" class="login__error">` — same `role="alert"` convention as `SystemStatusView.vue` line 23, so screen readers announce it.
- On a successful `auth.login(...)`, `router.replace(redirectTarget)` where:

```ts
const redirectTarget = computed(() => {
  const redirect = route.query.redirect;

  // Only same-site paths. An absolute URL here would be an open-redirect: an
  // attacker sends /login?redirect=https://evil.example and harvests the
  // session the moment the user signs in.
  return typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
    ? redirect
    : '/';
});
```

- `router.replace`, not `push`, so the back button does not return to the sign-in page.
- **Never** render the password back, log it, or put it in a query string.
- Do **not** show which of email or password was wrong — the API deliberately returns one message for every failure (Story 06), and the UI must not invent a distinction it does not have.

The `redirect` sanitisation is the security-relevant part of this file. The `startsWith('//')` exclusion is not redundant: `//evil.example` is a protocol-relative URL that the browser treats as absolute.

---

### 6 — Users store and management screen

**Create file: `apps/web/src/stores/users.ts`**

A setup store in the shape of `stores/health.ts`:

- State: `items`, `meta`, `roles`, `departments`, `isLoading`, `error`, and a `filters` ref holding `page`, `pageSize`, `search`, `roleKey`, `isActive`.
- `load()` — calls `listUsers(filters.value)`, writes `items` and `meta`, sets `error` via `toErrorMessage` on failure and **clears `items`** so a stale list is never shown next to an error.
- `loadLookups()` — `listRoles()` and `listDepartments()` in a `Promise.all`, called once. A failure here sets `error` but must **not** prevent the user list rendering; the role filter simply stays empty.
- Actions `create`, `update`, `setStatus`, `setRoles`, `resetPassword` — each returns `boolean` for success, sets `error` on failure, and calls `load()` on success so the list reflects the server rather than a locally patched guess.
- `setSearch(term)` resets `page` to 1 before reloading. Changing a filter without resetting the page is the classic "empty page 5" bug.

**Create file: `apps/web/src/views/UsersView.vue`**

Requirements:

- `onMounted` → `void users.loadLookups(); void users.load();`
- A filter bar: a search input (**debounced ~300 ms**, or an explicit Search button — pick one and be consistent), a role `<select>` populated from `users.roles`, and a status `<select>` offering "All / Active / Inactive" bound to the `'true' | 'false' | ''` union.
- A `<table>` with a `<caption class="sr-only">` and columns: Name, Email, Roles, Department, Status, Last login, Actions. Roles render as the role `name` from the lookup where available, falling back to the raw key.
- Four render states, following `SystemStatusView.vue` lines 21–29: loading (first load only, `isLoading && !items.length`), error (`role="alert"`), **empty** ("No users match these filters."), and the table.
- Pagination: Previous / Next buttons disabled at the bounds, and a "Page X of Y — N total" label read from `meta`.
- Actions per row, each hidden unless the permission is present:
  - **Edit** (`users:write`) — a form for `fullName`, `email`, and department.
  - **Roles** (`roles:assign`) — a multi-select of role keys, submitted as the **complete** set, since the endpoint is a `PUT` that replaces.
  - **Deactivate / Reactivate** (`users:deactivate`) — with a `window.confirm` before deactivating, and **hidden entirely for the signed-in user's own row** because the API rejects self-deactivation with a `400`.
  - **Reset password** (`users:write`) — a password field, with visible copy stating that the user must change it at next sign-in and that **every session for that user is signed out**.
- A **Create user** button and form (`users:write`): email, full name, password, at least one role, optional department. Show the API's `400` validation text verbatim — Story 07's messages already name the failing rule (`password must contain a digit`, `Unknown role key: …`).
- The `system-administrator` role is offered in the role pickers **only** when `auth.can` shows the current user holds it — mirror the server rule instead of letting the user submit a request that is guaranteed to return `403`.

Use `<button type="button">` for anything that is not a form submit. A bare `<button>` inside a `<form>` submits it, which produces the classic "clicking Cancel saves the record" bug.

**Create file: `apps/web/src/views/ForbiddenView.vue`**

An `<h1>Not allowed</h1>`, a sentence explaining that the signed-in account lacks permission for that page, and a `<RouterLink to="/">` back to the dashboard. Follow `NotFoundView.vue`'s eight-line shape. **No sign-out prompt** — the session is valid; only the permission is missing.

---

### 7 — Layout: identity, sign out, permission-aware navigation

**File: `apps/web/src/layouts/AppLayout.vue`**

Keep every existing class name and the `<style scoped>` block; add to it.

- Header (currently lines 7–9): keep `.layout__brand`, and add, right-aligned, the signed-in user's `fullName`, their first role name, and a `<button type="button" class="layout__signout">Sign out</button>` calling `await auth.logout()` then `router.replace({ name: 'login' })`. Render the whole group only `v-if="auth.isAuthenticated"`, so `/login` shows a bare brand bar.
- Navigation (currently lines 12–15): keep the Dashboard and System status links, and add `<RouterLink to="/users" v-if="auth.can('users:read')">Users</RouterLink>`. Render the whole `<nav>` only when authenticated.
- When `auth.user?.mustChangePassword` is true, render a dismissible banner above `<RouterView />`: "Your password was set by an administrator. Ask an administrator to change it for you." That wording is deliberate — **there is no self-service change endpoint** (Story 07 deferred it), so promising a "change password" link would be a dead end. Leave a code comment pointing at the follow-up.
- `.layout__link.router-link-active` (lines 75–78) already highlights the active link; the Users link inherits it with no CSS change.

Add a `.sr-only` utility class to `apps/web/src/assets/main.css` for the table caption — the standard clip-rect pattern, using the existing token style. **Add no colours**; the ten custom properties at lines 2–11 cover everything here.

---

### 8 — Application entry point

**File: `apps/web/src/main.ts`**

All 7 lines are replaced. The **order** is the whole point:

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import AppLayout from './layouts/AppLayout.vue';
import { useAuthStore } from './stores/auth';
import './assets/main.css';

void (async () => {
  const app = createApp(AppLayout);
  const pinia = createPinia();

  app.use(pinia);

  // Pinia first, and the store instantiated before the router: the auth store's
  // setup body registers the axios session handlers, and router.beforeEach
  // calls useAuthStore(). Installing the router first makes the very first
  // navigation run before any of that exists.
  const auth = useAuthStore(pinia);

  // Trade the httpOnly cookie for an access token before anything renders, so a
  // reloaded page does not flash the sign-in screen. Never throws.
  await auth.restore();

  app.use(router);
  await router.isReady();

  app.mount('#app');
})();
```

- The **async IIFE**, not a top-level `await`. Top-level await needs an ESM-only build target; the IIFE works under the existing `apps/web/tsconfig.app.json` and Vite defaults with no config change.
- `await router.isReady()` before `mount` so the first render already has the resolved route, and the guard's redirect does not cause a visible flash of the wrong page.
- Mounting is now asynchronous, so `#app` is briefly empty. Add a minimal `<div id="app">Loading…</div>` placeholder in `apps/web/index.html`; Vue replaces it on mount.

---

## Edge Cases & Failure Modes

- **Hard reload while signed in.** `main.ts` awaits `restore()`, which refreshes from the cookie and re-fetches `/auth/me`, so the app renders already signed in. If it flashes `/login` instead, `restore()` is not being awaited before `app.use(router)`.
- **Hard reload while signed out.** `restore()` gets a `401` from `/auth/refresh`, swallows it, and the guard redirects to `/login`. **No error is shown** — being signed out is not an error.
- **Two requests expiring together.** Both hit the response interceptor, both call `auth.refresh()`, and the `??=` guard means one network call. If the shared promise is removed, the second refresh replays a consumed token, Story 06's reuse detection revokes **every** session, and the user is logged out mid-task. Test Plan item 3 is the guard against a future "simplification".
- **Refresh cookie expired after 7 days.** `/auth/refresh` returns `401`, `refresh()` resolves `null`, the interceptor calls `onSessionLost()`, and the guard sends the user to `/login`. Clean, no loop.
- **`403` from any endpoint.** Re-thrown untouched by the interceptor; `toErrorMessage` renders "You do not have permission to do this (…)". **No refresh, no logout.** Removing the status check from the interceptor's first `if` reintroduces the sign-in loop this design exists to avoid.
- **A permanently-`401` endpoint.** The `_authRetried` flag caps the retry at one, so a misconfigured route produces one refresh and one failure, not an infinite loop.
- **Deep link while signed out**, `/users` → `/login?redirect=%2Fusers` → sign in → `/users`. `router.replace` keeps the sign-in page out of history.
- **Open redirect.** `/login?redirect=https://evil.example` and `/login?redirect=//evil.example` both fall back to `/`. The `startsWith('/')` **and** `!startsWith('//')` pair is what makes that true; dropping either one reopens the hole.
- **Signed-in user navigates to `/login`.** The guard's `public` branch redirects to the dashboard, so there is no way to see a sign-in form while holding a session.
- **User deactivated by an administrator mid-session.** The next request returns `401`, the interceptor refreshes, the refresh also fails (Story 06's `consume` checks `isActive`), and the user lands on `/login`. Roughly one request of delay, not a token lifetime.
- **Role revoked mid-session.** The **server** enforces it immediately, so the API returns `403`. The client's cached `permissions` are now stale and the "Users" link may still show until the next `/auth/me`. Advisory-only UI permissions are exactly why this is cosmetic; clicking through yields a clear `403`, not a broken screen.
- **Administrator resets their own password from `/users`.** Story 07 revokes all of that user's sessions, so the next request `401`s and the app signs them out. The reset dialog's copy must say so.
- **Administrator tries to deactivate themselves.** The button is hidden for their own row, and the API returns `400` if the request is made anyway. Both layers, because the hidden button is UX and the `400` is the guarantee.
- **Last-administrator demotion.** The API returns `400` with the remedy ("Grant the role to another active user first"). Render it verbatim — it is more useful than any generic message.
- **API down while signed in.** `toErrorMessage`'s existing no-response branch (`client.ts` lines 36–38) returns "Cannot reach the API. Is it running on port 3000?" and the user stays signed in. `axios` reports no status, so nothing mistakes it for a `401`.
- **Cookie not set at all in the browser.** Symptom: login succeeds, reload signs you out. Causes, in order of likelihood: the request bypassed the Vite proxy (an absolute `VITE_API_BASE_URL` in `.env`), `withCredentials` missing on the axios instance, or the browser blocking third-party cookies for a cross-origin setup. `apps/web/.env` must keep `VITE_API_BASE_URL` **empty** in development.
- **`npm run preview` after a build.** No proxy exists, so `/api` calls fail and login is impossible. Story 04's Verification Step 12 already documented this for health; it applies to the whole app. Not a regression.
- **`useAuthStore()` before Pinia is installed.** Throws `getActivePinia() was called with no active Pinia`. Caused by importing the store at module scope in `router/index.ts` and having the router installed before Pinia — task 8's ordering is the fix, and the guard's own `await auth.restore()` makes it robust either way.
- **Search term with `%`, `_`, or Arabic text.** Passed as a query parameter and parameterised server-side (Story 07). No client-side escaping needed and none should be added.
- **Debounced search racing the response.** A slow response for `"no"` can land after a fast one for `"nour"`. Guard it by comparing the request's search term with the current filter before writing `items`, or drop the debounce for an explicit Search button. Either is acceptable; leaving the race in place is not.
- **`window.confirm` in tests.** jsdom implements it as a no-op returning `undefined` (falsy), so an unmocked confirm silently cancels the action. Stub it with `vi.spyOn(window, 'confirm').mockReturnValue(true)` in any spec covering deactivation.

---

## Test Plan

1. **Unit — `apps/web/src/api/session.spec.ts`** (new). `setAccessToken` / `getAccessToken` round-trip; `resetSession` clears both the token and the handlers; `getSessionHandlers` returns `null` before registration.
2. **Unit — `apps/web/src/stores/auth.spec.ts`** (new). Follow `apps/web/src/stores/health.spec.ts` lines 1–36: `vi.mock('@/api/auth')`, `setActivePinia(createPinia())` in `beforeEach`, and `resetSession()` too.
   - `login` on success stores the token, sets `user` from `fetchCurrentUser`, leaves `error` null, and makes `isAuthenticated` true.
   - `login` on a rejection clears the token, sets `error`, leaves `user` null, and returns `false`.
   - `login` toggles `isLoading` around the request — use the controlled-promise technique at `health.spec.ts` lines 81–97.
   - `restore` with a successful refresh sets `user` and `isRestored`.
   - `restore` with a rejected refresh sets `isRestored`, leaves `user` null, and leaves **`error` null** — signed out is not an error.
   - `restore` called twice makes only **one** `refreshSession` call.
   - `logout` clears the token and `user` **even when** `logoutRequest` rejects.
   - `can` is false for every permission when `user` is null, true for a held one, false for an unheld one; `canAny` is true when one of several matches.
3. **Unit — same file. The shared-refresh test, and the most important test in this story.** Make `refreshSession` return a promise you control, call `store.refresh()` five times **without awaiting**, resolve it, then await all five. Assert `refreshSession` was called **exactly once** and that all five resolve to the same token. Then, after the first settles, call `refresh()` again and assert a **second** call is made — proving `refreshInFlight` was cleared.
4. **Unit — `apps/web/src/api/client.spec.ts`** (extend the existing file; keep every current test). Use `axios-mock-adapter`, or `vi.spyOn` on the instance's adapter — whichever the existing spec already establishes; read it first and match it.
   - The request interceptor adds `Authorization: Bearer <token>` when a token is set, and omits the header entirely when it is null.
   - A `401` triggers `handlers.refresh()` once and replays the original request with the **new** token.
   - A `401` whose refresh resolves `null` calls `onSessionLost` and rejects.
   - A **`403`** calls neither `refresh` nor `onSessionLost` and rejects with the original error. Assert both spies have zero calls.
   - A second `401` on the same config (`_authRetried` already set) does **not** refresh again.
   - `toErrorMessage` returns the permission wording for a `403` body, and its existing outputs are unchanged for `string`, `string[]`, `ECONNABORTED`, no-response, and non-`Error` inputs.
5. **Unit — `apps/web/src/router/index.spec.ts`** (extend; keep the three existing tests). Router guard tests need an active Pinia and a mocked auth store.
   - `/login`, `/users`, and `/forbidden` resolve to the `login`, `users`, and `forbidden` route names.
   - The catch-all still resolves last: `/nope` → `not-found`.
   - Signed out, navigating to `/users` redirects to `login` with `query.redirect === '/users'`.
   - Signed in **without** `users:read`, `/users` redirects to `forbidden`.
   - Signed in **with** `users:read`, `/users` resolves to `users`.
   - Signed in, `/login` redirects to `dashboard`.
   - `document.title` still updates via the existing `afterEach`.
6. **Component — `apps/web/src/views/LoginView.spec.ts`** (new). Mount with `@vue/test-utils` and a mocked auth store.
   - Renders email and password inputs and a disabled submit button when both are empty.
   - Submitting calls `auth.login` with the typed values.
   - A failed login renders `auth.error` inside `[role="alert"]`.
   - A successful login calls `router.replace` with `'/'` by default.
   - With `?redirect=/users`, replace is called with `'/users'`.
   - With `?redirect=https://evil.example`, and again with `?redirect=//evil.example`, replace is called with `'/'`. **The open-redirect regression test.**
   - The rendered HTML never contains the typed password outside the `input`'s bound value.
7. **Component — `apps/web/src/layouts/AppLayout.spec.ts`** (extend the existing spec; keep its current assertions). With a mocked auth store:
   - Signed out: no `<nav>`, no sign-out button, brand still visible.
   - Signed in with `users:read`: the Users link is rendered.
   - Signed in without `users:read`: it is **not**.
   - The sign-out button calls `auth.logout` and then `router.replace({ name: 'login' })`.
   - `mustChangePassword: true` renders the banner; false does not.
8. **Component — `apps/web/src/views/UsersView.spec.ts`** (new). Mock `@/api/users` and the auth store.
   - Renders one table row per item, showing name, email, and roles.
   - Renders the empty state for `items: []` and no error.
   - Renders `[role="alert"]` when the store has an error, and no table.
   - Previous is disabled on page 1; Next is disabled on the last page.
   - Changing the role filter resets `page` to 1 and calls `load`.
   - Edit / Roles / Deactivate / Reset password controls are absent for a caller with only `users:read`, and present with the matching permissions.
   - The deactivate control is absent on the signed-in user's **own** row.
   - `system-administrator` is absent from the role picker for a non-administrator caller.
   - Deactivation calls the store action only when `window.confirm` is stubbed to `true`, and not when stubbed to `false`.
9. **Unit — `apps/web/src/stores/users.spec.ts`** (new). Mock `@/api/users`.
   - `load` populates `items` and `meta`; a rejection sets `error` **and clears `items`**.
   - `setSearch` resets `page` to 1.
   - `loadLookups` failing still leaves `items` renderable from a prior `load`.
   - `create`, `setStatus`, and `setRoles` each call `load` again on success, and none of them do on failure.
10. **No new backend tests.** Story 07's e2e suite already covers every endpoint this story consumes; re-asserting them from the frontend workspace would duplicate coverage without adding signal.
11. **No end-to-end browser test.** Consistent with the init-porject overview's recorded exclusion. The browser path is covered manually by Verification Steps 6–15.

---

## Verification Steps

1. **Frontend type-checks:** from `apps/web`, run `npm run typecheck`. Expect exit code 0. `noUnusedLocals` and `noUnusedParameters` are on (`tsconfig.app.json`), so an unused import fails here.
2. **Frontend lints:** from `apps/web`, run `npm run lint`. Expect exit code 0 with `--max-warnings 0`.
3. **Frontend tests:** from `apps/web`, run `npm test`. Expect every spec green and the process to **exit** rather than watch.
4. **Frontend builds:** from `apps/web`, run `npm run build`. Expect `vue-tsc` clean and `apps/web/dist/index.html` written.
5. **No token in web storage — check this before anything else.** Grep `apps/web/src` for `localStorage` and `sessionStorage`. Expect **zero** matches. This is the security property the whole design rests on.
6. **Signed-out redirect:** with both dev servers running, open `http://localhost:5173/users` in a fresh private window. Expect a redirect to `/login?redirect=%2Fusers` and the sign-in form.
7. **Sign in:** submit the seeded administrator's email and password. Expect a redirect to `/users` (the preserved destination), the header showing their name, and a "Users" link in the sidebar.
8. **Session survives reload:** press F5 on `/users`. Expect the page to come back **signed in**, with no flash of the sign-in form. In the Network tab, expect exactly one `POST /api/auth/refresh` returning `200` and one `GET /api/auth/me`.
9. **The cookie is httpOnly:** in DevTools → Application → Cookies, find `crm_refresh`. Expect **HttpOnly** ticked, `Path=/api/auth`, and `SameSite=Lax`. Then run `document.cookie` in the console — expect `crm_refresh` **not** to appear.
10. **Wrong password:** sign out, then submit a bad password. Expect the `role="alert"` block reading "Invalid email or password." and **no** redirect. Confirm the form does not reveal whether the email exists.
11. **User management works:** as the administrator on `/users`, in order — create a user (`support-agent`, a 12+ character password with a digit); find them with the search box; open Edit and change the full name; open Roles and add `reporting-user`; reset their password; deactivate them; reactivate them. Expect every action to succeed and the list to refresh. **This is the acceptance criterion "Users can be created and managed by an administrator."**
12. **Validation errors surface:** try to create a user with the password `short1`. Expect the API's own message about the minimum length, rendered in the form. Then reuse an existing email — expect the `409` conflict text.
13. **Self-protection:** confirm your own row has **no** Deactivate control. Then, as a second administrator, try to deactivate the only other administrator — expect the `400` explaining that the role must be granted to another active user first.
14. **Protected routes for a restricted account:** sign out, sign in as the `support-agent` created in step 11. Expect **no** "Users" link. Type `http://localhost:5173/users` directly — expect the **"Not allowed"** page, and confirm you are **still signed in** (the header still shows your name, and `/system-status` still works). **This is the acceptance criterion "Vue protected routes work correctly."**
15. **Transparent refresh:** sign in, then temporarily set `JWT_ACCESS_TTL=60s` in `apps/api/.env` and restart the API. Sign in again, wait 70 seconds, then click "Users". Expect the page to load normally, and the Network tab to show one `401`, one `POST /api/auth/refresh` → `200`, and the original request replayed → `200`. **Restore `JWT_ACCESS_TTL=15m` afterwards.**
16. **Sign out:** click "Sign out". Expect a redirect to `/login`, the `crm_refresh` cookie gone from DevTools, and the browser **back** button not restoring the app — it must bounce back to `/login`.
17. **API down while signed in:** stop the API and click "Users". Expect "Cannot reach the API. Is it running on port 3000?" and to remain signed in — **not** a forced sign-out. Restart the API and retry; expect full recovery.
18. **Only one refresh under concurrency:** in the console on a signed-in page, fire several `/api/users` requests at once after the access token has expired (reuse the short-TTL setup from step 15). Expect exactly **one** `POST /api/auth/refresh` in the Network tab and no sign-out.
19. **Regression:** `/system-status` still shows API "Healthy" and Database "Connected" while signed in. `/nope` while signed in still shows "Page not found". `document.title` still updates on every navigation.
20. **Regression:** from the repo root, run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`. All four green across both workspaces.
21. **Regression:** from `apps/api`, run `npm test` and `npm run test:e2e`. Both green — this story changed no backend file, so a failure here means something was edited that should not have been.

---

## Done Criteria

- [ ] `apps/web/src/api/session.ts` holds the access token in a **module variable**; a grep for `localStorage` and `sessionStorage` across `apps/web/src` returns **zero** matches.
- [ ] `apps/web/src/api/auth.ts` and `apps/web/src/api/users.ts` mirror `CurrentUserDto`, `LoginResponseDto`, `UserResponseDto`, and `RoleResponseDto` field for field, and no interface declares a refresh token.
- [ ] `apiClient` sets `withCredentials: true`; `rawClient` exists with **no** interceptors and is what `login`, `refreshSession`, and `logout` use.
- [ ] The request interceptor attaches `Authorization: Bearer …` only when a token is held.
- [ ] The response interceptor refreshes on `401` **once** per request (guarded by `_authRetried`), replays with the new token, and calls `onSessionLost` when the refresh fails.
- [ ] A **`403`** neither refreshes nor signs the user out, and `toErrorMessage` renders it as a permission message.
- [ ] `toErrorMessage`'s existing outputs for `string`, `string[]`, `ECONNABORTED`, no-response, and non-`Error` inputs are unchanged, and Story 04's tests for them still pass.
- [ ] `useAuthStore` exposes `user`, `isLoading`, `error`, `isRestored`, `isAuthenticated`, `can`, `canAny`, `login`, `logout`, `refresh`, and `restore`.
- [ ] **All concurrent refreshes share one promise**, the promise is cleared in `finally`, and the test in Test Plan item 3 proves both halves.
- [ ] `restore()` swallows a failed refresh, leaves `error` **null**, and sets `isRestored`; calling it twice makes one network call.
- [ ] `logout()` clears local state even when the server call fails.
- [ ] The router declares `login` (`public: true`), `users` (`permissions: ['users:read']`), and `forbidden`, all **before** the catch-all, which is still last.
- [ ] `beforeEach` awaits `restore()` when needed, redirects signed-out users to `login` with a `redirect` query, redirects signed-in users away from `login`, and sends permission failures to `forbidden` — never `return false`.
- [ ] The `redirect` query is sanitised: only paths starting with `/` and not `//` are honoured, verified by the two open-redirect tests.
- [ ] `LoginView.vue` uses `router.replace`, shows `auth.error` in `[role="alert"]`, disables submit while loading, and never reveals whether the email or the password was wrong.
- [ ] `UsersView.vue` renders loading, error, empty, and table states; supports search, role filter, status filter, and pagination with bounds-disabled buttons; and offers create, edit, roles, deactivate/reactivate, and reset-password behind their respective permissions.
- [ ] The deactivate control is hidden on the signed-in user's own row, and `system-administrator` is absent from the role picker for a non-administrator.
- [ ] `AppLayout.vue` shows the user's name and a working sign-out only when authenticated, hides the Users link without `users:read`, keeps every existing class name, and shows the `mustChangePassword` banner with copy that does **not** promise a self-service change screen.
- [ ] `main.ts` installs Pinia, instantiates the auth store, `await`s `restore()`, then installs the router and `await`s `router.isReady()` before mounting — inside an async IIFE, with a placeholder in `index.html`.
- [ ] A reload while signed in does **not** flash the sign-in screen.
- [ ] The `crm_refresh` cookie is `HttpOnly`, `Path=/api/auth`, `SameSite=Lax`, and invisible to `document.cookie`.
- [ ] A `support-agent` typing `/users` sees "Not allowed" and **stays signed in**.
- [ ] An expired access token is refreshed transparently, with exactly one refresh call under concurrency.
- [ ] All tests in the Test Plan exist and pass; from the repo root `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` are green across both workspaces.
- [ ] No backend file was modified, and `apps/api`'s unit and e2e suites still pass.

---

**All four stories for work item 2 are now complete.** The work item's acceptance criteria map to Verification Steps 7 (login), 9 and 5 (token handled securely), 14 (protected routes), 11 (administrator manages users), and Story 07's Verification Steps 6 and 7 (protected APIs reject unauthorized requests; roles and permissions enforced).

**STOP HERE. Report to the user.**
