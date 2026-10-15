import { describe, expect, it } from 'vitest'
import {
  CHALLENGE_MISSION,
  MEDALS_MODE,
  POINTS_PER_STICK,
  inSticks,
  sticksFor,
  THRESHOLD_DELAY,
  VIEW_WITHOUT_TURNING,
  angleFromGaze,
  signCorners,
  runCounts,
  remainingText,
  signRun,
  signPose,
  thresholdPulses,
  signPlacement,
  thresholdHaptic,
  type WhatIsPlayed,
  type SignAspect,
} from './machineSign'
import { MACHINE_HEIGHT, MAX_STICKS, PLAYER_OFFSET_Z, STICK_CORD_LENGTH, STICK_LENGTH, STICK_RADIUS } from './gameConfig'
import { CHALLENGE_LIVES, CHALLENGE_SETUP, DEFAULT_GAME_MODE } from './gameMode'
import { MAX_EYE_HEIGHT, MIN_EYE_HEIGHT, REFERENCE_EYE_HEIGHT } from './hoopHeight'
import { goalSign, medalToCelebrate, type Goal } from './goal'
import { pointOnPanel } from './panelReading'
import { buildStickLayout } from './stickLayout'
import { pulsesFor } from './hapticFeedback'
import { softTranslator } from './textos'
import {
  TUTORIAL_PANEL,
  XR_SIGN_POSITION,
  XR_CONFIRM_POSITION,
  XR_CONFIRM_SIZE,
  XR_HUD_POSITION,
  XR_TUTORIAL_POSITION,
  xrHudLayout,
  xrUiRise,
} from './xrLayout'

/**
 * The goal sign on the machine: that it is read head-on and without turning the head, that it
 * covers no stick nor overlaps the panels around, and that it tells the run it should.
 */

/** What the sign measures per metre of distance: 24° wide by 4.5° high, like the real one. */
const ASPECT: SignAspect = {
  width: 2 * Math.tan((12 * Math.PI) / 180),
  height: 2 * Math.tan((2.25 * Math.PI) / 180),
}

/** The most the sign grows when celebrating a threshold (`celebrationPulse`). */
const GROWN = 1.12

const PLACEMENT = signPlacement()
const HEIGHT = ASPECT.height * PLACEMENT.distance

/** How far the sign reaches at the top and at the bottom, also while it celebrates. */
const TOP = pointOnPanel(signPose(), 0, (HEIGHT * GROWN) / 2).y
const BOTTOM = pointOnPanel(signPose(), 0, (-HEIGHT * GROWN) / 2).y

