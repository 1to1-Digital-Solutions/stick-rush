'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  type Difficulty,
  MAX_STICKS,
  MIN_STICKS,
} from './gameConfig'
import {
  CHALLENGE_SETUP,
  DEFAULT_GAME_MODE,
  type GameMode,
  type RunOutcome,
  remainingLives,
  runOutcome,
} from './gameMode'
import {
  getBestEndlessStreak,
  getBestPoints,
  getServerBestEndlessStreak,
  getServerBestPoints,
  saveBestEndlessStreak,
  saveBestPoints,
  subscribeBestEndlessStreak,
  subscribeBestPoints,
} from './highScore'
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
} from './duel'
import { saveDuelResult, type DuelTally } from './duelTally'
import { useDuelTally } from './useDuelTally'
import { LEVEL_COUNT, clampLevel, levelPassed, levelSpec, levelStars, type Stars } from './levels'
import {
  getServerStarsList,
  getServerUnlockedLevel,
  getStarsList,
  getUnlockedLevel,
  saveLevelResult,
  subscribeStarsList,
  subscribeUnlockedLevel,
} from './progress'
import { volumeFactor } from './settings'
import { setScenery as setArcadeScenery, useLang, useScenery, useVolumes } from './settingsClient'
import { runCounts, signRun } from './machineSign'
import {
  goalSign,
  medalToCelebrate,
  type GoalPhase,
  type Medal,
  type Goal,
  type GoalSignView,
} from './goal'
import { softTranslator } from './textos'
import { exposeTestRun } from './testRun'
import {
  HOOP_ADJUST_STEP,
  clampHoopAdjustment,
  getHoopAdjustment,
  hoopHeightFor,
  saveHoopAdjustment,
} from './hoopHeight'
import {
  NO_FEATS,
  withFeats,
  countCatch,
  countRound,
  earnFeats,
  type FeatCount,
  type ResultWithFeats,
} from './feats'
import { forgetOwnScenery, sceneryModeOf, sceneryOf } from './sceneryPreference'
import { gameStorage } from './storage'
import { randomSeed, deriveSeed, type Challenge } from './seed'
import { stickPoints } from './scoring'
import {
  STEP_DEADLINE,
  type TutorialStepKey,
  milestonesFromCatches,
  markTutorialSeen,
  skipStep,
  tutorialSeen as readTutorialSeen,
  tutorialStep as currentTutorialStep,
} from './tutorial'
import { inWarmup } from './warmup'

export type GameState = 'menu' | 'countdown' | 'playing' | 'finished'

/**
 * What is seen around the machine in an immersive session.
 *
 * - `scene`: the game's scenery (the square at night). It is the "VR mode".
 * - `passthrough`: the player's real room. It is the "AR mode".
 *
 * They are not two kinds of WebXR session but two ways of painting the same one:
 * switching from `immersive-vr` to `immersive-ar` would mean closing the session and
 * opening another, with its flicker and its permission. By always entering `immersive-ar`
 * —when the headset supports it— drawing the set or not is enough to go from
 * one to the other instantly.
 */
export type SceneryMode = 'scene' | 'passthrough'

/** Seconds of countdown between pressing "Jugar" and the first stick. */
export const COUNTDOWN_SECONDS = 3

/**
 * The mode played with the hall's `challenge`: the one of the cabinet's record
 * (`stick-rush:best-points:challenge`), with what that mode fixes (`CHALLENGE_SETUP`).
 */
const CHALLENGE_MODE: GameMode = 'challenge'

/**
 * What the hall passes to the store through the scene (see `StickRushScene`).
 *
 * All optional: with nothing, the game starts in the menu and draws at random as on its own website.
 */
export interface HallOptions {
  /**
   * Play this challenge: it goes **straight** into a run of the challenge, with no lesson, with the
   * sticks that fall and their turn taken from the seed. Read on mount; another challenge is another mount.
   */
  challenge?: Challenge
  /**
   * Called once when each run with a score ends (not when it is left halfway), with the
   * feats first earned in it if there are any (`feats.ts`).
   */
  onFinish?: (result: ResultWithFeats) => void
  /**
   * The game's medal thresholds and the best of whoever is playing, for the sign above the
   * scoreboard (`goal.ts`). Without it —the game opened on its own— the sign says the mission and the
   * record saved in this browser.
   */
  goal?: Goal
}

