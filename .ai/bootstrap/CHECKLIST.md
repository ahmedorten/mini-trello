# Onboarding Verification Checklist

Use this checklist to confirm that your local workspace is functional and fully prepared for code implementation.

---

## 1. System Environment Integrity
- [ ] Runtime platform compiler (e.g. Node, .NET) is accessible via terminal.
- [ ] Docker Daemon is active and container status is green.
- [ ] Local database ports (e.g. `5432` for Postgres) are bindable and free of conflicts.

---

## 2. Codebase Compilation Check
- [ ] Backend dependencies install successfully.
- [ ] Frontend dependencies install successfully.
- [ ] Codebase lint checker compiles with zero warnings or errors.

---

## 3. Database & API Smoke Tests
- [ ] Relational migrations deploy successfully to the local database container.
- [ ] Backend server boots on the designated port (e.g. `3000`).
- [ ] A sample ping request to `/api/v1/health` returns `{ "success": true, "data": "healthy" }`.
- [ ] Frontend app launches and successfully loads screen views.
