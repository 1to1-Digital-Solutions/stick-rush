/**
 * The sticks of a round in Godot: what each `Stick.tsx` does on the web frame by frame, without
 * painting anything.
 *
 * Each stick hangs from its point of the hoop (`buildStickLayout`, with the round's seed), waits
 * its turn swaying (`hangingSwing`), is released and falls **from rest, accelerating** with the
 * acceleration of its own travel (`fallAcceleration`, `fallDrop`), and ends up caught —with its
 * flash, which lasts what it lasts on the web— or on the floor, tinted red. **It is caught hanging
 * or falling, until it touches the floor** (`canCatchStick`), and how long it had been falling, in
 * time, decides the reflex bonus (`stickFallProgress`). Everything comes from `src/lib` as it is;
 * here only the clock of each stick runs, with its same rules and its same constants
 * (`CATCH_FLASH_DECAY`, `MISS_TINT_SPEED`, which on the web live inside the component).
 *
 * **As on the web, the sticks are not mounted again because the hoop changes height or the number
 * of sticks changes in the menu**: the ones already there keep their state (a missed stick stays on
 * the floor) and only their anchor changes. A new round —another run, another reload of the endless
 * run— does bring new sticks. Who decides when it is new is the scene, with the key (`roundKey`).
 *
 * It does not touch the engine, so it is tested whole in `round.engine.test.ts`.
 */
import {
  STICK_CORD_LENGTH,
  STICK_LENGTH,
  STICK_MISS_Y,
  fallAcceleration,
  fallDrop,
  stickFallProgress,
} from '@/lib/gameConfig'
import { buildStickLayout, type StickLayout } from '@/lib/stickLayout'
import { SWING_RELEASE_DECAY, hangingSwing, type SwingTilt } from '@/lib/stickSwing'
import { canCatchStick, type StickState } from '@/lib/xrInteraction'

/** How fast the flash of the catch fades, 1/s (`CATCH_FLASH_DECAY` in `Stick.tsx`). */
export const CATCH_FLASH_DECAY = 1.8
/** How fast the missed stick is tinted red, 1/s (`MISS_TINT_SPEED` in `Stick.tsx`). */
export const MISS_TINT_SPEED = 3.5
/** The longest step taken at once: a jump after a hitch does not release half a round (`Stick.tsx`). */
export const MAX_STEP = 0.05

export type Vec3 = [number, number, number]

/** A stick and its clock: what on the web are the state and the `ref`s of `Stick.tsx`. */
export interface Stick {
  readonly index: number
  layout: StickLayout
  state: StickState
  /** Seconds of run since it was mounted: decides when it is released (`elapsed`). */
  elapsed: number
  /** Seconds it has been falling: the height comes from here, not from adding steps (`fallTime`). */
  fallTime: number
  /** Clock of the sway, which also runs with the run paused (`swingTime`). */
  swingTime: number
  /** How much of the sway is applied, from 1 hanging to 0 released (`swingLevel`). */
  swingLevel: number
  /** The tilt right now: that of the sway times its level. */
  tilt: SwingTilt
  /** The flash of the catch, from 1 to 0 (`flash`). */
  flash: number
  /** How much the missed stick has been tinted red, from 0 to 1 (`missTint`). */
  missTint: number
  /** The height of the anchor: the hoop's when hanging, lower when falling, `STICK_MISS_Y` on the floor. */
  y: number
  /** It is hidden when the flash of the catch ends. */
  visible: boolean
}

/** What happens in a frame: the sticks that have touched the floor, by index. */
export interface RoundEvents {
  missed: number[]
}

/** The key of a round: with another one, new sticks (on the web, the `key` of each `Stick`). */
export function roundKey(runId: number, seed: number): string {
  return `${runId}:${seed >>> 0}`
}

/**
 * Where the body of a stick is, from its top tip to its bottom one, in the machine's space: it
 * hangs a cord below the anchor, tilted with the sway (first about `Z`, then about `X`, which is
 * three's order for a rotation without `Y`).
 */
export function stickBody(stick: Stick): { top: Vec3; bottom: Vec3 } {
  const [ax, , az] = stick.layout.anchor
  const { x: bx, z: bz } = stick.tilt
  const tip = (d: number): Vec3 => {
    const sx = d * Math.sin(bz)
    const sy = -d * Math.cos(bz)
    return [ax + sx, stick.y + sy * Math.cos(bx), az + sy * Math.sin(bx)]
  }
  return { top: tip(STICK_CORD_LENGTH), bottom: tip(STICK_CORD_LENGTH + STICK_LENGTH) }
}

