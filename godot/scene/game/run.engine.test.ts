/**
 * The Stick Rush run in Godot against the rules of the web's `gameStore`: the phases and the
 * countdown, the points and the streak, the lives of the challenge, the levels with their stars,
 * the endless run by rounds, the record, the hoop height, the lesson that is learnt by catching and
 * the contract of the challenge with the hall (entering already playing with its seed and reporting
 * each run only once), with the feats first earned in the result, which is what goes in the JSON of
 * `report_result`.
 *
 * It runs inside the engine, with the domain tests: it saves in the kit's save.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { MAX_STICKS, MIN_STICKS } from '@/lib/gameConfig'
import { CHALLENGE_LIVES, CHALLENGE_SETUP, DEFAULT_GAME_MODE } from '@/lib/gameMode'
import { HOOP_ADJUST_RANGE, HOOP_ADJUST_STEP, HOOP_RISE_ABOVE_EYES, getHoopAdjustment } from '@/lib/hoopHeight'
import { LEVEL_STICK_STEPS, levelSpec } from '@/lib/levels'
import { getBestEndlessStreak, getBestPoints } from '@/lib/bests'
import { getUnlockedLevel } from '@/lib/progress'
import { stickPoints } from '@/lib/scoring'
import { deriveSeed, type GameResult } from '@/lib/seed'
import { gameStorage } from '@/lib/storage'
import { formatFigure } from '@/lib/textos'
import { getDuelTally } from '@/lib/duelTally'
import { FEATS, FEATS_KEY, readFeats, type ResultWithFeats } from '@/lib/feats'
import { STEP_DEADLINE, tutorialSeen } from '@/lib/tutorial'

import type { Goal } from '@/lib/goal'

import { COUNTDOWN_SECONDS, CHALLENGE_MODE, Run, clampStickCount, type RunOptions } from './run'
import { THRESHOLD_SOUND, SOUNDS, soundsBetween, type Cues } from './sound'

/**
 * A run with **practice** chosen, which is what almost all these tests play: that is where the
 * sticks and the speed are chosen. The menu opens on the challenge (the first one checks it).
 */
function inPractice(options?: RunOptions): Run {
  const p = new Run(options)
  p.setGameMode('practice')
  return p
}

/** A run with the countdown already over. */
function playing(p: Run, options?: { tutorial?: boolean }): Run {
  p.startGame(options)
  p.tick(COUNTDOWN_SECONDS)
  return p
}

/** Resolves `n` sticks: caught just released, or missed. */
function resolve(p: Run, n: number, caught = true): void {
  for (let i = 0; i < n; i++) {
    if (caught) p.catchStick(0)
    else p.missStick()
  }
}

