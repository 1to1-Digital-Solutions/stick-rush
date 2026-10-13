import { describe, expect, it } from 'vitest'

import { CHALLENGE_SETUP, GAME_MODE_ORDER } from './gameMode'
import { deriveSeed } from './seed'
import { buildStickLayout, fallOrder } from './stickLayout'
import {
  DUEL_MODE,
  PLAYER_COUNTS,
  PLAYER_COUNT_HINTS,
  PLAYER_COUNT_LABELS,
  PLAYER_LABELS,
  controllerHolder,
  createDuel,
  duelOver,
  duelTurn,
  duelSummary,
  duelWinner,
  picksPlayers,
  playsAsDuel,
  duelBest,
  otherPlayer,
  recordTurn,
} from './duel'

/**
 * The two-player match: one round of the challenge each, with the same sticks, and whoever scores
 * more points wins.
 *
 * What is tested is what makes it fair —that both play the same round— and what closes
 * it: whose turn it is, who wins and what happens when they tie.
 */

describe('whose turn it is', () => {
  it('the first one starts, the second follows and with both played it is nobody\'s turn', () => {
    const duel = createDuel(7)
    expect(duelTurn(duel)).toBe(0)
    expect(controllerHolder(duel)).toBe(0)

    const after = recordTurn(duel, 1200)
    expect(duelTurn(after)).toBe(1)
    expect(controllerHolder(after)).toBe(1)
    expect(duelOver(after)).toBe(false)

    const done = recordTurn(after, 900)
    expect(duelTurn(done)).toBeNull()
    expect(duelOver(done)).toBe(true)
    // Finished, the controller still belongs to whoever closed it: the scoreboard shows their round.
    expect(controllerHolder(done)).toBe(1)
  })

  it('a third round is nobody\'s: it does not change what has already been seen', () => {
    const done = recordTurn(recordTurn(createDuel(7), 1200), 900)
    expect(recordTurn(done, 5000)).toBe(done)
  })

  it('the seed is the same for both: it is not touched when noting down', () => {
    expect(recordTurn(recordTurn(createDuel(4242), 10), 20).seed).toBe(4242)
  })

  it('the other one is the other one', () => {
    expect(otherPlayer(0)).toBe(1)
    expect(otherPlayer(1)).toBe(0)
  })
})

describe('who wins', () => {
  it('whoever scores more points', () => {
    expect(duelWinner(recordTurn(recordTurn(createDuel(1), 1200), 900))).toBe(0)
    expect(duelWinner(recordTurn(recordTurn(createDuel(1), 900), 1200))).toBe(1)
  })

  it('with the same points it is a tie: the tie is not broken by another figure', () => {
    expect(duelWinner(recordTurn(recordTurn(createDuel(1), 1000), 1000))).toBeNull()
    expect(duelWinner(recordTurn(recordTurn(createDuel(1), 0), 0))).toBeNull()
  })

  it('without both rounds played nobody wins yet', () => {
    expect(duelWinner(createDuel(1))).toBeNull()
    expect(duelWinner(recordTurn(createDuel(1), 3000))).toBeNull()
  })

  it('the hall is told the best that was done in the match', () => {
    expect(duelBest(recordTurn(recordTurn(createDuel(1), 1200), 900))).toBe(1200)
    expect(duelBest(recordTurn(createDuel(1), 40))).toBe(40)
    expect(duelBest(createDuel(1))).toBe(0)
  })
})

describe('the same seed, the same round', () => {
  it('both see the same sticks fall, in the same order and in the same place', () => {
    // The challenge's round is round 0 of the match: its layout comes from the seed and its number.
    const duel = createDuel(98765)
    const first = deriveSeed(duel.seed, 0)
    const second = deriveSeed(recordTurn(duel, 1500).seed, 0)
    expect(second).toBe(first)
    expect(fallOrder(CHALLENGE_SETUP.stickCount, second)).toEqual(fallOrder(CHALLENGE_SETUP.stickCount, first))
    expect(buildStickLayout(CHALLENGE_SETUP.stickCount, second, 2)).toEqual(buildStickLayout(CHALLENGE_SETUP.stickCount, first, 2))
  })

  it('and another match is another round: the next one is not repeated', () => {
    const one = fallOrder(CHALLENGE_SETUP.stickCount, deriveSeed(createDuel(1).seed, 0))
    const another = fallOrder(CHALLENGE_SETUP.stickCount, deriveSeed(createDuel(2).seed, 0))
    expect(another).not.toEqual(one)
  })
})

describe('where two can play', () => {
  it('only in the challenge: it is the same run for everyone', () => {
    expect(GAME_MODE_ORDER.filter(picksPlayers)).toEqual(['challenge'])
    expect(DUEL_MODE).toBe('challenge')
    expect(playsAsDuel('challenge', 2)).toBe(true)
    expect(playsAsDuel('challenge', 1)).toBe(false)
    // Outside the challenge what was chosen does not count.
    expect(playsAsDuel('practice', 2)).toBe(false)
    expect(playsAsDuel('levels', 2)).toBe(false)
  })

  it('each option has its name and its explanation, and each player their own', () => {
    for (const count of PLAYER_COUNTS) {
      expect(PLAYER_COUNT_LABELS[count].length).toBeGreaterThan(0)
      expect(PLAYER_COUNT_HINTS[count].length).toBeGreaterThan(0)
    }
    expect(PLAYER_LABELS).toEqual(['Player 1', 'Player 2'])
  })
})

describe('what is said when a two-player round ends', () => {
  const PAIR = { wins: [3, 2] as const, ties: 1 }

  it('when the first one finishes: what they scored and the notice to pass the controller to the second', () => {
    const summary = duelSummary(recordTurn(createDuel(1), 1500), PAIR, 'en')
    expect(summary.title).toBe('Player 1: 1,500 points')
    expect(summary.pass).toBe('Pass the controller to Player 2.')
    expect(summary.next).toBe(1)
    expect(summary.winner).toBeNull()
    expect(summary.tally).toBeNull()
    expect(summary.lines).toEqual([{ player: 0, text: 'Player 1: 1,500 points' }])
  })

  it('when both finish: who wins, the points of both and what the pair has so far', () => {
    const summary = duelSummary(recordTurn(recordTurn(createDuel(1), 1500), 1700), PAIR, 'es')
    expect(summary.title).toBe('Gana Jugador 2')
    expect(summary.pass).toBeNull()
    expect(summary.next).toBeNull()
    expect(summary.winner).toBe(1)
    expect(summary.lines.map((l) => l.text)).toEqual(['Jugador 1: 1500 puntos', 'Jugador 2: 1700 puntos'])
    expect(summary.tally).toBe('Ganadas: 3–2 · empates: 1')
  })

  it('with the same points, a tie', () => {
    const summary = duelSummary(recordTurn(recordTurn(createDuel(1), 900), 900), PAIR, 'en')
    expect(summary.title).toBe("It's a tie")
    expect(summary.winner).toBeNull()
  })

  it('with nobody played yet, the notice is for the first one', () => {
    const summary = duelSummary(createDuel(1), PAIR, 'en')
    expect(summary.pass).toBe('Pass the controller to Player 1.')
    expect(summary.lines).toEqual([])
  })
})
