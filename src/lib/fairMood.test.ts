import { describe, expect, it } from 'vitest'
import {
  BULB_GLOW_IDLE,
  BULB_GLOW_MAX,
  FULL_PARTY_STREAK,
  PARTY_STREAK,
  bulbGlow,
  bulbPulse,
  crowdBob,
  crowdTempo,
  partyLevel,
} from './fairMood'

describe('the glow of the bulbs', () => {
  it('with no streak it is the usual one, and with a streak it rises without going past the cap', () => {
    expect(bulbGlow(0)).toBe(BULB_GLOW_IDLE)
    let previous = BULB_GLOW_IDLE
    for (let streak = 1; streak <= 40; streak++) {
      const glow = bulbGlow(streak)
      expect(glow).toBeGreaterThan(previous)
      expect(glow).toBeLessThan(BULB_GLOW_MAX)
      previous = glow
    }
  })

  it('a short streak already shows: at five sticks it is more than halfway there', () => {
    const halfway = (BULB_GLOW_IDLE + BULB_GLOW_MAX) / 2
    expect(bulbGlow(PARTY_STREAK)).toBeGreaterThan(halfway)
  })
})

describe('the party', () => {
  it('does not start until the party streak and is complete with the long streak', () => {
    expect(partyLevel(PARTY_STREAK - 1)).toBe(0)
    expect(partyLevel(PARTY_STREAK)).toBeGreaterThan(0)
    expect(partyLevel(FULL_PARTY_STREAK)).toBe(1)
    expect(partyLevel(FULL_PARTY_STREAK + 10)).toBe(1)
  })

  it('the bulbs do not throb without a party', () => {
    for (let t = 0; t < 3; t += 0.05) expect(bulbPulse(PARTY_STREAK - 1, t)).toBe(0)
  })

  it('with a party they throb between 0 and the party level, and they really move', () => {
    const values = Array.from({ length: 200 }, (_, i) => bulbPulse(FULL_PARTY_STREAK, i / 100))
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...values)).toBeLessThanOrEqual(1)
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.9)
    const timid = Array.from({ length: 200 }, (_, i) => bulbPulse(PARTY_STREAK, i / 100))
    expect(Math.max(...timid)).toBeLessThan(0.5)
  })
})

describe('the crowd', () => {
  it('always sways a little, and more and faster with the streak', () => {
    expect(crowdBob(0)).toBeGreaterThan(0)
    expect(crowdBob(FULL_PARTY_STREAK)).toBeGreaterThan(crowdBob(3))
    expect(crowdBob(FULL_PARTY_STREAK * 3)).toBe(crowdBob(FULL_PARTY_STREAK))
    expect(crowdTempo(FULL_PARTY_STREAK)).toBeGreaterThan(crowdTempo(0))
    expect(crowdTempo(-5)).toBe(crowdTempo(0))
  })
})
