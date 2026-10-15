/**
 * The Stick Rush run in Godot: what on the web is `lib/gameStore.ts`, without React.
 *
 * The web's store is a hook (`useState`, `useEffect`, `useSyncExternalStore`) and the engine has no
 * React, so here the same machine is written as a class that the scene advances every frame.
 * **The rules are not rewritten**: the end comes from `gameMode.ts` (`runOutcome`, the lives), the
 * points from `scoring.ts`, the levels and their stars from `levels.ts`, the hoop height from
 * `hoopHeight.ts`, the lesson from `tutorial.ts` and what is saved from `bests.ts` and
 * `progress.ts`. What is left here is what the `useState`s and the `useEffect`s do on the web: what
 * has been chosen, which phase it is in, the counters of the run in progress and the clocks (the
 * countdown and the deadline of each step of the lesson).
 *
 * Just as on the web, **almost everything is derived**: the phase comes from whether there is a
 * run, from the countdown and from the resolved sticks; the lives, from the missed ones; the
 * tutorial step, from the caught ones and from what was skipped. What is not derived is what the
 * web keeps in state, with the same names.
 *
 * **The two-player run too**, as on the web (`lib/duel.ts`): in the challenge, with two players,
 * each run is one player's round, with the first one's seed for the second; the round just finished
 * is deduced from the points and is recorded when the next one starts; when the second one ends it
 * is recorded for the pair (`duelTally.ts`) and the hall is told once, without touching the record.
 *
 * It does not touch the engine (neither `godot` nor nodes), so it is tested whole in
 * `run.engine.test.ts` without mounting the scene.
 */
import { MAX_STICKS, MIN_STICKS, type Difficulty } from '@/lib/gameConfig'
import type { Lang } from '@/lib/settings'
import { inWarmup } from '@/lib/warmup'
import { runCounts, signRun } from '@/lib/machineSign'
import { goalWithPlayed } from '@kit/lib/gameBase'
import { CHALLENGE_SETUP, DEFAULT_GAME_MODE, remainingLives, runOutcome, type GameMode, type RunOutcome } from '@/lib/gameMode'
import {
  controllerHolder,
  createDuel,
  duelOver,
  duelWinner,
  playsAsDuel,
  duelBest,
  recordTurn,
  type Duel,
  type Player,
  type PlayerCount,
} from '@/lib/duel'
import { saveDuelResult } from '@/lib/duelTally'
import {
  NO_FEATS,
  withFeats,
  countCatch,
  countRound,
  earnFeats,
  type FeatCount,
  type ResultWithFeats,
} from '@/lib/feats'
import { HOOP_ADJUST_STEP, clampHoopAdjustment, getHoopAdjustment, hoopHeightFor, saveHoopAdjustment } from '@/lib/hoopHeight'
import { LEVEL_COUNT, clampLevel, levelPassed, levelSpec, levelStars, type Stars } from '@/lib/levels'
import { getBestEndlessStreak, getBestPoints, saveBestEndlessStreak, saveBestPoints } from '@/lib/bests'
import {
  goalSign,
  medalToCelebrate,
  type GoalPhase,
  type Medal,
  type Goal,
  type Run as GoalRun,
  type GoalSignView,
} from '@/lib/goal'
import { getStarsList, getUnlockedLevel, saveLevelResult } from '@/lib/progress'
import { stickPoints } from '@/lib/scoring'
import { randomSeed, deriveSeed, type Challenge } from '@/lib/seed'
import { softTranslator } from '@/lib/textos'
import {
  STEP_DEADLINE,
  milestonesFromCatches,
  markTutorialSeen,
  skipStep,
  tutorialSeen as readTutorialSeen,
  tutorialStep as tutorialStepFor,
  type TutorialStepKey,
} from '@/lib/tutorial'

/** The web's phases (`GameState`). The question about leaving goes apart, in `prompt`, as there. */
export type RunPhase = 'menu' | 'countdown' | 'playing' | 'finished'

/** Seconds of countdown between pressing «jugar» and the first stick (`COUNTDOWN_SECONDS`). */
export const COUNTDOWN_SECONDS = 3

/** The mode played with the hall's `challenge`: that of the cabinet's record (`CHALLENGE_MODE`). */
export const CHALLENGE_MODE: GameMode = 'challenge'

