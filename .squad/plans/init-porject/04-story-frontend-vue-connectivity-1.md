# Story 04 — Frontend Vue 3: router, Pinia, API client, layout and end-to-end connectivity (Story: 1)

## Prerequisites

- [Story 01 completed](01-story-workspace-scaffolding-1.md): npm workspaces monorepo, an **empty** `apps/web/` directory, `apps/web/.env.example` declaring `VITE_API_BASE_URL`, and root `.editorconfig` / `.prettierrc.json`.
- [Story 02 completed](02-story-backend-api-bootstrap-1.md): API serving `GET /api/health` on port 3000 with the global `api` prefix and the `AllExceptionsFilter` error envelope.
- [Story 03 completed](03-story-prisma-postgres-migration-1.md): `GET /api/health` returns a `database` block and **`503`** when PostgreSQL is down. This story's UI renders both states, so the response contract from Story 03 task 8 must be final before starting.
- The workspace package name **`@crm/web`** is a shared contract with the root `dev:web` script (`npm run dev --workspace @crm/web`) defined in Story 01, task 2.
- **The API must be running** for the connectivity verification. Start it with `npm run dev:api` in a separate terminal.

---

## Story Goal

Stand up the Vue 3 frontend and close the loop the work item's demo requires: a request that starts in the browser, travels through the API, touches PostgreSQL, and renders in the UI.

User-visible outcomes:

1. `npm run dev:web` serves the app at `http://localhost:5173`.
2. A persistent application shell with a header and sidebar navigation is visible on every route.
3. Navigating between "Dashboard" and "System status" works without a full page reload.
4. The "System status" page shows live API health — service name, environment, uptime, and the **PostgreSQL** status with its latency — fetched through the API client and held in a Pinia store.
5. When the API or the database is down, the page shows a clear failure state instead of a blank screen or a console error.

**Not in scope:** authentication, any CRM domain screens (ticket lists, customer records), a component library or design system, and internationalization. This story delivers the shell and the proven connectivity path that later work items build screens on top of.

---

## Context — Read These Files First

1. [Story 03 plan](03-story-prisma-postgres-migration-1.md) — **task 8** is the response contract this story consumes. Read `HealthResponseDto` and `DatabaseHealthDto` field by field: `status`, `service`, `version`, `environment`, `uptimeSeconds`, `timestamp`, and `database.{status,latencyMs,message?}`. The TypeScript types in task 5 below must mirror it exactly.
2. `apps/api/src/health/dto/health-response.dto.ts` — the whole file. This is the source of truth; prefer reading it over trusting the plan text if the two ever disagree.
3. [Story 02 plan](02-story-backend-api-bootstrap-1.md) — **task 5**, the `ErrorResponseBody` shape. Note `message` is typed **`string | string[]`**; the error handling in task 5 below must tolerate both.
4. `package.json` (repo root) — the `dev:web` script and the `--workspaces --if-present` fan-out determine the script names `apps/web/package.json` must expose: **`dev`**, **`build`**, **`test`**, **`lint`**, **`typecheck`**.
5. `apps/web/.env.example` — created by Story 01. Read the comment: `VITE_API_BASE_URL` is intentionally **empty** in development so requests flow through the Vite dev proxy configured in task 3.
6. `.prettierrc.json` and `.editorconfig` (repo root) — `singleQuote: true`, `printWidth: 100`, `indent_size = 2`, LF endings. The Vite scaffolder writes its own `.prettierrc`; task 2 deletes it.
7. After scaffolding, read the generated `apps/web/src/main.ts`, `apps/web/src/App.vue`, and `apps/web/vite.config.ts` (all small) before editing — you replace all three.

---

## Backend Tasks

**No backend changes required.** This story consumes the `/api/health` contract exactly as Story 03 left it. If a field turns out to be missing, change it in Story 03's files and update that plan's Done Criteria rather than working around it here.

---

## Frontend Tasks

### 1 — Scaffold the Vite application

Run from **`apps/`** (not the repo root — the scaffolder creates a directory named after its argument):

```bash
npm create vite@latest web -- --template vue-ts
```

