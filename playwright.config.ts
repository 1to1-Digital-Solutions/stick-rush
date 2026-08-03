import { defineConfig, devices } from '@playwright/test'

/**
 * Tests de extremo a extremo sobre el build de producción.
 *
 * Se sirve en `127.0.0.1` y no en `localhost` a propósito: `@react-three/xr`
 * inyecta el emulador WebXR (IWER) cuando el hostname es exactamente
 * `localhost`, y con él aparece un botón "Enter XR" que no existe en el juego
 * real. Con la IP el navegador se comporta como el de un usuario sin visor.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100)
const HOST = '127.0.0.1'
const baseURL = `http://${HOST}:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // La escena 3D es tiempo real: dos partidas a la vez en la misma máquina se
  // roban FPS y falsean los tiempos de caída.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  // Holgado a propósito: una partida entera dura segundos, y `Stick` limita el
  // delta por frame a 50 ms, así que en una máquina cargada (o en CI, con
  // WebGL por software) la caída se alarga en tiempo real. Con los 30 s por
  // defecto, un pico de carga tumbaba tests que en realidad funcionan.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // El Canvas necesita WebGL; en headless lo cubre SwiftShader.
        launchOptions: { args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT} --hostname ${HOST}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
  },
})
