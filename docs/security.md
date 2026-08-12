# Security Specifications & Guidelines - Generic Template

| Metadata | Value |
| :--- | :--- |
| **Owner** | Principal Software Architect |
| **Reviewer** | Reviewer |
| **Status** | Approved |
| **Version** | v1.0.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | [Architecture Specification](architecture.md) |
| **Referenced By** | [Canonical Document Index](index.md), [Quality Checklists](quality-checklists.md) |
| **Document Type** | Security Standard |
| **Audience** | Development Team, AI Agents |

---

## 1. Authentication & Token Management

### 1.1 JWT (JSON Web Token) Policy
- **Signature Algorithm**: Use secure signature methods (e.g. HMAC SHA-256).
- **Token Claims**: Payload must include identifier fields (like `userId` and `email`). Do not store sensitive fields (like password hashes) in token claims.
- **Expiration**: Standard token validity duration is 24 hours.
- **Storage**: The client must store tokens securely (cookies or storage) and attach them to request headers:
  ```http
  Authorization: Bearer <TOKEN>
  ```

---

## 2. Cryptography & Data Protection
- **Password Hashing**: Store passwords hashed using secure hashing algorithms (e.g., Bcrypt with work factor: 10 rounds). Plaintext passwords must never hit database columns or logs.
- **Environment Separation**: Bind security secrets (e.g. key credentials, database connection URLs) to environment files (`.env`). Never commit `.env` files to Git.

---

## 3. Threat Mitigation

### 3.1 SQL Injection Prevention
- **Constraint**: Under no circumstances construct query strings via concatenation.
- **Data Access Boundary**: Always use parameterized binding or safe ORM parameters.

### 3.2 XSS (Cross-Site Scripting) Defense
- **Frontend Encoding**: Use reactive framework binding properties which automatically HTML-escape content. Avoid raw HTML rendering interfaces unless sanitized.

### 3.3 CORS Policy Configuration
- Limit API requests to authorized origins. Local development CORS must only allow the designated client ports.