This writes into the empty `apps/web/` from Story 01. If the tool prompts to install dependencies, **decline** — installing here creates a nested `apps/web/node_modules` and defeats workspace hoisting. Install from the root in task 2.

The `vue-ts` template is required, not `vue`. It supplies `tsconfig.app.json`, `tsconfig.node.json`, and `vue-tsc`, which the `typecheck` script depends on.

---

### 2 — Fix up the generated manifest

**File: `apps/web/package.json`**

- Set `"name": "@crm/web"` — **required** by the root `dev:web` script.
- Set `"private": true`.
- Keep the generated `dev`, `build`, and `preview` scripts.
- **Add** `"typecheck": "vue-tsc --noEmit -p tsconfig.app.json"`. Note it targets **`tsconfig.app.json`**, not `tsconfig.json` — in the `vue-ts` template the root `tsconfig.json` is a solution file holding only `references`, so `--noEmit -p tsconfig.json` checks nothing and passes vacuously.
- **Add** `"test": "vitest run"` and `"test:watch": "vitest"`. The root `npm test` needs the non-watch form; a watch-mode default would hang CI forever.
- **Add** `"lint": "eslint . --max-warnings 0"`.

Delete `apps/web/.prettierrc` and `apps/web/.gitignore` if the scaffolder wrote them — the root config and ignore rules from Story 01 govern the monorepo.

Install dependencies from the **repo root**:

```bash
npm install --workspace @crm/web vue-router pinia axios
npm install --workspace @crm/web --save-dev vitest jsdom @vue/test-utils @vitejs/plugin-vue eslint eslint-plugin-vue typescript-eslint
```

- `vue-router` and `pinia` are the routing and state requirements named in the work item.
- `axios` gives one place to configure `baseURL`, timeouts, and interceptors. `fetch` would push that wiring into every call site.
- `vitest` + `jsdom` + `@vue/test-utils` are the test stack. Vitest reuses the Vite config, so there is no second build pipeline to maintain.
- `@vitejs/plugin-vue` is usually already present from the template; the explicit install is harmless and guards against a template change.

Then run `npm install` at the root to refresh the lockfile.

---

### 3 — Vite configuration: proxy, alias, test environment

**File: `apps/web/vite.config.ts`**

Replace the generated contents.

```ts
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.spec.ts'],
  },
});
```

Details that matter:

- **The proxy key `/api` must not be rewritten.** The backend already serves under the `api` global prefix (Story 02, task 8), so `/api/health` in the browser must arrive as `/api/health` at the API. Adding a `rewrite` that strips `/api` produces a `404`.
- **`strictPort: true`** makes Vite fail rather than silently move to 5174. A silent shift breaks the API's `CORS_ORIGINS` allowlist, which names 5173 explicitly.
- **The proxy is why CORS is not needed in development** — the browser sees a same-origin request to `localhost:5173`. The API's `enableCors` still matters for deployed environments where the two are on different origins.
- **`test` inside `vite.config.ts`** avoids a second `vitest.config.ts`. TypeScript may flag the `test` key as unknown; fix it with the reference in task 4, not by casting to `any`.
- The `@` alias must be declared here **and** as a `paths` entry in `tsconfig.app.json` (task 4). Vite resolves the bundle; TypeScript resolves the editor and `vue-tsc`. Only one of the two configured means imports work at runtime but fail type-checking, or vice versa.

---

### 4 — TypeScript configuration and env typing

**File: `apps/web/tsconfig.app.json`**

Add the alias to `compilerOptions` so `vue-tsc` and the editor resolve `@/...`:

```jsonc
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

Keep every option the template already set; add these rather than replacing the block.

**File: `apps/web/tsconfig.node.json`**

Add `"types": ["vitest"]` to `compilerOptions` so the `test` key in `vite.config.ts` type-checks. If the template's `include` does not already list `vite.config.ts`, add it.

**Create file: `apps/web/src/env.d.ts`**

Type the environment variables so a typo becomes a compile error.

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

If the template already generated `apps/web/src/vite-env.d.ts`, add the two interfaces there instead of creating a second file — two files both declaring `ImportMetaEnv` is a duplicate-identifier error.

Copy the env file so the dev server has one:

```bash
cp apps/web/.env.example apps/web/.env
```

---

### 5 — API client

**Create file: `apps/web/src/api/client.ts`**

```ts
import axios, { AxiosError, type AxiosInstance } from 'axios';

