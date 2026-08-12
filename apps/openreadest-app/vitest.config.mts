import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // Browser-mode tests — run via `pnpm test:browser` (vitest.browser.config.mts).
      '**/*.browser.test.ts',
      '**/*.browser.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/store/cloudSyncStore.ts', 'src/services/cloud/profileName.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
