import { expect, test } from '@playwright/test'

import { PLAY_HEIGHT_KEY } from '@/lib/ajustes'
import type { StickProbe } from '@/lib/sceneProbe'
import { openGame } from './helpers'
import {
  enterVR,
  installXREmulator,
  seatPlayer,
  startGameInsideSession,
} from './support/xr'

/**
 * Jugar sentado.
 *
 * **Era la barrera más grande que tenía el arcade**, y la única que no se podía sortear
 * jugando peor: las cotas de los trece juegos se eligieron con una persona de pie delante,
 * así que sentado —en una silla, en un sofá, en una silla de ruedas— el aro queda por
 * encima de donde llega el brazo y no hay partida. No falla nada, y por eso tampoco había
 * nada que arreglar: simplemente no se podía jugar.
 *
 * Aquí se sienta al jugador de verdad —la cabeza a metro veinte, que es lo que mide alguien
 * sentado— y se comprueba **con un palo del aro** que el mundo baja hasta él. Es lo único
 * que lo dice desde fuera del Canvas: la escena es geometría y no deja rastro en el DOM.
 */

/** Dónde está ahora mismo un palo del aro, en metros del mundo. */
async function alturaDeUnPalo(page: import('@playwright/test').Page) {
  const encontrado = await page.waitForFunction(
    () => {
      // El más alto de los que se pueden coger, que es uno que sigue colgando: el turno de
      // caída sale de una semilla nueva en cada partida, y el primero de la lista puede ser
      // justo el que ya está cayendo.
      const sticks = Object.values(window.__stickRushSticks ?? {}).filter((stick) => stick.catchable)
      return sticks.length === 0 ? null : sticks.reduce((alto, stick) => (stick.y > alto.y ? stick : alto))
    },
    undefined,
    { timeout: 15_000 },
  )
  return ((await encontrado.jsonValue()) as StickProbe).y
}

test.describe('el mundo a la altura de quien juega', () => {
  test.beforeEach(async ({ page }) => {
    await installXREmulator(page)
  })

  test('sentado y de pie, el aro está a la misma altura si nadie pide nada', async ({
    page,
  }) => {
    // El ajuste no se adivina: a quien está de pie, mover el suelo bajo los pies le
    // revuelve el estómago, y hay gente baja que prefiere el mundo como es.
    await openGame(page)
    await enterVR(page)
    await page.evaluate(() => {
      window.__stickRushSticks = {}
    })
    await startGameInsideSession(page)

    const dePie = await alturaDeUnPalo(page)
    await seatPlayer(page, 1.2)
    await page.waitForTimeout(1500)

    expect(await alturaDeUnPalo(page)).toBeCloseTo(dePie, 2)
  })

  test('pedido desde el arcade, el mundo baja hasta los ojos', async ({ page }) => {
    await openGame(page)
    await enterVR(page)
    await page.evaluate(() => {
      window.__stickRushSticks = {}
    })
    await startGameInsideSession(page)

    const dePie = await alturaDeUnPalo(page)

    // Sentarse y pedirlo, las dos cosas. El ajuste viaja por el navegador desde la portada
    // del arcade, y el aviso es lo que hace que llegue a un juego ya montado: quien lo
    // cambia está dentro del salón y recargar cerraría la sesión inmersiva.
    await seatPlayer(page, 1.2)
    await pedirElMundoALosOjos(page)
    // El seguimiento no salta: se acerca a la medida y solo la adopta cuando el cambio se
    // sostiene, para que agacharse a media partida no mueva la escena.
    await page.waitForTimeout(2500)

    const sentado = await alturaDeUnPalo(page)

    // Los cuarenta centímetros que le faltan a quien tiene los ojos a 1,20 para alcanzar
    // un mundo dibujado para 1,60.
    expect(dePie - sentado).toBeGreaterThan(0.3)
    expect(dePie - sentado).toBeLessThan(0.5)
  })

  test('elegido antes de empezar, el aro no baja dos veces', async ({ page }) => {
    // Este juego ya acomodaba **su aro** a la estatura de quien juega, medida mientras se
    // elige la partida (`XRPlayerHeight`). Con el mundo entero bajando además hasta los
    // ojos, el aro se llevaba las dos correcciones y acababa por debajo de las manos: el
    // arreglo es que deja de seguir la estatura cuando el decorado ya se acerca solo.
    await openGame(page)
    await enterVR(page)
    await page.evaluate(() => {
      window.__stickRushSticks = {}
    })

    // Sentado y pedido **desde el menú**, que es el camino de verdad: es ahí donde el aro
    // se mide, y por eso es ahí donde se notaba el doble descuento.
    await seatPlayer(page, 1.2)
    await pedirElMundoALosOjos(page)
    await page.waitForTimeout(2000)
    await startGameInsideSession(page)

    // Un palo del aro queda a la altura de un brazo de quien está sentado, ni por encima
    // de la cabeza ni por los tobillos. Con la doble corrección caía por debajo de 0,8.
    const alturaDelPalo = await alturaDeUnPalo(page)

    expect(alturaDelPalo).toBeGreaterThan(0.9)
    expect(alturaDelPalo).toBeLessThan(1.5)
  })
})

/** Pide el mundo a la altura de los ojos, como se hace desde los ajustes del arcade. */
async function pedirElMundoALosOjos(page: import('@playwright/test').Page) {
  await page.evaluate((clave) => {
    window.localStorage.setItem(clave, 'eyes')
    window.dispatchEvent(new Event('xrcade:ajustes'))
  }, PLAY_HEIGHT_KEY)
}
