import { expect, test } from '@playwright/test'

import { XR_CARTEL_POSITION } from '../src/lib/xrLayout'
import type { Goal } from '../src/lib/goal'
import { installDrawCallCounter, medianDrawCalls } from './support/scenery'
import { buscarEnLaEscena, esconderEnLaEscena, mirarEnLaEscena, openHost, partidasTerminadas } from './support/host'
import { drawCallBudget } from './support/budget'

/**
 * El cartel del objetivo, montado como lo monta el salón: la escena dentro de un Canvas ajeno,
 * con el `reto` y los listones de medalla (`objetivo`).
 *
 * Lo que dice y si se lee lo miden los unitarios (`cartelDeLaMaquina.legible.test.ts`); aquí se
 * comprueba lo que solo se ve con la escena pintando: que está colgado donde dice el reparto
 * desde la cuenta atrás hasta el final, y **lo que cuesta**: una llamada de dibujo, dos como
 * mucho (`xrcade.budget.drawCalls` del manifiesto).
 */

/** Los listones de Stick Rush en el salón. */
const OBJETIVO: Goal = {
  medals: { bronze: 1900, silver: 3750, gold: 5200 },
  better: 'higher',
  unit: 'points in challenge',
  record: null,
  mode: 'challenge',
}

const CARTEL = drawCallBudget('goal-sign')
const NOMBRE = 'cartel-de-objetivo'

/**
 * Dónde queda el cartel sin visor: la interfaz se planta delante de la cámara del anfitrión
 * (`XRGazeAnchor`), que está 60 cm por detrás del origen.
 */
const CAMARA_Z = 0.6
const DONDE: readonly [number, number, number] = [XR_CARTEL_POSITION[0], XR_CARTEL_POSITION[1], CAMARA_Z + XR_CARTEL_POSITION[2]]

test('con el reto del salón, el cartel cuelga encima del marcador y cuesta una llamada de dibujo', async ({ page }) => {
  // Una partida entera en tiempo real: con WebGL por software la caída se alarga.
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await installDrawCallCounter(page)
  await openHost(page, undefined, { reto: 20260925, goal: OBJETIVO })

  // Desde la cuenta atrás: la misión se lee antes de que caiga el primer palo.
  await expect
    .poll(() => buscarEnLaEscena(page, NOMBRE), { message: 'el cartel del objetivo no llegó a colgarse' })
    .toMatchObject({ visible: true })
  const cartel = await buscarEnLaEscena(page, NOMBRE)
  expect(cartel!.x).toBeCloseTo(DONDE[0], 2)
  expect(cartel!.y).toBeCloseTo(DONDE[1], 2)
  expect(cartel!.z).toBeCloseTo(DONDE[2], 2)

  // Sin tocar nada el reto se acaba solo con la tercera vida, y el cartel sigue ahí para decir
  // lo que faltó. Con la partida acabada la escena está quieta: es donde se mide.
  await expect
    .poll(() => partidasTerminadas(page), { timeout: 90_000, message: 'la escena no avisó del final del reto' })
    .toEqual([{ modo: 'challenge', puntos: 0, reto: true }])
  await expect.poll(() => buscarEnLaEscena(page, NOMBRE)).toMatchObject({ visible: true })

  // Lo que cuesta el cartel: las llamadas con él menos las llamadas sin él, mirándolo de frente
  // para que no lo descarte el recorte de la cámara.
  await mirarEnLaEscena(page, DONDE)
  const conCartel = await medianDrawCalls(page)
  expect(await esconderEnLaEscena(page, NOMBRE, true)).toBe(true)
  const sinCartel = await medianDrawCalls(page)
  expect(await esconderEnLaEscena(page, NOMBRE, false)).toBe(true)

  console.log(`[cartel] el cartel del objetivo: ${conCartel - sinCartel} llamadas (${sinCartel} sin él, ${conCartel} con él)`)
  expect(conCartel - sinCartel).toBeGreaterThanOrEqual(CARTEL.min)
  expect(conCartel - sinCartel).toBeLessThanOrEqual(CARTEL.max)
  expect(errors).toEqual([])
})

test('sin reto ni partida, en el menú, no hay cartel', async ({ page }) => {
  await openHost(page, undefined, { goal: OBJETIVO })

  // El menú es lo primero que monta la escena; el cartel solo cuelga con la partida en marcha.
  await expect.poll(() => buscarEnLaEscena(page, 'world-anchor')).not.toBeNull()
  expect(await buscarEnLaEscena(page, NOMBRE)).toBeNull()
})