/** How the level played ended: what the end shows (the web's `levelResult`). */
export interface LevelResult {
  stars: Stars
  passed: boolean
  /** The level this run opens, if it opens any. */
  unlocked: number | null
}

/** Restricts the number of sticks to the allowed range (`clampStickCount`). */
export function clampStickCount(count: number): number {
  if (Number.isNaN(count)) return MIN_STICKS
  return Math.min(MAX_STICKS, Math.max(MIN_STICKS, Math.round(count)))
}

export interface RunOptions {
  /** Play this challenge: it goes straight into a run of the challenge mode, with the sticks of its seed. */
  challenge?: Challenge | null
  /**
   * Called once when each run with a score ends (not when it is left halfway), with the feats
   * first earned in it if there are any (`feats.ts`).
   */
  onFinish?: (result: ResultWithFeats) => void
  /** Where the seed of a run that is not the challenge comes from. By default, at random. */
  seeds?: () => number
  /**
   * The game's medal thresholds and the best of whoever plays, for the sign above the scoreboard
   * (`goal.ts`). Without it, the sign says the mission and the record saved here.
   */
  goal?: Goal | null
}

export class Run {
  // What is chosen in the menu.
  stickCount = MIN_STICKS
  difficulty: Difficulty = 'easy'
  /** It opens on the challenge, with a hall or without one (`DEFAULT_GAME_MODE`): practice is one tap away. */
  gameMode: GameMode = DEFAULT_GAME_MODE
  endless = false
  /** Level chosen in Levels, or `null` = the highest unlocked one. */
  level: number | null = null
  /** Alone, or two passing the controller: it only counts in the challenge (`playsAsDuel`). */
  players: PlayerCount = 1

  // The run in progress.
  running = false
  /** Seconds of countdown left, with decimals: it is shown rounded up (`countdown`). */
  countdownLeft = 0
  prompt: 'quit' | null = null
  runId = 0
  /** Where the layout of the run comes from: the challenge's one, or a new one in each run. */
  seed = 0
  /** What is played now is the challenge the hall passed. Only the first one: «otra vez» is already theirs. */
  inChallenge = false
  wave = 0
  private waveStart = { score: 0, resolved: 0 }
  score = 0
  resolved = 0
  points = 0
  streak = 0
  bestStreak = 0

  // What the web keeps in state even though it is not the run's.
  /** Manual correction of the hoop height, saved between visits. */
  hoopAdjustment: number
  /** What the headset measures, or `null` without a headset or without a floor. */
  playerEyeHeight: number | null = null
  tutorialSeen: boolean
  /** Whether this run is teaching how to play (the lesson runs with the run, it does not stop it). */
  teaching = false
  /**
   * The run started warming up (`warmup.ts`): the missed sticks take no lives and it does not
   * end. It is turned off when the challenge starts again from scratch, when the lesson closes.
   */
  warmingUp = false
  /** The challenge has just started from scratch after the warm-up: it is announced until the first stick. */
  private countsNotice = false
  /** Whether it is played with the headset on: decides who is shown the lesson. */
  immersive = false
  /** Whether it is played with bare hands: it changes the sentence of the lesson, not the gesture. */
  bareHanded = false

  private tutorialSkipped = 0
  /** Seconds the current step has been in view, for its safety deadline (`STEP_DEADLINE`). */
  private stepTime = 0
  private timedStep: TutorialStepKey | null = null
  private endedByPlayer = false
  private recordToBeat = 0
  private unlockedAtStart = 1
  private levelAtStart = 1
  private readonly onFinish: ((result: ResultWithFeats) => void) | undefined
  private readonly seeds: () => number
  /** The cabinet's goal as the hall passed it on mounting (the `goal` metadata). */
  private readonly goal: Goal | null
  /**
   * That of the run in progress: the cabinet's one with the record raised by what has already been
   * reported to the hall (`goalWithPlayed`), taken when each run starts like the web's record on
   * pressing «Jugar». Read only once on mounting, the second run would compare with the old record.
   */
  private runGoal: Goal | null
  /** What the run has reported to the hall when each one ended, in order. */
  private readonly reported: ResultWithFeats[] = []
  /** The run (its `runId`) whose end was already saved and reported to the hall. */
  private reportedRun = -1
  /** Whether the lesson of this run was already marked as seen on getting through its steps. */
  private markedSeen = false
  /** Which round has already been passed in the endless run: two passes through the same one do not add up to two. */
  private advancedWave = -1
  /** The two-player run with the rounds already closed recorded; the one just finished is deduced (`duel`). */
  private duelSoFar: Duel | null = null
  /** The feats of the run in progress; with two players, those of both turns (the web's `feats`). */
  private feats: FeatCount = NO_FEATS

