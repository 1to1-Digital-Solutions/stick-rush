import { describe, expect, it } from 'vitest'
import { inWarmup } from './warmup'

describe('the warm-up', () => {
  const CHALLENGE = { teaching: true, gameMode: 'challenge' as const, twoPlayers: false, inChallenge: false }

  it('is the challenge with the lesson under way', () => {
    expect(inWarmup(CHALLENGE)).toBe(true)
  })

  it('with no lesson, the challenge counts from the first stick', () => {
    expect(inWarmup({ ...CHALLENGE, teaching: false })).toBe(false)
  })

  it('never in the challenge of the day nor with two players', () => {
    expect(inWarmup({ ...CHALLENGE, inChallenge: true })).toBe(false)
    expect(inWarmup({ ...CHALLENGE, twoPlayers: true })).toBe(false)
  })

  it('in practice and in the levels there is no medal to protect', () => {
    expect(inWarmup({ ...CHALLENGE, gameMode: 'practice' })).toBe(false)
    expect(inWarmup({ ...CHALLENGE, gameMode: 'levels' })).toBe(false)
  })
})