/**
 * Empty VITE_API_BASE_URL means "use the Vite dev proxy", which forwards
 * /api to the backend on port 3000. Deployed builds set an absolute URL.
 */
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

/** Error envelope produced by the API's AllExceptionsFilter (Story 02). */
export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
  requestId?: string;
}

/** Normalizes any thrown value into a single human-readable message. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined;

    if (body?.message) {
      return Array.isArray(body.message) ? body.message.join(', ') : body.message;
    }

    if (error.code === 'ECONNABORTED') {
      return 'The request timed out. Is the API running?';
    }

    if (!error.response) {
      return 'Cannot reach the API. Is it running on port 3000?';
    }

    return error.message;
  }

  return error instanceof Error ? error.message : 'Unexpected error';
}
```

- **`import.meta.env.VITE_API_BASE_URL || '/api'`** uses `||`, not `??`, on purpose. Vite substitutes an unset variable as the **empty string**, not `undefined`, and `??` would let `''` through and produce request URLs like `/health`.
- **`toErrorMessage` handles the `string[]` case** because `ValidationPipe` returns per-field message arrays (Story 02, task 8). Rendering the raw array yields `"[object Object]"` in the UI.
- **The no-`response` branch is the one users actually hit** during this story's demo — API not started. A generic "Network Error" would send a developer hunting in the wrong place.
- Do not add an auth interceptor here. There is no authentication yet, and a placeholder that reads a non-existent token is dead code.

**Create file: `apps/web/src/api/health.ts`**

```ts
import { apiClient } from './client';

export interface DatabaseHealth {
  status: 'up' | 'down';
  latencyMs: number;
  message?: string;
}

/** Mirrors HealthResponseDto in apps/api/src/health/dto/health-response.dto.ts */
export interface HealthResponse {
  status: 'ok' | 'error';
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
  database: DatabaseHealth;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>('/health', {
    // The API answers 503 with a full, useful body when the database is down
    // (Story 03, task 8). Accept it so the UI can render the failure detail
    // instead of collapsing it into a generic network error.
    validateStatus: (status) => status === 200 || status === 503,
  });

  return response.data;
}
```

**The `validateStatus` override is the critical line in this file.** By default axios rejects on `503`, which would discard the response body — exactly the body that says *why* the service is unhealthy. Without this, the "database down" state in task 8 cannot be rendered.

Note the path is `'/health'`, not `'/api/health'` — `/api` comes from the client's `baseURL`. Doubling it yields `/api/api/health` and a `404`.

---

### 6 — Pinia store

**Create file: `apps/web/src/stores/health.ts`**

```ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { fetchHealth, type HealthResponse } from '@/api/health';
import { toErrorMessage } from '@/api/client';

export const useHealthStore = defineStore('health', () => {
  const data = ref<HealthResponse | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lastCheckedAt = ref<string | null>(null);

  const isHealthy = computed(() => data.value?.status === 'ok');
  const isDatabaseUp = computed(() => data.value?.database.status === 'up');

  async function load(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      data.value = await fetchHealth();
    } catch (caught) {
      data.value = null;
      error.value = toErrorMessage(caught);
    } finally {
      isLoading.value = false;
      lastCheckedAt.value = new Date().toISOString();
    }
  }

  return { data, isLoading, error, lastCheckedAt, isHealthy, isDatabaseUp, load };
});
```

- Written in the **setup-store** style (a function body), which types better under `strict` than the options style and matches the Composition API used in the components below. Stay consistent across future stores.
- `data` is cleared on failure so the UI cannot show stale health next to an error banner.
- `error` holds an already-normalized **string**, so components never re-parse an axios error.
- `lastCheckedAt` is set in `finally`, so it updates on success and failure alike.
- No polling. `load()` is called on mount and by an explicit "Refresh" button. A background interval here would defeat the API's health-log filter (Story 02, task 7) if that predicate is ever widened, and it hides connectivity problems the demo is meant to expose.

---

### 7 — Router

**Create file: `apps/web/src/router/index.ts`**

```ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { title: 'Dashboard' },
  },
  {
    path: '/system-status',
    name: 'system-status',
    component: () => import('@/views/SystemStatusView.vue'),
    meta: { title: 'System status' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: 'Not found' },
  },
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? 'Customer Support CRM';
  document.title = `${title} · Customer Support CRM`;
});