  constructor({ challenge = null, onFinish, seeds = randomSeed, goal = null }: RunOptions = {}) {
    this.goal = goal
    this.runGoal = goal
    this.onFinish = onFinish
    this.seeds = seeds
    this.hoopAdjustment = getHoopAdjustment()
    this.tutorialSeen = readTutorialSeen()
    if (challenge != null) {
      // With the hall's challenge it goes straight into playing, as on the web: no menu and no lesson.
      this.gameMode = CHALLENGE_MODE
      this.inChallenge = true
      this.seed = challenge.seed >>> 0
      this.recordToBeat = getBestPoints(CHALLENGE_MODE)
      this.running = true
      this.countdownLeft = COUNTDOWN_SECONDS
    }
  }

  get levels(): boolean {
    return this.gameMode === 'levels'
  }

  /** Endless practice: the machine reloads every time it empties. */
  get endlessRun(): boolean {
    return this.gameMode === 'practice' && this.endless
  }

  get unlockedLevel(): number {
    return getUnlockedLevel()
  }

  /** The stars of each level, from the first to the last. */
  get levelStars(): Stars[] {
    return getStarsList().split(',').map((s) => Number(s) as Stars)
  }

  private get selectedLevel(): number {
    const unlocked = getUnlockedLevel()
    return clampLevel(Math.min(this.level ?? unlocked, unlocked))
  }

  /** The level being played: the chosen one, or the highest; during the run, the one at the start. */
  get activeLevel(): number {
    return this.running ? this.levelAtStart : this.selectedLevel
  }

  /** What hangs: what was chosen in practice, the level's in Levels and the fixed setup of the challenge. */
  private get setup(): { difficulty: Difficulty; stickCount: number } {
    if (this.levels) return levelSpec(this.activeLevel)
    if (this.gameMode === 'challenge') return CHALLENGE_SETUP
    return { difficulty: this.difficulty, stickCount: this.stickCount }
  }

  get activeDifficulty(): Difficulty {
    return this.setup.difficulty
  }

  get activeStickCount(): number {
    return this.setup.stickCount
  }

  /** The seed of the layout of the round in progress: each round of the endless run brings new sticks. */
  get stickSeed(): number {
    return deriveSeed(this.seed, this.wave)
  }

  get waveScore(): number {
    return this.score - this.waveStart.score
  }

  get waveResolved(): number {
    return this.resolved - this.waveStart.resolved
  }

  get misses(): number {
    return this.resolved - this.score
  }

  get lives(): number | null {
    return remainingLives(this.gameMode, this.warmingUp ? 0 : this.misses)
  }

  /** Until the first stick of the challenge that started from scratch after the warm-up is resolved. */
  get nowItCounts(): boolean {
    return this.countsNotice && this.resolved === 0
  }

  get outcome(): RunOutcome | null {
    if (!this.running || this.warmingUp) return null
    if (this.endlessRun) return this.endedByPlayer ? 'cleared' : null
    return runOutcome({ mode: this.gameMode, resolved: this.resolved, misses: this.misses, stickCount: this.activeStickCount })
  }

  /** The figure of the countdown, as the web keeps it: 3, 2, 1 and 0 outside it (`countdown`). */
  get countdown(): number {
    return Math.ceil(this.countdownLeft)
  }

  get gameState(): RunPhase {
    if (!this.running) return 'menu'
    if (this.countdown > 0) return 'countdown'
    if (this.outcome != null) return 'finished'
    return 'playing'
  }

  /** Which step of the lesson is due to be shown, or `null` if there is no lesson or nothing is left. */
  get tutorialStep(): TutorialStepKey | null {
    return this.teaching ? tutorialStepFor(milestonesFromCatches(this.score), this.tutorialSkipped) : null
  }

  get levelResult(): LevelResult | null {
    if (!this.levels || this.gameState !== 'finished') return null
    const stars = levelStars(this.score, this.activeStickCount)
    const passed = levelPassed(stars)
    const level = this.activeLevel
    const opens = passed && level + 1 > this.unlockedAtStart && level < LEVEL_COUNT
    return { stars, passed, unlocked: opens ? level + 1 : null }
  }