describe('the run of the web, without React', () => {
  beforeEach(() => gameStorage()?.clear())

  it('starts in the menu with the challenge chosen: playing without touching anything starts the run that gives a medal', () => {
    const p = new Run()
    expect(DEFAULT_GAME_MODE).toBe('challenge')
    expect([p.gameState, p.gameMode, p.lives, p.sign('en'), p.signPhase]).toEqual(['menu', 'challenge', CHALLENGE_LIVES, null, null])
    p.startGame()
    expect([p.gameState, p.gameMode, p.activeDifficulty, p.activeStickCount, p.signPhase]).toEqual([
      'countdown',
      'challenge',
      CHALLENGE_SETUP.difficulty,
      CHALLENGE_SETUP.stickCount,
      'before',
    ])
  })

  it('practice is one tap away: on Easy, with five sticks and no lives', () => {
    const p = inPractice()
    expect([p.gameState, p.gameMode, p.difficulty, p.stickCount, p.endless, p.lives]).toEqual(['menu', 'practice', 'easy', MIN_STICKS, false, null])
  })

  it('the sticks stay between five and thirteen', () => {
    expect([clampStickCount(2), clampStickCount(20), clampStickCount(7.4), clampStickCount(Number.NaN)]).toEqual([MIN_STICKS, MAX_STICKS, 7, MIN_STICKS])
  })

  it('playing counts down three seconds, with a new seed; the question about leaving stops it and stops the sticks', () => {
    let seed = 100
    const p = inPractice({ seeds: () => ++seed })
    p.startGame()
    expect([p.gameState, p.countdown, p.seed, p.runId, p.paused]).toEqual(['countdown', 3, 101, 1, true])
    p.tick(1.2)
    expect(p.countdown).toBe(2)
    p.askToQuit()
    p.tick(5)
    expect(p.countdown).toBe(2)
    p.keepPlaying()
    p.tick(2)
    expect([p.gameState, p.paused]).toEqual(['playing', false])
    p.askToQuit()
    expect(p.paused).toBe(true)
    p.resetGame()
    expect(p.gameState).toBe('menu')
    p.startGame()
    expect([p.seed, p.runId]).toEqual([102, 2])
  })

  it('each caught stick scores with the difficulty, the streak and the reflexes of the web', () => {
    const p = inPractice()
    p.setDifficulty('hard')
    playing(p)
    p.catchStick(0.2)
    p.catchStick(0.9)
    p.missStick()
    p.catchStick(0)
    const expected =
      stickPoints({ difficulty: 'hard', streak: 1, fallProgress: 0.2 }) +
      stickPoints({ difficulty: 'hard', streak: 2, fallProgress: 0.9 }) +
      stickPoints({ difficulty: 'hard', streak: 1, fallProgress: 0 })
    expect([p.score, p.resolved, p.misses, p.streak, p.bestStreak, p.points]).toEqual([3, 4, 1, 1, 2, expected])
  })

  it('practice ends with the last stick, the record is saved and the hall is told once', () => {
    const reported: GameResult[] = []
    const p = inPractice({ onFinish: (r) => reported.push(r) })
    playing(p)
    resolve(p, 4)
    expect(p.gameState).toBe('playing')
    resolve(p, 1, false)
    expect([p.gameState, p.outcome, p.isRecord]).toEqual(['finished', 'cleared', true])
    expect(getBestPoints('practice')).toBe(p.points)
    p.tick(1)
    p.tick(1)
    expect(reported).toEqual([{ mode: 'practice', points: p.points, challenge: false }])
    // Another identical one does not beat the best: it equals it.
    const other = inPractice()
    playing(other)
    resolve(other, 4)
    resolve(other, 1, false)
    expect(other.isRecord).toBe(false)
  })

  it('the challenge is fixed, with three lives: the third one that gets away ends it', () => {
    const p = inPractice()
    p.setGameMode('challenge')
    p.setDifficulty('impossible')
    p.setStickCount(5)
    playing(p)
    expect([p.activeDifficulty, p.activeStickCount, p.lives]).toEqual([CHALLENGE_SETUP.difficulty, CHALLENGE_SETUP.stickCount, CHALLENGE_LIVES])
    resolve(p, 2, false)
    expect([p.lives, p.gameState]).toEqual([1, 'playing'])
    resolve(p, 1, false)
    expect([p.lives, p.gameState, p.outcome]).toEqual([0, 'finished', 'failed'])
  })

  it('the mode only changes between runs', () => {
    const p = inPractice()
    playing(p)
    p.setGameMode('challenge')
    expect(p.gameMode).toBe('practice')
    p.resetGame()
    p.setGameMode('levels')
    expect(p.gameMode).toBe('levels')
  })

  it('the levels play what the level says, give stars and open the next one', () => {
    const p = inPractice()
    p.setGameMode('levels')
    expect(p.activeLevel).toBe(getUnlockedLevel())
    playing(p)
    const level = levelSpec(1)
    expect([p.activeDifficulty, p.activeStickCount]).toEqual([level.difficulty, LEVEL_STICK_STEPS[0]])
    resolve(p, level.stickCount)
    expect(p.levelResult).toEqual({ stars: 3, passed: true, unlocked: 2 })
    expect(p.isRecord).toBe(false)
    p.tick(0.1)
    expect(getUnlockedLevel()).toBe(2)
    // During the summary the level is still the one played, even though the next one is already open.
    expect(p.activeLevel).toBe(1)
    // Without choosing, the highest open one; what is chosen is clamped to what is open.
    p.resetGame()
    expect(p.activeLevel).toBe(2)
    expect(p.levelStars[0]).toBe(3)
    p.setLevel(9)
    expect(p.activeLevel).toBe(2)
    p.setLevel(1)
    expect(p.activeLevel).toBe(1)
  })

  it('endless, the machine reloads with another seed and whoever plays closes it; the streak is saved', () => {
    const p = inPractice({ seeds: () => 7 })
    p.setEndless(true)
    playing(p)
    const first = p.stickSeed
    expect(first).toBe(deriveSeed(7, 0))
    resolve(p, 5)
    expect([p.wave, p.waveScore, p.waveResolved, p.score, p.gameState]).toEqual([1, 0, 0, 5, 'playing'])
    expect(p.stickSeed).toBe(deriveSeed(7, 1))
    resolve(p, 3)
    p.endRun()
    expect([p.gameState, p.outcome, p.isRecord]).toEqual(['finished', 'cleared', true])
    expect(getBestEndlessStreak()).toBe(8)
  })

  it('the hoop goes up and down in steps, with limits, and is saved', () => {
    const p = inPractice()
    for (let i = 0; i < 10; i++) p.adjustHoop(1)
    expect(p.hoopAdjustment).toBeCloseTo(HOOP_ADJUST_RANGE)
    expect(getHoopAdjustment()).toBeCloseTo(HOOP_ADJUST_RANGE)
    p.adjustHoop(-1)
    expect(p.hoopAdjustment).toBeCloseTo(HOOP_ADJUST_RANGE - HOOP_ADJUST_STEP)
    p.setPlayerEyeHeight(1.5)
    expect(p.hoopHeight).toBeCloseTo(1.5 + HOOP_RISE_ABOVE_EYES + HOOP_ADJUST_RANGE - HOOP_ADJUST_STEP)
    expect(inPractice().hoopAdjustment).toBeCloseTo(HOOP_ADJUST_RANGE - HOOP_ADJUST_STEP)
  })

  it('with the headset and without having seen it, the run teaches; it is learnt by catching and is marked as seen', () => {
    const p = inPractice()
    p.setImmersive(true)
    playing(p)
    expect([p.teaching, p.tutorialStep]).toEqual([true, 'grab'])
    p.catchStick(0)
    expect(p.tutorialStep).toBe('around')
    p.catchStick(0)
    p.tick(0.01)
    expect(p.tutorialStep).toBe(null)
    expect(tutorialSeen()).toBe(true)
    // Once seen, the next run no longer teaches.
    p.resetGame()
    playing(p)
    expect(p.teaching).toBe(false)
  })

  it('each step has its deadline, which only runs while playing; next passes it and skipping counts it as seen', () => {
    const p = inPractice()
    playing(p, { tutorial: true })
    p.askToQuit()
    p.tick(STEP_DEADLINE.grab + 1)
    expect(p.tutorialStep).toBe('grab')
    p.keepPlaying()
    p.tick(STEP_DEADLINE.grab / 2)
    p.tick(STEP_DEADLINE.grab / 2 + 0.01)
    expect(p.tutorialStep).toBe('around')
    p.nextTutorialStep()
    expect(p.tutorialStep).toBe(null)
    p.resetGame()
    playing(p, { tutorial: true })
    p.finishTutorial()
    expect([p.teaching, p.tutorialSeen, tutorialSeen()]).toEqual([false, true, true])
  })

  it('the hall challenge enters already playing the challenge mode with its seed, and another run is no longer the challenge', () => {
    const reported: GameResult[] = []
    const p = inPractice({ challenge: { seed: 4242 }, onFinish: (r) => reported.push(r), seeds: () => 1 })
    expect([p.gameState, p.gameMode, p.inChallenge, p.seed, p.countdown]).toEqual(['countdown', CHALLENGE_MODE, true, 4242, 3])
    p.tick(COUNTDOWN_SECONDS)
    resolve(p, CHALLENGE_LIVES, false)
    expect(reported).toEqual([{ mode: 'challenge', points: 0, challenge: true }])
    p.startGame()
    expect([p.inChallenge, p.seed]).toEqual([false, 1])
  })
})

