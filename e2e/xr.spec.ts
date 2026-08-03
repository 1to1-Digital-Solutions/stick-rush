import { expect, test } from '@playwright/test'
import { openGame } from './helpers'
import {
  enterVR,
  exitXR,
  installXREmulator,
  startGameInsideSession,
} from './support/xr'

/**
 * Modo inmersivo, sobre un Quest 3 emulado con IWER.
 *
 * Chromium no trae WebXR, así que sin el emulador estos caminos no se ejecutan
 * nunca: los demás tests entran por el ratón, que es código distinto. Aquí se
 * abre una sesión de verdad y se comprueba en qué estado deja al juego.
 *
 * El estado se observa por el DOM: en sesión inmersiva el jugador no lo ve,
 * pero los overlays siguen montados, así que el menú de escritorio y el
 * marcador sirven de espejo de en qué fase está la partida.
 *
 * **Lo que estos tests NO cubren:** mover los mandos y pulsar sus botones. El
 * emulador entrega sesión, dos `inputSources` y ~125 fps, pero los punteros de
 * @react-three/xr no llegan a emitir eventos sobre los objetos de la escena
 * (comprobado con un barrido de posiciones y con agarre, contacto y rayo). Así
 * que el agarre de los palos y los botones del menú 3D **solo se pueden validar
 * en hardware**. La regla de qué puntero puede atrapar sí está cubierta, en
 * `src/lib/xrInteraction.test.ts`.
 */

test.describe('Sesión inmersiva', () => {
  test.beforeEach(async ({ page }) => {
    await installXREmulator(page)
    await openGame(page)
  })

  test('con WebXR disponible aparecen las entradas a VR y AR', async ({
    page,
  }) => {
    await expect(page.getByRole('button', { name: 'Entrar en VR' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Entrar en AR' })).toBeVisible()
  })

  test('entrar en VR lleva al menú y no arranca una partida sola', async ({
    page,
  }) => {
    await enterVR(page)

    // Si hubiera arrancado, el menú habría dejado paso al marcador. Este era el
    // comportamiento que se veía con el visor puesto.
    await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('los palos no se sueltan mientras se está en el menú', async ({ page }) => {
    await enterVR(page)

    // Tiempo de sobra para que, con el reloj corriendo, ya hubieran caído.
    await page.waitForTimeout(4000)

    await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('salir de la sesión devuelve al menú de escritorio', async ({ page }) => {
    await enterVR(page)

    await startGameInsideSession(page)
    await expect(page.getByRole('status')).toBeVisible()

    await exitXR(page)

    // Volver al menú al salir solo ocurre si la app detectó el modo inmersivo
    // (`XRSessionController` recuerda que hubo sesión), así que este test
    // también prueba que el modo se reconoce.
    await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })
})
