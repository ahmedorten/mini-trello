import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
  plugins: [
    vue(),
    visualizer({
      filename: 'reports/bundle-report.html',
      title: 'Mini Trello Frontend Bundle Visualizer Report',
      template: 'treemap',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  optimizeDeps: {
    include: [
      'dayjs',
      'dayjs/plugin/relativeTime',
      'dayjs/locale/ar',
      'dayjs/locale/en'
    ],
  },
  resolve: {

    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@layouts': fileURLToPath(new URL('./src/layouts', import.meta.url)),
      '@assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
    },
  },
  build: {
    sourcemap: 'hidden', // hides sourcemaps from browser devtools but emits maps for debugging
    cssCodeSplit: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('pinia')) {
              return 'vendor-core';
            }
            if (id.includes('axios') || id.includes('dayjs') || id.includes('vee-validate') || id.includes('zod')) {
              return 'vendor-libs';
            }
            return 'vendor-misc';
          }
        },
      },
    },
  },
  esbuild: {
    // Strip console.log and debugger statements in production builds
    drop: ['console', 'debugger'],
  } as any,
})
