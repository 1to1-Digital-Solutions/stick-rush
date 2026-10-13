import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests on the production build.
 *
 * It is served on `127.0.0.1` and not on `localhost` on purpose: `@react-three/xr`
 * injects the WebXR emulator (IWER) when the hostname is exactly
 * `localhost`, and with it a "Enter XR" button shows up that does not exist in the real
 * game. With the IP the browser behaves like that of a user with no headset.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100)
const HOST = '127.0.0.1'
const baseURL = `http://${HOST}:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // Bundles the WebXR emulator the immersive session tests use.
  globalSetup: './e2e/support/globalSetup.ts',
  // The 3D scene is real time: two runs at once on the same machine steal
  // FPS from each other and falsify the fall times.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  // Roomy on purpose: a whole run lasts seconds, and `Stick` caps the
  // delta per frame at 50 ms, so on a loaded machine (or in CI, with
  // software WebGL) the fall stretches in real time. With the default 30 s,
  // a load spike knocked down tests that actually work.
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
        // The Canvas needs WebGL; in headless SwiftShader covers it.
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
