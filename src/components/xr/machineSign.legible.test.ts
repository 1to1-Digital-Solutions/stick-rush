import { describe, expect, it } from 'vitest'
import {
  DRAW_DISTANCE,
  SIGN_PANEL,
  drawSign,
  signScale,
  signAspect,
} from './GoalSign'
import { LINE_HEIGHT } from './canvasPanel'
import { MIN_ANGLE, recordingCanvas, legibilityProblems, type DrawnText } from './legibility'
import {
  VIEW_WITHOUT_TURNING,
  angleFromGaze,
  signCorners,
  signRun,
  signPose,
  signPlacement,
  type WhatIsPlayed,
} from '../../lib/machineSign'
import { MACHINE_RADIUS, PLAYER_OFFSET_Z } from '../../lib/gameConfig'
import { CHALLENGE_LIVES, CHALLENGE_SETUP, GAME_MODE_ORDER } from '../../lib/gameMode'
import { REFERENCE_EYE_HEIGHT } from '../../lib/hoopHeight'
import { goalSign, type Goal, type GoalSignView } from '../../lib/goal'
import { EYE_HEIGHTS, eyesAt, letterAngle } from '../../lib/panelReading'
import { maxScore } from '../../lib/scoring'
import { softTranslator } from '../../lib/textos'
import { xrUiRise } from '../../lib/xrLayout'

/**
 * The sign above the scoreboard, measured where it is really read.
 *
 * `goalSign.legible.test.ts` measures the phrases common to all the games; here go those of Stick
 * Rush —the challenge's mission, the lives with the sticks that are left, the name of each mode— with their
 * four-digit figures, and what is only known with the machine in front: how many degrees each
 * letter takes up at its real distance (97 cm, below the gaze) and that the whole sign fits in
 * what is seen without turning the head, farther away than any stick.
 */

const LANGUAGES = ['en', 'es'] as const

/** The most that can be scored in the challenge: the longest figure that reaches the sign. */
const CEILING = maxScore(CHALLENGE_SETUP.difficulty, CHALLENGE_SETUP.stickCount)

/** The thresholds of Stick Rush in the hall, with a record above gold. */
const GOAL: Goal = {
  medals: { bronze: 1900, silver: 3750, gold: 5200 },
  better: 'higher',
  unit: 'points in challenge',
  record: CEILING - 1,
  mode: 'challenge',
}

function game(changes: Partial<WhatIsPlayed>): WhatIsPlayed {
  return {
    goal: GOAL,
    gameMode: 'challenge',
    twoPlayers: false,
    gameState: 'playing',
    points: 0,
    lives: CHALLENGE_LIVES,
    resolved: 0,
    stickCount: CHALLENGE_SETUP.stickCount,
    record: CEILING - 1,
    ...changes,
  }
}

/** Everything the sign gets to say in this game, in that language. */
function views(lang: (typeof LANGUAGES)[number]): GoalSignView[] {
  const t = softTranslator(lang)
  const all: GoalSignView[] = []
  const say = (changes: Partial<WhatIsPlayed>) => {
    const run = signRun(game(changes), t)
    if (run != null) all.push(goalSign(run, t))
  }
  for (const goal of [GOAL, { ...GOAL, record: 2400 }, { ...GOAL, record: null }, null]) {
    for (const record of [0, 2400, CEILING - 1]) {
      say({ goal, record, gameState: 'countdown' })
      for (const points of [0, 150, 1899, 1900, 3749, 3750, 5199, 5200, CEILING - 1, CEILING]) {
        for (const [lives, resolved] of [[3, 1], [2, 7], [1, 12], [0, 13]]) {
          say({ goal, record, points, lives, resolved })
          say({ goal, record, points, lives, resolved, gameState: 'finished' })
        }
      }
    }
  }
  // What does not count for a medal: the other modes, and the two-player challenge.
  for (const gameMode of GAME_MODE_ORDER) say({ gameMode, lives: gameMode === 'challenge' ? 3 : null, twoPlayers: gameMode === 'challenge' })
  return all
}

