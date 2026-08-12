# Production Deployment Guide

This guide details server routing rules, caching guidelines, progressive enhancement policies, and browser compatibility parameters for hosting the production-ready build.

---

## 1. Static Assets Caching Strategy

To achieve sub-second loading times in production, configure your CDN, reverse proxy, or Nginx server with different caching rules for static assets versus core documents:

* **index.html (No-Cache):**
  * **Headers:** `Cache-Control: no-cache, no-store, must-revalidate`
  * **Description:** Never cache `index.html`. It contains references to hashed build assets. Caching this file prevents users from receiving updates.
* **Hashed Bundles (Immutable):**
  * **Headers:** `Cache-Control: public, max-age=31536000, immutable`
  * **Description:** Vite outputs hashed filenames under `dist/assets/` (e.g. `index-CimVRPvJ.css`). These files are 100% immutable and should be cached by browsers and CDNs for a full year.

---

## 2. Nginx Fallback Routing (Vue SPA Router)

Because Vue Router utilizes history mode (`HTML5 History`), direct accesses to child paths (such as `/boards/1` or `/search`) will trigger server-side 404 errors unless forwarded to the index bootstrap shell.

Add the `try_files` rule inside your Nginx configuration:

```nginx
server {
    listen 80;
    server_name app.minitrello.com;
    root /var/www/mini-trello/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Custom caching headers for hashed assets
    location ~* \.(?:css|js|woff2?|png|jpg|jpeg|svg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }
}
```

---

## 3. Browser Support Matrix

The built distribution is targets modern browsers supporting ES modules natively:

| Browser | Minimum Version | Mobile Support | Progressive Policy |
|---------|-----------------|----------------|--------------------|
| **Google Chrome** | 90+ | Chrome for Android | ES2022 syntax, Grid, Flex, Web Animation |
| **Microsoft Edge** | 90+ | Edge Mobile | ES2022 syntax, Grid, Flex, Web Animation |
| **Mozilla Firefox** | 88+ | Firefox for Android | ES2022 syntax, Grid, Flex |
| **Apple Safari** | 15+ | iOS Safari | ES2022 syntax, Grid, Flex, Web Animation |

### Progressive Enhancement Policy
If a browser does not support specific CSS features (like backdrop-blur), styles fallback gracefully to solid color backgrounds. Motion prefers-reduced-motion is respected to swap animation timings.
