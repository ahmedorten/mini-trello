# API Endpoint Contract Template

## Endpoint Title
`[VERB] /api/v1/resource-path`

---

## 1. Description
Summary of what this route does and any authorization required.

---

## 2. Request Details

### 2.1 Request Headers
```http
Authorization: Bearer <TOKEN>
Content-Type: application/json
```

### 2.2 Route Parameters
- `id` (UUID, required): Description of param.

### 2.3 Query String Filters
- `q` (string, optional): Search keyword.

### 2.4 Request Body
```json
{
  "property_name": "expected_type_and_constraints"
}
```

---

## 3. Response Details

### 3.1 Success Response (HTTP Status Code)
```json
{
  "success": true,
  "data": {
    "property": "value"
  }
}
```

### 3.2 Error Responses (HTTP Status Code)
```json
{
  "success": false,
  "error": "Error description message."
}
```
