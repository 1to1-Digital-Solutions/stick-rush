/**
 * The sticks of a round in Godot against what each `Stick.tsx` does on the web: the layout of
 * `buildStickLayout`, the fall turn, the accelerated fall that lasts what the difficulty says, the
 * window to catch them (hanging or falling, never with the run paused nor already resolved), the
 * flash of the catch, the tint of the miss, the sway that belongs only to the ones that hang, and
 * that changing the hoop or the number of sticks in the menu does not remount the ones already
 * there. And the arithmetic of which stick the hand or the mouse touches, and the rule of what
 * sounds from `useGameSound.ts`.
 *
 * It runs inside the engine, with the domain tests.
 */
import { describe, expect, it } from 'vitest'

import {
  DIFFICULTY_SPEEDS,
  MACHINE_HEIGHT,
  STICK_CORD_LENGTH,
  STICK_LENGTH,
  STICK_MISS_Y,
  STICK_RADIUS,
  fallDurationSeconds,
} from '@/lib/gameConfig'
import { hoopFallSpeed } from '@/lib/hoopHeight'
import { buildStickLayout, fallOrder } from '@/lib/stickLayout'

import { GRAB_RADIUS, distanceToSegment, stickOnRay, stickInHand, rayAgainstSegment } from './reach'
import { SOUNDS, endingSound, soundsBetween, type Cues } from './sound'
import { CATCH_FLASH_DECAY, MAX_STEP, Round, roundKey, stickBody } from './round'

const STEP = 1 / 72

/** Advances the round `seconds` at 72 frames per second; returns the missed ones, in order. */
function runFor(round: Round, seconds: number, speed: number, paused = false): number[] {
  const missed: number[] = []
  for (let t = 0; t < seconds; t += STEP) missed.push(...round.advance(STEP, { paused, speed }).missed)
  return missed
}

