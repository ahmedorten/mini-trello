# Pull Request Review Report Template

## PR Title
`[PR-XXX] Feature/Bug Description`

---

## 1. Review Summary
- **Target Branch**: `[main / dev]`
- **PR Author**: `[Backend Engineer / Frontend Engineer]`
- **Reviewer**: `[Principal Reviewer]`
- **Status**: `[Approved / Request Changes / Rejected]`

---

## 2. Compliance Checklist

### 2.1 Code Quality & Formatting
- [ ] Strictly typed. No `any` keywords used.
- [ ] Code formatted using prettier settings.
- [ ] Unit/Integration tests coverage meets or exceeds 80% threshold.

### 2.2 Architectural Conformity
- [ ] Files sit inside correct feature directory (`src/modules/<feature>/`).
- [ ] Controllers contain no database queries or business logic validation checks.
- [ ] Database updates execute via repositories.

### 2.3 Security Verification
- [ ] Bearer token authorization checks guard protected routes.
- [ ] Input data is parsed and validated (e.g. Zod schema).
- [ ] No configurations or private credentials hardcoded.

---

## 3. Review Comments & Required Fixes
Detail any standard violations or logic bugs found:
- `Line reference`: Explanation of the issue and suggested fix.
