import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { playwright } from '@vitest/browser-playwright';

// Browser-mode vitest for foliate-js paginator / fixed-layout scroll tests.
// These need a real browser: jsdom has no layout, custom elements, or scroll
// containers. Ported from upstream readest-app, trimmed to the OpenReadest
// dependency set (no supabase / turso / COOP headers needed here).
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    conditions: ['development'],
  },
  optimizeDeps: {
    include: ['@zip.js/zip.js'],
    exclude: ['@pdfjs/pdf.min.mjs'],
  },
  test: {
    include: ['src/**/*.browser.test.ts', 'src/**/*.browser.test.tsx'],
    onConsoleLog(_log, type) {
      if (type === 'stdout') return false;
    },
    browser: {
      enabled: true,
      headless: true,
      screenshotFailures: false,
      provider: playwright({
        contextOptions: {
          viewport: { width: 1920, height: 1080 },
          deviceScaleFactor: 2,
        },
      }),
      instances: [{ browser: 'chromium' }],
    },
  },
});