describe('the sticks of the round, like those of the web', () => {
  it('hang where `buildStickLayout` puts them, with their turn and their sway', () => {
    const round = new Round('a', 99, 9, MACHINE_HEIGHT)
    const web = buildStickLayout(9, 99, MACHINE_HEIGHT)
    expect(round.sticks.map((p) => p.layout)).toEqual(web)
    expect(round.sticks.every((p) => p.state === 'hanging' && p.y === MACHINE_HEIGHT)).toBe(true)
  })

  it('paused they are not released, but they sway; and fully straight without sway', () => {
    const round = new Round('a', 3, 5, MACHINE_HEIGHT)
    runFor(round, 20, 1, true)
    expect(round.sticks.every((p) => p.state === 'hanging')).toBe(true)
    expect(round.sticks.some((p) => Math.abs(p.tilt.z) > 0.01)).toBe(true)
    const still = new Round('b', 3, 5, MACHINE_HEIGHT, false)
    runFor(still, 2, 1, true)
    expect(still.sticks.every((p) => p.tilt.x === 0 && p.tilt.z === 0)).toBe(true)
  })

  it('fall in turns (`fallOrder`) and each one takes what its difficulty says', () => {
    const speed = DIFFICULTY_SPEEDS.hard
    const round = new Round('a', 11, 7, MACHINE_HEIGHT)
    const missed = runFor(round, 30, speed)
    expect(missed).toEqual(fallOrder(7, 11))
    expect(round.sticks.every((p) => p.state === 'missed' && p.y === STICK_MISS_Y)).toBe(true)
    // The first one, with no delay: it touches the floor when its fall time runs out.
    const one = new Round('b', 11, 7, MACHINE_HEIGHT)
    const first = fallOrder(7, 11)[0]
    const duration = fallDurationSeconds('hard')
    runFor(one, duration - 0.05, speed)
    expect(one.sticks[first].state).toBe('falling')
    runFor(one, 0.1, speed)
    expect(one.sticks[first].state).toBe('missed')
  })

  it('with the hoop higher the fall is scaled: it takes the same', () => {
    const height = 2.3
    const speed = hoopFallSpeed(DIFFICULTY_SPEEDS.medium, height)
    const round = new Round('a', 5, 5, height)
    const first = fallOrder(5, 5)[0]
    runFor(round, fallDurationSeconds('medium') - 0.05, speed)
    expect(round.sticks[first].state).toBe('falling')
    runFor(round, 0.1, speed)
    expect(round.sticks[first].state).toBe('missed')
  })

  it('are caught hanging or falling, not paused nor resolved; catching it early gives more reflexes', () => {
    const speed = DIFFICULTY_SPEEDS.easy
    const hanging = new Round('a', 21, 5, MACHINE_HEIGHT)
    expect(hanging.catchStick(0, true)).toBe(null)
    expect(hanging.catchStick(0, false)).toBe(0)
    expect(hanging.catchStick(0, false)).toBe(null)
    const falling = new Round('b', 21, 5, MACHINE_HEIGHT)
    const first = fallOrder(5, 21)[0]
    runFor(falling, fallDurationSeconds('easy') * 0.6, speed)
    // At three fifths of its fall time, which is what the bonus measures (not the travel).
    const progress = falling.catchStick(first, false)!
    expect(progress).toBeGreaterThan(0.55)
    expect(progress).toBeLessThan(0.65)
  })

  it('the caught one lights up and goes with the flash; the missed one is tinted fully red', () => {
    const round = new Round('a', 1, 5, MACHINE_HEIGHT)
    round.catchStick(2, false)
    const stick = round.sticks[2]
    expect([stick.state, stick.flash, stick.visible]).toEqual(['caught', 1, true])
    runFor(round, 1 / CATCH_FLASH_DECAY + 0.05, 1, true)
    expect([stick.flash, stick.visible]).toEqual([0, false])
    const other = new Round('b', 1, 5, MACHINE_HEIGHT)
    runFor(other, 30, DIFFICULTY_SPEEDS.impossible)
    expect(other.sticks.every((p) => p.missTint === 1)).toBe(true)
  })

  it('a frame jump does not release half a round: the step is clamped', () => {
    const round = new Round('a', 1, 13, MACHINE_HEIGHT)
    round.advance(10, { paused: false, speed: 1 })
    expect(round.sticks.every((p) => p.elapsed === MAX_STEP)).toBe(true)
  })

  it('changing the hoop or the sticks in the menu does not remount the ones there were; the missed one stays on the floor', () => {
    const round = new Round('a', 8, 5, MACHINE_HEIGHT)
    runFor(round, 30, DIFFICULTY_SPEEDS.impossible)
    round.catchStick(0, false)
    round.place(7, 2.2)
    expect(round.sticks.length).toBe(7)
    expect(round.sticks[0].state).toBe('missed')
    expect(round.sticks[0].y).toBe(STICK_MISS_Y)
    expect([round.sticks[5].state, round.sticks[5].y]).toEqual(['hanging', 2.2])
    expect(round.sticks.map((p) => p.layout)).toEqual(buildStickLayout(7, 8, 2.2))
    expect(roundKey(3, 8)).not.toBe(roundKey(4, 8))
  })

  it('the body of the stick hangs a cord below the anchor and tilts with the sway', () => {
    const round = new Round('a', 1, 5, MACHINE_HEIGHT, false)
    const stick = round.sticks[2]
    const [x, y, z] = stick.layout.anchor
    const straight = stickBody(stick)
    const expected = { top: [x, y - STICK_CORD_LENGTH, z], bottom: [x, y - STICK_CORD_LENGTH - STICK_LENGTH, z] }
    for (const tip of ['top', 'bottom'] as const) straight[tip].forEach((v, i) => expect(v).toBeCloseTo(expected[tip][i]))
    stick.tilt = { x: 0, z: Math.PI / 2 }
    const { bottom } = stickBody(stick)
    expect(bottom[0]).toBeCloseTo(x + STICK_CORD_LENGTH + STICK_LENGTH)
    expect(bottom[1]).toBeCloseTo(y)
  })
})