describe('the two-player run, without React', () => {
  beforeEach(() => gameStorage()?.clear())

  /** A two-player run in the challenge, with the seeds that are asked for one after another. */
  function twoPlayers(seeds: number[], onFinish?: (r: GameResult) => void): Run {
    let i = 0
    const p = inPractice({ seeds: () => seeds[i++ % seeds.length], onFinish })
    p.setGameMode('challenge')
    p.setPlayers(2)
    return p
  }

  it('alone, or outside the challenge, there is no two-player run', () => {
    const p = inPractice()
    p.setGameMode('challenge')
    playing(p)
    expect([p.duel, p.player]).toEqual([null, null])
    const q = inPractice()
    q.setPlayers(2)
    playing(q)
    expect(q.duel).toBeNull()
  })

  it('both play the same seed, and when the first one ends the controller is the second one\'s', () => {
    const p = twoPlayers([111, 222, 333])
    playing(p)
    expect([p.player, p.seed, p.stickSeed]).toEqual([0, 111, deriveSeed(111, 0)])
    resolve(p, 5)
    resolve(p, CHALLENGE_LIVES, false)
    expect(p.gameState).toBe('finished')
    expect(p.duel?.points).toEqual([p.points, null])
    expect([p.player, p.celebrates, p.isRecord]).toEqual([1, false, false])
    playing(p)
    expect([p.player, p.seed]).toEqual([1, 111])
  })

  it('whoever scores more wins, it is recorded for the pair, it is celebrated, told to the hall once and with no record', () => {
    const reported: GameResult[] = []
    const p = twoPlayers([111, 222], (r) => reported.push(r))
    playing(p)
    resolve(p, 5)
    resolve(p, CHALLENGE_LIVES, false)
    const first = p.points
    playing(p)
    resolve(p, 1)
    resolve(p, CHALLENGE_LIVES, false)
    p.tick(1)
    expect(p.duel?.points).toEqual([first, p.points])
    expect([p.celebrates, p.isRecord, getBestPoints('challenge')]).toEqual([true, false, 0])
    expect(getDuelTally()).toEqual({ wins: [1, 0], ties: 0 })
    expect(reported).toEqual([{ mode: 'duel', points: first, challenge: false }])
    // Again: a new run, with another seed.
    playing(p)
    expect([p.player, p.seed, p.duel?.points]).toEqual([0, 222, [null, null]])
  })

  it('with the same points it is a tie; going back to the menu leaves the run', () => {
    const p = twoPlayers([7])
    playing(p)
    resolve(p, CHALLENGE_LIVES, false)
    playing(p)
    resolve(p, CHALLENGE_LIVES, false)
    expect(getDuelTally()).toEqual({ wins: [0, 0], ties: 1 })
    p.resetGame()
    expect(p.duel).toBeNull()
  })
})