export default router;
```

- **`createWebHistory`**, not `createWebHashHistory` — clean URLs. This requires the production host to serve `index.html` for unknown paths; note it in the deployment story.
- **The `/:pathMatch(.*)*` catch-all must be last.** vue-router matches in order, so placing it earlier swallows every route.
- Lazy `() => import(...)` components keep the initial bundle small and set the pattern for the domain screens that follow.
- `meta.title` plus one `afterEach` hook handles document titles in a single place rather than per-view.

---

### 8 — Layout, views, and styles

**Create file: `apps/web/src/assets/main.css`**

Plain CSS with custom properties — no framework, per the out-of-scope note.

```css
:root {
  --color-bg: #f6f7f9;
  --color-surface: #ffffff;
  --color-border: #e2e5ea;
  --color-text: #1c2430;
  --color-text-muted: #64707f;
  --color-accent: #2b5cd9;
  --color-ok: #1c8a4a;
  --color-error: #c2331f;
  --radius: 8px;
  --font-sans: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-bg);
}
```

**Create file: `apps/web/src/layouts/AppLayout.vue`**

The persistent shell: header, sidebar nav, and a `<router-view />` outlet.

```vue
<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <div class="layout">
    <header class="layout__header">
      <span class="layout__brand">Customer Support CRM</span>
    </header>

    <div class="layout__body">
      <nav class="layout__nav" aria-label="Main navigation">
        <RouterLink to="/" class="layout__link">Dashboard</RouterLink>
        <RouterLink to="/system-status" class="layout__link">System status</RouterLink>
      </nav>

      <main class="layout__main">
        <RouterView />
      </main>
    </div>
  </div>
</template>
```

Add scoped styles for a fixed-width sidebar and a flexible main area. Two requirements:

- **`aria-label="Main navigation"`** on the `<nav>` — the accessibility test in Test Plan item 5 queries it, and a screen reader needs it to distinguish multiple landmarks.
- Style the active link using vue-router's automatic **`.router-link-active`** class. Do not hand-roll active detection from `useRoute()`.

**Create file: `apps/web/src/views/DashboardView.vue`**

A placeholder that states plainly what the bootstrap delivered and links to the status page. Use a `<h1>` reading "Dashboard". Do **not** invent metric tiles or fake ticket counts — placeholder data that looks real gets mistaken for a working feature during the demo.

**Create file: `apps/web/src/views/NotFoundView.vue`**

An `<h1>` reading "Page not found" and a `<RouterLink to="/">` back to the dashboard.

**Create file: `apps/web/src/views/SystemStatusView.vue`**

This view is the acceptance criterion "Vue can call the API successfully" — it must render all four states: loading, error, healthy, and database-down.

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useHealthStore } from '@/stores/health';

const health = useHealthStore();

onMounted(() => {
  void health.load();
});
</script>

<template>
  <section>
    <header class="status__header">
      <h1>System status</h1>
      <button type="button" :disabled="health.isLoading" @click="health.load()">
        {{ health.isLoading ? 'Checking…' : 'Refresh' }}
      </button>
    </header>

    <p v-if="health.isLoading && !health.data">Checking API…</p>

    <div v-else-if="health.error" role="alert" class="status__error">
      <strong>Cannot reach the API.</strong>
      <p>{{ health.error }}</p>
      <p>Start it with <code>npm run dev:api</code> from the repository root.</p>
    </div>

    <dl v-else-if="health.data" class="status__list">
      <dt>API</dt>
      <dd>{{ health.isHealthy ? 'Healthy' : 'Degraded' }}</dd>

      <dt>Service</dt>
      <dd>{{ health.data.service }}</dd>

      <dt>Version</dt>
      <dd>{{ health.data.version }}</dd>

      <dt>Environment</dt>
      <dd>{{ health.data.environment }}</dd>

      <dt>Uptime</dt>
      <dd>{{ health.data.uptimeSeconds }} s</dd>

      <dt>Database</dt>
      <dd>
        {{ health.isDatabaseUp ? 'Connected' : 'Unavailable' }}
        ({{ health.data.database.latencyMs }} ms)
      </dd>

      <template v-if="health.data.database.message">
        <dt>Database error</dt>
        <dd>{{ health.data.database.message }}</dd>
      </template>
    </dl>

    <p v-if="health.lastCheckedAt" class="status__meta">
      Last checked {{ new Date(health.lastCheckedAt).toLocaleTimeString() }}
    </p>
  </section>
</template>
```