describe('where the sign is read', () => {
  it('head-on: centred, without turning to either side', () => {
    expect(PLACEMENT.position).toBe(XR_SIGN_POSITION)
    expect(PLACEMENT.position[0]).toBe(0)
    expect(PLACEMENT.rotation[1]).toBe(0)
    expect(PLACEMENT.rotation[2]).toBe(0)
  })

  it('looks at the eyes of whoever plays: it is read head-on and at the distance it says', () => {
    const [x, y, z] = PLACEMENT.position
    const towardTheEyes = { x: -x, y: REFERENCE_EYE_HEIGHT - y, z: -z }
    const distance = Math.hypot(towardTheEyes.x, towardTheEyes.y, towardTheEyes.z)
    expect(PLACEMENT.distance).toBeCloseTo(distance)

    // The panel's normal comes from two of its points: one step to the right and another upwards.
    const pose = signPose()
    const centre = pointOnPanel(pose, 0, 0)
    const right = pointOnPanel(pose, 1, 0)
    const up = pointOnPanel(pose, 0, 1)
    const u = { x: right.x - centre.x, y: right.y - centre.y, z: right.z - centre.z }
    const v = { x: up.x - centre.x, y: up.y - centre.y, z: up.z - centre.z }
    const normal = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x }
    const cosine = (normal.x * towardTheEyes.x + normal.y * towardTheEyes.y + normal.z * towardTheEyes.z) / distance
    expect(cosine).toBeCloseTo(1, 5)
  })

  it('stays inside what is seen without turning the head from the playing posture', () => {
    for (const corner of signCorners(ASPECT)) {
      expect(angleFromGaze(corner)).toBeLessThanOrEqual(VIEW_WITHOUT_TURNING)
    }
    // Below the gaze, not above: at some 27°, which is reached by lowering the eyes.
    const centre = { x: PLACEMENT.position[0], y: PLACEMENT.position[1], z: PLACEMENT.position[2] }
    expect(PLACEMENT.position[1]).toBeLessThan(REFERENCE_EYE_HEIGHT)
    expect(angleFromGaze(centre)).toBeGreaterThan(20)
    expect(angleFromGaze(centre)).toBeLessThan(30)
    expect(VIEW_WITHOUT_TURNING).toBeLessThanOrEqual(35)
  })

  it('and whoever plays: it goes up and down with the eyes, like the rest of the ui', () => {
    for (const eyes of [MIN_EYE_HEIGHT, 1.15, REFERENCE_EYE_HEIGHT, MAX_EYE_HEIGHT]) {
      const rise = xrUiRise(eyes)
      for (const corner of signCorners(ASPECT)) {
        const whereItEndsUp = { ...corner, y: corner.y + rise }
        expect(angleFromGaze(whereItEndsUp, eyes), `eyes at ${eyes}`).toBeLessThanOrEqual(VIEW_WITHOUT_TURNING)
        expect(whereItEndsUp.y, `eyes at ${eyes}`).toBeGreaterThan(0)
      }
    }
  })

  it('covers no stick: all of them fall nearer to whoever plays than the sign', () => {
    // Whoever plays is one step behind the centre of the hoop, and the world shifts by that same amount.
    const sticks = buildStickLayout(MAX_STICKS, 1).map(({ anchor: [x, , z] }) => Math.hypot(x, z - PLAYER_OFFSET_Z) + STICK_RADIUS)
    expect(sticks).toHaveLength(MAX_STICKS)
    const farthest = Math.max(...sticks)

    // The nearest the sign gets, however the ui is turned: its bottom edge.
    const pose = signPose()
    const width = ASPECT.width * PLACEMENT.distance * GROWN
    const edges = [-1, 0, 1].flatMap((x) => [-1, 1].map((y) => pointOnPanel(pose, (x * width) / 2, (y * HEIGHT * GROWN) / 2)))
    const nearest = Math.min(...edges.map((point) => Math.hypot(point.x, point.z)))

    expect(farthest).toBeLessThan(0.7)
    expect(nearest).toBeGreaterThan(farthest + 0.1)
  })

  it('nor do the hanging ones cover it: the line from the eyes to the sign passes below them', () => {
    const lowestTheyHang = MACHINE_HEIGHT - STICK_CORD_LENGTH - STICK_LENGTH
    const sticks = buildStickLayout(MAX_STICKS, 1).map(({ anchor: [x, , z] }) => Math.hypot(x, z - PLAYER_OFFSET_Z))
    const top = pointOnPanel(signPose(), 0, (HEIGHT * GROWN) / 2)
    const far = Math.hypot(top.x, top.z)
    for (const stick of sticks) {
      const sightHeight = REFERENCE_EYE_HEIGHT + ((top.y - REFERENCE_EYE_HEIGHT) * stick) / far
      expect(sightHeight).toBeLessThan(lowestTheyHang)
    }
  })

  it('goes above the scoreboard without overlapping it, with the sign or saying it does not count', () => {
    for (const layout of [
      xrHudLayout({ finished: false, row: false, sign: true }),
      xrHudLayout({ finished: true, row: false, sign: true }),
      // Outside the challenge the sign says quietly that it does not count and the scoreboard goes whole, with its lives for two.
      xrHudLayout({ finished: false, row: false, sign: false }),
      xrHudLayout({ finished: false, row: true, sign: false }),
    ]) {
      const scoreboardTop = XR_HUD_POSITION[1] + layout.centre + layout.height / 2
      expect(BOTTOM).toBeGreaterThan(scoreboardTop)
    }
    expect(XR_SIGN_POSITION[2]).toBe(XR_HUD_POSITION[2])
  })

  it('and below the exit notice and the tutorial, which are shown with the run under way', () => {
    expect(TOP).toBeLessThan(XR_CONFIRM_POSITION[1] - XR_CONFIRM_SIZE[1] / 2)
    expect(TOP).toBeLessThan(XR_TUTORIAL_POSITION[1] - TUTORIAL_PANEL.height / 2)
  })
})

/** The thresholds of Stick Rush in the hall. */
const GOAL: Goal = {
  medals: { bronze: 1900, silver: 3750, gold: 5200 },
  better: 'higher',
  unit: 'points in challenge',
  record: 2400,
  mode: 'challenge',
}

const en = softTranslator('en')
const es = softTranslator('es')

/** The challenge under way, alone, with whatever is said on top. */
function challenge(changes: Partial<WhatIsPlayed> = {}): WhatIsPlayed {
  return {
    goal: GOAL,
    gameMode: 'challenge',
    twoPlayers: false,
    gameState: 'playing',
    points: 0,
    lives: CHALLENGE_LIVES,
    resolved: 0,
    stickCount: CHALLENGE_SETUP.stickCount,
    record: 0,
    ...changes,
  }
}

