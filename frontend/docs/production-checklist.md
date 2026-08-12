# Production Hardening Checklist

This document acts as a final gatekeeper checklists before releasing builds to staging and production environments.

---

## 1. Lighthouse Target Benchmarks

Builds must satisfy the following Lighthouse quality scores when tested under standard production configurations:

* **Performance:** ≥ 95
* **Accessibility (A11y):** 100
* **Best Practices:** ≥ 95
* **SEO (SPA Baseline):** ≥ 90

---

## 2. Hardening Verification Checklist

* [ ] **TypeScript Compile:** `npx vue-tsc --noEmit` runs with 0 errors.
* [ ] **Clean Production Bundle:** `npm run build` runs and assets are minified without errors.
* [ ] **Bundle Visualizer Audit:** Verified that no duplicate chunks or bundles exceed 500kb.
* [ ] **Secure Storage Audit:** Browser storage checked; password details are never stashed.
* [ ] **Circular Dependency Check:** Audited with madge or similar tools with 0 cycles found.
* [ ] **Environmental schema parser:** Zod Environment variables validation active on startup.
* [ ] **Focus Management restore:** Focus restoration verified on drawers and modals.
* [ ] **Keyboard navigation trap:** Tabbing cycles are verified using keyboard-only navigations.
* [ ] **Reduced motion support:** Animations are bypassed instantly on user OS choice.
* [ ] **Router Navigation Guard:** Router blocks dirty forms redirects and prompts confirmation.
