import { expect, test, type Page } from '@playwright/test'

import { CROSSFADE } from '../src/lib/hints'
import { GUION_DE_AYUDAS } from '../src/lib/guionDeAyudas'
import { TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE } from '../src/lib/tutorial'
import { openGame } from './helpers'
import { installDrawCallCounter, letSettle, storeBeforeOpen, medianDrawCalls } from './support/scenery'
import { buscarEnLaEscena, enterHostBooth, enterHostVR, openHost } from './support/host'
import { enterVR, installXREmulator, lookAt } from './support/xr'

/**
 * Las ayudas visuales, dentro del visor.
 *
 * **Qué se comprueba aquí y qué no.** Que el guion se apague solo, que lo que flota se vaya
 * antes de que caiga nada y que ninguna cota tape la máquina ni los palos lo mide
 * `src/lib/guionDeAyudas.test.ts`, sin navegador y con cifras. Lo que solo se ve aquí es que
 * **se pinten de verdad** —que es distinto de que el guion las encienda— y que **dejen de
 * pintarse** cuando toca.
 *
 * **Y se miden por lo que cuestan**, que es lo único que una ayuda deja ver desde fuera del
 * visor: las llamadas de dibujo por fotograma (`e2e/support/scenery.ts`). Una ayuda encendida
 * cuesta; apagada es invisible y no cuesta nada. **Se mide en el menú**, que es la fase quieta:
 * los palos cuelgan y no cae ninguno, así que lo único que cambia entre las dos medidas son las
 * ayudas.
 *
 * Si se **leen** —si el fantasma se entiende como un palo que cae o como un borrón ámbar— no lo
 * dice ningún número: para eso están las capturas, y la respuesta llega con las gafas puestas.
 *
 * **Se entra con el tutorial ya visto** para que su panel y su mando sobre la mano no cuenten en
 * la medida. El mando de las ayudas va al lado del fantasma, así que no se pisan.
 */

const CAPTURAS = 'test-results/capturas'

/**
 * Hacia dónde se mira para verlas: al palo de delante y un poco abajo, que es por donde cae el
 * fantasma y donde está el mando. **Las dos medidas de una comparación se toman con la cabeza en
 * el mismo sitio**: si no, lo que se compara son dos vistas y no dos escenas.
 */
const A_LA_MAQUINA = { yaw: 0, pitch: -18 }
/** Y a los pies, que es donde están las huellas: solo para la captura. */
const A_LOS_PIES = { yaw: 0, pitch: -70 }

/** Lo que tarda la ayuda más paciente en irse sola, más el cruce con el que se desvanece. */
const HASTA_QUE_SE_VAN = Math.max(...GUION_DE_AYUDAS.map((ayuda) => ayuda.expiresAfter)) + CROSSFADE + 2

/**
 * Cuántas llamadas de dibujo por fotograma pueden costar todas las ayudas a la vez.
 *
 * Los dos ojos de una sesión inmersiva duplican cada malla, y el modelo del mando trae las
 * suyas —es, de largo, la cara: por eso se va con el fantasma—. El resto son tres mallas: las
 * dos huellas y el fantasma.
 */
const TECHO_DE_LAS_AYUDAS = 60

/** Deja que el cruce con el que aparecen o se van termine, que dura casi medio segundo. */
async function dejarQueCrucen(page: Page) {
  await page.waitForTimeout(CROSSFADE * 1000 + 300)
  await letSettle(page)
}

test.describe('Las ayudas visuales', () => {
  test('en el menú se pintan, y se van solas al agotarse su plazo', async ({ page }) => {
    test.setTimeout(HASTA_QUE_SE_VAN * 1000 + 90_000)
    await installDrawCallCounter(page)
    await installXREmulator(page)
    await storeBeforeOpen(page, TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE)
    await openGame(page)
    await enterVR(page)

    await lookAt(page, A_LA_MAQUINA.yaw, A_LA_MAQUINA.pitch)
    await dejarQueCrucen(page)
    const conAyudas = await medianDrawCalls(page)
    await page.screenshot({ path: `${CAPTURAS}/ayudas-menu-maquina.png` })
    await lookAt(page, A_LOS_PIES.yaw, A_LOS_PIES.pitch)
    await dejarQueCrucen(page)
    await page.screenshot({ path: `${CAPTURAS}/ayudas-menu-pies.png` })

    // Se dejan caducar, que es la única forma de apagarlas sin tocar la escena. **La cabeza
    // vuelve al mismo sitio para la segunda medida.**
    await lookAt(page, A_LA_MAQUINA.yaw, A_LA_MAQUINA.pitch)
    await page.waitForTimeout(HASTA_QUE_SE_VAN * 1000)
    await letSettle(page)
    const sinAyudas = await medianDrawCalls(page)
    await page.screenshot({ path: `${CAPTURAS}/ayudas-agotadas.png` })

    console.log(`[ayudas] llamadas por fotograma: con ayudas ${conAyudas}, agotadas ${sinAyudas}`)
    expect(conAyudas, 'las ayudas no costaron nada: ¿se están pintando?').toBeGreaterThan(sinAyudas)
    expect(
      conAyudas - sinAyudas,
      `${conAyudas} llamadas con ayudas y ${sinAyudas} sin ellas: se han ido de precio`,
    ).toBeLessThanOrEqual(TECHO_DE_LAS_AYUDAS)
  })

  test('lo que flota se va antes de que caiga el primer palo, y las huellas se quedan', async ({
    page,
  }) => {
    // Con el reto la partida arranca sola al montar la escena, así que se ve la cuenta atrás
    // entera sin pulsar nada en el menú del visor.
    await installXREmulator(page)
    await openHost(page, undefined, { aLaCarta: true, reto: 7 })
    await enterHostVR(page)
    await enterHostBooth(page)

    await expect
      .poll(() => buscarEnLaEscena(page, 'ayuda-palo'), {
        // La cuenta atrás deja dos segundos para verlo: se mira a menudo.
        intervals: [100],
        message: 'el fantasma no llegó a pintarse',
      })
      .toMatchObject({ visible: true })
    expect(await buscarEnLaEscena(page, 'ayuda-mando')).toMatchObject({ visible: true })

    // En el último segundo de la cuenta se van los dos; las huellas, pintadas en el suelo, siguen.
    await expect
      .poll(async () => (await buscarEnLaEscena(page, 'ayuda-palo'))?.visible, { timeout: 6_000 })
      .toBe(false)
    expect(await buscarEnLaEscena(page, 'ayuda-mando')).toMatchObject({ visible: false })
    expect(await buscarEnLaEscena(page, 'ayuda-huella-0')).toMatchObject({ visible: true })
  })
})
