# Folder Structure Guide

This guide maps the workspace layouts of the Mini Trello project source files located under the `src/` directory.

---

## 1. Directory Tree Map

```
src/
├── assets/                 ← Static resources, global images, stylesheet imports
│   ├── styles/
│   │   └── main.css        ← Imports Tailwind and ThemeTokens CSS properties
│   └── hero.png
│
├── core/                   ← Core boot configurations (Static/Singleton configurations)
│   ├── api/
│   │   └── ApiClient.ts    ← Base Axios client with request/response interceptors
│   ├── auth/
│   │   └── SessionManager.ts
│   ├── config/
│   │   └── EnvironmentSchema.ts ← Zod schema environmental validation
│   └── errors/
│       └── error-handler.ts
│
├── features/               ← Modular, self-contained business domains
│   ├── auth/               ← Sign-in, sign-up, user context
│   ├── boards/             ← Workspace listing and dashboard layouts
│   ├── columns/            ← Lane listings and reordering logic
│   ├── cards/              ← Drag-and-drop cards, checklist, attachment controls
│   ├── filters/            ← Active queries chip panels
│   ├── search/             ← In-memory LRU cache global searches
│   └── statistics/         ← Dashboard registry-driven widgets
│
├── layouts/                ← Routing template layouts (App layout, Auth layouts)
│   ├── AppLayout.vue
│   ├── AuthLayout.vue
│   └── BlankLayout.vue
│
├── plugins/                ← Boot plugins configured on Vue app initialization
│   ├── axios.ts
│   ├── pinia.ts
│   ├── router.ts
│   └── validation.ts
│
└── shared/                 ← Reusable across multiple domains
    ├── animations/         ← CSS transition presets
    ├── components/
    │   ├── base/           ← Pure HTML wrapper elements (Inputs, Buttons)
    │   ├── dialogs/        ← Modal confirmation containers
    │   └── feedback/       ← Toast containers, spinners, error boundaries
    ├── composables/
    └── services/           ← Centralized focus, breakpoints, and themes
```

---

## 2. Directory Rules

* **Shared vs Features:** If a component is specific to one domain (e.g. `CardItem.vue`), it belongs in `features/cards/components/`. If it is used by multiple domains (e.g. `BaseButton.vue`), it belongs in `shared/components/base/`.
* **Private Code:** Code inside a feature folder is private to that feature. Do not export internals; only expose public accessors at the feature root via a barrel `index.ts` file if necessary.
