import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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
 * Familias instanciadas que dibuja la escena entera: las del recinto
 * (`FairPieces`) más las de la máquina (`MachinePieces`).
 *
 * Es la señal de que ya está todo montado. La máquina cuelga de un `Suspense`
 * propio esperando las texturas de la madera, así que llega bastante después
 * que el recinto: sus familias son lo último en aparecer.
 *
 * Se CUENTA del código en vez de escribirse a mano. Escrito, había que acordarse
 * de recontarlo cada vez que una de las dos familias creciera o menguara, y el
 * día que no te acuerdes el test no falla: espera de menos, la muestra sale con
 * la escena a medio montar y el techo de llamadas pasa midiendo una escena que
 * no es la que ve el jugador. Un guardián que se relaja solo es peor que no
 * tenerlo, porque nadie vuelve a mirarlo.
 */
function contarFamiliasInstanciadas(): number {
  const fuentes = ['FairPieces.tsx', 'MachinePieces.tsx'].map((archivo) =>
    readFileSync(join('src', 'components', 'game', archivo), 'utf8'),
  )
  const total = fuentes.reduce(
    (suma, fuente) => suma + (fuente.match(/createInstances\(/g)?.length ?? 0),
    0,
  )
  // Si esto sale a cero es que los ficheros se han movido o renombrado, y el test
  // pasaría a no esperar a nada: mejor romperse aquí, con el motivo delante.
  if (total === 0) {
    throw new Error(
      'No encuentro ninguna familia instanciada en src/components/game/: ' +
        '¿se han movido FairPieces.tsx o MachinePieces.tsx?',
    )
  }
  return total
}

const SCENE_INSTANCED_FAMILIES = contarFamiliasInstanciadas()

/**
 * Espera de las dos partes del muestreo. Más que los 15 s de `expect`: en CI la
 * escena va por software y un fotograma puede costar cientos de milisegundos,
 * así que tanto montarla como juntar la muestra llevan su tiempo aunque todo
 * esté bien.
 */
const SAMPLE_TIMEOUT = 45_000

/**
 * Llamadas por fotograma que cuesta la escena **en el menú**, que es el estado con
 * medidas comparables: arranca siempre con los mismos cinco palos colgando.
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
 * Lo que el test comprueba es el total, no el reparto: si la escena cambia de coste,
 * las cuatro líneas de arriba hay que rehacerlas aquí a mano, y quien avisa de que
 * toca es esta cifra clavada. Un techo holgado no lo haría: la escena podría
 * encarecerse la mitad sin que saltara nada y el desglose se quedaría desfasado en
 * silencio, que es justo lo que no puede pasar con una cuenta que nadie recalcula.
 */
const MENU_DRAW_CALLS = 29

/**
 * Cuánto se le deja moverse a la medida antes de exigir que se rehaga el desglose.
 *
 * Da para un palo colgando de más o de menos —tres llamadas cada uno— y poco más:
 * quedarse sin el recinto, o sin la máquina, son cinco de golpe y saltan. Lo gordo
 * salta con muchísimo margen: dejar de instanciar devolvería la escena a las ~110 de
 * cuando la máquina iba con cada tubo suelto.
 */
const MENU_DRAW_CALL_MARGIN = 4

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

/**
 * Fotogramas seguidos con la escena ya montada entera.
 *
 * Que el canvas tenga tamaño (`openGame`) solo dice que R3F ha empezado a
 * pintar. La máquina tarda más —sus texturas—, y en un arranque en frío la
 * muestra entera cabe en ese hueco: ahí el fotograma vale 6 llamadas, que no
 * son el coste de nada, y cualquier medida sobre ellas miente. Así que primero
 * se espera a que aparezcan todas las familias instanciadas y solo entonces se
 * cuenta.
 */
async function sampleFrames(page: Page, count = 30): Promise<DrawFrame[]> {
  // Sin contador no hay fotogramas que contar, y las esperas de abajo tardarían
  // 45 s en decirlo culpando a la escena de lo que falta aquí.
  const counting = await page.evaluate(() => Boolean(window.__drawFrames))
  expect(counting, 'falta countDrawCalls(page) antes de abrir la página').toBe(
    true,
  )

  await expect
    .poll(
      () =>
        page.evaluate(() => window.__drawFrames!.at(-1)?.instanced.length ?? 0),
      {
        message: 'la escena no llegó a montarse entera',
        timeout: SAMPLE_TIMEOUT,
      },
    )
    .toBeGreaterThanOrEqual(SCENE_INSTANCED_FAMILIES)

  // Lo contado durante el montaje ya no sirve: la muestra empieza aquí.
  await page.evaluate(() => {
    window.__drawFrames!.length = 0
  })
  await expect
    .poll(() => page.evaluate(() => window.__drawFrames!.length), {
      message: 'la escena no llegó a pintar fotogramas',
      timeout: SAMPLE_TIMEOUT,
    })
    .toBeGreaterThanOrEqual(count)
  return page.evaluate(() => window.__drawFrames!.slice())
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

  test('el menú cuesta las llamadas de dibujo que dice el desglose', async ({
    page,
  }) => {
    // Mediana: el fotograma en el que entra la máquina cuenta de más, y un pico
    // suelto no puede mover la cifra que se compara con el desglose.
    const calls = (await sampleFrames(page))
      .map((frame) => frame.calls)
      .sort((a, b) => a - b)
    const median = calls[Math.floor(calls.length / 2)]

    const measured =
      `llamadas por fotograma en el menú (el desglose dice ${MENU_DRAW_CALLS})`
    expect(median, measured).toBeGreaterThanOrEqual(
      MENU_DRAW_CALLS - MENU_DRAW_CALL_MARGIN,
    )
    expect(median, measured).toBeLessThanOrEqual(
      MENU_DRAW_CALLS + MENU_DRAW_CALL_MARGIN,
    )
  })
})
