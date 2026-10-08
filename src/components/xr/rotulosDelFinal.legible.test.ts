import { describe, expect, it } from 'vitest'
import { ROTULOS_DEL_FINAL, dibujarRotulosDelFinal } from './XRHud'
import { ALTO_DE_LINEA } from './canvasPanel'
import { XR_HUD_POSITION, xrHudLayout, xrPanelViews } from '../../lib/xrLayout'
import { lienzoQueApunta, problemasDeLegibilidad, type Escrito } from './legibilidad'
import { MIN_READING_DEGREES, unreadableTexts, worstReadingDistance } from '../../lib/panelReading'
import { traductor } from '../../lib/textos'

/**
 * Los rótulos de los botones de fin de partida, medidos en vez de mirados: «Otra partida» es la
 * etiqueta más larga y es en español donde se sale. Se miden con el reto («Otro reto») y con los
 * demás modos («Otra partida»).
 */

const IDIOMAS = ['en', 'es'] as const
/** La fila de botones va 12 cm por debajo de las fichas (`XRHud`), y los rótulos debajo de ella. */
const BAJO_LAS_FICHAS = -0.12 + ROTULOS_DEL_FINAL.y
/** Donde de verdad quedan: con el cartel encima y sin él, que mueve las fichas. */
const VISTAS = [true, false].flatMap((sign) => {
  const { content } = xrHudLayout({ finished: true, row: true, sign })
  const [x, y, z] = XR_HUD_POSITION
  return xrPanelViews([x, y + content + BAJO_LAS_FICHAS, z])
})

const MODOS = ['challenge', 'practice'] as const

function medir(lang: (typeof IDIOMAS)[number], modo: (typeof MODOS)[number] = 'challenge'): Escrito[] {
  const { ctx, escritos } = lienzoQueApunta()
  dibujarRotulosDelFinal(ctx, traductor(lang), modo)
  return escritos
}

describe('los rótulos de los botones del final', () => {
  it('dicen los dos botones y no se pisan ni se salen, en los dos idiomas y en cada modo', () => {
    for (const lang of IDIOMAS) {
      for (const modo of MODOS) {
        const escritos = medir(lang, modo)
        expect(escritos.map((e) => e.texto), lang).toHaveLength(2)
        const panel = { width: ROTULOS_DEL_FINAL.width, height: ROTULOS_DEL_FINAL.height }
        const distancia = Math.max(...VISTAS.map(({ pose, ojos }) => worstReadingDistance(escritos, pose, ojos, ALTO_DE_LINEA)))
        expect(problemasDeLegibilidad(escritos, { panel, distancia }), `${lang}, ${modo}`).toEqual([])
      }
    }
    expect(medir('es').map((e) => e.texto)).toEqual(['Otro reto', 'Menú'])
    expect(medir('es', 'practice').map((e) => e.texto)).toEqual(['Otra partida', 'Menú'])
  })

  it(`ninguna letra baja de ${MIN_READING_DEGREES}°, a cualquier altura de ojos`, () => {
    for (const lang of IDIOMAS) {
      for (const modo of MODOS) {
        for (const vista of VISTAS) {
          expect(unreadableTexts(medir(lang, modo), vista.pose, vista.ojos, ALTO_DE_LINEA), `${lang}, ${modo}, ${vista.donde}`).toEqual([])
        }
      }
    }
  })
})