  /** The best of this mode: points, or the streak in the endless run; in Levels there is no best. */
  get bestPoints(): number {
    return this.endlessRun ? getBestEndlessStreak() : this.levels ? 0 : getBestPoints(this.gameMode)
  }

  /**
   * The run just finished has beaten the best it started with and what is saved is exactly this
   * score (with the storage blocked the best to beat would stay at zero for ever).
   */
  get isRecord(): boolean {
    const achieved = this.endlessRun ? this.bestStreak : this.points
    return this.gameState === 'finished' && !this.levels && this.duelSoFar == null && achieved > this.recordToBeat && this.bestPoints === achieved
  }

  /**
   * The two-player run, with the round just finished already recorded, or `null` if playing alone:
   * the notice to pass the controller and the one of who has won come from here (the web's
   * `currentDuel`).
   */
  get duel(): Duel | null {
    return this.duelSoFar != null && this.gameState === 'finished' ? recordTurn(this.duelSoFar, this.points) : this.duelSoFar
  }

  /** Who holds the controller in the two-player run, or `null` if playing alone. */
  get player(): Player | null {
    const duel = this.duel
    return duel == null ? null : controllerHolder(duel)
  }

  /** Whether the end sounds like winning on top of the close: a record, or the end of a two-player run. */
  get celebrates(): boolean {
    const duel = this.duel
    return this.isRecord || (duel != null && duelOver(duel))
  }

  /** The run just as it is told to the goal sign (the web's `signRun`). */
  private forTheSign(lang: Lang): GoalRun | null {
    return signRun(
      {
        goal: this.runGoal,
        gameMode: this.gameMode,
        twoPlayers: this.duel != null,
        gameState: this.gameState,
        points: this.points,
        lives: this.lives,
        resolved: this.resolved,
        stickCount: this.activeStickCount,
        record: this.recordToBeat,
        warmingUp: this.warmingUp,
        nowItCounts: this.nowItCounts,
      },
      softTranslator(lang),
    )
  }

  /**
   * What the sign above the scoreboard says, in that language, or `null` if there is nothing to
   * hang: in the menu, and outside the challenge with the game opened on its own.
   */
  sign(lang: Lang): GoalSignView | null {
    const run = this.forTheSign(lang)
    return run == null ? null : goalSign(run, softTranslator(lang))
  }

  /**
   * Which moment the run that counts for a medal is at, or `null` if what is played does not count:
   * with it the sign already says the points and the lives, and the scoreboard keeps them quiet (the
   * web's `signPhase`).
   */
  get signPhase(): GoalPhase | null {
    const run = this.forTheSign('en')
    return runCounts(run) ? run.phase : null
  }

  /** The medal that already belongs to whoever plays in this run: when it goes up, the threshold is celebrated. */
  get medal(): Medal | null {
    const run = this.forTheSign('en')
    return run == null ? null : medalToCelebrate(run)
  }

  /** The hoop height for whoever plays: the headset's plus the correction, with its limits. */
  get hoopHeight(): number {
    return hoopHeightFor({ eyeHeight: this.playerEyeHeight, adjustment: this.hoopAdjustment })
  }

  /** The sticks stay hanging outside the run and with the question in front (`paused`). */
  get paused(): boolean {
    return this.gameState !== 'playing' || this.prompt !== null
  }

  // What is chosen between runs.

  setStickCount(count: number): void {
    this.stickCount = clampStickCount(count)
  }

  setDifficulty(level: Difficulty): void {
    this.difficulty = level
  }

  setEndless(endless: boolean): void {
    this.endless = endless
  }

  /** Alone, or two passing the controller. It is read when each run starts. */
  setPlayers(count: PlayerCount): void {
    this.players = count
  }

  /** The mode belongs to the whole run: with the summary on screen, changing it would copy the points to another record. */
  setGameMode(mode: GameMode): void {
    if (!this.running) this.gameMode = mode
  }

  setLevel(level: number): void {
    if (!this.running) this.level = clampLevel(Math.min(level, getUnlockedLevel()))
  }

