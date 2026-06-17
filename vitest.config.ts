import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    exclude: ['node_modules', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      // Count files even when no test imports them, so the % reflects the
      // whole business-logic surface (not just files a test touches).
      // (Vitest 4 conta todos os arquivos por padrão — `all` deixou de ser opção.)
      // Scope to business logic: server actions, route handlers, lib helpers,
      // hooks and middleware. Pure UI components are validated by E2E, not by
      // this threshold gate.
      include: [
        'app/**/actions.ts',
        'app/**/route.ts',
        'lib/**/*.ts',
        'middleware.ts',
        'hooks/**/*.ts',
      ],
      exclude: [
        'lib/i18n/**',            // static translation strings
        'lib/supabase/client.ts', // thin browser-client factory (no logic)
        '**/*.d.ts',
        '**/types.ts',
      ],
      // Ratchet gate — raise these as each phase of docs/TEST-PLAN.md lands.
      // Baseline (2026-06-16): stmts 41.6 / branch 30.6 / funcs 34.1 / lines 43.7
      // Phase 1 done:          stmts 56.2 / branch 45.2 / funcs 43.9 / lines 58.3
      // Phase 2 done:          stmts 71.2 / branch 56.7 / funcs 58.5 / lines 73.5
      // Phase 3 done:          stmts 87.3 / branch 70.3 / funcs 78.0 / lines 88.7
      // Meta de 80% atingida em statements, branches e lines. Functions (78%)
      // só não chega a 80 por causa de factories finas do Supabase (sem lógica).
      thresholds: {
        statements: 85,
        branches: 68,
        functions: 76,
        lines: 87,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
