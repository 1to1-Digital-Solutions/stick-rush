import { expect, test, type Page } from '@playwright/test'
import { SCENERY_KEY } from '../src/lib/ajustes'
import { OWN_SCENERY_KEY } from '../src/lib/sceneryPreference'
import {
  combinacionesDeLuces,
  contarLlamadas,
  dejarAsentar,
  elegirEnElSalon,
  guardarAntesDeAbrir,
  leerClave,
  medianaDeLlamadas,
  programasEnlazados,
  vigilarProgramas,
} from './support/escenario'
import { openGame } from './helpers'
import { enterVR, installXREmulator } from './support/xr'

/**
 * El escenario lo elige el salón (`xrcade:scenery`), no el tipo de sesión ni un ajuste del juego.
 *
 * Se abre la web del juego y se entra por su botón, que abre realidad aumentada cuando el visor la
 * tiene, como el salón: así se comprueba también que fuera del salón el ajuste funciona igual, en
 * el origen del juego y con el sitio dibujado por defecto. Ahí el tipo de sesión es el mismo con
 * las dos elecciones, así que lo único que puede quitar la plaza es el escenario.
 */

/**
 * Cuántas llamadas de dibujo por fotograma, como poco, separan la plaza de la habitación.
 *
 * Aquí el margen es más corto que en otros juegos: el recinto va instanciado —una llamada por
 * familia de piezas—, así que la plaza entera, con su suelo y su fondo, se mide en unas
 * dieciséis por fotograma, contando los dos ojos. El selector del escenario no cambia de
 * piezas al cambiar, solo de sitio, y no suma ninguna.
 */
const LO_QUE_PINTA_EL_DECORADO = 8

/**
 * Entra por el botón de la web, que abre realidad aumentada si el visor la tiene: el Quest 3
 * del emulador la tiene, así que es la misma sesión en la que entra el salón.
 */
async function entrarPorLaWeb(page: Page) {
  await enterVR(page)
}

async function haySesion(page: Page) {
  return page.evaluate(() => window.__xrTest.hasSession())
}

test.describe('El escenario lo elige el salón', () => {
  test.beforeEach(async ({ page }) => {
    await contarLlamadas(page)
    await installXREmulator(page)
  })

  test('con «room» no se pinta la plaza y con «place» sí, sin salir de la sesión', async ({ page }) => {
    await guardarAntesDeAbrir(page, SCENERY_KEY, 'room')
    await openGame(page)
    await entrarPorLaWeb(page)

    const enLaHabitacion = await medianaDeLlamadas(page)
    await elegirEnElSalon(page, 'place')
    const conDecorado = await medianaDeLlamadas(page)
    console.log(`[escenario] llamadas por fotograma: habitación ${enLaHabitacion}, decorado ${conDecorado}`)

    expect(conDecorado, 'con «place» en realidad aumentada no se pintó la plaza').toBeGreaterThan(
      enLaHabitacion + LO_QUE_PINTA_EL_DECORADO,
    )
    // Y volver a la habitación lo quita otra vez, en la misma sesión.
    await elegirEnElSalon(page, 'room')
    expect(await medianaDeLlamadas(page), 'con «room» se siguió pintando la plaza').toBeLessThan(
      conDecorado - LO_QUE_PINTA_EL_DECORADO,
    )
    expect(await haySesion(page), 'cambiar el escenario cerró la sesión').toBe(true)
  })

  test('la clave propia del juego no manda: en «passthrough» y sin nada del salón, se pinta la plaza', async ({
    page,
  }) => {
    await guardarAntesDeAbrir(page, OWN_SCENERY_KEY, 'passthrough')
    await openGame(page)
    await entrarPorLaWeb(page)

    const conLaClavePropia = await medianaDeLlamadas(page)
    // Se borró al montar la partida, y sin pasar a la del arcade: manda lo que diga el salón.
    expect(await leerClave(page, OWN_SCENERY_KEY), 'la clave propia del juego sigue guardada').toBeNull()
    expect(await leerClave(page, SCENERY_KEY), 'la clave propia del juego se trasladó a la del arcade').toBeNull()

    await elegirEnElSalon(page, 'room')
    const enLaHabitacion = await medianaDeLlamadas(page)
    console.log(`[escenario] llamadas por fotograma: clave propia ${conLaClavePropia}, habitación ${enLaHabitacion}`)

    expect(conLaClavePropia, 'la clave propia del juego quitó la plaza').toBeGreaterThan(
      enLaHabitacion + LO_QUE_PINTA_EL_DECORADO,
    )
  })

  test('alternar el escenario no cambia las luces ni recompila ningún shader', async ({ page }) => {
    // El tirón al cambiar de escenario con el visor puesto. Quitar una luz o la niebla con
    // la plaza cambia el programa de todo lo que se ilumina, y desmontar el decorado libera
    // sus shaders, que se vuelven a compilar al volver. Las luces se quedan montadas —apagadas
    // donde no alumbran—, la niebla se aleja y el decorado se oculta.
    await vigilarProgramas(page)
    await guardarAntesDeAbrir(page, SCENERY_KEY, 'room')
    await openGame(page)
    await entrarPorLaWeb(page)
    await dejarAsentar(page)

    // Una vuelta entera primero: lo que solo existe en uno de los dos escenarios se compila la
    // primera vez que se ve, y eso pasa una vez por visita, no a cada cambio.
    await elegirEnElSalon(page, 'place')
    await dejarAsentar(page)
    await elegirEnElSalon(page, 'room')
    await dejarAsentar(page)
    const trasLaPrimeraVuelta = await programasEnlazados(page)

    await elegirEnElSalon(page, 'place')
    await dejarAsentar(page)
    await elegirEnElSalon(page, 'room')
    await dejarAsentar(page)

    const luces = await combinacionesDeLuces(page)
    console.log(`[escenario] luces con las que se pinta: ${luces.join(' | ')}`)
    expect(luces, 'el número de luces cambió con el escenario').toHaveLength(1)
    expect(
      (await programasEnlazados(page)) - trasLaPrimeraVuelta,
      'volver a cambiar de escenario recompiló shaders: eso es un tirón con el visor puesto',
    ).toBe(0)
    expect(await haySesion(page), 'cambiar el escenario cerró la sesión').toBe(true)
  })
})