describe('the run the sign is told about', () => {
  it('the mission is the one of the challenge: the sticks of the rules and its three lives', () => {
    expect(MEDALS_MODE).toBe(DEFAULT_GAME_MODE)
    expect(CHALLENGE_MISSION).toContain('{sticks}')
    // The lives are written out in the sentence: if they stop being three, it has to be rewritten.
    expect(CHALLENGE_LIVES).toBe(3)
    expect(en(CHALLENGE_MISSION, { sticks: CHALLENGE_SETUP.stickCount })).toBe(
      'Catch 13 sticks. Drop three and out',
    )
    expect(es(CHALLENGE_MISSION, { sticks: CHALLENGE_SETUP.stickCount })).toBe('Atrapa 13 palos. Tres al suelo y fuera')
  })

  it('in the menu nothing is hung', () => {
    expect(signRun(challenge({ gameState: 'menu' }), en)).toBeNull()
    expect(signRun(challenge({ gameState: 'menu', goal: null }), en)).toBeNull()
  })

  it('during the countdown: the mission and the three thresholds', () => {
    const run = signRun(challenge({ gameState: 'countdown' }), es)

    expect(run?.phase).toBe('before')
    expect(goalSign(run!, es)).toMatchObject({
      title: 'Atrapa 13 palos. Tres al suelo y fuera',
      detail: 'Bronce 1900 · Plata 3750 · Oro 5200',
    })
    expect(medalToCelebrate(run!)).toBeNull()
  })

  it('the first time, with no record, the bronze said in sticks and the gold', () => {
    const noRecord = { ...GOAL, record: null }
    expect(goalSign(signRun(challenge({ gameState: 'countdown', goal: noRecord }), es)!, es).detail).toBe(
      'Bronce ≈ 13 palos · Oro 5200',
    )
    expect(goalSign(signRun(challenge({ gameState: 'countdown', goal: noRecord }), en)!, en).detail).toBe(
      'Bronze ≈ 13 sticks · Gold 5,200',
    )
    // A bronze of one stick is said with its figure: «≈ 1 palo» is the first catch.
    const ofOneStick = { ...noRecord, medals: { bronze: 10, silver: 20, gold: 30 } }
    expect(goalSign(signRun(challenge({ gameState: 'countdown', goal: ofOneStick }), en)!, en).detail).toBe(
      'Bronze 10 · Silver 20 · Gold 30',
    )
  })

  it('the points, in sticks: the least one is worth in the challenge, and the right plural', () => {
    expect(POINTS_PER_STICK).toBe(150)
    expect([sticksFor(1), sticksFor(150), sticksFor(151), sticksFor(1900)]).toEqual([1, 1, 2, 13])
    expect(inSticks(es)(150)).toBe('≈ 1 palo')
    expect(inSticks(es)(300)).toBe('≈ 2 palos')
    expect(inSticks(en)(150)).toBe('≈ 1 stick')
    expect(inSticks(en)(300)).toBe('≈ 2 sticks')
  })

  it('and it stays until the first stick is settled: there is time to read it', () => {
    expect(signRun(challenge({ gameState: 'playing', resolved: 0 }), en)?.phase).toBe('before')
    expect(signRun(challenge({ gameState: 'playing', resolved: 1, points: 150 }), en)?.phase).toBe('playing')
    // Even if that first stick got away and there are no points.
    expect(signRun(challenge({ gameState: 'playing', resolved: 1, lives: 2 }), en)?.phase).toBe('playing')
  })

  it('playing: the threshold that is missing, what has been scored, the lives and the sticks that remain', () => {
    const run = signRun(challenge({ points: 2100, lives: 2, resolved: 6 }), es)

    expect(run).toMatchObject({ phase: 'playing', points: 2100, remaining: 'Vidas ♥♥♡ · Palos 7' })
    expect(goalSign(run!, es)).toMatchObject({
      title: 'Plata a 3750 · llevas 2100',
      detail: 'Vidas ♥♥♡ · Palos 7',
      medal: 'silver',
    })
    expect(medalToCelebrate(run!)).toBe('bronze')
  })

  it('at the end: what was achieved and what was missing for the next one', () => {
    const run = signRun(challenge({ gameState: 'finished', points: 2100, lives: 0, resolved: 9 }), es)

    expect(run?.phase).toBe('end')
    expect(goalSign(run!, es)).toMatchObject({
      title: 'Bronce · 2100 points in challenge',
      detail: 'Te han faltado 1650 para la plata',
    })
    // Without reaching the bronze, what was missing for it.
    const noMedal = signRun(challenge({ gameState: 'finished', points: 400, lives: 0, resolved: 4 }), en)
    expect(goalSign(noMedal!, en)).toMatchObject({
      title: 'No medal · 400 points in challenge',
      detail: '1,500 short of bronze',
    })
  })

  it('outside the challenge, inside the hall: it says quietly that it does not count for a medal', () => {
    const practice = signRun(challenge({ gameMode: 'practice', lives: null, points: 900, resolved: 3 }), es)
    expect(goalSign(practice!, es)).toMatchObject({ title: 'Práctica · no cuenta para medalla', subdued: true })
    expect(medalToCelebrate(practice!)).toBeNull()
    expect(runCounts(practice)).toBe(false)

    const levels = signRun(challenge({ gameMode: 'levels', lives: null, gameState: 'countdown' }), en)
    expect(goalSign(levels!, en).title).toBe('Levels · does not count for a medal')
  })

  it('with two players it does not count either, even if it is the challenge: a round for two is the best of no one', () => {
    const run = signRun(challenge({ twoPlayers: true, points: 2100, resolved: 5 }), es)

    expect(goalSign(run!, es).title).toBe('Duelo · no cuenta para medalla')
    expect(medalToCelebrate(run!)).toBeNull()
  })

  it('what does not count is said while it is played: at the end it is not hung, and the scoreboard goes whole', () => {
    expect(signRun(challenge({ gameMode: 'practice', lives: null, gameState: 'finished' }), en)).toBeNull()
    expect(signRun(challenge({ twoPlayers: true, gameState: 'finished' }), en)).toBeNull()
  })

  it('if the hall says that the medals come from another mode, the challenge does not count either', () => {
    const run = signRun(challenge({ goal: { ...GOAL, mode: 'levels' }, points: 500, resolved: 2 }), es)

    expect(goalSign(run!, es).title).toBe('Reto · no cuenta para medalla')
  })

  it('with the game opened on its own: in the challenge, the mission and the record stored here', () => {
    const before = signRun(challenge({ goal: null, gameState: 'countdown', record: 3100 }), en)
    expect(goalSign(before!, en)).toMatchObject({
      title: 'Catch 13 sticks. Drop three and out',
      detail: 'Your record 3,100',
    })

    const playing = signRun(challenge({ goal: undefined, points: 1200, lives: 1, resolved: 8, record: 3100 }), en)
    expect(goalSign(playing!, en)).toMatchObject({
      title: 'Your record 3,100 · you have 1,200',
      detail: 'Lives ♥♡♡ · Sticks 5',
    })
    expect(runCounts(playing)).toBe(true)

    // With no stored record there is no second line.
    const noRecord = signRun(challenge({ goal: null, gameState: 'countdown' }), en)
    expect(goalSign(noRecord!, en).detail).toBeNull()
  })

  it('with the game opened on its own and outside the challenge nothing is hung', () => {
    expect(signRun(challenge({ goal: null, gameMode: 'practice', lives: null }), en)).toBeNull()
    expect(signRun(challenge({ goal: null, twoPlayers: true }), en)).toBeNull()
    expect(runCounts(null)).toBe(false)
  })

  it('a challenge with no lives in play is not the challenge: it does not count', () => {
    expect(signRun(challenge({ goal: null, lives: null }), en)).toBeNull()
  })

  it('the lives are written with the remaining ones full and the spent ones empty', () => {
    expect(remainingText(CHALLENGE_LIVES, 13, en)).toBe('Lives ♥♥♥ · Sticks 13')
    expect(remainingText(1, 4, es)).toBe('Vidas ♥♡♡ · Palos 4')
    expect(remainingText(0, 0, en)).toBe('Lives ♡♡♡ · Sticks 0')
    // One count too many does not draw hearts too many.
    expect(remainingText(CHALLENGE_LIVES + 2, 1, en)).toBe('Lives ♥♥♥ · Sticks 1')
  })
})

describe('the threshold in the hand', () => {
  it('is felt stronger the better the medal is, in whichever hand is said', () => {
    const strength = (medal: 'bronze' | 'silver' | 'gold') => thresholdPulses(medal, 'left')[0]

    expect(strength('bronze').hand).toBe('left')
    expect(strength('silver').intensity).toBeGreaterThan(strength('bronze').intensity)
    expect(strength('gold').intensity).toBeGreaterThan(strength('silver').intensity)
    expect(thresholdPulses('gold', 'right')).toHaveLength(1)
    expect(thresholdPulses('gold', 'right')[0].hand).toBe('right')
  })

  it('arrives after the catch that crossed it, so that they are two taps and not one', () => {
    const fromTheCatch = pulsesFor({ type: 'grab', hand: 'right' })[0]
    const [pulse] = thresholdPulses('silver', 'right')

    expect(pulse.delay).toBe(pulsesFor(thresholdHaptic('silver', 'right'))[0].delay + THRESHOLD_DELAY)
    // `pulse()` does not queue: the threshold's one goes out when the catch's one has already ended.
    expect(pulse.delay).toBeGreaterThan(fromTheCatch.delay + fromTheCatch.ms)
  })
})
