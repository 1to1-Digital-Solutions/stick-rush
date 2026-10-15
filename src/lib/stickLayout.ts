import { MACHINE_HEIGHT, machinePoint } from './gameConfig'
import { randomFrom, deriveSeed } from './seed'

/** Position and release moment of a stick within a run. */
export interface StickLayout {
  /** Stable key per round: it forces the remount when another one starts. */
  key: string
  /** Point of the hoop it hangs from. */
  anchor: [number, number, number]
  /** Seconds it waits hanging before being released. */
  delay: number
  /** Its slot within the swing cycle, in [0, 1). See `stickSwing.ts`. */
  swingPhase: number
}

/**
 * What each draw of a round comes from, to derive it from the seed with `deriveSeed`.
 *
 * Each thing that is drawn carries its own stream: the fall turn, the hesitation of each stick
 * before being released and its swing. That way, adding a new draw does not change the ones
 * already there, and the swing —which is only decoration— does not take numbers the layout needs.
 */
const STREAM = { order: 1, delay: 2, swing: 3 } as const

/**
 * Fall turn of each stick, shuffled.
 *
 * Returns the positions of the hoop in the order in which they are released: `order[0]` is
 * the stick that falls first. Fisher-Yates seeded with the seed of the round, so
 * the sequence is different in each run but stable within it, and the
 * same for everyone who plays one same challenge (`seed.ts`).
 */
export function fallOrder(stickCount: number, seed: number): number[] {
  const order = Array.from({ length: Math.max(stickCount, 0) }, (_, i) => i)
  const random = randomFrom(deriveSeed(seed, STREAM.order))
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/** A number in [0, 1) belonging to one stick and to what is drawn for it. */
function stickDraw(seed: number, stream: number, index: number): number {
  return randomFrom(deriveSeed(seed, stream, index))()
}

/**
 * Lays the sticks out along the hoop and staggers their fall.
 *
 * The position on the hoop and the moment of falling are **independent**: the
 * anchors go from left to right avoiding the exact ends (the posts are
 * there), but the turn of each stick comes from `fallOrder`. Before, the delay
 * was computed from the index, so the sticks always fell in order,
 * from left to right, and the run was predictable.
 */
export function buildStickLayout(
  stickCount: number,
  seed: number,
  hoopHeight: number = MACHINE_HEIGHT,
): StickLayout[] {
  const order = fallOrder(stickCount, seed)
  const turnOf: number[] = []
  order.forEach((stickIndex, turn) => {
    turnOf[stickIndex] = turn
  })

  return Array.from({ length: stickCount }, (_, index) => {
    const t = stickCount === 1 ? 0.5 : (index + 1) / (stickCount + 1)
    return {
      key: `${seed}-${index}`,
      anchor: machinePoint(t, hoopHeight),
      // One turn per stick, plus a jitter so that it does not sound like a metronome.
      delay: turnOf[index] * (1 + stickDraw(seed, STREAM.delay, index) * 0.5),
      swingPhase: stickDraw(seed, STREAM.swing, index),
    }
  })
}

/** How each stick has ended (or not), to draw the scoreboard. */
export type StickStatus = 'caught' | 'missed' | 'pending'

/**
 * State of each stick of the scoreboard from the counters of the run.
 *
 * The store only keeps aggregates (caught and settled), not the outcome of
 * each stick: for the scoreboard it is enough to draw the caught ones first, then the
 * lost ones and at the end the ones still in play.
 */
export function stickStatuses(
  score: number,
  resolved: number,
  stickCount: number,
): StickStatus[] {
  return Array.from({ length: Math.max(stickCount, 0) }, (_, index) => {
    if (index < score) return 'caught'
    if (index < resolved) return 'missed'
    return 'pending'
  })
}
