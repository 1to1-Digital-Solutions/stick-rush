import { describe, expect, it } from 'vitest'
import { FRASES, PANEL_WIDTH, TEXT_HEIGHT, TEXT_OFFSET_Y, TUTORIAL_TEXT, dibujarLaFrase } from './XRTutorial'
import { ALTO_DE_LINEA } from './canvasPanel'
import { lienzoQueApunta, problemasDeLegibilidad, type Escrito } from './legibilidad'
import type { TutorialStepKey } from '../../lib/tutorial'
import { XR_TUTORIAL_POSITION, xrPanelViews } from '../../lib/xrLayout'
import { MIN_READING_DEGREES, sizesOffList, unreadableTexts, worstReadingDistance } from '../../lib/panelReading'
import { traductor } from '../../lib/textos'

/**
 * La frase del tutorial, medida en vez de mirada.
 *
 * Es el único texto del tutorial —el resto es un dibujo que enseña el gesto— y va en una banda
 * encima del panel, por encima de la vista. Se mide cada tramo en los dos idiomas y desde donde
 * se juega: delante de los ojos, a tres alturas de ojos y con el mundo de pie o no.
 */

const IDIOMAS = ['en', 'es'] as const
const BANDA = { width: PANEL_WIDTH, height: TEXT_HEIGHT }
const VISTAS = xrPanelViews([XR_TUTORIAL_POSITION[0], XR_TUTORIAL_POSITION[1] + TEXT_OFFSET_Y, XR_TUTORIAL_POSITION[2]])

function todasLasFrases(): { donde: string; escritos: Escrito[] }[] {
  return IDIOMAS.flatMap((lang) =>
    (Object.keys(FRASES) as TutorialStepKey[]).map((step) => {
      const { ctx, escritos } = lienzoQueApunta()
      dibujarLaFrase(ctx, traductor(lang), step)
      return { donde: `${lang} ${step}`, escritos }
    }),
  )
}

describe('la frase del tutorial se lee', () => {
  it('en cada tramo y en los dos idiomas, sin salirse de su banda', () => {
    for (const { donde, escritos } of todasLasFrases()) {
      expect(escritos.length, donde).toBeGreaterThan(0)
      const distancia = Math.max(...VISTAS.map(({ pose, ojos }) => worstReadingDistance(escritos, pose, ojos, ALTO_DE_LINEA)))
      expect(problemasDeLegibilidad(escritos, { panel: BANDA, distancia }), donde).toEqual([])
    }
  })

  it(`y cada letra, de un vistazo: ninguna baja de ${MIN_READING_DEGREES}° ni se escribe fuera de la lista`, () => {
    for (const { donde, escritos } of todasLasFrases()) {
      for (const vista of VISTAS) {
        expect(unreadableTexts(escritos, vista.pose, vista.ojos, ALTO_DE_LINEA), `${donde}, ${vista.donde}`).toEqual([])
      }
      expect(sizesOffList(escritos, ALTO_DE_LINEA, Object.values(TUTORIAL_TEXT)), donde).toEqual([])
    }
  })

  it('sin tramo que enseñar no escribe nada', () => {
    const { ctx, escritos } = lienzoQueApunta()
    dibujarLaFrase(ctx, traductor('es'), null)
    expect(escritos).toEqual([])
  })
})