  /** Raises or lowers the hoop in steps; it is saved on touching it, and only if it changes. */
  adjustHoop(steps: number): void {
    const next = clampHoopAdjustment(this.hoopAdjustment + steps * HOOP_ADJUST_STEP)
    if (next === this.hoopAdjustment) return
    saveHoopAdjustment(next)
    this.hoopAdjustment = next
  }

  setPlayerEyeHeight(height: number | null): void {
    this.playerEyeHeight = height
  }

  setImmersive(withHeadset: boolean): void {
    this.immersive = withHeadset
  }

  setBareHanded(withBareHands: boolean): void {
    this.bareHanded = withBareHands
  }

  private clearRun(): void {
    this.score = 0
    this.resolved = 0
    this.points = 0
    this.streak = 0
    this.bestStreak = 0
    this.wave = 0
    this.waveStart = { score: 0, resolved: 0 }
    this.endedByPlayer = false
    this.advancedWave = -1
  }

  /**
   * Starts a run with what was chosen. It turns the lesson on when it is due —with the headset on
   * and without having seen it—, and `tutorial` forces the decision (the button to see it again).
   */
  startGame(options?: { tutorial?: boolean }): void {
    // The two-player run with the round that has just finished: before emptying the counters, which
    // is where it comes from.
    const current = this.duel
    this.prompt = null
    // It is read again: the lesson that is finished by catching gets marked without going through here.
    const seen = readTutorialSeen()
    this.tutorialSeen = seen
    this.clearRun()
    this.inChallenge = false
    // With two players, the second one plays the first one's seed: the same sticks in the same
    // order. With the run finished, or without any, another one starts with a new seed.
    this.duelSoFar = !playsAsDuel(this.gameMode, this.players) ? null : current == null || duelOver(current) ? createDuel(this.seeds() >>> 0) : current
    // The feats start from zero with each run, except the second turn of a two-player one.
    if (this.duelSoFar == null || this.duelSoFar !== current) this.feats = NO_FEATS
    this.seed = this.duelSoFar?.seed ?? this.seeds() >>> 0
    this.recordToBeat = this.endlessRun ? getBestEndlessStreak() : getBestPoints(this.gameMode)
    this.runGoal = goalWithPlayed(this.goal, this.reported)
    this.unlockedAtStart = getUnlockedLevel()
    this.levelAtStart = this.selectedLevel
    this.runId++
    this.teaching = options?.tutorial ?? (this.immersive && !seen)
    this.warmingUp = inWarmup({ teaching: this.teaching, gameMode: this.gameMode, twoPlayers: this.duelSoFar != null, inChallenge: false })
    this.countsNotice = false
    this.tutorialSkipped = 0
    this.stepTime = 0
    this.markedSeen = false
    this.countdownLeft = COUNTDOWN_SECONDS
    this.running = true
  }

  /** Removes the lesson and counts it as seen (skipping it or finishing it). It does not touch the run. */
  finishTutorial(): void {
    if (!this.teaching) return
    markTutorialSeen()
    this.tutorialSeen = true
    this.teaching = false
  }

  /** Counts the current step as passed: the next button. */
  nextTutorialStep(): void {
    const step = this.tutorialStep
    if (step == null) return
    this.tutorialSkipped = skipStep(this.tutorialSkipped, step)
  }

  /**
   * Stick caught: `fallProgress` (0 just released, 1 level with the floor) decides the reflex bonus.
   * `behind`, whether it was caught with the back turned to it (`isBehindBack` in `feats.ts`).
   */
  catchStick(fallProgress: number, behind = false): void {
    this.feats = countCatch(this.feats, { behind })
    this.score++
    this.resolved++
    this.streak++
    this.bestStreak = Math.max(this.bestStreak, this.streak)
    this.points += stickPoints({ difficulty: this.activeDifficulty, streak: this.streak, fallProgress })
    this.onChange()
  }

  /** Stick missed: it breaks the streak, counts towards closing the run and, in challenge, costs a life. */
  missStick(): void {
    this.resolved++
    this.streak = 0
    this.onChange()
  }

  /** Ends the endless run at will: it is its only exit with a summary. */
  endRun(): void {
    this.endedByPlayer = true
    this.onChange()
  }

  askToQuit(): void {
    this.prompt = 'quit'
  }

  keepPlaying(): void {
    this.prompt = null
  }