- **`v-if="health.isLoading && !health.data"`** shows the spinner only on the first load. On a refresh the previous values stay on screen instead of flashing to a placeholder.
- **`role="alert"`** on the error block so assistive technology announces it.
- The **`database.message`** row is what makes the `validateStatus` override in task 5 pay off — the driver's reason reaches the user.
- The error copy names the exact command to run. During a bootstrap demo, "API not started" is the most common cause by a wide margin.

Add scoped styles using the `--color-ok` and `--color-error` custom properties for the API and Database values.

---

### 9 — Application entry point

**File: `apps/web/src/main.ts`**

Replace the generated contents.

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import AppLayout from './layouts/AppLayout.vue';
import './assets/main.css';

createApp(AppLayout).use(createPinia()).use(router).mount('#app');
```

**File: `apps/web/src/App.vue`**

Delete it. `AppLayout.vue` is the root component. Also delete the scaffolded `apps/web/src/components/HelloWorld.vue` and `apps/web/src/style.css` — `main.css` replaces the latter.

**Order matters:** `createPinia()` must be installed **before** `router`. A route component that calls `useHealthStore()` during setup throws "getActivePinia was called with no active Pinia" if the router is installed first.

---

## Edge Cases & Failure Modes

- **API not running.** Trigger: open `/system-status` with no backend. Expected: axios rejects with no `response`, `toErrorMessage` in `apps/web/src/api/client.ts` (task 5) returns "Cannot reach the API. Is it running on port 3000?", and the `role="alert"` block renders. **Not** a blank page or a console-only error.
- **Database down, API up.** Trigger: stop PostgreSQL, keep the API running. Expected: `GET /api/health` returns **`503`** with a full body; `validateStatus` in task 5 accepts it; the store fills `data` (**not** `error`); the view shows API "Degraded", Database "Unavailable", and the driver message. Getting this wrong — by dropping `validateStatus` — turns a precise diagnosis into "Cannot reach the API", which is the single most misleading outcome this story can produce.
- **`validateStatus` omitted.** Trigger: the default axios behaviour. Expected failure mode: every `503` becomes a generic error and the `database.message` row never renders. If the down-state test in Test Plan item 3 fails, check this first.
- **Doubled `/api` prefix.** Trigger: calling `apiClient.get('/api/health')` while `baseURL` is already `/api`. Expected: `404` from the API with the JSON error envelope. Enforced by the note in task 5.
- **Proxy path rewritten.** Trigger: adding `rewrite: (path) => path.replace(/^\/api/, '')` to `apps/web/vite.config.ts`. Expected: `404`, because the backend genuinely serves under `/api` (Story 02, task 8). The proxy must forward the path untouched.
- **`VITE_API_BASE_URL` set but empty.** Trigger: the default `apps/web/.env`. Expected: `||` falls back to `/api`. Using `??` instead lets `''` through and produces `/health`, which the dev proxy does not match and Vite answers with `index.html` — so axios receives **HTML with a `200`** and JSON parsing fails confusingly. This is why task 5 specifies `||`.
- **Variable missing the `VITE_` prefix.** Trigger: renaming it to `API_BASE_URL`. Expected: Vite does not expose it to client code, so it is `undefined` at runtime and the fallback silently applies. Every browser-visible variable must keep the `VITE_` prefix.
- **Port 5173 already taken.** Trigger: another Vite dev server. Expected: `strictPort: true` (task 3) makes Vite **fail** rather than move to 5174. A silent shift breaks the API's `CORS_ORIGINS` allowlist, which names 5173.
- **Pinia installed after the router.** Trigger: reordering the chain in `apps/web/src/main.ts` (task 9). Expected: "getActivePinia was called with no active Pinia" thrown from `SystemStatusView`'s setup. The order is load-bearing.
- **Catch-all route placed first.** Trigger: moving `/:pathMatch(.*)*` above the other entries in `apps/web/src/router/index.ts` (task 7). Expected: every URL renders "Page not found". vue-router matches in declaration order.
- **Deep link `404` in production.** Trigger: reloading `/system-status` on a static host with no SPA fallback. Expected: the host's own `404`, because `createWebHistory` needs `index.host` rewriting. Out of scope for this story — the dev server handles it automatically — but it **will** bite on first deployment. Recorded here so the deployment story does not rediscover it.
- **Slow API.** Trigger: a response taking over 10 seconds. Expected: the axios `timeout: 10_000` fires and `toErrorMessage` returns the `ECONNABORTED` message. A health probe that hangs indefinitely gives a worse signal than one that reports a timeout.
- **Duplicate `ImportMetaEnv` declaration.** Trigger: creating `src/env.d.ts` while the template's `src/vite-env.d.ts` already declares it. Expected: a `vue-tsc` duplicate-identifier error. Guarded by the note in task 4 — check which file the template generated before creating a new one.
- **`typecheck` passing vacuously.** Trigger: pointing `vue-tsc --noEmit` at `tsconfig.json` instead of `tsconfig.app.json`. Expected: the command exits 0 having checked **nothing**, because the root config in the `vue-ts` template holds only `references`. Enforced in task 2. To confirm the check is real, temporarily introduce a type error and make sure the script fails.
- **`uptimeSeconds` grows unbounded.** A long-running API shows a large raw number. Accepted as-is for this bootstrap; formatting it as a duration is deliberately out of scope.

---

## Test Plan

Vitest with `environment: 'jsdom'` and `globals: true`, configured in `apps/web/vite.config.ts` (task 3). Specs live beside their subject as `*.spec.ts`, matching the `include` glob.

1. **Unit — `apps/web/src/api/client.spec.ts`** (new). Test `toErrorMessage` — it is the whole error-reporting surface:
   - an `AxiosError` whose `response.data.message` is a **string** → that string;
   - an `AxiosError` whose `response.data.message` is a **`string[]`** → the members joined with `', '` (guards the `ValidationPipe` shape from Story 02);
   - an `AxiosError` with **no** `response` → "Cannot reach the API. Is it running on port 3000?";
   - an `AxiosError` with `code === 'ECONNABORTED'` → the timeout message;
   - a plain `new Error('boom')` → `'boom'`;
   - a non-`Error` throw such as `'boom'` → `'Unexpected error'`.
   Also assert `apiClient.defaults.baseURL === '/api'` under an empty `VITE_API_BASE_URL`.
2. **Unit — `apps/web/src/api/health.spec.ts`** (new). Mock `apiClient.get` with `vi.spyOn`. Assert `fetchHealth` requests the path **`'/health'`** (not `'/api/health'`) and that the options it passes include a `validateStatus` predicate returning `true` for both `200` and `503` and `false` for `500`. This test is what keeps the down-state behaviour from silently regressing.
3. **Unit — `apps/web/src/stores/health.spec.ts`** (new). Call `setActivePinia(createPinia())` in `beforeEach`. Mock the `@/api/health` module with `vi.mock`. Assert:
   - initial state — `data` is `null`, `isLoading` is `false`, `error` is `null`;
   - on a healthy response — `data` is set, `isHealthy` is `true`, `isDatabaseUp` is `true`, `error` is `null`, `lastCheckedAt` is non-null;
   - on a `503`-shaped response (resolved, `status: 'error'`, `database.status: 'down'`) — `error` stays **`null`** and `isDatabaseUp` is `false`. This is the key assertion distinguishing "unhealthy" from "unreachable";
   - on a rejection — `data` is `null`, `error` is a non-empty string, `isLoading` is `false`;
   - `isLoading` is `true` while the promise is pending and `false` after it settles, in both the success and failure paths.
4. **Component — `apps/web/src/views/SystemStatusView.spec.ts`** (new). Mount with `@vue/test-utils` and a stubbed store via `createTestingPinia`, or by mocking `@/api/health`. Assert one case per state:
   - loading with no data → the text "Checking API…";
   - error → an element with `role="alert"` containing the error message and the text `npm run dev:api`;
   - healthy → the service name, environment, and "Connected" all present;
   - database down → "Unavailable" **and** the `database.message` text rendered;
   - the "Refresh" button is `disabled` while `isLoading` is `true` and calls the store's `load` on click.
5. **Component — `apps/web/src/layouts/AppLayout.spec.ts`** (new). Mount with a real router created by `createRouter` + `createWebHistory` over the routes from task 7. Assert the `nav` with `aria-label="Main navigation"` exists, that it holds exactly two links pointing at `/` and `/system-status`, and that the brand text "Customer Support CRM" renders.
6. **Unit — `apps/web/src/router/index.spec.ts`** (new). Assert `router.resolve('/')` has name `dashboard`, `router.resolve('/system-status')` has name `system-status`, and `router.resolve('/nope')` has name `not-found`. The third assertion is what catches a misordered catch-all route.
7. **Remove:** the scaffolded `apps/web/src/components/HelloWorld.vue`, `apps/web/src/App.vue`, and `apps/web/src/style.css`, along with any spec the template generated for them.
8. **Manual (demo) — the work item's acceptance path.** Not automated: an end-to-end browser test would need Playwright plus a live database, which is out of scope for this bootstrap. Covered by Verification Steps 8–11 and recorded here so the gap is explicit rather than implied.

---

## Verification Steps

1. **Frontend installs:** from the repo root, run `npm install`. Expect exit code 0 and **no** `apps/web/node_modules`.
2. **Frontend type-checks:** from `apps/web`, run `npm run typecheck`. Expect exit code 0. Confirm the check is real by temporarily assigning a `number` to a `string` and seeing it fail.
3. **Frontend lints:** from `apps/web`, run `npm run lint`. Expect exit code 0.
4. **Frontend tests:** from `apps/web`, run `npm test`. Expect all specs green and the process to **exit** rather than watch.
5. **Frontend builds:** from `apps/web`, run `npm run build`. Expect `apps/web/dist/index.html` to exist and `vue-tsc` to report no errors.
6. **Frontend runs:** from the repo root, run `npm run dev:web`. Expect Vite to serve on **exactly** `http://localhost:5173`.
7. **Layout and navigation:** open `http://localhost:5173`. Expect the header, the sidebar with "Dashboard" and "System status", and the dashboard content. Click both links — expect the URL and content to change with **no** full page reload, the active link to be highlighted, and the document title to update.
8. **End-to-end connectivity (the work item's demo):** with `npm run dev:api` running in another terminal and PostgreSQL up, open `http://localhost:5173/system-status`. Expect API "Healthy", the service name `customer-support-crm-api`, the environment, a non-zero uptime, and Database "Connected" with a latency in ms. In the browser Network tab, confirm a `200` on `/api/health` served through the Vite proxy. **This step is the acceptance criterion "Vue can call the API successfully".**
9. **Database-down state:** stop PostgreSQL, keep the API running, and click "Refresh". Expect API "Degraded", Database "Unavailable", the database error message visible, a `503` in the Network tab, and **no** "Cannot reach the API" banner. Restart PostgreSQL and refresh — expect "Connected" again.
10. **API-down state:** stop the API and click "Refresh". Expect the `role="alert"` block with "Cannot reach the API. Is it running on port 3000?" and the `npm run dev:api` hint. Restart the API and refresh — expect a full recovery.
11. **Deep link and catch-all:** with only the dev server running, navigate directly to `http://localhost:5173/system-status` — expect the status page, not a `404`. Then visit `http://localhost:5173/nope` — expect "Page not found" with a working link home.
12. **Production build serves:** from `apps/web`, run `npm run build` then `npm run preview`. Expect the app to load. **Expect the health call to fail** on the preview server — it has no proxy, and `VITE_API_BASE_URL` is empty. That is correct behaviour for this story; the deployed configuration sets an absolute URL.
13. **Regression:** from the repo root, run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`. Expect all four to succeed across **both** workspaces — this is the first point at which the root fan-out scripts exercise `apps/web` as well as `apps/api`.
14. **Regression:** confirm the Story 02 and 03 checks still hold — `GET /health` is `404`, `/api/docs` loads, `/api/health` returns `database.status: 'up'`, and the seed remains idempotent.

---

## Done Criteria

- [ ] `apps/web/package.json` is named `@crm/web`, is `private`, and exposes `dev`, `build`, `preview`, `test`, `lint`, and `typecheck`.
- [ ] `typecheck` runs `vue-tsc --noEmit -p tsconfig.app.json` and genuinely fails on an introduced type error.
- [ ] `test` runs `vitest run` (non-watch) so the root `npm test` terminates.
- [ ] `apps/web/.prettierrc` and `apps/web/.gitignore` are deleted; root config governs.
- [ ] `npm install` at the root exits 0 and creates no `apps/web/node_modules`.
- [ ] `apps/web/vite.config.ts` sets `strictPort: true`, port 5173, the `@` → `./src` alias, a `/api` → `http://localhost:3000` proxy with **no** path rewrite, and the Vitest `jsdom` block.
- [ ] `tsconfig.app.json` declares the matching `@/*` path mapping and keeps `strict: true`.
- [ ] `ImportMetaEnv` types `VITE_API_BASE_URL` in exactly **one** declaration file.
- [ ] `apps/web/src/api/client.ts` falls back to `/api` using `||`, sets a 10s timeout, and exports `toErrorMessage` handling `string`, `string[]`, no-response, timeout, and non-`Error` inputs.
- [ ] `apps/web/src/api/health.ts` requests `'/health'` and overrides `validateStatus` to accept both `200` and `503`.
- [ ] `HealthResponse` and `DatabaseHealth` mirror the API DTOs field-for-field, including optional `database.message`.
- [ ] `useHealthStore` is a setup store exposing `data`, `isLoading`, `error`, `lastCheckedAt`, `isHealthy`, `isDatabaseUp`, and `load`; a `503` populates `data` and leaves `error` **null**.
- [ ] The router registers `dashboard`, `system-status`, and a **last-declared** `not-found` catch-all, uses `createWebHistory`, lazy-loads views, and updates `document.title`.
- [ ] `AppLayout.vue` is the root component, renders header + `nav[aria-label="Main navigation"]` + `<RouterView />`, and highlights the active link via `.router-link-active`.
- [ ] `main.ts` installs **Pinia before the router** and imports `./assets/main.css`.
- [ ] The scaffolded `App.vue`, `HelloWorld.vue`, and `style.css` are deleted.
- [ ] `SystemStatusView.vue` renders all four states — loading, error (with `role="alert"` and the `npm run dev:api` hint), healthy, and database-down (showing `database.message`) — and its Refresh button is disabled while loading.
- [ ] With the API and PostgreSQL running, `/system-status` displays Database "Connected" with a latency, over a `200` on `/api/health` through the Vite proxy.
- [ ] With PostgreSQL stopped, the page shows Database "Unavailable" plus the driver message and does **not** show "Cannot reach the API".
- [ ] With the API stopped, the page shows the "Cannot reach the API" alert.
- [ ] All tests in the Test Plan exist and pass; from the repo root `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` are green across both workspaces.

---

**All four stories for work item 1 are now complete.** The work item's demo — "Run the backend and frontend and demonstrate a successful request from Vue through the API to PostgreSQL" — is Verification Step 8 above.

**STOP HERE. Report to the user.**
