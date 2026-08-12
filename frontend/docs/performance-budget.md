# Performance Budget Guidelines

This document defines performance target budgets and limits designed to keep page loading responsive.

---

## 1. File Size Budgets (Gzip)

All production build chunks must satisfy these limits:

| Asset Type | Maximum Budget (Gzip) | Warning Threshold | Description |
|------------|-----------------------|-------------------|-------------|
| **Initial JavaScript** | **250 KB** | 200 KB | Total JavaScript loaded on page init |
| **Largest Chunk** | **150 KB** | 120 KB | Any individual vendor or routing chunk |
| **CSS Bundle** | **50 KB** | 40 KB | Compressed global styling stylesheet |
| **Assets / Images** | **500 KB** | 300 KB | Any individual background graphic or asset |

---

## 2. Core User Metric Targets

The application is optimized to achieve the following performance metrics on a simulated mobile connection (3G Slow):

* **First Contentful Paint (FCP):** ≤ 1.5 seconds.
* **Largest Contentful Paint (LCP):** ≤ 2.5 seconds.
* **Interaction to Next Paint (INP):** ≤ 200 milliseconds.
* **Lighthouse Performance Score:** ≥ 95.

---

## 3. Maintenance Policy

* **Vite Visualizer Auditing:** Build outputs should be routinely audited using `reports/bundle-report.html` to find duplicate imports and strip dead code.
* **Images Handling:** All static images must be compressed and formatted in modern WebP format before being committed to `/assets`.
* **Tree Shaking:** Do not import full library paths if only a sub-helper is needed. Use explicit destructured named imports.
