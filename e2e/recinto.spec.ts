import { expect, test, type Page } from '@playwright/test'
import { openGame } from './helpers'

/**
 * Lo que cuesta pintar el recinto de feria, medido sobre la escena de verdad.
 *
 * Es la parte de "validar el recinto en el visor" que no necesita visor: lo que
 * se paga en unas gafas no son los triángulos sino las **llamadas de dibujo**, y
 * esas son las mismas aquí que allí (allí, eso sí, por ojo). Los fps de un
 * escritorio no dirían nada del visor; el número de llamadas sí.
 *
 * Se mide desde fuera, envolviendo el contexto WebGL, para no meter contadores
 * en el código del juego. El fotograma se cierra con un `requestAnimationFrame`
 * registrado antes que el de la escena, así que cada vuelta cuenta lo que se
 * dibujó en el fotograma anterior.
 */

/**
 * Instancias que tiene que dibujar cada familia de piezas del recinto —tablas,
 * postes y bombillas—, tal y como las suma `FAIR_PIECES` en `Fairground.tsx`:
 * 285 piezas entre las tres.
 *
 * Este es el aviso que drei no da: `<Instances limit={n}>` pinta
 * `min(limit, piezas)` **sin decir nada**, así que un límite corto no se ve como
 * un error sino como decorado que falta. Al añadir o quitar piezas del recinto
 * hay que traer aquí los números nuevos.
 */
const FAIR_INSTANCES = { boards: 120, poles: 55, bulbs: 110 }

/**
 * Techo de llamadas por fotograma **en el menú**, que es el estado con medidas
 * comparables: la escena arranca siempre con los mismos cinco palos colgando.
 *
 * Medidas 29, y este es el sitio donde vive el desglose entero —`ESTADO.md` y
 * `TODO.md` citan el total y remiten aquí, que es el único de los tres que se
 * ejecuta—:
 *
 * - **5 el recinto**: sus tres familias instanciadas más los dos aros de la noria.
 * - **5 la máquina**: tres familias de tubos (comparten geometría pero no material)
 *   y dos de bombillas.
 * - **15 los cinco palos**, a tres cada uno mientras cuelgan: la cuerda, el palo y
 *   su gancho. Al caer pasan a dos.
 * - **4 las bases de los postes**: la del pie y la del tirante, por cada uno de los
 *   dos postes.
 *
 * Los palos y sus ganchos van sueltos a propósito —un palo se coge con la mano y una
 * instancia no se puede apuntar ni mover por su cuenta—, así que el total es lo único
 * que se mueve con la partida: 53 con trece palos colgando, y bajando según se
 * resuelven. El recinto y la máquina no cambian nunca.
 *
 * Lo que el test comprueba es el techo, no el reparto: si la escena cambia de coste,
 * las cuatro líneas de arriba hay que rehacerlas aquí a mano —nadie va a avisar—.
 *
 * El margen absorbe algún palo de más. Lo que tiene que saltar es dejar de
 * instanciar: cuando la máquina iba con cada tubo suelto eran 110, así que un
 * techo de 45 caza esa regresión mientras que uno de 120 la dejaba pasar entera.
 */
const MENU_DRAW_CALL_BUDGET = 45

interface DrawFrame {
  /** Llamadas de dibujo del fotograma. */
  calls: number
  /** Instancias pedidas en cada llamada instanciada del fotograma. */
  instanced: number[]
}

declare global {
  interface Window {
    /** Solo existe con el contador puesto (`countDrawCalls`), como `__audioSpy`. */
    __drawFrames?: DrawFrame[]
  }
}

/** Envuelve el contexto WebGL para contar llamadas. Antes de `page.goto`. */
async function countDrawCalls(page: Page) {
  await page.addInitScript(() => {
    const frames: DrawFrame[] = []
    window.__drawFrames = frames

    let calls = 0
    let instanced: number[] = []

    const gl = WebGL2RenderingContext.prototype
    const { drawElements, drawElementsInstanced } = gl
    gl.drawElements = function (...args: Parameters<typeof drawElements>) {
      calls++
      return drawElements.apply(this, args)
    }
    gl.drawElementsInstanced = function (
      ...args: Parameters<typeof drawElementsInstanced>
    ) {
      calls++
      instanced.push(args[4])
      return drawElementsInstanced.apply(this, args)
    }

    const closeFrame = () => {
      frames.push({ calls, instanced })
      // Solo interesan los últimos: la muestra se toma con la escena asentada.
      if (frames.length > 240) frames.shift()
      calls = 0
      instanced = []
      requestAnimationFrame(closeFrame)
    }
    requestAnimationFrame(closeFrame)
  })
}

/** Fotogramas seguidos contados desde ya: los de la carga no cuentan. */
async function sampleFrames(page: Page, count = 30): Promise<DrawFrame[]> {
  await page.evaluate(() => {
    if (window.__drawFrames) window.__drawFrames.length = 0
  })
  await expect
    .poll(() => page.evaluate(() => window.__drawFrames?.length ?? 0), {
      message: 'la escena no llegó a pintar fotogramas',
      // Más que los 15 s de `expect`: en CI la escena va por software y un
      // fotograma puede costar cientos de milisegundos, así que juntar la
      // muestra lleva su tiempo aunque todo esté bien.
      timeout: 45_000,
    })
    .toBeGreaterThanOrEqual(count)
  return page.evaluate(() => window.__drawFrames?.slice() ?? [])
}

test.describe('Coste de dibujo del recinto', () => {
  test.beforeEach(async ({ page }) => {
    await countDrawCalls(page)
    await openGame(page)
  })

  test('pinta las 285 piezas del recinto, sin recortes silenciosos', async ({
    page,
  }) => {
    const frames = await sampleFrames(page)
    const expected = Object.values(FAIR_INSTANCES)
    // Basta con que un fotograma las traiga todas: si un límite se quedara
    // corto, el recorte saldría en todos.
    const complete = frames.some((frame) =>
      expected.every((count) => frame.instanced.includes(count)),
    )

    expect(
      complete,
      `ningún fotograma dibujó ${expected.join(' + ')} instancias; el último trajo ${
        frames.at(-1)?.instanced.join(' + ') || 'ninguna'
      }`,
    ).toBe(true)
  })

  test('el decorado no dispara las llamadas de dibujo', async ({ page }) => {
    // Mediana: un fotograma suelto puede pillar la escena a medio montar.
    const calls = (await sampleFrames(page))
      .map((frame) => frame.calls)
      .sort((a, b) => a - b)
    const median = calls[Math.floor(calls.length / 2)]

    expect(median, 'llamadas de dibujo por fotograma en el menú').toBeLessThanOrEqual(
      MENU_DRAW_CALL_BUDGET,
    )
  })
})
