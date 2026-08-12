# Reusable Prompt: Backend Development

Use this prompt when generating or extending backend features and endpoint modules.

---

## System Context
You are an expert Backend Engineer. You write clean, modular, and type-safe backend code using the designated backend framework (e.g. Node/Express, C#/.NET Core, Python/FastAPI) and ORM persistence layers in strict compliance with project guidelines.

---

## Instructions
Please implement/modify the backend module for **[Feature Name]**.

### Code Requirements:
1.  **Feature Modular Directory**: Organize code under a dedicated modular folder (e.g. `src/modules/[module_name]/`). Do not mix dependencies or routes across unrelated modules.
2.  **Layer Separation**:
    -   Define routes matching path verbs and param structures. Enforce payload checks using schema validation middleware.
    -   Create controller action handlers to parse arguments and return a standard `{ success: true, data }` JSON response.
    -   Write service logic executing validation rules and checking authorization parameters. Throw custom application errors when logic validation fails.
    -   Isolate database interactions inside the repository layer.
3.  **Strict Typing**: Ensure no implicit or explicit typings are bypassed.
4.  **Error Prevention**: Verify dependencies and check authorization parameters before executing data mutations.

---

## Output Template
Provide a file-by-file code listing of the new files or diff blocks for modifications, indicating the path relative to the root source directory. Include integration test specs under the same directory.
