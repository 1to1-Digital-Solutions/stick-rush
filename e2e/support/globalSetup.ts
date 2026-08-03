import path from 'node:path'
import { build } from 'esbuild'

/**
 * Rutas relativas a la raíz del proyecto, que es desde donde se lanza
 * Playwright. No se usa `import.meta.url` porque Playwright carga este fichero
 * como CommonJS y ahí no existe.
 */
const SOURCE = path.join(process.cwd(), 'e2e/support/xr-emulator.src.ts')

/** Bundle del emulador que consumen los tests XR. */
export const XR_EMULATOR_BUNDLE = path.join(
  process.cwd(),
  'e2e/support/xr-emulator.bundle.js',
)

/**
 * Empaqueta el emulador WebXR antes de correr la suite.
 *
 * `page.addInitScript` necesita un fichero plano que el navegador pueda evaluar,
 * y el emulador es TypeScript con imports. Se compila aquí, una vez por
 * ejecución, en lugar de commitear un artefacto de 400 KB que quedaría
 * desincronizado con la versión de `iwer` del lockfile.
 */
export default async function globalSetup() {
  await build({
    entryPoints: [SOURCE],
    outfile: XR_EMULATOR_BUNDLE,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    logLevel: 'warning',
  })
}
