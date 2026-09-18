import { describe, expect, it } from 'vitest'
import { dibujarElAviso } from './XRHud'
import { ALTO_DE_LINEA } from './canvasPanel'
import {
  CONFIRM_BOXES,
  CONFIRM_TEXT,
  XR_CONFIRM_POSITION,
  XR_CONFIRM_SIZE as CONFIRM_SIZE,
  xrPanelViews,
} from '../../lib/xrLayout'
import { lienzoQueApunta, problemasDeLegibilidad, type Escrito } from './legibilidad'
import {
  MIN_READING_DEGREES,
  sizesOffList,
  textsOnButtons,
  unreadableTexts,
  worstReadingDistance,
} from '../../lib/panelReading'
import { traductor } from '../../lib/textos'

/**
 * El aviso de dejar la partida, medido en vez de mirado.
 *
 * Es uno de los dos paneles que el propio `legibilidad.ts` nombra como sitios donde el
 * problema ya pasó —«el texto se superpone», «no se entiende nada»— y no lo medía nadie en
 * este juego. Se mide en los dos idiomas: el español es más largo que el inglés casi
 * siempre, y es donde el texto se sale.
 *
 * Y desde donde se juega: delante de los ojos, donde el menú, a tres alturas de ojos.
 */

const IDIOMAS = ['en', 'es'] as const
const VISTAS = xrPanelViews(XR_CONFIRM_POSITION)

function medir(lang: (typeof IDIOMAS)[number]): Escrito[] {
  const { ctx, escritos } = lienzoQueApunta()
  dibujarElAviso(ctx, traductor(lang))
  return escritos
}

describe('el aviso de dejar la partida', () => {
  it('se lee en los dos idiomas', () => {
    for (const lang of IDIOMAS) {
      const escritos = medir(lang)

      expect(escritos.length, 'no se ha medido nada').toBeGreaterThan(0)
      const panel = { width: CONFIRM_SIZE[0], height: CONFIRM_SIZE[1] }
      const distancia = Math.max(...VISTAS.map(({ pose, ojos }) => worstReadingDistance(escritos, pose, ojos, ALTO_DE_LINEA)))
      expect(problemasDeLegibilidad(escritos, { panel, distancia }), lang).toEqual([])
    }
  })
})

describe('cada letra del aviso se lee de un vistazo', () => {
  it(`ninguna baja de ${MIN_READING_DEGREES}°, en los dos idiomas y a cualquier altura de ojos`, () => {
    for (const lang of IDIOMAS) {
      for (const vista of VISTAS) {
        expect(unreadableTexts(medir(lang), vista.pose, vista.ojos, ALTO_DE_LINEA), `${lang}, ${vista.donde}`).toEqual([])
      }
    }
  })

  it('y todas se escriben con un tamaño de la lista, sin encogerse', () => {
    // «Seguir jugando» no cabía en su botón y se encogía a 33 mm.
    for (const lang of IDIOMAS) {
      expect(sizesOffList(medir(lang), ALTO_DE_LINEA, Object.values(CONFIRM_TEXT)), lang).toEqual([])
    }
  })

  it('y la pregunta no se mete en los botones, ni la etiqueta de uno en el otro', () => {
    const botones = Object.values(CONFIRM_BOXES).map(({ position, size }) => ({
      x: position[0],
      y: position[1],
      width: size[0],
      height: size[1],
    }))
    for (const lang of IDIOMAS) {
      expect(textsOnButtons(medir(lang), botones), lang).toEqual([])
    }
  })

  it('el control: una etiqueta encogida a 24 mm no llegaría', () => {
    const salir = medir('es').find((e) => e.texto === 'Salir')!
    const vista = VISTAS[0]
    expect(unreadableTexts([{ ...salir, alto: 0.024 * ALTO_DE_LINEA }], vista.pose, vista.ojos, ALTO_DE_LINEA)).toHaveLength(1)
  })
})