export interface GameStore {
  /** Number of sticks chosen (5–13). */
  stickCount: number
  /** Selected difficulty. */
  difficulty: Difficulty
  /** Practice, levels or challenge (see `gameMode.ts`). */
  gameMode: GameMode
  /**
   * Endless practice: when the round of sticks is resolved the machine loads
   * another one, until the player finishes. The record is the best streak.
   */
  endless: boolean
  /**
   * How many play: alone, or two taking turns with the same controller. It only counts in the challenge
   * (`playsAsDuel`), which is the same run for everyone.
   */
  players: PlayerCount
  /**
   * The two-player match under way, with the round just finished already recorded, or `null` if playing
   * alone. With it, the end of a round is the notice to pass the controller or the one of who has won.
   */
  duel: Duel | null
  /** Who holds the controller in the two-player match, or `null` if playing alone. */
  player: Player | null
  /** The two-player matches each one of the pair in front has won so far. */
  duelTally: DuelTally
  /**
   * Whether the ending sounds like winning on top of the close: a beaten record, or the end of a
   * two-player match, which someone of those in front always wins —or they tie— and is celebrated.
   */
  celebrates: boolean
  /** Level chosen in Levels, or `null` = the highest unlocked. */
  level: number | null
  /** The level being played: the chosen one, or the highest unlocked. */
  activeLevel: number
  /** Up to which level can be played, remembered between visits. */
  unlockedLevel: number
  /** Stars of each level, from the first to the last. */
  levelStars: readonly Stars[]
  /** How the level played ended, only with the run finished in Levels. */
  levelResult: { stars: Stars; passed: boolean; unlocked: number | null } | null
  /** Speed it is played at: the chosen one, or the level's in Levels. */
  activeDifficulty: Difficulty
  /** Sticks hanging from the machine in this round: the chosen ones, or the level's. */
  activeStickCount: number
  /**
   * Seed of the stick layout of the current round: it comes from the run's seed and the round
   * number (`deriveSeed`), so in the endless run each reload brings new sticks and in
   * the challenge everyone who plays it sees the same sticks fall in the same order.
   */
  stickSeed: number
  /**
   * What is being played now is the `challenge` the hall passed. It stops being so as soon as
   * another run is started or the menu is returned to.
   */
  inChallenge: boolean
  /**
   * The lesson runs on top of the challenge: **what happens does not count yet** (`warmup.ts`). Missed
   * sticks take no lives and the run does not end; when the lesson closes the challenge starts from
   * scratch.
   */
  warmingUp: boolean
  /** The lesson has just closed and the challenge's first stick is not resolved yet: a notice is shown. */
  nowItCounts: boolean
  /** Current round of the endless run, starting at 0; always 0 otherwise. */
  wave: number
  /** Sticks caught and resolved in the current ROUND; in endless, not in the run. */
  waveScore: number
  waveResolved: number
  /**
   * Lives left in the run, or `null` in a mode that is not played with
   * them. In the menu they are the starting ones: it is what is at stake when starting.
   */
  lives: number | null
  /**
   * How the run has ended, or `null` while it is still alive. It is what
   * tells beating the challenge from running out of lives on the end screen.
   */
  outcome: RunOutcome | null
  /**
   * What the goal sign says (`goal.ts`), already translated, or `null` if there is nothing to
   * hang: in the menu, and outside the challenge with the game opened on its own.
   */
  sign: GoalSignView | null
  /**
   * What moment the run that counts for a medal is at —before the first stick is resolved,
   * playing or finished—, or `null` if what is being played does not count. With it the sign already
   * says the points and the lives, and the scoreboard below keeps quiet about them.
   */
  signPhase: GoalPhase | null
  /** The medal that is already whoever plays' in this run: when it goes up, the threshold is celebrated. */
  medal: Medal | null
  /** Sticks caught in the current run. */
  score: number
  /**
   * Sticks already resolved (caught + missed) in the current run. It is state
   * and not an internal counter because the XR 3D HUD paints it stick by stick.
   */
  resolved: number
  /** Points accumulated (see `scoring.ts`). */
  points: number
  /** Sticks caught in a row without missing any. */
  streak: number
  /** The best streak of the run, for the final summary. */
  bestStreak: number
  /**
   * Best score achieved **in the chosen mode**, saved between visits
   * (see `highScore.ts`). During a run it is the best to beat: it does not include
   * the points in progress until the run ends.
   */
  bestPoints: number
  /**
   * The run just finished has beaten the previous record. It goes off when
   * the next one starts or on returning to the menu.
   */
  isRecord: boolean
  /** Phase of the game. */
  gameState: GameState
  /**
   * Seconds left until the first stick is released. It only makes sense
   * in `countdown`; outside that phase it is 0.
   */
  countdown: number
  /**
   * Run identifier. It is incremented when a new one starts to
   * force the sticks to remount and restart their animations.
   */
  runId: number
  /** Scenery or passthrough in an immersive session. */
  scenery: SceneryMode
  /**
   * Game in silence, because the effects are at zero in the hall's
   * settings. It is no longer a preference of the game: it is chosen once in xrcade and
   * holds for all twelve (see `settings.ts`). Here it is left derived because half the
   * scene asks "am I muted?" and not "how loud are the effects?".
   */
  muted: boolean
  /** Volume of the effects, from 0 to 1, just as the Web Audio API wants it. */
  sfxVolume: number
  /** Background music on: the ambience of the settings, above zero. */
  music: boolean
  /** Volume of the ambience, from 0 to 1. */
  ambienceVolume: number
  /**
   * Height of the hoop, in metres, already fitted to whoever is playing: it comes from the height
   * of the headset plus the manual correction (see `hoopHeight.ts`).
   */
  hoopHeight: number
  /** Manual correction on that height, in metres. It is saved between visits. */
  hoopAdjustment: number
  /**
   * Eye height the headset has measured, or `null` when there is no session, there has
   * not been time to measure yet or its reference space does not let it be known. The
   * hoop uses it and so does the immersive UI, which hangs from the player's eyes
   * and not from the floor (see `xrUiRise` in `xrLayout.ts`).
   */
  playerEyeHeight: number | null
  /**
   * Whether the headset tutorial has already been seen in this browser. It is saved between
   * visits: it is what makes it be shown only once.
   */
  tutorialSeen: boolean
  /**
   * Whether this run started out teaching how to play. `startGame` decides it and
   * `finishTutorial` turns it off; the lesson runs **with the run under way**, so it is not
   * a state of the game but a companion of it (see `tutorial.ts`).
   *
   * Once the steps are passed it does not go off: what removes the panel is running out of
   * a step to teach, and it is `tutorialStep` that says so.
   */
  teaching: boolean
  /**
   * Which step of the tutorial is to be taught, or `null` if there is no lesson or nothing
   * is left. It is **deduced** from the sticks caught, so it advances on its own on
   * catching; the safety deadline of each step is also kept by the store, so
   * that the lesson does not depend on the Canvas painting in time.
   *
   * The two places that teach it read it: the headset's panel and its mirror in
   * the overlay, which have to be on the same step.
   */
  tutorialStep: TutorialStepKey | null
  /** Counts the current step as passed. The next button calls it. */
  nextTutorialStep: () => void
  /** Whether an immersive session is open, that is, whether it is played with the headset on. */
  immersive: boolean
  /**
   * Whether it is being played bare-handed, with no controllers (see
   * `playingBareHanded`). It changes **what has to be taught**, not what has to be
   * done: the sticks are caught the same way, but the gesture has another name.
   *
   * It lives here, and not only inside the Canvas, because the two places
   * that teach the lesson need it: the headset's panel and its mirror in the overlay, which
   * is DOM and cannot reach the session's state. It is kept up to date by
   * `XRSessionController`, which is the one already watching what is connected.
   */
  bareHanded: boolean

