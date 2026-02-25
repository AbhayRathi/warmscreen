import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
    exclude: ['node_modules', '.next', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      exclude: ['node_modules/**', '.next/**', 'dist/**', '**/__tests__/**'],
      include: [
        'lib/agents/**/*.ts',
        'lib/db/agent-log.ts',
        'app/api/interviews/*/analyze/route.ts',
        'app/api/interviews/*/agent-analysis/route.ts',
        'app/api/responses/*/agent-analysis/route.ts',
      ],
      thresholds: {
        // Overall thresholds - relaxed due to pre-existing untested files
        lines: 85,
        functions: 85,
        branches: 70,
        statements: 85,
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
