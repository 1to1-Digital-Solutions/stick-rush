/**
 * The goal sign in this game: where it is read and which run it is told about.
 *
 * The sign is common to all the games of the hall (`goal.ts` and `GoalSign.tsx`); what
 * belongs to Stick Rush is here: that it goes **facing forward and under the machine**, above
 * the scoreboard (`XR_SIGN_POSITION`), and that the run that counts is the challenge —the
 * thirteen sticks at medium speed, with three lives—.
 *
 * With no three nor React: the scene places what comes out of here and the tests measure it.
 */

import { NOW_IT_COUNTS, WARMUP } from './warmup'
import { PLAYER_COUNT_LABELS } from './duel'
import { CHALLENGE_LIVES, CHALLENGE_SETUP, GAME_MODE_LABELS, type GameMode } from './gameMode'
import { REFERENCE_EYE_HEIGHT } from './hoopHeight'
import { MEDALS, countsForMedal, type Medal, type Goal, type Run, type Translate } from './goal'
import { plural } from './menuWords'
import { stickPoints } from './scoring'
import { distanceFromEyes, eyesAt, pointOnPanel, tiltTowardEyes, type PanelPose, type Point } from './panelReading'
import { pulsesFor, type HandSide, type HandPulse, type HapticEvent } from './hapticFeedback'
import { XR_SIGN_POSITION, type Vec3 } from './xrLayout'

/** The mode the cabinet's record and the hall's medals come from. */
export const MEDALS_MODE: GameMode = 'challenge'

/**
 * How far something that is still read **without turning the head** strays from the gaze
 * straight ahead, in degrees: lowering or raising the eyes gets there comfortably, and the
 * headset shows quite a lot more (some 48° downwards). TO BE CALIBRATED WITH THE HEADSET.
 */
export const VIEW_WITHOUT_TURNING = 35

/** What the sign measures for each metre of reading distance: its width and its height. */
export interface SignAspect {
  readonly width: number
  readonly height: number
}

/** Where the sign ends up and how it is oriented. */
export interface SignPlacement {
  /** Its centre, in the space of the ui (`−Z` is where one looks). */
  readonly position: Vec3
  /** Like three's `rotation`: tilted towards the eyes, to be read head-on. */
  readonly rotation: readonly [number, number, number]
  /** From the eyes to the centre of the sign, in metres: its size comes from there. */
  readonly distance: number
}

/**
 * Where the sign goes: at `XR_SIGN_POSITION`, facing the eyes of whoever plays.
 *
 * It is placed for the reference person and goes up or down with the rest of the ui
 * (`xrUiRise`), so relative to the eyes it always ends up the same.
 */
export function signPlacement(eyes: number = REFERENCE_EYE_HEIGHT): SignPlacement {
  const from = eyesAt(eyes)
  return {
    position: XR_SIGN_POSITION,
    rotation: [tiltTowardEyes(XR_SIGN_POSITION, from), 0, 0],
    distance: distanceFromEyes(XR_SIGN_POSITION, from),
  }
}

/** The sign as a panel, to measure what its writing takes up in the eye (`panelReading.ts`). */
export function signPose(placement: SignPlacement = signPlacement()): PanelPose {
  return { position: placement.position, rotation: placement.rotation }
}

/** The four corners of the sign already placed, in the space of whoever plays. */
export function signCorners(aspect: SignAspect, placement: SignPlacement = signPlacement()): Point[] {
  const pose = signPose(placement)
  const width = aspect.width * placement.distance
  const height = aspect.height * placement.distance
  return [-1, 1].flatMap((x) => [-1, 1].map((y) => pointOnPanel(pose, (x * width) / 2, (y * height) / 2)))
}

/** How many degrees that point strays from the gaze straight ahead (horizontal, towards `−Z`). */
export function angleFromGaze(point: Point, eyes: number = REFERENCE_EYE_HEIGHT): number {
  const toward = { x: point.x, y: point.y - eyes, z: point.z }
  return (Math.acos(-toward.z / Math.hypot(toward.x, toward.y, toward.z)) * 180) / Math.PI
}

/**
 * The mission of the challenge in one sentence. The sticks come from the rules; the lives are
 * written out, and a test warns if they stop being three.
 *
 * **Short on purpose**: the sign writes a single line and shrinks it until it fits. «Atrapa los
 * 13 palos. Tres al suelo y se acaba» came out at 0.82° and its English version at 0.69°, below
 * what can be read; this way it stays at one degree, like the three thresholds below
 * (`machineSign.legible.test.ts`).
 */
export const CHALLENGE_MISSION = 'Catch {sticks} sticks. Drop three and out'

/** What remains, as it is written on the sign: «Lives ♥♥♡ · Sticks 9». */
export function remainingText(lives: number, sticks: number, t: Translate): string {
  const spent = Math.max(0, CHALLENGE_LIVES - lives)
  return `${t('Lives')} ${'♥'.repeat(CHALLENGE_LIVES - spent)}${'♡'.repeat(spent)} · ${t('Sticks')} ${sticks}`
}

/**
 * What a caught stick gives in the challenge with no streak nor reflexes: the least a stick is
 * worth. It is the yardstick with which the points of a threshold are counted in sticks.
 */
export const POINTS_PER_STICK = stickPoints({ difficulty: CHALLENGE_SETUP.difficulty, streak: 1, fallProgress: 1 })