function newStick(layout: StickLayout, index: number, swings: boolean): Stick {
  return {
    index,
    layout,
    state: 'hanging',
    elapsed: 0,
    fallTime: 0,
    swingTime: 0,
    // It is born at 0 if it does not sway: starting at 1 would leave it born tilted and straightening up.
    swingLevel: swings ? 1 : 0,
    tilt: { x: 0, z: 0 },
    flash: 0,
    missTint: 0,
    y: layout.anchor[1],
    visible: true,
  }
}

export class Round {
  sticks: Stick[] = []
  private seed: number
  private count = 0
  private height = 0

  constructor(
    readonly key: string,
    seed: number,
    count: number,
    height: number,
    /** Whether the sticks sway while hanging: on the web it is turned off with `prefers-reduced-motion`. */
    private readonly swings = true,
  ) {
    this.seed = seed
    this.place(count, height)
  }

  /**
   * With another number of sticks or another hoop height, the new layout (`buildStickLayout`)
   * without losing what each stick that stays was carrying: the spare ones go, the missing ones are
   * born hanging. The stick that moves with the hoop takes the new height; the missed one stays on
   * the floor.
   */
  place(count: number, height: number): void {
    if (count === this.count && height === this.height) return
    this.count = count
    this.height = height
    const layouts = buildStickLayout(count, this.seed, height)
    this.sticks = layouts.map((layout, i) => {
      const previous = this.sticks[i]
      if (previous == null) return newStick(layout, i, this.swings)
      const moves = previous.layout.anchor[1] !== layout.anchor[1]
      previous.layout = layout
      if (moves && previous.state !== 'missed') previous.y = layout.anchor[1]
      return previous
    })
  }

  /**
   * A frame of all the sticks. `paused` is the run paused (menu, countdown, end or the question in
   * front): the clock of each stick does not run, but the sway does. `speed` is the average one of
   * the difficulty already corrected for the hoop height (`hoopFallSpeed`).
   */
  advance(delta: number, { paused, speed }: { paused: boolean; speed: number }): RoundEvents {
    const d = Math.min(Math.max(0, delta), MAX_STEP)
    const missed: number[] = []
    for (const stick of this.sticks) {
      if (!paused) stick.elapsed += d

      // The sway: the hanging stick sways; as soon as it is released it straightens up.
      if (this.swings && stick.state === 'hanging') {
        stick.swingTime += d
        stick.swingLevel = 1
      } else if (stick.swingLevel > 0) {
        stick.swingLevel = Math.max(0, stick.swingLevel - d * SWING_RELEASE_DECAY)
      }
      if (stick.swingLevel > 0) {
        const t = hangingSwing(stick.swingTime, stick.layout.swingPhase)
        stick.tilt = { x: t.x * stick.swingLevel, z: t.z * stick.swingLevel }
      } else stick.tilt = { x: 0, z: 0 }

      // The flash of the catch fades and, when it ends, the stick goes.
      if (stick.flash > 0) {
        stick.flash = Math.max(0, stick.flash - d * CATCH_FLASH_DECAY)
        if (stick.flash <= 0 && stick.state === 'caught') stick.visible = false
      }
      if (stick.state === 'missed' && stick.missTint < 1) stick.missTint = Math.min(1, stick.missTint + d * MISS_TINT_SPEED)

      if (stick.state === 'hanging') {
        if (!paused && stick.elapsed >= stick.layout.delay) stick.state = 'falling'
        continue
      }
      if (stick.state === 'falling' && !paused) {
        stick.fallTime += d
        const [, ay] = stick.layout.anchor
        stick.y = ay - fallDrop(stick.fallTime, fallAcceleration(speed, ay - STICK_MISS_Y))
        if (stick.y <= STICK_MISS_Y) {
          stick.y = STICK_MISS_Y
          stick.state = 'missed'
          missed.push(stick.index)
        }
      }
    }
    return { missed }
  }

  /** Whether that stick can be caught now (`canCatchStick`). */
  canCatch(index: number, paused: boolean): boolean {
    const stick = this.sticks[index]
    return stick != null && canCatchStick(stick.state, paused)
  }

  /**
   * Catches a stick, if it can be: it lights up and returns how long it had been falling, as a
   * fraction of its fall time (`stickFallProgress`, against its own anchor). `null` if it could not.
   */
  catchStick(index: number, paused: boolean): number | null {
    if (!this.canCatch(index, paused)) return null
    const stick = this.sticks[index]
    stick.state = 'caught'
    stick.flash = 1
    return stickFallProgress(stick.y, stick.layout.anchor[1])
  }

  /** The sticks that can be caught now, by index. */
  catchable(paused: boolean): Stick[] {
    return this.sticks.filter((p) => canCatchStick(p.state, paused))
  }
}
