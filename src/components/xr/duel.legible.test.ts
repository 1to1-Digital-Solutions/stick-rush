import { describe, expect, it } from 'vitest'
import { dibujarElDuelo } from './XRHud'
import { LINE_HEIGHT } from './canvasPanel'
import { DUEL_TEXT, XR_DUEL_POSITION, XR_DUEL_SIZE, xrPanelViews } from '../../lib/xrLayout'
import { recordingCanvas, legibilityProblems, type DrawnText } from './legibility'
import { MIN_READING_DEGREES, sizesOffList, unreadableTexts, worstReadingDistance } from '../../lib/panelReading'
import { createDuel, duelSummary, recordTurn, type Duel } from '../../lib/duel'

/**
 * El final de una tanda a dos dentro del visor, medido en vez de mirado: el aviso de pasar el
 * mando, una partida ganada y un empate, con las cifras más anchas y la pareja llevando muchas.
 *
 * En los dos idiomas —el español es más largo y es donde el texto se sale— y desde donde se juega:
 * delante de los ojos, a tres alturas.
 */

const IDIOMAS = ['en', 'es'] as const
const VISTAS = xrPanelViews(XR_DUEL_POSITION)
const PAREJA = { wins: [128, 99] as const, ties: 17 }
const DUELOS: Record<string, Duel> = {
  pasa: recordTurn(createDuel(1), 18888),
  gana: recordTurn(recordTurn(createDuel(1), 18888), 29999),
  empate: recordTurn(recordTurn(createDuel(1), 20000), 20000),
}

function momentos(): { donde: string; escritos: DrawnText[] }[] {
  return IDIOMAS.flatMap((lang) =>
    Object.entries(DUELOS).map(([nombre, duel]) => {
      const { ctx, drawnTexts: escritos } = recordingCanvas()
      dibujarElDuelo(ctx, duelSummary(duel, PAREJA, lang))
      return { donde: `${lang} ${nombre}`, escritos }
    }),
  )
}

describe('el final de una tanda a dos', () => {
  it('se lee: nada se pisa ni se sale del panel', () => {
    for (const { donde, escritos } of momentos()) {
      expect(escritos.length, 'no se ha medido nada').toBeGreaterThan(1)
      const panel = { width: XR_DUEL_SIZE[0], height: XR_DUEL_SIZE[1] }
      const distancia = Math.max(...VISTAS.map(({ pose, ojos }) => worstReadingDistance(escritos, pose, ojos, LINE_HEIGHT)))
      expect(legibilityProblems(escritos, { panel, distance: distancia }), donde).toEqual([])
    }
  })

  it(`ninguna letra baja de ${MIN_READING_DEGREES}°, a ninguna altura de ojos`, () => {
    for (const { donde, escritos } of momentos()) {
      for (const vista of VISTAS) {
        expect(unreadableTexts(escritos, vista.pose, vista.ojos, LINE_HEIGHT), `${donde}, ${vista.donde}`).toEqual([])
      }
    }
  })

  it('y todas se escriben con un tamaño de la lista, sin encogerse', () => {
    for (const { donde, escritos } of momentos()) {
      expect(sizesOffList(escritos, LINE_HEIGHT, Object.values(DUEL_TEXT)), donde).toEqual([])
    }
  })

  it('dice lo que toca: a quién pasarle el mando, y luego quién gana y lo que llevan', () => {
    const pasa = recordingCanvas()
    dibujarElDuelo(pasa.ctx, duelSummary(DUELOS.pasa, PAREJA, 'es'))
    expect(pasa.drawnTexts.map((e) => e.text)).toEqual(['Jugador 1: 18.888 puntos', 'Pásale el mando a Jugador 2.'])

    const gana = recordingCanvas()
    dibujarElDuelo(gana.ctx, duelSummary(DUELOS.gana, PAREJA, 'en'))
    expect(gana.drawnTexts.map((e) => e.text)).toEqual([
      'Player 2 wins',
      'Player 1: 18,888 points',
      'Player 2: 29,999 points',
      'Duels won: 128–99 · tied: 17',
    ])
  })
})
