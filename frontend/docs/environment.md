# Environment Variables Configuration

This document lists all environment variables configured for the client application.

---

## 1. Schema & Variables Definition

The application uses two variables validated during startup in `EnvironmentSchema.ts`:

### `VITE_API_BASE_URL`
* **Type:** String (Absolute URL)
* **Required:** Yes
* **Default:** None
* **Purpose:** Sets the base endpoint url for the backend API consumed by Axios.
* **Example:** `https://api.minitrello.com/api/v1`

### `VITE_APP_ENV`
* **Type:** Enum (`'development' | 'staging' | 'production'`)
* **Required:** Yes
* **Default:** None
* **Purpose:** Instructs the application about the current deployment environment profile, gating diagnostic outputs and logging levels.
* **Example:** `production`

---

## 2. Configuration Profiles

### Development (`.env.development`)
```ini
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_APP_ENV=development
```

### Staging (`.env.staging`)
```ini
VITE_API_BASE_URL=https://staging-api.minitrello.com/api/v1
VITE_APP_ENV=staging
```

### Production (`.env.production`)
```ini
VITE_API_BASE_URL=https://api.minitrello.com/api/v1
VITE_APP_ENV=production
```
