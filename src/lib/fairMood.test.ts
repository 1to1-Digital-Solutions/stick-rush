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

describe('el brillo de las bombillas', () => {
  it('sin racha es el de siempre, y con racha sube sin pasar del tope', () => {
    expect(bulbGlow(0)).toBe(BULB_GLOW_IDLE)
    let previous = BULB_GLOW_IDLE
    for (let streak = 1; streak <= 40; streak++) {
      const glow = bulbGlow(streak)
      expect(glow).toBeGreaterThan(previous)
      expect(glow).toBeLessThan(BULB_GLOW_MAX)
      previous = glow
    }
  })

  it('una racha corta ya se nota: a cinco palos va por más de la mitad del camino', () => {
    const halfway = (BULB_GLOW_IDLE + BULB_GLOW_MAX) / 2
    expect(bulbGlow(PARTY_STREAK)).toBeGreaterThan(halfway)
  })
})

describe('la fiesta', () => {
  it('no empieza hasta la racha de fiesta y está completa con la racha larga', () => {
    expect(partyLevel(PARTY_STREAK - 1)).toBe(0)
    expect(partyLevel(PARTY_STREAK)).toBeGreaterThan(0)
    expect(partyLevel(FULL_PARTY_STREAK)).toBe(1)
    expect(partyLevel(FULL_PARTY_STREAK + 10)).toBe(1)
  })

  it('las bombillas no palpitan sin fiesta', () => {
    for (let t = 0; t < 3; t += 0.05) expect(bulbPulse(PARTY_STREAK - 1, t)).toBe(0)
  })

  it('con fiesta palpitan entre 0 y el nivel de fiesta, y de verdad se mueven', () => {
    const values = Array.from({ length: 200 }, (_, i) => bulbPulse(FULL_PARTY_STREAK, i / 100))
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...values)).toBeLessThanOrEqual(1)
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.9)
    const timid = Array.from({ length: 200 }, (_, i) => bulbPulse(PARTY_STREAK, i / 100))
    expect(Math.max(...timid)).toBeLessThan(0.5)
  })
})

describe('el público', () => {
  it('siempre se mece un poco, y más y más deprisa con la racha', () => {
    expect(crowdBob(0)).toBeGreaterThan(0)
    expect(crowdBob(FULL_PARTY_STREAK)).toBeGreaterThan(crowdBob(3))
    expect(crowdBob(FULL_PARTY_STREAK * 3)).toBe(crowdBob(FULL_PARTY_STREAK))
    expect(crowdTempo(FULL_PARTY_STREAK)).toBeGreaterThan(crowdTempo(0))
    expect(crowdTempo(-5)).toBe(crowdTempo(0))
  })
})
