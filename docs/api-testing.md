# API Testing Guide

| Metadata | Value |
| :--- | :--- |
| **Owner** | Project Manager |
| **Reviewer** | Principal Software Architect |
| **Status** | Draft |
| **Version** | v1.0.0 |
| **Last Updated** | 2026-07-13 |
| **Review Date** | 2026-07-13 |
| **Dependencies** | [API Contract](api-contract.md) |
| **Referenced By** | [Canonical Document Index](index.md), [Contributing Guide](contributing.md) |
| **Document Type** | Developer Guide |
| **Audience** | Development Team, AI Agents |

---

## 1. Prerequisites

Before testing the API, ensure the following are ready:

1. **HTTP Client** — Install [Bruno](https://www.usebruno.com/) (recommended, free, open-source) or any HTTP client that supports environment variables (e.g. Postman, Insomnia).
2. **Dev Server Running** — Start the backend:
   ```bash
   npm run dev
   ```
3. **Database Migrated** — Apply the latest schema:
   ```bash
   npx prisma migrate dev
   ```
4. **Collection Loaded** — Open the collection folder at `backend/http/` in your HTTP client.
5. **Environment Selected** — Select the `local` environment to activate `BASE_URL` and `JWT_TOKEN` variables.

---

## 2. Authentication Testing Workflow

Follow this sequence to test all three auth endpoints end-to-end:

### Step 1 — Register a New User

- **Request**: `POST /api/v1/auth/register`
- **Body**:
  ```json
  {
    "fullName": "Jane Doe",
    "email": "jane@example.com",
    "password": "SecurePassword123"
  }
  ```
- **Expected Response** — `201 Created`:
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid-user-1234",
      "name": "Jane Doe",
      "email": "jane@example.com"
    }
  }
  ```

---

### Step 2 — Login

- **Request**: `POST /api/v1/auth/login`
- **Body**:
  ```json
  {
    "email": "jane@example.com",
    "password": "SecurePassword123"
  }
  ```
- **Expected Response** — `200 OK`:
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOi...",
      "user": {
        "id": "uuid-user-1234",
        "name": "Jane Doe",
        "email": "jane@example.com"
      }
    }
  }
  ```

---

### Step 3 — Copy the JWT Token

From the Login response, copy the value of `data.token`.

---

### Step 4 — Paste into Environment Variable

Open your HTTP client's environment panel and paste the token into `JWT_TOKEN`.

- **Bruno**: `Environments` → edit `local` → paste into `JWT_TOKEN`
- **Postman**: `Environments` → edit `Mini Trello Local` → paste into `JWT_TOKEN`

---

### Step 5 — Test the Protected Endpoint

- **Request**: `GET /api/v1/auth/me`
- **Auth Header** (injected automatically from environment): `Authorization: Bearer {{JWT_TOKEN}}`
- **Expected Response** — `200 OK`:
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid-user-1234",
      "name": "Jane Doe",
      "email": "jane@example.com"
    }
  }
  ```

---

## 3. Expected Error Responses

The API returns a standard error envelope for all failures:

```json
{
  "success": false,
  "error": "Short explanation details."
}
```

| Status Code | Trigger |
| :--- | :--- |
| `400 Bad Request` | Missing or malformed request body fields |
| `401 Unauthorized` | Token missing, expired, or invalid |
| `409 Conflict` | Email address already registered |
| `422 Unprocessable Entity` | Validation failure (e.g. password too short) |
| `500 Internal Server Error` | Unhandled runtime crash |

See [api-contract.md §3](api-contract.md) for the full error handling specification.

---

## 4. Prisma Studio

Prisma Studio is a visual database browser for local development and debugging.

> [!WARNING]
> **Development Only — Never connect Prisma Studio to a Production database.**
> Prisma Studio reads your active `DATABASE_URL` from `.env`. Connecting it to
> a production database risks accidental data inspection or corruption. Use it
> strictly on your local development instance.

### Starting Prisma Studio

From the `backend/` directory:

```bash
npx prisma studio
```

Prisma Studio opens at **`http://localhost:5555`**.

### Common Uses During Auth Testing

| Task | What to Do |
| :--- | :--- |
| Verify registration wrote to DB | Open the `User` model → confirm the new row exists |
| Inspect field values | Click any row to expand all column values |
| Check soft-delete fields | Inspect `is_deleted` and `deleted_at` columns |
| Clear test data | Delete rows manually via the Studio UI (dev only) |