function measure(view: GoalSignView): DrawnText[] {
  const { ctx, drawnTexts } = recordingCanvas()
  drawSign(ctx, view)
  return drawnTexts
}

const PLACEMENT = signPlacement()

/**
 * The degrees each letter of the sign takes up hung in its place, seen from those eyes.
 *
 * @param rise how much the UI has risen with whoever plays (`xrUiRise`).
 */
function degreesFrom(drawnTexts: readonly DrawnText[], eyes: number = REFERENCE_EYE_HEIGHT, rise = 0): number[] {
  const scale = signScale(PLACEMENT.distance)
  const pose = signPose({ ...PLACEMENT, position: [PLACEMENT.position[0], PLACEMENT.position[1] + rise, PLACEMENT.position[2]] })
  return drawnTexts.map((drawn) =>
    letterAngle(pose, eyesAt(eyes), drawn.x * scale, drawn.y * scale, (drawn.height / LINE_HEIGHT) * scale),
  )
}

describe('the sign above the scoreboard reads', () => {
  it('everything it says fits and does not overlap, in the two languages', () => {
    for (const lang of LANGUAGES) {
      const all = views(lang)
      expect(all.length, 'nothing was measured').toBeGreaterThan(100)
      for (const view of all) {
        const drawnTexts = measure(view)
        expect(drawnTexts.length, 'nothing was measured').toBeGreaterThan(0)
        expect(
          legibilityProblems(drawnTexts, { panel: SIGN_PANEL, distance: DRAW_DISTANCE }),
          `${lang}: ${view.title} / ${view.detail}`,
        ).toEqual([])
      }
    }
  })

  it('at its real distance each letter takes up the same as drawn, and above what is readable', () => {
    expect(PLACEMENT.distance).toBeGreaterThan(0.9)
    expect(PLACEMENT.distance).toBeLessThan(1)
    for (const lang of LANGUAGES) {
      for (const view of views(lang)) {
        const drawnTexts = measure(view)
        const degrees = degreesFrom(drawnTexts)
        degrees.forEach((angle, i) => {
          const asDrawn = (2 * Math.atan(drawnTexts[i].height / LINE_HEIGHT / (2 * DRAW_DISTANCE)) * 180) / Math.PI
          expect(angle, `${lang}: «${drawnTexts[i].text}»`).toBeGreaterThan(MIN_ANGLE)
          expect(angle, `${lang}: «${drawnTexts[i].text}»`).toBeCloseTo(asDrawn, 1)
        })
      }
    }
  })

  it('what is looked at while playing —the threshold, the lives and the sticks— reads at a glance', () => {
    const t = softTranslator('es')
    const run = signRun(game({ points: 2100, lives: 2, resolved: 6 }), t)
    const drawnTexts = measure(goalSign(run!, t))

    expect(drawnTexts.map((drawn) => drawn.text)).toEqual(['Plata a 3750 · llevas 2100', 'Vidas ♥♥♡ · Palos 7'])
    const [threshold, remaining] = degreesFrom(drawnTexts)
    // Four figures in Spanish go without a dot, as on the hall's plate: the line does not shrink from its 1.4°.
    expect(threshold).toBeGreaterThan(1.39)
    expect(remaining).toBeGreaterThan(1.15)
  })

  it('the mission shrinks to fit and stays at one degree, like the thresholds underneath', () => {
    for (const lang of LANGUAGES) {
      const t = softTranslator(lang)
      const run = signRun(game({ gameState: 'countdown' }), t)
      const [mission, thresholds] = degreesFrom(measure(goalSign(run!, t)))
      expect(mission, lang).toBeGreaterThan(0.95)
      // The thresholds, in English with their commas, stay at 0.9°: above the minimum (0.75°).
      expect(thresholds, lang).toBeGreaterThan(0.9)
    }
  })

  it('the first time, the bronze in sticks, legible with the eyes at 1.4 and at 1.9 m without the UI rising', () => {
    for (const lang of LANGUAGES) {
      const t = softTranslator(lang)
      const run = signRun(game({ gameState: 'countdown', goal: { ...GOAL, record: null }, record: 0 }), t)
      const view = goalSign(run!, t)
      expect(view.detail, lang).toBe(lang === 'es' ? 'Bronce ≈ 13 palos · Oro 5200' : 'Bronze ≈ 13 sticks · Gold 5,200')
      const drawnTexts = measure(view)
      expect(legibilityProblems(drawnTexts, { panel: SIGN_PANEL, distance: DRAW_DISTANCE }), lang).toEqual([])
      for (const eyes of [1.4, 1.9]) {
        for (const angle of degreesFrom(drawnTexts, eyes)) expect(angle, `${lang}, eyes at ${eyes}`).toBeGreaterThan(MIN_ANGLE)
      }
    }
  })

  it('the control: the long mission, with its articles and its «it is over», could not be read', () => {
    const long = { title: 'Catch all 13 sticks. Three on the floor and it is over', detail: null, bar: null, medal: null, subdued: false }
    expect(degreesFrom(measure(long))[0]).toBeLessThan(MIN_ANGLE)
    expect(legibilityProblems(measure(long), { panel: SIGN_PANEL, distance: DRAW_DISTANCE })).not.toEqual([])
  })

  it('whoever plays: the UI rises with the eyes and the letter takes up the same', () => {
    const drawnTexts = measure(views('es')[3])
    const reference = degreesFrom(drawnTexts)
    for (const eyes of EYE_HEIGHTS) {
      degreesFrom(drawnTexts, eyes, xrUiRise(eyes)).forEach((angle, i) => expect(angle).toBeCloseTo(reference[i], 5))
    }
  })

  it('and if the headset does not say the height and the UI does not rise, taller or shorter it still reads', () => {
    for (const lang of LANGUAGES) {
      for (const view of views(lang)) {
        const drawnTexts = measure(view)
        for (const eyes of [1.4, 1.9]) {
          for (const angle of degreesFrom(drawnTexts, eyes)) expect(angle, `${lang}: ${view.title}`).toBeGreaterThan(MIN_ANGLE)
        }
      }
    }
  })
})

