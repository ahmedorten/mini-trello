# REST API Contract Specifications - Generic Template

| Metadata | Value |
| :--- | :--- |
| **Owner** | Principal Software Architect |
| **Reviewer** | QA Lead |
| **Status** | Approved |
| **Version** | v1.0.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | [Architecture Specification](architecture.md) |
| **Referenced By** | [Canonical Document Index](index.md), [Frontend Integration](../.ai/context/frontend.md) |
| **Document Type** | Route Contract |
| **Audience** | Development Team, QA Team, AI Agents |

---

## 1. Global Setup
- **Base Path**: `/api/v1`
- **Content-Type**: `application/json`
- **Authentication**: JWT token in headers: `Authorization: Bearer <TOKEN>`

---

## 2. API Endpoints

### 2.1 Authentication & Profile

#### `POST /auth/register`
*   **Auth**: Public
*   **Request Body**:
    ```json
    {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "password": "SecurePassword123"
    }
    ```
*   **Response (201 Created)**:
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

#### `POST /auth/login`
*   **Auth**: Public
*   **Request Body**:
    ```json
    {
      "email": "jane@example.com",
      "password": "SecurePassword123"
    }
    ```
*   **Response (200 OK)**:
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

#### `GET /auth/profile`
*   **Auth**: Required
*   **Response (200 OK)**:
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

### 2.2 Parent Resource CRUD

#### `GET /resources`
*   **Auth**: Required
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "uuid-resource-555",
          "name": "Main Project Workspace",
          "description": "Details here",
          "createdAt": "2026-07-08T20:00:00.000Z"
        }
      ]
    }
    ```

#### `POST /resources`
*   **Auth**: Required
*   **Request Body**:
    ```json
    {
      "name": "New Resource Workspace",
      "description": "Description details"
    }
    ```
*   **Response (201 Created)**:
    ```json
    {
      "success": true,
      "data": {
        "id": "uuid-resource-777",
        "name": "New Resource Workspace",
        "description": "Description details",
        "createdAt": "2026-07-08T20:05:00.000Z"
      }
    }
    ```

#### `GET /resources/:id`
*   **Auth**: Required
*   **Response (200 OK)**: Returns the Parent Resource along with its nested Columns and Items.
    ```json
    {
      "success": true,
      "data": {
        "id": "uuid-resource-777",
        "name": "New Resource Workspace",
        "columns": [
          {
            "id": "uuid-column-111",
            "name": "Stage Alpha",
            "order": 1,
            "items": [
              {
                "id": "uuid-item-999",
                "title": "Configure DB tables",
                "priority": "HIGH",
                "order": 1
              }
            ]
          }
        ]
      }
    }
    ```

#### `PUT /resources/:id`
*   **Auth**: Required
*   **Request Body**:
    ```json
    {
      "name": "Updated Name",
      "description": "Updated Description"
    }
    ```
*   **Response (200 OK)**

#### `DELETE /resources/:id`
*   **Auth**: Required
*   **Response (200 OK)**: `{ "success": true, "data": null }`

---

### 2.3 Group Column CRUD

#### `POST /columns`
*   **Auth**: Required
*   **Request Body**:
    ```json
    {
      "name": "Stage Beta",
      "parentResourceId": "uuid-resource-777"
    }
    ```
*   **Response (201 Created)**: Returns created column with computed `order` index.

#### `PUT /columns/:id`
*   **Auth**: Required
*   **Request Body**:
    ```json
    {
      "name": "Stage Gamma",
      "order": 2
    }
    ```
*   **Response (200 OK)**

#### `DELETE /columns/:id`
*   **Auth**: Required
*   **Response (200 OK)**: `{ "success": true, "data": null }`

---

### 2.4 Resource Item CRUD

#### `POST /items`
*   **Auth**: Required
*   **Request Body**:
    ```json
    {
      "title": "Setup local environment",
      "description": "Setup project files",
      "groupColumnId": "uuid-column-111",
      "priority": "HIGH",
      "dueDate": "2026-08-01T12:00:00.000Z"
    }
    ```
*   **Response (201 Created)**: Returns created item with computed `order` field.

#### `PUT /items/:id`
*   **Auth**: Required
*   **Request Body**:
    ```json
    {
      "title": "Updated Item Title",
      "description": "Updated details",
      "priority": "LOW",
      "dueDate": null
    }
    ```

#### `PATCH /items/:id/move`
*   **Auth**: Required
*   **Request Body**:
    ```json
    {
      "targetColumnId": "uuid-column-222",
      "targetOrder": 2
    }
    ```
*   **Response (200 OK)**: Returns the updated item parameters.

#### `DELETE /items/:id`
*   **Auth**: Required
*   **Response (200 OK)**: `{ "success": true, "data": null }`

---

### 2.5 Dashboard & Search

#### `GET /dashboard`
*   **Auth**: Required
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "totalResources": 3,
        "totalItems": 14,
        "pendingItems": 9,
        "completedItems": 5
      }
    }
    ```

#### `GET /items/search?q=<query>`
*   **Auth**: Required
*   **Response (200 OK)**: Returns items containing the query in titles.
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "uuid-item-999",
          "title": "Configure DB tables",
          "parentResourceId": "uuid-resource-777",
          "columnName": "Stage Alpha"
        }
      ]
    }
    ```

---

## 3. Error Handling Envelope
Failures resolve to the standard error shape matching the appropriate HTTP code:
```json
{
  "success": false,
  "error": "Short explanation details."
}
```
Status Codes:
- `400 Bad Request`: Validation failure.
- `401 Unauthorized`: Token missing or expired.
- `403 Forbidden`: Access check failed on resource.
- `404 Not Found`: Targeted record ID is invalid.
- `500 Server Error`: Internal runtime crash.