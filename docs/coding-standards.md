# Software Coding Standards - Generic Template

| Metadata | Value |
| :--- | :--- |
| **Owner** | Principal Software Architect |
| **Reviewer** | Reviewer |
| **Status** | Approved |
| **Version** | v1.0.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | None |
| **Referenced By** | [Canonical Document Index](index.md), [Agent Personas](../.ai/agents/architect.md) |
| **Document Type** | Coding Standard |
| **Audience** | Development Team, AI Agents |

---

## 1. Code Style & Formatter Rules

### 1.1 Formatting Rules
- **Semicolons**: Always enforce trailing semicolons.
- **Quotes**: Prefer single quotes for standard strings, double quotes for HTML templates.
- **Indent**: Use 2 spaces for indentation. Never use tabs.
- **Line Width**: Max print width is 100 characters.

### 1.2 Typing Strictness
- **Strict Settings**: Always set strict compilation flags to true.
- **Type Definitions**: Never bypass typings. Explicitly declare return types for all public controller routes, service functions, and helper functions.
- **Interface Naming**: Always use PascalCase for interface declarations. Do not prefix interfaces with `I`.

---

## 2. Naming Conventions

### 2.1 Backend Layer Casing
- **Files**: Use kebab-case for filenames (e.g. `create-resource.dto.ts`, `auth.routes.ts`).
- **Folders**: Module folder names must be lowercase singular (e.g. `auth`, `resource`, `category`).
- **Classes**: Controllers, Services, and Repositories must be PascalCase (e.g., `ResourceController`, `ResourceService`, `ResourceRepository`).
- **Validation Schemas**: Append `Schema` and use camelCase (e.g. `createResourceSchema`).
- **DTOs**: Append `Dto` and use PascalCase (e.g. `CreateResourceDto`).

### 2.2 Frontend Layer Casing
- **Components**: Use PascalCase for single file frontend components (e.g. `ResourceCard.vue`).
- **Views**: Append `View` and use PascalCase (e.g. `DashboardView.vue`).
- **Stores**: Use camelCase and match store domain name (e.g. `authStore.ts`).

---

## 3. Layer Separation Rules
1.  **Request Validation**: Validation parsing must execute within route middleware. Controllers must not manually check properties.
2.  **Stateless Request Binds**: Decode session tokens via middleware and attach user identities to the request context.
3.  **Encapsulated Transactions**: When deleting a resource that triggers downstream updates, use database cascade rules or encapsulate writes in transactions.
4.  **No Logger Pollution**: Never use default output prints in production. Always write application messages through logging utility libraries.