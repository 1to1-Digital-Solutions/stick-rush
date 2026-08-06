import { expect, test } from '@playwright/test'
import { xrPlayButtonPosition } from '@/lib/xrLayout'
import { openGame } from './helpers'
import {
  aimHandAt,
  enterVR,
  exitXR,
  installXREmulator,
  placeHand,
  pressAndRelease,
  startGameInsideSession,
  toPoint,
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
 * emulador entrega sesión, dos `inputSources`, ~125 fps y modo `controller`,
 * pero los punteros de @react-three/xr no llegan a emitir eventos sobre los
 * objetos de la escena (comprobado con un barrido de posiciones, con agarre,
 * contacto y rayo, y con los botones escuchando `pointerdown`). Así que el
 * agarre de los palos y los botones del menú 3D **solo se pueden validar en
 * hardware**. Ojo: esto ya no debe usarse como coartada. Durante mucho tiempo
 * tapó un fallo real —los mandos no llegaban a registrarse porque su perfil se
 * descargaba de un CDN que la CSP bloquea—, que sí se podía haber detectado
 * mirando la consola dentro de la sesión. De ahí el test que la vigila.
 *
 * Lo que sí está cubierto sin navegador, en `src/lib`: qué puntero puede
 * atrapar un palo (`xrInteraction.test.ts`), y que la interfaz quede siempre
 * delante del jugador y dentro de su campo de visión (`xrAnchor.test.ts` y el
 * bloque de layout de `xrInteraction.test.ts`) — que es justo el fallo que hacía
 * el modo inmersivo inutilizable.
 */

test.describe('Sesión inmersiva', () => {
  test.beforeEach(async ({ page }) => {
    await installXREmulator(page)
    await openGame(page)
  })

  test('con WebXR disponible aparece la entrada al visor', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Entrar en el visor' }),
    ).toBeVisible()
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

  // Pendiente por una limitación del emulador, no de la app. Se ha reintentado
  // tras arreglar el registro de mandos (que era un fallo real: sin el perfil
  // local no se creaba el `XRControllerState` y no había punteros que valieran),
  // con los botones escuchando `pointerdown` y con la sesión confirmada en modo
  // `controller`, dos `inputSources` y la consola limpia. Aun así IWER no llega
  // a propagar sus poses a los punteros. Se deja escrito para activarlo si el
  // emulador mejora, y porque describe lo que hay que probar a mano en el visor.
  test.fixme('se puede empezar la partida apuntando al botón del menú 3D', async ({
    page,
  }) => {
    await enterVR(page)

    // Mano a un lado, a la altura del pecho, apuntando al botón de empezar.
    await placeHand(page, 'right', { x: 0.25, y: 1.25, z: -0.15 })
    await aimHandAt(page, 'right', toPoint(xrPlayButtonPosition()))
    await pressAndRelease(page, 'right', 'trigger')

    // Si el rayo enganchó, la partida arranca y aparece el marcador.
    await expect(page.getByRole('status')).toBeVisible()
  })

  test('la sesión monta mandos e interfaz sin ensuciar la consola', async ({
    page,
  }) => {
    // Dentro de la sesión se monta código que ningún test de escritorio toca:
    // el mando dibujado a mano, la pista del gatillo y el anclaje que sigue la
    // mirada. Si alguno reventara, aquí saldría.
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))

    await enterVR(page)
    await startGameInsideSession(page)
    // Unos segundos de partida: el anclaje y la pista corren en cada frame.
    await page.waitForTimeout(2000)

    expect(errors).toEqual([])
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
