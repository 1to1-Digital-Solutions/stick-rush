import { describe, expect, it } from 'vitest'
import { drawDuel } from './XRHud'
import { LINE_HEIGHT } from './canvasPanel'
import { DUEL_TEXT, XR_DUEL_POSITION, XR_DUEL_SIZE, xrPanelViews } from '../../lib/xrLayout'
import { recordingCanvas, legibilityProblems, type DrawnText } from './legibility'
import { MIN_READING_DEGREES, sizesOffList, unreadableTexts, worstReadingDistance } from '../../lib/panelReading'
import { createDuel, duelSummary, recordTurn, type Duel } from '../../lib/duel'

/**
 * The end of a two-player round inside the headset, measured instead of looked at: the notice to pass the
 * controller, a match won and a tie, with the widest figures and the pair having many so far.
 *
 * In the two languages —Spanish is longer and is where the text runs off— and from where it is played:
 * in front of the eyes, at three heights.
 */

const LANGUAGES = ['en', 'es'] as const
const VIEWS = xrPanelViews(XR_DUEL_POSITION)
const PAIR = { wins: [128, 99] as const, ties: 17 }
const DUELS: Record<string, Duel> = {
  passes: recordTurn(createDuel(1), 18888),
  wins: recordTurn(recordTurn(createDuel(1), 18888), 29999),
  tie: recordTurn(recordTurn(createDuel(1), 20000), 20000),
}

function moments(): { where: string; drawnTexts: DrawnText[] }[] {
  return LANGUAGES.flatMap((lang) =>
    Object.entries(DUELS).map(([name, duel]) => {
      const { ctx, drawnTexts } = recordingCanvas()
      drawDuel(ctx, duelSummary(duel, PAIR, lang))
      return { where: `${lang} ${name}`, drawnTexts }
    }),
  )
}

describe('the end of a two-player round', () => {
  it('reads: nothing overlaps or runs off the panel', () => {
    for (const { where, drawnTexts } of moments()) {
      expect(drawnTexts.length, 'nothing was measured').toBeGreaterThan(1)
      const panel = { width: XR_DUEL_SIZE[0], height: XR_DUEL_SIZE[1] }
      const distance = Math.max(...VIEWS.map(({ pose, eyes }) => worstReadingDistance(drawnTexts, pose, eyes, LINE_HEIGHT)))
      expect(legibilityProblems(drawnTexts, { panel, distance }), where).toEqual([])
    }
  })

  it(`no letter drops below ${MIN_READING_DEGREES}°, at any eye height`, () => {
    for (const { where, drawnTexts } of moments()) {
      for (const view of VIEWS) {
        expect(unreadableTexts(drawnTexts, view.pose, view.eyes, LINE_HEIGHT), `${where}, ${view.where}`).toEqual([])
      }
    }
  })

  it('and all of them are written with a size from the list, without shrinking', () => {
    for (const { where, drawnTexts } of moments()) {
      expect(sizesOffList(drawnTexts, LINE_HEIGHT, Object.values(DUEL_TEXT)), where).toEqual([])
    }
  })

  it('says what it should: who to pass the controller to, and then who wins and what they have so far', () => {
    const passes = recordingCanvas()
    drawDuel(passes.ctx, duelSummary(DUELS.passes, PAIR, 'es'))
    expect(passes.drawnTexts.map((e) => e.text)).toEqual(['Jugador 1: 18.888 puntos', 'Pásale el mando a Jugador 2.'])

    const wins = recordingCanvas()
    drawDuel(wins.ctx, duelSummary(DUELS.wins, PAIR, 'en'))
    expect(wins.drawnTexts.map((e) => e.text)).toEqual([
      'Player 2 wins',
      'Player 1: 18,888 points',
      'Player 2: 29,999 points',
      'Duels won: 128–99 · tied: 17',
    ])
  })
})
