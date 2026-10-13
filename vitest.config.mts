import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Unit tests of the game's logic (`src/lib`), of the state in React and of the package
 * that is published (`scripts/`: what the `package.json` declares and what there can be
 * inside the logic the Godot port takes along).
 * The end-to-end tests live in `e2e/` and are run by Playwright, which
 * needs a real browser because of the WebGL Canvas.
 *
 * No `@vitejs/plugin-react` on purpose: Fast Refresh is not needed here and its
 * copy of Vite clashes with the one Vitest brings. The JSX is transformed by
 * esbuild with the automatic runtime `tsconfig.json` already declares.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      // What is measured is **the domain**: `src/lib` is where what decides
      // something lives and it is the only thing that can be tested without a
      // browser with WebGL. The scene's components are tested end to end, in a
      // real browser, and counting them here would only lower the number without
      // saying anything about whether they are tested.
      include: ['src/lib/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}'],
      reporter: ['text-summary', 'html'],
      // The domain is fully covered, so the floor is the ceiling: whatever is
      // added untested breaks the build. The branches no test can reach carry
      // `v8 ignore` with the reason written next to it.
      thresholds: { lines: 100, statements: 100, functions: 100, branches: 100 },
    },
  },
})