describe('the feats, as on the web', () => {
  beforeEach(() => gameStorage()?.clear())

  /** What the scene passes to the hall: the result as it is, in JSON (`reportToHall`). */
  function toTheHall(): { json: string[]; newRun: (options?: ConstructorParameters<typeof Run>[0]) => Run } {
    const json: string[] = []
    return {
      json,
      newRun: (options = {}) => inPractice({ ...options, onFinish: (r: ResultWithFeats) => json.push(JSON.stringify(r)) }),
    }
  }

  it('all thirteen with none getting away: SR_CLEAN_SWEEP in the JSON, saved and only the first time', () => {
    const { json, newRun } = toTheHall()
    const p = newRun()
    p.setStickCount(MAX_STICKS)
    playing(p)
    resolve(p, MAX_STICKS)
    expect(JSON.parse(json[0])).toEqual({ mode: 'practice', points: p.points, challenge: false, feats: [FEATS.cleanSweep] })
    expect(readFeats()).toEqual([FEATS.cleanSweep])
    expect(gameStorage()?.getItem(FEATS_KEY)).not.toBeNull()
    playing(p)
    resolve(p, MAX_STICKS)
    expect(JSON.parse(json[1])).not.toHaveProperty('feats')
  })

  it('twelve out of thirteen does not: the JSON is the usual one', () => {
    const { json, newRun } = toTheHall()
    const p = newRun()
    p.setStickCount(MAX_STICKS)
    playing(p)
    resolve(p, MAX_STICKS - 1)
    resolve(p, 1, false)
    expect(JSON.parse(json[0])).toEqual({ mode: 'practice', points: p.points, challenge: false })
  })

  it('with the hoop at the minimum, a clean round: SR_LOW_HOOP; one step above, no', () => {
    const { json, newRun } = toTheHall()
    const p = newRun()
    p.adjustHoop(-100)
    p.adjustHoop(1)
    playing(p)
    resolve(p, MIN_STICKS)
    expect(JSON.parse(json[0])).not.toHaveProperty('feats')
    p.adjustHoop(-1)
    expect(p.hoopAdjustment).toBe(-HOOP_ADJUST_RANGE)
    playing(p)
    resolve(p, MIN_STICKS)
    expect(JSON.parse(json[1]).feats).toEqual([FEATS.lowHoop])
  })

  it('a stick behind the back: SR_BEHIND_BACK; leaving the run halfway loses it', () => {
    const { json, newRun } = toTheHall()
    const p = newRun()
    playing(p)
    p.catchStick(0.5, true)
    p.resetGame()
    playing(p)
    resolve(p, MIN_STICKS, false)
    expect(JSON.parse(json[0])).not.toHaveProperty('feats')
    playing(p)
    p.catchStick(0.5, true)
    resolve(p, MIN_STICKS - 1, false)
    expect(JSON.parse(json[1]).feats).toEqual([FEATS.behindBack])
  })

  it('endless, the clean round counts on reloading and is given on ending; the one that gets away does not', () => {
    const { json, newRun } = toTheHall()
    const p = newRun()
    p.setEndless(true)
    p.setStickCount(MAX_STICKS)
    playing(p)
    resolve(p, 1, false)
    resolve(p, MAX_STICKS - 1)
    expect(p.wave).toBe(1)
    resolve(p, MAX_STICKS)
    expect(p.wave).toBe(2)
    resolve(p, 1)
    p.endRun()
    expect(JSON.parse(json[0]).feats).toEqual([FEATS.cleanSweep])
  })

  it('in the challenge, without losing a life; and with two players, the first turn\'s is counted when the second ends', () => {
    const { json, newRun } = toTheHall()
    const p = newRun()
    p.setGameMode('challenge')
    p.setPlayers(2)
    playing(p)
    resolve(p, CHALLENGE_SETUP.stickCount)
    expect(json).toEqual([])
    playing(p)
    resolve(p, CHALLENGE_LIVES, false)
    expect(JSON.parse(json[0])).toMatchObject({ mode: 'duel', feats: [FEATS.cleanSweep] })
  })
})