  setScenery: (scenery: SceneryMode) => void
  setStickCount: (count: number) => void
  setDifficulty: (difficulty: Difficulty) => void
  /**
   * Chooses the mode. **Only from the menu**: with a run under way, or with its
   * summary on screen, it does nothing (see why in the implementation).
   */
  setGameMode: (mode: GameMode) => void
  setEndless: (endless: boolean) => void
  /** Alone, or two passing the controller. Read at the start of each run. */
  setPlayers: (players: PlayerCount) => void
  /** Chooses a level among the unlocked ones; what is not unlocked is clamped. */
  setLevel: (level: number) => void
  /** Ends the endless run at will: it is its only way out with a summary. */
  endRun: () => void
  /**
   * Raises (positive steps) or lowers (negative) the hoop. Each step is
   * `HOOP_ADJUST_STEP` metres and the travel is bounded, so the hoop
   * cannot end up out of reach or inside the floor.
   */
  adjustHoop: (steps: number) => void
  /**
   * Eye height the headset measures, or `null` when there is no session or its
   * reference space does not let it be known.
   */
  setPlayerEyeHeight: (height: number | null) => void
  /** Records whether it is being played inside the headset. The session keeps it up to date. */
  setImmersive: (immersive: boolean) => void
  /** Records whether it is played bare-handed. The session keeps it up to date. */
  setBareHanded: (bareHanded: boolean) => void
  /**
   * What is being asked right now, or `null` if nothing is being asked.
   *
   * Leaving the run halfway **loses what has been done so far**, and the button gets pressed by
   * accident: with the headset on you cannot see what is at your sides and the arm passes where
   * it passes. So it does not quit at once: it stops and asks. While it asks no
   * stick falls, because otherwise deciding would cost points.
   */
  prompt: 'quit' | null
  /** Stops the run and asks whether quitting is really wanted. */
  askToQuit: () => void
  /** No: play goes on from where it was. */
  keepPlaying: () => void

  /**
   * Starts a run.
   *
   * On its own it turns on the lesson on how to play when it is due: with the
   * headset on and never having seen it. It belongs to the game and not to the button
   * pressed, because inside the session a run can also be started from the overlay
   * with the keyboard. `tutorial` forces the decision both ways: the
   * button to watch it again from the menu uses it.
   */
  startGame: (options?: { tutorial?: boolean }) => void
  /**
   * Removes the tutorial and counts it as seen. The skip button and the
   * lesson's own ending call it: both count, so from then on
   * it does not come up again. **It does not touch the run**, which carries on where it was.
   */
  finishTutorial: () => void
  /**
   * Stick caught. `fallProgress` (fraction of its fall time: 0 just
   * released, 1 level with the floor) decides the reflex bonus. `behind`, whether it was
   * caught with the back to it (`isBehindBack` in `feats.ts`): it only counts for its feat.
   */
  catchStick: (fallProgress: number, behind?: boolean) => void
  /**
   * Stick missed: it breaks the streak, counts towards closing the run and, in challenge,
   * costs a life.
   */
  missStick: () => void
  resetGame: () => void
}

export const GameContext = createContext<GameStore | null>(null)

/** Restricts the number of sticks to the allowed range. */
function clampStickCount(count: number): number {
  if (Number.isNaN(count)) return MIN_STICKS
  return Math.min(MAX_STICKS, Math.max(MIN_STICKS, Math.round(count)))
}

