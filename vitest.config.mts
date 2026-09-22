import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Tests unitarios de la lógica del juego (`src/lib`), del estado en React y del paquete
 * que se publica (`scripts/`: lo que declara el `package.json` y qué puede haber dentro
 * de la lógica que se lleva el puerto a Godot).
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
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      // Lo que se mide es **el dominio**: `src/lib` es donde vive lo que decide
      // algo y es lo único que se puede probar sin un navegador con WebGL. Los
      // componentes de la escena se prueban de extremo a extremo, en un
      // navegador de verdad, y contarlos aquí solo bajaría el número sin decir
      // nada de si están probados.
      include: ['src/lib/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}'],
      reporter: ['text-summary', 'html'],
      // El dominio está cubierto entero, así que el suelo es el techo: lo que
      // se añada sin probar rompe el build. Las ramas que no puede alcanzar
      // ningún test llevan `v8 ignore` con el motivo escrito al lado.
      thresholds: { lines: 100, statements: 100, functions: 100, branches: 100 },
    },
  },
})