describe('the goal sign, as on the web', () => {
  beforeEach(() => gameStorage()?.clear())

  /** The thresholds of Stick Rush in the hall. */
  const GOAL: Goal = {
    medals: { bronze: 1900, silver: 3750, gold: 5200 },
    better: 'higher',
    unit: 'points in challenge',
    record: null,
    mode: 'challenge',
  }

  it('without a hall: the mission and the saved record; playing, the score so far, the lives and the sticks; at the end, what was achieved', () => {
    gameStorage()!.setItem('stick-rush:best-points:challenge', '3100')
    const p = new Run()
    p.startGame()
    expect(p.sign('en')).toMatchObject({ title: 'Catch 13 sticks. Drop three and out', detail: 'Your record 3,100' })
    expect(p.sign('es')).toMatchObject({ title: 'Atrapa 13 palos. Tres al suelo y fuera', detail: 'Tu récord 3100' })
    p.tick(COUNTDOWN_SECONDS)
    // Until the first stick is resolved the mission stays: there is time to read it.
    expect(p.signPhase).toBe('before')
    p.missStick()
    expect(p.signPhase).toBe('playing')
    expect(p.sign('es')).toMatchObject({ title: 'Tu récord 3100 · llevas 0', detail: 'Vidas ♥♥♡ · Palos 12' })
    expect(p.medal).toBeNull()
    resolve(p, 2, false)
    expect([p.gameState, p.signPhase]).toEqual(['finished', 'end'])
    expect(p.sign('en')).toMatchObject({ title: 'You scored 0', detail: '3,100 short of your record' })
  })

  it('with the hall\'s thresholds: the three thresholds, the medal that goes up and what was missing', () => {
    const p = new Run({ goal: { ...GOAL, medals: { bronze: 1, silver: 400, gold: 100000 } } })
    playing(p)
    expect(p.sign('es')).toMatchObject({ title: 'Atrapa 13 palos. Tres al suelo y fuera', detail: 'Bronce 1 · Plata 400 · Oro 100.000' })
    p.catchStick(0.5)
    expect(p.medal).toBe('bronze')
    resolve(p, 3)
    expect(p.points).toBeGreaterThanOrEqual(400)
    expect(p.medal).toBe('silver')
    resolve(p, 3, false)
    // The sign writes the figures like the hall's badge: in Spanish, four figures go without a dot.
    expect(p.points).toBeLessThan(10000)
    expect(p.sign('es')).toMatchObject({ title: `Plata · ${p.points} points in challenge`, detail: `Te han faltado ${formatFigure(100000 - p.points, 'es')} para el oro` })
  })

  it('two runs in a row: the second one compares with the new record of the first, which the hall has not passed again', () => {
    const reported: unknown[] = []
    const p = new Run({ goal: GOAL, onFinish: (result) => reported.push(result) })
    playing(p)
    // The first time, the bronze in sticks and the gold.
    expect(p.sign('es')?.detail).toBe('Bronce ≈ 13 palos · Oro 5200')
    resolve(p, 3)
    resolve(p, 3, false)
    const achieved = p.points
    expect(achieved).toBeGreaterThan(0)
    expect(p.sign('en')?.footer).toContain('First record!')
    expect(reported).toHaveLength(1)
    // The `goal` metadata still has no record, but the run already knows it: it asks for it on starting.
    playing(p)
    expect(p.sign('es')?.detail).toBe('Bronce 1900 · Plata 3750 · Oro 5200')
    resolve(p, 3, false)
    expect(p.sign('en')?.footer).toContain(`Your best ${formatFigure(achieved, 'en')}`)
  })

  it('outside the challenge: in the hall it says it does not count while playing; standalone, it is not hung', () => {
    const inTheHall = inPractice({ goal: GOAL })
    playing(inTheHall)
    expect(inTheHall.sign('es')).toMatchObject({ title: 'Práctica · no cuenta para medalla', subdued: true })
    expect([inTheHall.signPhase, inTheHall.medal]).toEqual([null, null])
    resolve(inTheHall, MIN_STICKS)
    expect([inTheHall.gameState, inTheHall.sign('es')]).toEqual(['finished', null])

    const standalone = inPractice()
    playing(standalone)
    expect(standalone.sign('en')).toBeNull()

    const twoPlayers = new Run({ goal: GOAL })
    twoPlayers.setPlayers(2)
    playing(twoPlayers)
    expect(twoPlayers.sign('en')?.title).toBe('Duel · does not count for a medal')
  })

  it('the crossed threshold sounds with its medal, besides the catch, and only once', () => {
    expect(SOUNDS).toEqual(expect.arrayContaining(Object.values(THRESHOLD_SOUND)))
    const base: Cues = { score: 0, missed: 0, countdown: 0, gameState: 'playing', streak: 0, isRecord: false, levelPassed: null, lives: 3, medal: null }
    const withBronze: Cues = { ...base, score: 1, streak: 1, medal: 'bronze' }
    expect(soundsBetween(base, withBronze)).toEqual(['catch-1', 'medal-bronze'])
    expect(soundsBetween(withBronze, { ...withBronze, score: 2, streak: 2 })).toEqual(['catch-2'])
    expect(soundsBetween(withBronze, { ...withBronze, score: 2, streak: 2, medal: 'gold' })).toEqual(['catch-2', 'medal-gold'])
    // Going back to the menu leaves the medal at nothing: it does not sound, and with no medal to look at neither.
    expect(soundsBetween(withBronze, { ...base, gameState: 'menu' })).toEqual([])
    expect(soundsBetween({ ...base, medal: undefined }, { ...base, medal: undefined })).toEqual([])
  })
})