/** How many sticks have to be caught, at most, to reach those points: the bronze 1900 is 13. */
export function sticksFor(points: number): number {
  return Math.ceil(points / POINTS_PER_STICK)
}

/**
 * The points of a threshold said in sticks, already translated: `1900` → «≈ 13 palos». It is the
 * sign's `asCount`: the mission counts sticks and the record, points, and whoever is starting
 * does not know how much 1900 is.
 */
export function inSticks(t: Translate): (points: number) => string {
  return (points) => {
    const n = sticksFor(points)
    return t(plural(n, '≈ {n} stick', '≈ {n} sticks'), { n })
  }
}

/** What the sign needs to know about what is being played. */
export interface WhatIsPlayed {
  /** What the hall passed, if it passed it. */
  goal?: Goal | null
  gameMode: GameMode
  /** Whether two play passing the controller to each other: a round for two is nobody's best. */
  twoPlayers: boolean
  gameState: 'menu' | 'countdown' | 'playing' | 'finished'
  points: number
  /** The lives that remain, or `null` in a mode that is not played with them. */
  lives: number | null
  /** Sticks already settled, caught or lost. */
  resolved: number
  /** Sticks that were put into play. */
  stickCount: number
  /** The challenge's record stored here at the start; zero if there is none. */
  record: number
  /** The lesson runs over the challenge: what happens does not count yet (`warmup.ts`). */
  warmingUp?: boolean
  /** The lesson has just closed and the challenge starts from scratch: until the first stick, it is announced. */
  nowItCounts?: boolean
}

/**
 * The run the sign is told about, or `null` if there is nothing to hang.
 *
 * The one that counts is the challenge —or the mode the hall says—, played alone: during the
 * countdown and until the first stick is settled, the mission and the thresholds; afterwards, the
 * threshold that is missing, the lives and the sticks that remain; at the end, what was missing.
 * In any other mode, and with two players, inside the hall the sign says quietly that it does not
 * count for a medal while it is played; with the game opened on its own there is no medal to talk
 * about and it is not hung. In the menu, neither.
 *
 * **The warm-up** says quietly that it does not count, with the hall and without it; and when the
 * lesson closes, the countdown of the challenge that starts from scratch says «Ahora cuenta para
 * medalla» instead of the mission —which has already been played—, with the thresholds below.
 */
export function signRun(game: WhatIsPlayed, t: Translate): Run | null {
  const { gameMode, gameState } = game
  if (gameState === 'menu') return null
  const goal = game.goal ?? null
  if (game.warmingUp === true) {
    // With no hall the sign only says the mission, so the mission is already the whole sentence.
    const mode = t(WARMUP)
    const mission = t('{mode} · does not count for a medal', { mode })
    return { goal, phase: 'playing', points: game.points, mission, counts: false, mode }
  }
  const mission = t(CHALLENGE_MISSION, { sticks: CHALLENGE_SETUP.stickCount })
  const counts =
    gameMode === MEDALS_MODE && !game.twoPlayers && game.lives != null && countsForMedal(goal, gameMode)
  if (!counts) {
    if (goal == null || gameState === 'finished') return null
    const mode = t(game.twoPlayers ? PLAYER_COUNT_LABELS[2] : GAME_MODE_LABELS[gameMode])
    return { goal, phase: 'playing', points: 0, mission, counts: false, mode }
  }
  const notStarted = gameState === 'countdown' || game.resolved === 0
  return {
    goal,
    phase: gameState === 'finished' ? 'end' : notStarted ? 'before' : 'playing',
    points: game.points,
    mission: game.nowItCounts === true && notStarted ? t(NOW_IT_COUNTS) : mission,
    remaining: remainingText(game.lives as number, game.stickCount - game.resolved, t),
    record: game.record > 0 ? game.record : null,
    // The first time, the bronze in sticks. With a bronze of one stick or less, the figure: «≈ 1 palo»
    // is the first catch and does not say how far one has to get.
    asCount: goal != null && sticksFor(goal.medals.bronze) > 1 ? inSticks(t) : null,
  }
}

/** Whether the sign of that run already says the points and the lives: then the scoreboard keeps quiet about them. */
export function runCounts(run: Run | null): run is Run {
  return run != null && run.counts !== false
}

/**
 * How long the threshold takes to be noticed after the catch that crossed it, in milliseconds.
 *
 * The stick that crosses the threshold already vibrates on catching it (`haptics.ts`) and
 * `pulse()` does not queue: the two at once would be one. With this gap they feel like two taps.
 * TO BE CALIBRATED WITH THE HEADSET.
 */
export const THRESHOLD_DELAY = 90

/**
 * What is felt in the hand on crossing a threshold: something has arrived, stronger the better
 * the medal is. TO BE CALIBRATED WITH THE HEADSET.
 */
export function thresholdHaptic(medal: Medal, hand: HandSide): HapticEvent {
  return { type: 'arrival', hand, strength: 0.5 + 0.25 * MEDALS.indexOf(medal) }
}

/** The pulses of the crossed threshold, already with their gap after the catch. */
export function thresholdPulses(medal: Medal, hand: HandSide): HandPulse[] {
  return pulsesFor(thresholdHaptic(medal, hand)).map((pulse) => ({ ...pulse, delay: pulse.delay + THRESHOLD_DELAY }))
}
