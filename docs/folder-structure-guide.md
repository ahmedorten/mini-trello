# Folder Structure Guide - Generic Template

| Metadata | Value |
| :--- | :--- |
| **Owner** | Principal Software Architect |
| **Reviewer** | Reviewer |
| **Status** | Approved |
| **Version** | v1.0.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | [Architecture Specification](architecture.md) |
| **Referenced By** | [Canonical Document Index](index.md) |
| **Document Type** | Structural Guide |
| **Audience** | Development Team, AI Agents |

---

## 1. Backend Structure Guide (`/backend`)
All business logic is located under `src/modules/` grouped in feature directories.

```
backend/
├── db/                      # Database schemas and settings
│   └── schema.prisma        # Database model declarations
├── src/
│   ├── app.ts               # Web application initialization
│   ├── server.ts            # Server entry (ports, listener)
│   ├── config/              # Environment configurations (db client)
│   ├── middlewares/         # Global middleware chains
│   │   ├── auth.middleware.ts
│   │   └── error.middleware.ts
│   ├── modules/             # Feature-modular directory
│   │   └── [feature]/       # Example: user, resources, auth
│   │       ├── [feature].routes.ts      # Endpoint paths mapping
│   │       ├── [feature].controller.ts  # Request handler formats
│   │       ├── [feature].service.ts     # Business logic validations
│   │       ├── [feature].repository.ts  # Database queries wrapper
│   │       ├── [feature].schema.ts      # Input validation schema
│   │       └── [feature].spec.ts        # Integration specs
│   └── shared/              # Reusable decorators, types, utils
└── package.json
```

---

## 2. Frontend Structure Guide (`/frontend`)
The client app uses a modular arrangement of components, stores, routes, and services.

```
frontend/
├── src/
│   ├── App.vue              # Visual shell of application
│   ├── main.ts              # Frontend bootstrapper
│   ├── assets/              # Base stylesheets and CSS variables
│   ├── components/          # Reusable presentation component nodes
│   ├── views/               # Page views mapped to routes
│   ├── stores/              # State store files
│   ├── services/            # Axios API connections
│   └── router/              # Router navigation guards
└── package.json
```