describe('the warm-up, as in the web\'s store', () => {
  beforeEach(() => gameStorage()?.clear())

  it('three sticks on the floor with the lesson in front leave the challenge intact, and on closing it it starts from scratch', () => {
    const p = new Run()
    p.setImmersive(true)
    playing(p)
    expect([p.gameMode, p.warmingUp]).toEqual(['challenge', true])
    resolve(p, 3, false)
    expect([p.gameState, p.lives]).toEqual(['playing', CHALLENGE_LIVES])
    expect(p.sign('es')?.title).toBe('Calentamiento · no cuenta para medalla')

    const before = p.runId
    p.finishTutorial()
    p.tick(0.01)
    expect([p.warmingUp, p.runId, p.gameState, p.resolved, p.lives, p.nowItCounts]).toEqual([false, before + 1, 'countdown', 0, CHALLENGE_LIVES, true])
    p.tick(COUNTDOWN_SECONDS)
    p.missStick()
    expect([p.nowItCounts, p.lives]).toEqual([false, CHALLENGE_LIVES - 1])
  })

  it('never in practice nor in the hall challenge', () => {
    const practice = inPractice()
    practice.setImmersive(true)
    playing(practice)
    expect(practice.warmingUp).toBe(false)
    const fromChallenge = new Run({ challenge: { seed: 7 } })
    expect(fromChallenge.warmingUp).toBe(false)
  })
})