export function useGameStoreValue({ challenge, onFinish, goal }: HallOptions = {}): GameStore {
  const [stickCount, setStickCountState] = useState(MIN_STICKS)
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  // It opens on the challenge, with the hall or without it (`DEFAULT_GAME_MODE`): Jugar without touching
  // anything starts the run that gives a medal, and practice is one tap away, in the same place. With
  // the hall's challenge the mode is that same one: the one of the cabinet's record.
  const [gameMode, setGameModeState] = useState<GameMode>(DEFAULT_GAME_MODE)
  // The challenge is looked at only once, on mount: it is what decides what it starts with.
  const [inChallenge, setInChallenge] = useState(() => challenge != null)
  // Where the layout of the run under way comes from. The challenge's if the challenge is played; if not,
  // a new one in each run (`startGame`), which is still different every time. In the menu it does
  // not matter which: the sticks hang still.
  const [seed, setSeed] = useState(() => challenge?.seed ?? 0)
  const [endless, setEndless] = useState(false)
  const [players, setPlayers] = useState<PlayerCount>(1)
  /**
   * The two-player match with the rounds **already closed** recorded. The one just played is not
   * recorded on finishing —that would be writing state from an effect—: it is deduced from the
   * finished run (`currentDuel`) and recorded when the next one starts.
   */
  const [duel, setDuel] = useState<Duel | null>(null)
  const duelTally = useDuelTally()
  // `null` is "the highest unlocked": that way the menu shows the level that is due
  // without reading storage on the first render, which is not on the server.
  const [level, setLevelState] = useState<number | null>(null)
  // The endless run is ended by the player: it is the only thing that closes it.
  const [endedByPlayer, setEndedByPlayer] = useState(false)
  // Round of the endless run, and with what scoreboard it started: the scoreboard of the
  // run keeps going up while the machine reloads.
  const [wave, setWave] = useState(0)
  const [waveStart, setWaveStart] = useState({ score: 0, resolved: 0 })
  const [score, setScore] = useState(0)
  const [resolved, setResolved] = useState(0)
  const [points, setPoints] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  // The record is not React state: it lives in the browser and the game
  // subscribes to it. That way there is no need to sync it with effects and no copy is left
  // that could disagree with what is saved. Each mode has its own, so the
  // read changes with the chosen mode.
  const readRecord = useCallback(() => getBestPoints(gameMode), [gameMode])
  const bestPoints = useSyncExternalStore(
    subscribeBestPoints,
    readRecord,
    getServerBestPoints,
  )
  // The best to beat is frozen at the start: as soon as the run ends and is
  // saved, `bestPoints` already includes what was just done and would be no use for knowing
  // whether anything has been beaten.
  const [recordToBeat, setRecordToBeat] = useState(() =>
    challenge != null ? getBestPoints(CHALLENGE_MODE) : 0,
  )
  /**
   * The hall's record, taken at the start like the local one: on finishing, the hall records the new
   * best and passes `goal` again with it (`onFinish`), and the sign would compare the run
   * with itself («Has igualado tu récord»).
   */
  const hallRecord = goal?.record ?? null
  const liveHallRecord = useRef(hallRecord)
  useEffect(() => {
    liveHallRecord.current = hallRecord
  }, [hallRecord])
  const [hallRecordAtStart, setHallRecordAtStart] = useState(hallRecord)
  // The Levels progress and the endless streak are not React state either: they live
  // in the browser and are read subscribed, like the record.
  const unlockedLevel = useSyncExternalStore(
    subscribeUnlockedLevel,
    getUnlockedLevel,
    getServerUnlockedLevel,
  )
  const starsList = useSyncExternalStore(subscribeStarsList, getStarsList, getServerStarsList)
  const levelStarsAll = useMemo(
    () => starsList.split(',').map((s) => Number(s) as Stars),
    [starsList],
  )
  const bestEndlessStreak = useSyncExternalStore(
    subscribeBestEndlessStreak,
    getBestEndlessStreak,
    getServerBestEndlessStreak,
  )
  // How far could be played at the start, and with what level it started. The level
  // is frozen at the start: on passing it the next one is unlocked on the spot, and
  // if the active one followed the unlocked one the finished run would turn into
  // the next one halfway, with more sticks to resolve and the summary vanished.
  const [unlockedAtStart, setUnlockedAtStart] = useState(1)
  const [levelAtStart, setLevelAtStart] = useState(1)
  // The only thing stored is whether a run is under way. The three phases of a
  // run —counting, playing and finished— are derived from the countdown and from
  // the sticks resolved, so there are no sources of truth to sync nor
  // effects that change phase causing cascading renders.
  //
  // With a challenge it starts out playing: the hall has already chosen game and mode for whoever plays.
  const [running, setRunning] = useState(() => challenge != null)
  // Whether this run started warming up (`warmup.ts`). It goes off only on starting the challenge
  // again from scratch: meanwhile the run does not end, even if the lesson has already been removed.
  const [warmingUp, setWarmingUp] = useState(false)
  const [countsNotice, setCountsNotice] = useState(false)
  // The scenery is not React state either, and besides it is not the game's: it is the
  // hall's scenery (`xrcade:scenery`), translated to `scene`/`passthrough` at
  // the edge (`sceneryPreference.ts`). It is changed from the hall's panel and from
  // the menu here, and both have to see the same thing at once. Saying
  // passthrough is not enough to serve it: in a session with no real room behind,
  // whoever paints the scene ignores it and keeps the scenery.
  const scenery = sceneryModeOf(useScenery())
  const setScenery = useCallback(
    (value: SceneryMode) => setArcadeScenery(sceneryOf(value)),
    [],
  )
  // The game's own key is deleted on mounting the run's state, without
  // carrying it over: the choice that rules is the hall's.
  useEffect(() => {
    forgetOwnScenery(gameStorage())
  }, [])
  // Sound is not this game's state: it comes from the hall's settings, which
  // are chosen once in xrcade and hold for all twelve. Here it is only translated into
  // what the scene asks: whether it is muted and at what volume (see `settings.ts`).
  const volumes = useVolumes()
  const muted = volumes.sfx === 0
  const sfxVolume = volumeFactor(volumes.sfx)
  const music = volumes.ambience > 0
  const ambienceVolume = volumeFactor(volumes.ambience)
  const [countdown, setCountdown] = useState(() => (challenge != null ? COUNTDOWN_SECONDS : 0))
  const [prompt, setPrompt] = useState<'quit' | null>(null)
  const [runId, setRunId] = useState(0)
  // The feats of the current run (`feats.ts`). They are not painted: they are counted on catching and
  // when each round is resolved, and the hall is told at the end. With two players, those of both rounds.
  const feats = useRef<FeatCount>(NO_FEATS)
  // The correction of the hoop's height comes from what was saved on earlier
  // visits. On the server there is no storage and it is 0, but that does not
  // throw hydration off: the hoop is only painted inside the Canvas, which is
  // loaded on the client.
  const [hoopAdjustment, setHoopAdjustmentState] = useState(getHoopAdjustment)
  // What the headset measures, while the session lasts. Outside it there is nobody to
  // measure and the hoop stays at the reference height.
  const [playerEyeHeight, setPlayerEyeHeight] = useState<number | null>(null)
  // The tutorial is seen once and remembered, like the hoop's height. It is read on
  // mount and not on every query because it decides what is painted: reading
  // storage in the middle of a render would make it unpredictable.
  const [tutorialSeen, setTutorialSeen] = useState(() => readTutorialSeen())
  // Whether this run is teaching how to play. **It stops nothing**: the lesson is done
  // by catching sticks, so it runs alongside the run and is removed when
  // its steps have been passed or when it is skipped (see `tutorial.ts`).
  const [teaching, setTeaching] = useState(false)
  // The steps counted as passed without doing them: by button or by deadline.
  const [tutorialSkipped, setTutorialSkipped] = useState(0)
  // Whether the headset is on. The game needs it to know whom to teach how
  // to play: on desktop the start screen already explains it with text.
  const [immersive, setImmersive] = useState(false)
  // What is being played with: controllers or bare hands. It only changes the lesson.
  const [bareHanded, setBareHanded] = useState(false)

  const levels = gameMode === 'levels'
  const endlessRun = gameMode === 'practice' && endless
  const selectedLevel = clampLevel(Math.min(level ?? unlockedLevel, unlockedLevel))
  const activeLevel = running ? levelAtStart : selectedLevel
  const currentLevel = levelSpec(activeLevel)
  // What was chosen only counts in practice: in Levels the level says it, and the challenge is fixed
  // (`CHALLENGE_SETUP`) so that its record —the cabinet's— is always the same run.
  const setup = levels ? currentLevel : gameMode === 'challenge' ? CHALLENGE_SETUP : { difficulty, stickCount }
  const activeDifficulty = setup.difficulty
  const activeStickCount = setup.stickCount
  // Each round, its seed: in endless, each reload deals new sticks; in the rest of the modes
  // there is only round 0.
  const stickSeed = deriveSeed(seed, wave)
  const waveScore = score - waveStart.score
  const waveResolved = resolved - waveStart.resolved

  // The sticks that have got away. It is derived instead of counted separately: a
  // third counter that has to be kept in step with the other two is a
  // mismatch waiting to happen.
  const misses = resolved - score
  // When a run ends is decided by the mode (see `gameMode.ts`): in
  // practice, the last stick; in challenge, also running out of lives. Endless
  // does not end on its own: the player closes it.
  const outcome = running && !warmingUp
    ? endlessRun
      ? endedByPlayer
        ? 'cleared'
        : null
      : runOutcome({ mode: gameMode, resolved, misses, stickCount: activeStickCount })
    : null
  // Warming up, missed sticks cost no lives.
  const lives = remainingLives(gameMode, warmingUp ? 0 : misses)
  const nowItCounts = countsNotice && resolved === 0
  const gameState: GameState = !running
    ? 'menu'
    : countdown > 0
      ? 'countdown'
      : outcome
        ? 'finished'
        : 'playing'

  // Which step the lesson is on. It comes from what whoever plays has already done —the
  // sticks caught so far— and from what has been counted as passed: a count
  // of the tutorial's own would end up disagreeing with the run, and here what rules
  // is the run.
  const tutorialStep = teaching
    ? currentTutorialStep(milestonesFromCatches(score), tutorialSkipped)
    : null

  // One tick per second until the first stick is released. The countdown gives time to
  // get into place —in the headset you have just pressed a button and your hands are where
  // they should not be— and warns that the run is really going to start.
  useEffect(() => {
    if (!running || countdown <= 0 || prompt !== null) return
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [running, countdown, prompt])

  // Skipping it and finishing it are the same way out: in both cases whoever plays has already
  // decided, and the lesson does not come up again. The run is not touched, because
  // it never got to stop.
  const finishTutorial = useCallback(() => {
    if (!teaching) return
    markTutorialSeen()
    setTutorialSeen(true)
    setTeaching(false)
  }, [teaching])

  // Once all the steps are passed, the lesson is noted as seen. It is an
  // effect because no gesture triggers it —having caught the sticks it asked for
  // triggers it—, and **it only writes outside React**: the panel already removes
  // itself, because what mounts it is the step and the step has stayed at `null`.
  // Turning `teaching` off from here as well would be asking for one render more for something
  // that is not seen.
  useEffect(() => {
    if (!teaching || tutorialStep !== null) return
    markTutorialSeen()
  }, [teaching, tutorialStep])

  // The step's safety deadline: if the milestone does not come —because the sticks get
  // away, or because whoever plays stays reading—, it passes on its own. It only runs
  // while it is really being played: during the countdown there are no sticks to catch,
  // and with the quit question on screen the run is stopped.
  useEffect(() => {
    if (tutorialStep === null || gameState !== 'playing' || prompt !== null) return
    const deadline = setTimeout(
      () => setTutorialSkipped((skipped) => skipStep(skipped, tutorialStep)),
      STEP_DEADLINE[tutorialStep] * 1000,
    )
    return () => clearTimeout(deadline)
  }, [tutorialStep, gameState, prompt])

  const nextTutorialStep = useCallback(() => {
    if (tutorialStep === null) return
    setTutorialSkipped((skipped) => skipStep(skipped, tutorialStep))
  }, [tutorialStep])

  // Endless: round resolved, the machine reloads. Which round was passed is noted
  // so that two executions of the effect —Strict Mode causes them— do not
  // skip two.
  const advancedWave = useRef(-1)
  useEffect(() => {
    if (!running || !endlessRun || gameState !== 'playing') return
    if (waveResolved < activeStickCount) return
    // Two executions of the effect for the same round —Strict Mode causes them in
    // development— would add what was done twice.
    /* v8 ignore next */
    if (advancedWave.current === wave) return
    advancedWave.current = wave
    feats.current = countRound(feats.current, {
      sticks: activeStickCount,
      caught: waveScore,
      hoopAdjustment,
    })
    setWaveStart({ score, resolved })
    setWave((value) => value + 1)
  }, [running, endlessRun, gameState, waveResolved, waveScore, activeStickCount, wave, score, resolved, hoopAdjustment])

  // How the level ended, only with the run finished in Levels.
  const levelResult = useMemo(() => {
    if (!levels || gameState !== 'finished') return null
    const stars = levelStars(score, activeStickCount)
    const passed = levelPassed(stars)
    const unlocksNext = passed && activeLevel + 1 > unlockedAtStart && activeLevel < LEVEL_COUNT
    return { stars, passed, unlocked: unlocksNext ? activeLevel + 1 : null }
  }, [levels, gameState, score, activeStickCount, activeLevel, unlockedAtStart])

  // Each mode saves its own on finishing: points, streak or stars. Saving
  // only does something if it improves what there was, so repeating it changes nothing. It is
  // saved at the end and not stick by stick so that during the run the record remains
  // the best to beat.
  //
  // And right here the hall is told, once per run and even if it is not a record. This effect
  // is redone with every render of the final screen (and twice in development): the run that was
  // already reported is noted so as not to report it twice. The callback is read from the last render
  // and does not go into the dependencies: a host that passes a new function on every render has no
  // reason to redo anything.
  const reportedRun = useRef(-1)
  const report = useRef(onFinish)
  useEffect(() => {
    report.current = onFinish
  }, [onFinish])
  // The two-player match with the round that has just ended already recorded: the notice to pass the
  // controller and the one of who has won come from here.
  const currentDuel = duel !== null && gameState === 'finished' ? recordTurn(duel, points) : duel
  useEffect(() => {
    if (gameState !== 'finished') return
    // The run's round, if it has been resolved whole: the one that ends with no lives is not. The endless
    // run counts each round on reloading, and the one left halfway on ending it is not a round.
    // Counting it again on the next render changes nothing.
    if (!endlessRun && resolved === activeStickCount) {
      feats.current = countRound(feats.current, {
        sticks: activeStickCount,
        caught: score,
        hoopAdjustment,
      })
    }
    // With two players there is no record to save: a two-player round is nobody's best. What counts is
    // who wins, and it is recorded at the end of the second, once per match; to the hall, the whole
    // match and not each round, with the best that was done.
    if (currentDuel !== null) {
      if (!duelOver(currentDuel) || reportedRun.current === runId) return
      reportedRun.current = runId
      saveDuelResult(duelWinner(currentDuel))
      report.current?.(
        withFeats(
          { mode: 'duel', points: duelBest(currentDuel), challenge: false },
          earnFeats(feats.current.earned),
        ),
      )
      return
    }
    if (levelResult) saveLevelResult(activeLevel, levelResult.stars)
    else if (endlessRun) saveBestEndlessStreak(bestStreak)
    else saveBestPoints(gameMode, points)
    if (reportedRun.current === runId) return
    reportedRun.current = runId
    report.current?.(
      withFeats({ mode: gameMode, points: points, challenge: inChallenge }, earnFeats(feats.current.earned)),
    )
  }, [
    gameState,
    gameMode,
    points,
    bestStreak,
    endlessRun,
    levelResult,
    activeLevel,
    runId,
    inChallenge,
    currentDuel,
    resolved,
    activeStickCount,
    score,
    hoopAdjustment,
  ])

  // The best of this mode: points, or the streak in the endless run. In Levels
  // there is no best to beat: there are stars.
  const bestForMode = endlessRun ? bestEndlessStreak : levels ? 0 : bestPoints
  const scoreForRecord = endlessRun ? bestStreak : points
  // The run has beaten the record it started with *and* what is saved is
  // exactly this score. Without that second condition, with
  // storage blocked the best to beat would stay at zero forever and
  // every run with points would be announced as a record. And equality is required and
  // not "at least": with two tabs open, the other one may have saved something
  // better while this was being played, and then this run beats the best it
  // froze at the start but not the one saved. Derived and not stored:
  // it lasts as long as the end-of-run screen lasts.
  const isRecord =
    gameState === 'finished' &&
    !levels &&
    currentDuel === null &&
    scoreForRecord > recordToBeat &&
    bestForMode === scoreForRecord
  const hoopHeight = hoopHeightFor({
    eyeHeight: playerEyeHeight,
    adjustment: hoopAdjustment,
  })

  // The goal sign: what has to be beaten and how much is left. It is built already translated, as
  // `goal.ts` asks: its sentences are templates and splitting them outside does not work for two languages.
  const lang = useLang()
  const twoPlayers = currentDuel !== null
  const runForTheSign = useMemo(
    () =>
      signRun(
        {
          goal: goal == null ? goal : { ...goal, record: hallRecordAtStart },
          gameMode,
          twoPlayers,
          gameState,
          points,
          lives,
          resolved,
          stickCount: activeStickCount,
          record: recordToBeat,
          warmingUp,
          nowItCounts,
        },
        softTranslator(lang),
      ),
    [goal, hallRecordAtStart, gameMode, twoPlayers, gameState, points, lives, resolved, activeStickCount, recordToBeat, warmingUp, nowItCounts, lang],
  )
  const sign = useMemo(
    () => (runForTheSign == null ? null : goalSign(runForTheSign, softTranslator(lang))),
    [runForTheSign, lang],
  )
  const signPhase = runCounts(runForTheSign) ? runForTheSign.phase : null
  const medal = runForTheSign == null ? null : medalToCelebrate(runForTheSign)

  const setStickCount = useCallback((count: number) => {
    setStickCountState(clampStickCount(count))
  }, [])

  // It is saved on touching it and not on leaving: in the headset there is no "leave", you
  // take the headset off. And only when the value really changes, so as not to write
  // on every press once the limit is reached.
  const adjustHoop = useCallback(
    (steps: number) => {
      const next = clampHoopAdjustment(hoopAdjustment + steps * HOOP_ADJUST_STEP)
      if (next === hoopAdjustment) return
      saveHoopAdjustment(next)
      setHoopAdjustmentState(next)
    },
    [hoopAdjustment],
  )

  /**
   * The mode belongs to the whole run, so it is only changed between runs.
   *
   * It is not a theoretical precaution: the points scored and the mode in which they were
   * scored are a pair, and the record is saved reading both. With the
   * summary on screen —where the score is still alive— changing mode
   * would copy that score to the record of the other one, which has not been played. Today no
   * menu is seen in that phase, but the rule belongs to the game and not to where the
   * button is.
   */
  const setGameMode = useCallback(
    (mode: GameMode) => {
      if (running) return
      setGameModeState(mode)
    },
    [running],
  )

  const setLevel = useCallback(
    (next: number) => {
      if (running) return
      setLevelState(clampLevel(Math.min(next, getUnlockedLevel())))
    },
    [running],
  )

  const endRun = useCallback(() => setEndedByPlayer(true), [])

  const clearRun = useCallback(() => {
    setScore(0)
    setResolved(0)
    setPoints(0)
    setStreak(0)
    setBestStreak(0)
    setWave(0)
    setWaveStart({ score: 0, resolved: 0 })
    setEndedByPlayer(false)
    advancedWave.current = -1
  }, [])
  const startGame = useCallback(
    (options?: { tutorial?: boolean }) => {
      setPrompt(null)
      // With the headset on and never having seen it, the run goes along
      // teaching. The countdown does not change: the lesson is learnt by catching
      // sticks, so it starts when they start to fall and not before.
      //
      // It is **re-read** from storage instead of looking at what was read on
      // mount: the lesson that is finished by catching is noted without going through
      // React, so the state would have been left behind and the second run
      // of the same visit would teach again what was already learnt.
      const seen = readTutorialSeen()
      setTutorialSeen(seen)
      clearRun()
      // What comes is another run: it is no longer the hall's challenge even if it is played in the same
      // mode, and it gets a fresh seed. With two players, the second plays **the first one's seed**: the
      // same sticks in the same order. With the match finished, or with none, another one starts.
      setInChallenge(false)
      const match = !playsAsDuel(gameMode, players)
        ? null
        : currentDuel === null || duelOver(currentDuel)
          ? createDuel(randomSeed())
          : currentDuel
      setDuel(match)
      // The feats start from scratch with each run, except the second turn of a two-player one: the
      // match belongs to both turns and the hall is told about it whole when the second ends.
      if (match === null || match !== currentDuel) feats.current = NO_FEATS
      setSeed(match?.seed ?? randomSeed())
      setRecordToBeat(
        gameMode === 'practice' && endless ? getBestEndlessStreak() : getBestPoints(gameMode),
      )
      setHallRecordAtStart(liveHallRecord.current)
      setUnlockedAtStart(getUnlockedLevel())
      setLevelAtStart(selectedLevel)
      setRunId((id) => id + 1)
      const willTeach = options?.tutorial ?? (immersive && !seen)
      setTeaching(willTeach)
      setWarmingUp(inWarmup({ teaching: willTeach, gameMode, twoPlayers: match !== null, inChallenge: false }))
      setCountsNotice(false)
      setTutorialSkipped(0)
      setCountdown(COUNTDOWN_SECONDS)
      setRunning(true)
    },
    [clearRun, gameMode, players, currentDuel, endless, selectedLevel, immersive],
  )

  // **The lesson closes and the challenge starts from scratch** (`warmup.ts`): by its steps, by
  // «Siguiente», by «Saltar» or by its deadline, which in all four cases leaves the step at `null`. The
  // lesson is already noted as seen (`finishTutorial` or the effect above), so the
  // new run does not teach; and it warns that now it counts until its first stick is resolved.
  //
  // Once per run: two executions of the effect —Strict Mode causes them— would start two.
  const restartedRun = useRef(-1)
  useEffect(() => {
    if (!warmingUp || !running || tutorialStep !== null) return
    /* v8 ignore next */
    if (restartedRun.current === runId) return
    restartedRun.current = runId
    startGame({ tutorial: false })
    setCountsNotice(true)
  }, [warmingUp, running, tutorialStep, startGame, runId])

  const catchStick = useCallback(
    (fallProgress: number, behind = false) => {
      feats.current = countCatch(feats.current, { behind })
      setScore((value) => value + 1)
      setResolved((value) => value + 1)
      // The streak is computed here and not outside because the points depend on it:
      // with two sticks being resolved in the same batch, reading `streak` from the previous
      // render would give the same bonus to both.
      setStreak((previous) => {
        const next = previous + 1
        setBestStreak((best) => Math.max(best, next))
        setPoints((total) =>
          total + stickPoints({ difficulty: activeDifficulty, streak: next, fallProgress }),
        )
        return next
      })
    },
    [activeDifficulty],
  )

  const missStick = useCallback(() => {
    setResolved((value) => value + 1)
    setStreak(0)
  }, [])

  // The hook of the shared e2e (`testRun.ts`): it only does something if the test has asked for it.
  // It reads the current state from a ref, not that of the render in which it was set.
  const inProgress = useRef({ sign, resolved, score })
  useEffect(() => {
    inProgress.current = { sign, resolved, score }
  }, [sign, resolved, score])
  useEffect(() => {
    exposeTestRun({
      start: () => {
        startGame({ tutorial: false })
        setCountdown(0)
      },
      score: (newPoints) => {
        setPoints(newPoints)
        // As if a stick had already been caught: until the first one, the sign says the mission.
        if (inProgress.current.resolved === 0) {
          setResolved(1)
          setScore(1)
        }
      },
      end: () => {
        // The remaining sticks, caught: the challenge is beaten and the hall is told.
        const { resolved: done, score: caught } = inProgress.current
        setScore(caught + activeStickCount - done)
        setResolved(activeStickCount)
      },
      sign: () => inProgress.current.sign,
    })
  }, [startGame, activeStickCount])

  const askToQuit = useCallback(() => setPrompt('quit'), [])
  const keepPlaying = useCallback(() => setPrompt(null), [])

  const resetGame = useCallback(() => {
    setPrompt(null)
    clearRun()
    setCountdown(0)
    // Leaving the lesson halfway does not count as having seen it: whoever returns to the
    // menu with the panel up finds it again on starting.
    setTeaching(false)
    setWarmingUp(false)
    setCountsNotice(false)
    setTutorialSkipped(0)
    setInChallenge(false)
    // Returning to the menu drops the two-player match: the next one starts from scratch. What was
    // achieved in the run left halfway is not counted, like its points.
    setDuel(null)
    feats.current = NO_FEATS
    setRunning(false)
  }, [clearRun])

  return useMemo(
    () => ({
      prompt,
      askToQuit,
      keepPlaying,
      stickCount,
      difficulty,
      gameMode,
      endless,
      players,
      duel: currentDuel,
      player: currentDuel === null ? null : controllerHolder(currentDuel),
      duelTally,
      celebrates: isRecord || (currentDuel !== null && duelOver(currentDuel)),
      level,
      activeLevel,
      unlockedLevel,
      levelStars: levelStarsAll,
      levelResult,
      activeDifficulty,
      activeStickCount,
      stickSeed,
      inChallenge,
      warmingUp,
      nowItCounts,
      wave,
      waveScore,
      waveResolved,
      lives,
      outcome,
      sign,
      signPhase,
      medal,
      score,
      resolved,
      points,
      streak,
      bestStreak,
      bestPoints: bestForMode,
      isRecord,
      gameState,
      countdown,
      runId,
      scenery,
      muted,
      sfxVolume,
      music,
      ambienceVolume,
      hoopHeight,
      hoopAdjustment,
      playerEyeHeight,
      tutorialSeen,
      teaching,
      tutorialStep,
      immersive,
      bareHanded,
      setScenery,
      setStickCount,
      setDifficulty,
      setGameMode,
      setEndless,
      setPlayers,
      setLevel,
      endRun,
      adjustHoop,
      setPlayerEyeHeight,
      setImmersive,
      setBareHanded,
      startGame,
      finishTutorial,
      nextTutorialStep,
      catchStick,
      missStick,
      resetGame,
    }),
    [
      prompt,
      askToQuit,
      keepPlaying,
      stickCount,
      difficulty,
      gameMode,
      endless,
      players,
      currentDuel,
      duelTally,
      level,
      activeLevel,
      unlockedLevel,
      levelStarsAll,
      levelResult,
      activeDifficulty,
      activeStickCount,
      stickSeed,
      inChallenge,
      warmingUp,
      nowItCounts,
      wave,
      waveScore,
      waveResolved,
      lives,
      outcome,
      sign,
      signPhase,
      medal,
      score,
      resolved,
      points,
      streak,
      bestStreak,
      bestForMode,
      isRecord,
      gameState,
      countdown,
      runId,
      scenery,
      muted,
      sfxVolume,
      music,
      ambienceVolume,
      hoopHeight,
      hoopAdjustment,
      playerEyeHeight,
      tutorialSeen,
      teaching,
      tutorialStep,
      immersive,
      bareHanded,
      setScenery,
      setStickCount,
      setGameMode,
      setLevel,
      endRun,
      adjustHoop,
      startGame,
      finishTutorial,
      nextTutorialStep,
      catchStick,
      missStick,
      resetGame,
    ],
  )
}

export function useGame(): GameStore {
  const store = useContext(GameContext)
  if (!store) {
    throw new Error('useGame must be used inside a <GameProvider>')
  }
  return store
}
