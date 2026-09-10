import { expect, test } from '@playwright/test'

import type { StickProbe } from '@/lib/sceneProbe'
import { openGame } from './helpers'
import {
  enterVR,
  installXREmulator,
  moveBareHand,
  pinchHand,
  pressPlayInsideSession,
  startGameInsideSession,
  tutorialSkipButton,
  useBareHands,
} from './support/xr'

/**
 * Jugar con las manos desnudas, sin mandos.
 *
 * **Es el modo de entrada que dejaba fuera a gente.** Quien no tiene mandos a
 * mano —o no puede sostenerlos— entra al visor con las manos, y el juego tiene
 * que dejarse jugar igual: el palo se coge cerrando la mano encima, que es
 * exactamente lo que el tutorial promete («close your hand around the stick»).
 *
 * Aquí se apagan los mandos, se encienden las manos con sus articulaciones y se
 * hace el gesto entero: llevar la mano hasta un palo y cerrarla. Lo que se
 * comprueba es que el palo se cuenta como atrapado, que es lo único que dice
 * desde fuera del Canvas si el agarre enganchó — con la mano desnuda no hay
 * botón que pulsar ni foco que seguir.
 */
test('con las manos desnudas los palos también se atrapan', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await installXREmulator(page)
  await openGame(page)
  await enterVR(page)
  await useBareHands(page)
  await startGameInsideSession(page)

  // Se pide la foto de los palos: la escena no la publica si nadie la ha
  // pedido, así que hay que crear la propiedad antes de mirarla.
  await page.evaluate(() => {
    window.__stickRushSticks = {}
  })

  // Un palo que se pueda coger ahora mismo, y dónde está. Colgando vale: la
  // ventana de captura se abre en cuanto arranca la partida (ver
  // `canCatchStick`), y un palo quieto es el que deja probar el gesto sin que
  // el test dependa de acertarle a algo que cae.
  const encontrado = await page.waitForFunction(
    () => {
      const sticks = Object.values(window.__stickRushSticks ?? {})
      return sticks.find((stick) => stick.catchable) ?? null
    },
    undefined,
    { timeout: 15_000 },
  )
  const palo = (await encontrado.jsonValue()) as StickProbe

  // La mano llega hasta el palo y se cierra. Las dos cosas hacen falta: cerrarla
  // desde lejos no coge nada, y llegar sin cerrarla tampoco.
  await moveBareHand(page, 'right', { x: palo.x, y: palo.y, z: palo.z })
  await pinchHand(page, 'right', true)

  await expect(page.getByRole('status')).toContainText(/[1-9]\d* \//, {
    timeout: 10_000,
  })

  expect(errors).toEqual([])
})

/**
 * Y lo que se enseña es lo que se tiene en la mano.
 *
 * El tutorial dibujaba un mando con su gatillo lateral marcado. Quien entra con
 * las manos veía un objeto que no tiene y un botón que no puede apretar, justo
 * en la única pantalla del juego que existe para explicar el gesto. Con las
 * manos se dibuja una mano cerrándose (ver `XRHandModel`).
 *
 * Desde fuera del Canvas no se puede mirar qué geometría hay —no hay texto ni
 * DOM que lo refleje—, así que lo que se comprueba es que la demostración
 * arranca, corre y se pinta sin reventar con las manos puestas.
 */
test('el tutorial se pinta con las manos sin ensuciar la consola', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await installXREmulator(page)
  await openGame(page)
  await enterVR(page)
  await useBareHands(page)
  await pressPlayInsideSession(page)

  // El tutorial se antepone a la partida la primera vez, y su botón de saltarlo
  // es el reflejo en DOM de la demostración que corre en 3D.
  await expect(tutorialSkipButton(page)).toHaveCount(1)
  // Unos segundos: la mano se cierra y se abre dos veces por ciclo, y el tramo
  // dura para dos ciclos.
  await page.waitForTimeout(4000)

  expect(errors).toEqual([])
})