describe('which stick the hand or the mouse touches', () => {
  it('the distance to a segment and that of a ray to a segment', () => {
    expect(distanceToSegment([0, 0.5, 1], [0, 0, 0], [0, 1, 0])).toBeCloseTo(1)
    expect(distanceToSegment([0, 2, 0], [0, 0, 0], [0, 1, 0])).toBeCloseTo(1)
    const r = rayAgainstSegment([0, 0.5, 5], [0, 0, -1], [0.01, 0, 0], [0.01, 1, 0])
    expect(r.distance).toBeCloseTo(0.01)
    expect(r.along).toBeCloseTo(5)
    // Parallel: from the top tip.
    expect(rayAgainstSegment([0, 0, 0], [0, 1, 0], [0.3, 0, 0], [0.3, 1, 0]).distance).toBeCloseTo(0.3)
  })

  it('the hand catches the stick that lies in its grab sphere, the nearest one', () => {
    const round = new Round('a', 1, 5, MACHINE_HEIGHT, false)
    const stick = round.sticks[2]
    const { top, bottom } = stickBody(stick)
    const middle: [number, number, number] = [(top[0] + bottom[0]) / 2, (top[1] + bottom[1]) / 2, (top[2] + bottom[2]) / 2]
    expect(stickInHand(round.sticks, middle)?.index).toBe(2)
    const outside: [number, number, number] = [middle[0], middle[1], middle[2] + GRAB_RADIUS + STICK_RADIUS + 0.01]
    expect(stickInHand(round.sticks, outside)).toBe(null)
  })

  it('the mouse catches the first stick its ray crosses, and not the one behind', () => {
    const round = new Round('a', 1, 5, MACHINE_HEIGHT, false)
    const stick = round.sticks[2]
    const { top, bottom } = stickBody(stick)
    const middle: [number, number, number] = [(top[0] + bottom[0]) / 2, (top[1] + bottom[1]) / 2, (top[2] + bottom[2]) / 2]
    const origin: [number, number, number] = [middle[0], middle[1], middle[2] + 3]
    expect(stickOnRay(round.sticks, origin, [0, 0, -1])?.index).toBe(2)
    expect(stickOnRay(round.sticks, [middle[0] + STICK_RADIUS * 2, middle[1], middle[2] + 3], [0, 0, -1])).toBe(null)
  })
})

describe('what sounds, with the rule of `useGameSound.ts`', () => {
  const menu: Cues = { score: 0, missed: 0, countdown: 0, gameState: 'menu', streak: 0, isRecord: false, levelPassed: null, lives: null }

  it('the countdown, the start and the sticks, each note of the catch with its streak and capped at eight', () => {
    expect(soundsBetween(menu, { ...menu, gameState: 'countdown', countdown: 3 })).toEqual(['countdown-3'])
    expect(soundsBetween({ ...menu, gameState: 'countdown', countdown: 1 }, { ...menu, gameState: 'playing' })).toEqual(['go'])
    const playing = { ...menu, gameState: 'playing' as const }
    expect(soundsBetween(playing, { ...playing, score: 1, streak: 1 })).toEqual(['catch-1'])
    expect(soundsBetween(playing, { ...playing, score: 12, streak: 12 })).toEqual(['catch-8'])
    expect(soundsBetween(playing, { ...playing, missed: 1 })).toEqual(['miss'])
    expect(soundsBetween(playing, playing)).toEqual([])
  })

  it('the end: winning, losing or finishing, with the record on top', () => {
    const playing = { ...menu, gameState: 'playing' as const }
    expect(soundsBetween(playing, { ...playing, gameState: 'finished', isRecord: true })).toEqual(['over-close', 'record'])
    // The end of a two-player run sounds like winning, with the flourish on top, even if it ends without lives.
    expect(soundsBetween(playing, { ...playing, gameState: 'finished', lives: 0, isRecord: true, duelEnds: true })).toEqual(['over-win', 'record'])
    expect(endingSound(true, null)).toBe('win')
    expect(endingSound(false, null)).toBe('loss')
    expect(endingSound(null, 2)).toBe('win')
    expect(endingSound(null, 0)).toBe('loss')
    expect(endingSound(null, null)).toBe('close')
  })

  it('everything that can sound is a file of `godot-kit.json`', () => {
    expect(SOUNDS.length).toBe(20)
  })
})
