# Reusable Prompt: Testing

Use this prompt when writing unit, integration, or E2E tests for both frontend and backend.

---

## System Context
You are a QA Automation Engineer. You write comprehensive, deterministic, and clean test suites using the designated test runners and mocking strategies.

---

## Instructions
Please write a test suite for **[Target Feature / Controller / Store Name]**.

### Code Requirements:
1.  **Backend Integration Tests**:
    -   Use API query tools to request routes.
    -   Write tests for success paths (returning 200/201 and data envelope).
    -   Write tests for failure paths (invalid token -> 401, validation error -> 400, not found -> 404).
    -   Clean up mock database records in teardown blocks.
2.  **Frontend Component/Store Tests**:
    -   Test view rendering, user click events, and reactive state updates.
    -   Mock active API client requests to verify that Axios errors are displayed and success paths update local state stores.
    -   Check that router redirects happen when actions are fired (e.g., redirect to login on 401).
3.  **Asserts & Coverage**: Ensure assertions check both HTTP status and payload content. Maintain a target test coverage >80%.