describe('the real sign, in its place', () => {
  it('whole within what is seen without turning the head from the playing posture', () => {
    for (const corner of signCorners(signAspect())) {
      expect(angleFromGaze(corner)).toBeLessThanOrEqual(VIEW_WITHOUT_TURNING)
      // And below the gaze: it does not cover the hoop or the sticks hanging from it.
      expect(corner.y).toBeLessThan(REFERENCE_EYE_HEIGHT - 0.35)
    }
  })

  it('does not cover the target: no corner is nearer than the farthest stick', () => {
    const farthestStick = MACHINE_RADIUS + PLAYER_OFFSET_Z
    for (const corner of signCorners(signAspect())) {
      expect(Math.hypot(corner.x, corner.z)).toBeGreaterThan(farthestStick + 0.1)
    }
  })

  it('at that distance it measures what it measures in the eye: 24° wide by 4.5° tall', () => {
    const { width, height } = signAspect()
    const angle = (metres: number) => (2 * Math.atan(metres / 2) * 180) / Math.PI
    // The width is counted like the letter, in small degrees added up: from end to end it is 23.7°.
    expect(angle(width)).toBeGreaterThan(23.5)
    expect(angle(width)).toBeLessThanOrEqual(24)
    expect(angle(height)).toBeCloseTo(4.5, 1)
    expect(SIGN_PANEL.width * signScale(PLACEMENT.distance)).toBeCloseTo(width * PLACEMENT.distance)
  })
})