  /** Goes back to the menu without saving anything. Leaving the lesson halfway does not count as having seen it. */
  resetGame(): void {
    // Going back to the menu leaves the two-player run: the next one starts from scratch. What was
    // achieved in the run left halfway is not counted, like its points.
    this.duelSoFar = null
    this.feats = NO_FEATS
    this.prompt = null
    this.clearRun()
    this.countdownLeft = 0
    this.teaching = false
    this.warmingUp = false
    this.countsNotice = false
    this.tutorialSkipped = 0
    this.inChallenge = false
    this.running = false
  }

  /**
   * A frame of clock: the countdown (stopped with the question in front) and the deadline of the
   * step of the lesson, which only runs while really playing and starts again on stopping, like the
   * web's `setTimeout` that is remade with each change of its dependencies.
   */
  tick(delta: number): void {
    const d = Math.max(0, delta)
    // The deadline counts what was really played: the frame in which the countdown ends is not its own.
    const wasPlaying = this.gameState === 'playing' && this.prompt === null
    if (this.running && this.countdownLeft > 0 && this.prompt === null) {
      this.countdownLeft = Math.max(0, this.countdownLeft - d)
    }
    const step = this.tutorialStep
    const ticking = step != null && wasPlaying && this.gameState === 'playing' && this.prompt === null
    if (!ticking || step !== this.timedStep) {
      this.stepTime = 0
      this.timedStep = step
    }
    if (ticking) {
      this.stepTime += d
      if (this.stepTime >= STEP_DEADLINE[step]) this.tutorialSkipped = skipStep(this.tutorialSkipped, step)
    }
    // Once the steps are passed, the lesson is marked as seen, even if the panel has already gone by itself.
    if (this.teaching && this.tutorialStep === null && !this.markedSeen) {
      markTutorialSeen()
      this.markedSeen = true
    }
    // The lesson has closed over the warm-up: the challenge starts from scratch (`warmup.ts`).
    if (this.warmingUp && this.running && this.tutorialStep === null) {
      if (this.teaching) markTutorialSeen()
      this.startGame({ tutorial: false })
      this.countsNotice = true
    }
    this.onChange()
  }

  /**
   * What the effects do on the web when the counters change: reloading the machine in the endless
   * run on resolving the round, and on ending, saving and reporting it to the hall only once.
   */
  private onChange(): void {
    if (this.running && this.endlessRun && this.gameState === 'playing' && this.waveResolved >= this.activeStickCount) {
      if (this.advancedWave !== this.wave) {
        this.advancedWave = this.wave
        this.feats = countRound(this.feats, { sticks: this.activeStickCount, caught: this.waveScore, hoopAdjustment: this.hoopAdjustment })
        this.waveStart = { score: this.score, resolved: this.resolved }
        this.wave++
      }
    }
    // Saving only does something if it improves what there was, so once per run is enough: on the
    // web the effect is repeated with each render of the end screen without changing anything.
    if (this.gameState !== 'finished' || this.reportedRun === this.runId) return
    this.reportedRun = this.runId
    // The round of the run, if it has been resolved whole (the one that ends without lives is not).
    // The endless run counts each round on reloading, and the one left halfway on ending it is not
    // a round.
    if (!this.endlessRun && this.resolved === this.activeStickCount) {
      this.feats = countRound(this.feats, { sticks: this.activeStickCount, caught: this.score, hoopAdjustment: this.hoopAdjustment })
    }
    // With two players there is no record to save: a two-player round is nobody's best. When the
    // second one ends, who wins is recorded and the hall is told the whole run, with the best.
    const duel = this.duel
    if (duel != null) {
      if (!duelOver(duel)) return
      saveDuelResult(duelWinner(duel))
      this.report(withFeats({ mode: 'duel', points: duelBest(duel), challenge: false }, earnFeats(this.feats.earned)))
      return
    }
    const levelResult = this.levelResult
    if (levelResult != null) saveLevelResult(this.activeLevel, levelResult.stars)
    else if (this.endlessRun) saveBestEndlessStreak(this.bestStreak)
    else saveBestPoints(this.gameMode, this.points)
    this.report(withFeats({ mode: this.gameMode, points: this.points, challenge: this.inChallenge }, earnFeats(this.feats.earned)))
  }

  /** Tells the hall how a run has ended and notes it down for the goal of the next one. */
  private report(result: ResultWithFeats): void {
    this.reported.push(result)
    this.onFinish?.(result)
  }
}
