import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Tests unitarios de la lógica del juego (`src/lib`) y del estado en React.
 * Los tests de extremo a extremo viven en `e2e/` y los corre Playwright, que
 * necesita un navegador real por el Canvas WebGL.
 *
 * Sin `@vitejs/plugin-react` a propósito: aquí no hace falta Fast Refresh y su
 * copia de Vite choca con la que trae Vitest. El JSX lo transforma esbuild con
 * el runtime automático que ya declara `tsconfig.json`.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
})
