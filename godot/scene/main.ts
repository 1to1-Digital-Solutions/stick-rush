/**
 * Stick Rush in Godot: the scene, the input, the sound and what is felt.
 *
 * Everything that decides something —where each stick hangs and when it is released, how it falls,
 * when it can be caught, how many points it gives, when the run ends, what sounds and what
 * vibrates— comes from `stick-rush/src/lib`, the same code the web uses and with its same tests.
 * The run (`game/run.ts`) is the web's `gameStore` without React, and the round (`game/round.ts`)
 * what each `Stick.tsx` does on the web frame by frame. Here everything is stitched and painted.
 *
 * Three ways of catching sticks, and all three go through the same `catchStick`:
 * - with a headset, **with the hand**: on squeezing the side trigger of either controller, the
 *   stick that lies inside the grab sphere of the fist (the web's one, `CONTROLLER_GRAB_RADIUS`),
 *   hanging or falling. The ray does not catch sticks: it is for the menu. The kit's XR grammar
 *   plants the machine where the hall lends it, lowers it to the eyes of whoever plays seated and
 *   turns it with the stick;
 * - flat, **with the mouse**: a click on the stick, as on the web;
 * - with `-- --autoplay`, an automatic player that clicks on each stick halfway through its fall
 *   (and lets one get away on purpose), to check without a headset that the scene and the logic
 *   are well stitched and to measure the cost. It always plays the same run: the layout comes from
 *   a fixed seed.
 *
 * The test scene `tests/xr_controller.tscn` plays with a headset without a headset: the kit's fake
 * controllers and an automatic player that takes the fist to each stick and squeezes the grip.
 *
 * It sounds with the same effects as the web, rendered from its `sound.ts` by the kit, with the
 * same rule of what sounds and when (`useGameSound.ts`), and with its music; it vibrates with the
 * web's one (`catchPulses` in `haptics.ts`, with the recipes of `hapticFeedback.ts`) in the hand
 * that catches.
 */
import {
  Basis,
  Callable,
  Camera3D,
  DisplayServer,
  InputEvent,
  InputEventKey,
  InputEventMouseButton,
  Key,
  MouseButton,
  Node3D,
  Time,
  Transform3D,
  Vector2,
  Vector3,
  XRServer,
  print,
} from 'godot'

import { gameNameFrom, goalFrom } from '@kit/lib/gameBase'
import { setGameName } from '@/lib/menuTemplate'
import { ACTION, isGrabbing, type HandSide } from '@kit/lib/xr/hands'
import { isolateSave, arg, hasFlag } from '@kit/runtime/args'
import { SceneryRig, headsetView } from '@kit/runtime/scene/scenery'
import { Music, Sfx } from '@kit/runtime/sfx'
import { RealController } from '@kit/runtime/ui/controller'
import { XRPlayer } from '@kit/runtime/xr/player'
import { simulateControllers, viewWithSimulatedHead, type Simulation } from '@kit/runtime/xr/simulated'

import { DIFFICULTY_SPEEDS, PLAYER_OFFSET_Z, STICK_MISS_Y, type Difficulty } from '@/lib/gameConfig'
import type { GameMode } from '@/lib/gameMode'
import { thresholdPulses } from '@/lib/machineSign'
import { catchPulses } from '@/lib/haptics'
import { headsetEyeHeight, hoopFallSpeed } from '@/lib/hoopHeight'
import * as hostAnchor from '@/lib/hostAnchor'
import { MUSIC_VOLUME } from '@/lib/music'
import { MUSIC_FADE_MS, fadeVolume } from '@/lib/musicFade'
import { isBehindBack, type ResultWithFeats } from '@/lib/feats'
import { randomSeed } from '@/lib/seed'
import { duelOver } from '@/lib/duel'
import { getDuelTally } from '@/lib/duelTally'
import { fallOrder } from '@/lib/stickLayout'
import { gameStorage } from '@/lib/storage'
import { followRatio } from '@/lib/xrAnchor'
import * as xrLayout from '@/lib/xrLayout'

import { volumeLevels } from '@kit/runtime/settings'
import { GameUi } from './ui/ui'
import { stickOnRay, stickInHand } from './game/reach'
import { Run, type RunPhase } from './game/run'
import { SOUNDS, soundsBetween, type Cues } from './game/sound'
import { Round, roundKey, stickBody, type Stick } from './game/round'
import { GameHints } from './world/hints'
import { Fairground } from './world/fairground'
import { Machine } from './world/machine'
import { PaintedSticks } from './world/sticks'

const SFX_DIR = 'res://games/stick-rush/sfx'
const MUSIC_PATH = 'res://games/stick-rush/music/feria.mp3'
/** The models of the controllers, copied from `public/webxr-profiles/` (`npm run godot:controllers`). */
const CONTROLLERS_DIR = 'res://games/stick-rush/mandos'
const HANDS: readonly HandSide[] = ['left', 'right']
/** Every how many frames the headset is asked again whether it gives augmented reality (half a second). */
const HEADSET_REREAD_FRAMES = 36

/**
 * The web's flat camera (`GameCanvas.tsx`): raised and behind the player, because at the height of
 * the hoop a horizontal semicircle would be seen edge-on, looking at the centre of the machine.
 */
const FLAT_CAMERA = { position: new Vector3(0, 1.9, 3.05), target: new Vector3(0, 1.12, -0.25), fov: 52, near: 0.05, far: 60 } as const
/** A flat camera from one side, to see the hints: the footprints, the ghost stick and the controller. */
const HINTS_CAMERA = { position: new Vector3(0.45, 2.3, 1.45), target: new Vector3(0, 0.85, -0.35) } as const

/**
 * The seed of the automatic player: **always the same run**, which is what makes two measurements
 * comparable and the tests that use it deterministic.
 */
export const BOT_SEED = 7

/** The run of the automatic player: practice, hard and nine sticks. */
const BOT_RUN: { mode: GameMode; difficulty: Difficulty; sticks: number } = { mode: 'practice', difficulty: 'hard', sticks: 9 }

/**
 * When the automatic player catches each stick: halfway through the fall in time, with the reflex
 * bonus at half. And the stick it lets get away on purpose (the third to fall): that way there is
 * always one that touches the floor, is tinted red and breaks the streak.
 */
const BOT_FALL = 0.5
const MISSED_TURN = 2
/**
 * With two players (`--two-players`), the turn the second automatic player lets get away as well:
 * with the same sticks, one fewer caught is fewer points, and that way the run does not come out
 * tied.
 */
const SECOND_PLAYER_MISSED_TURN = 6

/** How long the report of the automatic player waits after the end, in seconds. */
const REPORT_WAIT = 0.5

/** How long the automatic player with a headset stays in the menu before playing. */
const MENU_FRAMES = 30

/**
 * The eye height with which the sticks are placed in the menu (`XRPlayerHeight.tsx`): it is chased
 * at this speed and is only given to the run if it moves more than this.
 */
const HEIGHT_FOLLOW = 1.2
const HEIGHT_THRESHOLD = 0.02

type Driver = 'xr' | 'mouse' | 'bot'

export default class StickRush extends Node3D {
  private run!: Run
  private round: Round | null = null
  private driver: Driver = 'mouse'

  /** Where the scene hangs: the world of the player with a headset, or the scene itself. */
  private scene!: Node3D
  /** The machine and all that goes with it, shifted to leave whoever plays one step behind the centre of the hoop. */
  private machineRig!: Node3D
  private machine!: Machine
  private sticks!: PaintedSticks
  private fairground!: Fairground
  private scenery!: SceneryRig
  private hints!: GameHints
  private ui!: GameUi
  private camera: Camera3D | null = null
  private sfx!: Sfx
  private music!: Music
  /** The real controller in each fist, for the tutorial. */
  private controllersInHand: RealController[] = []

  /** With a headset: the kit's player and, in the test scene, the fake controllers. */
  private player: XRPlayer | null = null
  private sim: Simulation | null = null
  private gripped: Record<HandSide, boolean> = { left: false, right: false }
  /** The eye height being chased in the menu and the last one given to the run. */
  private trackedHeight: number | null = null
  private givenHeight: number | null = null
  private flatHints = false
  /** Where the fake head looks: to the left and downwards, in radians (`--mirar`, `--look-down`, or the `look` metadata of a test scene). */
  private lookLeft = 0
  private lookDown = 0

  /** The mouse click of this frame, as a ray of the camera. */
  private click: { origin: Vector3; dir: Vector3 } | null = null
  private cues!: Cues
  /** What the automatic player with a headset has in hand: which stick, with which hand. */
  private botTarget: { index: number; hand: HandSide; frames: number } | null = null
  /** Frames left for the automatic player to start, or `null` if it does not play or has already started. */
  private botStart: number | null = null

  private fixedSeed: number | null = null
  private harness = false
  private harnessMenu = false
  private shotPath: string | null = null
  private shotMenuPath: string | null = null
  private shotHintsPath: string | null = null
  private shotTutorialPath: string | null = null
  private menuFrames = 0
  private sinceCatch = -1
  private sinceEnd = 0

  private frames = 0
  private usecTotal = 0
  private usecMax = 0
  private playingFrames = 0
  private usecPlaying = 0
  private usecMaxPlaying = 0
  private startedMs = 0
  private framesXr = 0
  /** What was seen, for the report. */
  private catchesPerHand: Record<HandSide, number> = { left: 0, right: 0 }
  private handsSeen = new Set<string>()
  private hintsSeen = new Set<string>()
  private tutorialSeen = new Set<string>()
  private missedClicks = 0
  private results: ResultWithFeats[] = []
  /**
   * The two-player run (`--two-players`, or the `two_players` metadata): the menu comes up with the
   * challenge and two players chosen and, with the automatic player, the two rounds are played in a
   * row, the second with the seed of the first (`tests/auto_run.gd`).
   */
  private twoPlayers = false
  /** The seed of the layout each round started with, to check that with two players it is the same. */
  private roundSeeds: number[] = []
  /** The screenshot of the end of the two-player run (`--shot-duel=<path>`). */
  private shotDuelPath: string | null = null

  _ready(): void {
    this.harnessMenu = this.has_meta('harness_menu')
    this.harness = this.has_meta('harness') || this.harnessMenu
    // A test scene or a screenshot saves apart and starts from scratch: otherwise, the best of the
    // automatic player would end up as the record of whoever has the game.
    isolateSave(this.harness)
    const autoplay = hasFlag('autoplay') || (this.harness && !this.harnessMenu)
    // The language of the command line, or the one the test scene asks for (with nothing, the system's).
    const lang = arg('lang') ?? (this.has_meta('lang') ? String(this.get_meta('lang')) : null)
    let challenge: number | null = null
    this.shotPath = arg('shot')
    this.shotMenuPath = arg('shot-menu')
    this.shotDuelPath = arg('shot-duel')
    this.twoPlayers = hasFlag('two-players') || this.has_meta('two_players')
    this.shotHintsPath = arg('shot-hints')
    this.shotTutorialPath = arg('shot-tutorial')
    const seed = arg('seed')
    if (seed) this.fixedSeed = Number(seed) >>> 0
    const line = arg('reto')
    if (line) challenge = Number(line) >>> 0
    const look = arg('mirar')
    if (look) this.lookLeft = (Number(look) * Math.PI) / 180
    const down = arg('look-down')
    if (down) this.lookDown = (Number(down) * Math.PI) / 180
    if (this.has_meta('look')) this.lookLeft = (Number(this.get_meta('look')) * Math.PI) / 180
    if (this.has_meta('seed')) this.fixedSeed = Number(this.get_meta('seed')) >>> 0
    if (this.has_meta('challenge')) challenge = Number(this.get_meta('challenge')) >>> 0
    // In the native hub, the seed of the challenge is carried by its autoload as metadata (`challenge_seed`).
    const salon = this.get_node_or_null('/root/XRcade')
    if (salon != null && salon.has_meta('challenge_seed')) challenge = Number(salon.get_meta('challenge_seed')) >>> 0
    // And the cabinet's goal (the `goal` metadata: the medal thresholds, the best and the mode in
    // which it counts), read like the kit's `base.objetivo()` —its same `goalFrom`—: it is the web's
    // `goal` prop. Without a hall, or if it gives it no medals, `null` and the sign says the mission.
    // When each run starts, the run raises its record with what it has already reported to the hall
    // (`goalWithPlayed`): the metadata is read once and does not learn of the new best.
    const goal = goalFrom(salon != null && salon.has_meta('goal') ? salon.get_meta('goal') : null)
    // And what the cabinet is called (`game_name`), before painting the menu: it is the name of the game.
    setGameName(gameNameFrom(salon != null && salon.has_meta('game_name') ? salon.get_meta('game_name') : null))
    if (autoplay && this.fixedSeed == null) this.fixedSeed = BOT_SEED
    this.flatHints = hasFlag('ayudas') || this.shotHintsPath != null || this.has_meta('ayudas')

    // The simulated headset: the test scene's one, or `-- --visor-simulado` to look flat at what is
    // seen with the headset (the camera is the fake head).
    const simulated = (this.harness && this.has_meta('xr_simulado')) || hasFlag('visor-simulado')
    this.driver = simulated ? 'xr' : autoplay ? 'bot' : this.startXr() ? 'xr' : 'mouse'
    this.scene = this
    if (this.driver === 'xr') this.buildXrPlayer(simulated)
    this.buildWorld(hasFlag('room'))
    this.buildSound()

    this.run = new Run({
      challenge: challenge == null ? null : { seed: challenge },
      goal,
      onFinish: (result) => this.reportToHall(result),
      seeds: () => this.fixedSeed ?? randomSeed(),
    })
    this.run.setImmersive(this.driver === 'xr')
    // With two players, the menu comes up with the challenge and two players chosen, as whoever presses them would leave them.
    if (this.twoPlayers) {
      this.run.setGameMode('challenge')
      this.run.setPlayers(2)
    }
    // It starts by comparing with the menu, like the web: the challenge, which enters counting, sounds its 3.
    this.cues = { score: 0, missed: 0, countdown: 0, gameState: 'menu', streak: 0, isRecord: false, levelPassed: null, lives: null }
    this.ui = new GameUi(
      this.run,
      { exit: () => this.exit() },
      {
        parent: this.scene,
        camera: this.camera,
        pointers: this.player?.punteros() ?? [],
        headset: this.driver === 'xr',
        lang,
        tutorial: hasFlag('tutorial') || this.shotTutorialPath != null,
        hands: this.controllersInHand,
        eyes: () => {
          const player = this.player
          if (player == null) return null
          return { height: player.estadoDelDecorado.altura.held, atEyeHeight: player.ajustes.altura === 'eyes' }
        },
        scenery: this.scenery,
      },
    )
    // The screenshot of the hints looks at them from one side, with no panels in front.
    if (this.shotHintsPath != null) this.ui.root.visible = false
    // The automatic player does not go through the menu: it always plays the same run.
    // With `--menu` it stays in the menu, to look at it with the simulated headset.
    // With a simulated headset it waits a little in the menu, which is where the eye height is
    // measured for the hoop (`XRPlayerHeight.tsx`).
    if ((this.driver === 'bot' || this.sim != null || this.shotTutorialPath != null) && challenge == null && !hasFlag('menu')) {
      this.botStart = this.sim != null ? MENU_FRAMES : 0
    }
    this.startBot()
    this.startedMs = Time.get_ticks_msec()
  }

  /** The run of the automatic player, when it is its turn: always the same one. */
  private startBot(): void {
    if (this.botStart == null || this.botStart > 0) return
    this.botStart = null
    const p = this.run
    // With two players it plays the challenge `--two-players` already left chosen; otherwise, always the same practice.
    if (!this.twoPlayers) {
      p.setGameMode(BOT_RUN.mode)
      p.setDifficulty(BOT_RUN.difficulty)
      p.setStickCount(BOT_RUN.sticks)
    }
    p.startGame(this.shotTutorialPath != null ? { tutorial: true } : undefined)
    this.roundSeeds.push(p.stickSeed)
  }

  /** The same start-up as the hub: if there is no OpenXR runtime, it goes on flat. */
  private startXr(): boolean {
    const xr = XRServer.find_interface('OpenXR')
    if (xr == null) return false
    if (!xr.is_initialized() && !xr.initialize()) return false
    DisplayServer.window_set_vsync_mode(DisplayServer.VSyncMode.VSYNC_DISABLED)
    this.get_viewport()!.use_xr = true
    return true
  }

  /**
   * The kit's player with a headset, with the common files as they are: the height (`xrLayout.ts`)
   * and the anchoring (`hostAnchor.ts`).
   */
  private buildXrPlayer(simulated: boolean): void {
    if (simulated) {
      this.sim = simulateControllers()
      this.applyTestSettings()
    }
    // Stick Rush has no `uiHeight.ts`: the height lives in its `xrLayout.ts`, with the same functions
    // the kit asks for (`startTracking`, `trackHeight`, `worldRise`). Neither `grab.ts` nor
    // `pinch.ts`: here nothing is carried in the hand, the sticks are caught on squeezing, and without
    // `grab` the kit holds while it is squeezed (`AGARRE_MANTENIENDO`).
    this.player = new XRPlayer(this, { common: { uiHeight: xrLayout, hostAnchor } })
    // Without a real headset, the fake head acts as camera: what is captured is what would be seen.
    if (simulated) viewWithSimulatedHead(this.player.camara)
    this.scene = this.player.mundo
    for (const hand of HANDS) {
      // B/Y and the menu button do what Escape does flat. Playing and choosing are done by pointing.
      this.player.rayo[hand].button_pressed.connect(
        Callable.create(this, (button: string) => {
          if (button === 'by_button' || button === 'menu_button') this.ui.escape()
        }),
      )
      // The real controller in the fist: the tutorial lights it up with the button of its step.
      const controller = new RealController({ mano: hand, dir: CONTROLLERS_DIR })
      this.player.puno[hand].add_child(controller.nodo)
      this.controllersInHand.push(controller)
    }
  }

  /** The hall settings the test scene asks for (`settings` metadata), in the save. */
  private applyTestSettings(): void {
    const storage = gameStorage()
    if (storage == null || !this.has_meta('settings')) return
    const settings = JSON.parse(String(this.get_meta('settings'))) as Record<string, string>
    for (const [key, value] of Object.entries(settings)) storage.setItem(key, value)
  }

  /** The fairground, the machine, the sticks, the hints and the flat camera. */
  private buildWorld(room: boolean): void {
    // The world shifted by what the player moves away from the centre of the hoop (`GameWorld.tsx`).
    this.machineRig = new Node3D()
    this.machineRig.set_name('MachineRig')
    this.machineRig.position = new Vector3(0, 0, -PLAYER_OFFSET_Z)
    this.scene.add_child(this.machineRig)
    this.fairground = new Fairground(this, this.machineRig)
    this.scenery = new SceneryRig({
      mostrar: (inSquare) => this.fairground.inSquare(inSquare),
      vista: headsetView(this.get_viewport()!),
      forzado: room ? 'room' : null,
    })
    this.scenery.actualizar()
    this.machine = new Machine(this.machineRig)
    this.sticks = new PaintedSticks(this.machineRig)

    // The controller beside the ghost stick is that of the good hand; flat (`--ayudas`), that of Quest 3.
    const player = this.player
    const hand = player?.manoBuena ?? 'right'
    const beside = new RealController({ mano: hand, dir: CONTROLLERS_DIR, ...(player == null ? { perfil: () => 'oculus-touch-v3' } : {}) })
    this.hints = new GameHints(this.machineRig, [beside])

    if (player != null) return
    const camera = new Camera3D()
    camera.fov = FLAT_CAMERA.fov
    camera.near = FLAT_CAMERA.near
    camera.far = FLAT_CAMERA.far
    const { position, target } = this.shotHintsPath != null ? HINTS_CAMERA : FLAT_CAMERA
    camera.transform = new Transform3D(Basis.looking_at(Vector3.SUBTRACT(target, position), Vector3.UP), position)
    camera.current = true
    this.add_child(camera)
    this.camera = camera
  }

  /** The effects and the music. The test scene passes a muted bus, which counts just the same. */
  private buildSound(): void {
    const bus = this.has_meta('sfx_bus') ? String(this.get_meta('sfx_bus')) : undefined
    this.sfx = new Sfx(this, { dir: SFX_DIR, names: SOUNDS, bus, levels: volumeLevels })
    this.music = new Music(this, { path: MUSIC_PATH, volume: MUSIC_VOLUME, fade: fadeVolume, fadeMs: MUSIC_FADE_MS, bus, levels: volumeLevels })
    this.music.start()
  }

  /** What is compared from one frame to the next to know what sounds (`useGameSound.ts`). */
  private currentCues(): Cues {
    const p = this.run
    return {
      score: p.score,
      missed: p.misses,
      countdown: p.countdown,
      gameState: p.gameState,
      streak: p.streak,
      // On top of the close sounds what is celebrated: the record, or the end of a two-player run.
      isRecord: p.celebrates,
      duelEnds: p.duel != null && duelOver(p.duel),
      levelPassed: p.levelResult?.passed ?? null,
      lives: p.lives,
      medal: p.medal,
    }
  }

  /**
   * Tells the hall how a run has ended (`GameResult` in `seed.ts`, with the feats first earned in
   * it if there are any: `feats.ts`), if there is a hall.
   */
  private reportToHall(result: ResultWithFeats): void {
    this.results.push(result)
    print(`STICK-RUSH-RESULTADO ${JSON.stringify(result)}`)
    const xrcade = this.get_node_or_null('/root/XRcade')
    if (xrcade != null && xrcade.has_method('report_result')) {
      ;(xrcade as unknown as { call(m: string, a: string): unknown }).call('report_result', JSON.stringify(result))
    }
  }

  private exit(): void {
    if (this.harnessMenu) {
      this.set_meta('salida', true)
      return
    }
    const xrcade = this.get_node_or_null('/root/XRcade')
    if (xrcade != null) (xrcade as unknown as { call(method: string): unknown }).call('exit_to_hub')
    else this.get_tree().quit()
  }

  /** The mouse goes to the aim of the ui, before anything else: it is its ray. */
  _input(event: InputEvent): void {
    this.ui?.handleInput(event)
  }

  _unhandled_input(event: InputEvent): void {
    if (event instanceof InputEventKey && event.is_pressed() && event.keycode === Key.KEY_ESCAPE) this.ui.escape()
    // A click catches the stick underneath, unless it belongs to a button. On pressing, as on the web
    // (`onPointerDown`): with the stick falling, waiting for the release would make clicks that feel good miss.
    const mouse = this.ui.mouse
    if (
      this.camera != null &&
      mouse != null &&
      event instanceof InputEventMouseButton &&
      event.is_pressed() &&
      event.button_index === MouseButton.MOUSE_BUTTON_LEFT &&
      !this.ui.pointsAt(mouse.id)
    ) {
      const at: Vector2 = event.position
      this.click = { origin: this.camera.project_ray_origin(at), dir: this.camera.project_ray_normal(at) }
    }
  }

  _process(delta: number): void {
    const t0 = Time.get_ticks_usec()
    const p = this.run

    if (this.botStart != null) {
      this.botStart--
      this.startBot()
    }
    if (this.sim != null) this.driveXrBot()
    this.player?.update(delta)
    if (this.player != null) {
      this.measureHeight(delta)
      this.catchWithHand()
    }
    if (this.driver === 'bot') this.driveBot()
    this.catchWithMouse()

    p.tick(delta)
    this.advanceRound(delta)

    // What sounds, from the same counters and with the same rule as the web.
    const cues = this.currentCues()
    for (const sound of soundsBetween(this.cues, cues)) this.sfx.play(sound)
    this.cues = cues

    this.paint(delta)
    this.music.update(delta)

    const spent = Time.get_ticks_usec() - t0
    this.frames++
    this.usecTotal += spent
    this.usecMax = Math.max(this.usecMax, spent)
    if (p.gameState === 'playing' && this.frames > 10) {
      this.playingFrames++
      this.usecPlaying += spent
      this.usecMaxPlaying = Math.max(this.usecMaxPlaying, spent)
    }
    this.screenshots(delta)
  }

  /**
   * The eye height in the menu, for the hoop (`XRPlayerHeight.tsx`): the head is measured above the
   * floor, it is chased slowly and is given to the run if it really moves. With the world at eye
   * height it is not: the hoop already comes with the world, and following it would lower it twice.
   */
  private measureHeight(delta: number): void {
    const player = this.player!
    const p = this.run
    if (p.gameState !== 'menu') return
    if (player.ajustes.altura === 'eyes') {
      if (this.givenHeight !== null) p.setPlayerEyeHeight(null)
      this.givenHeight = null
      return
    }
    const measured = headsetEyeHeight(player.camara.position.y, true)
    if (measured == null) return
    this.trackedHeight = this.trackedHeight == null ? measured : this.trackedHeight + (measured - this.trackedHeight) * followRatio(delta, HEIGHT_FOLLOW)
    if (this.givenHeight != null && Math.abs(this.trackedHeight - this.givenHeight) < HEIGHT_THRESHOLD) return
    this.givenHeight = this.trackedHeight
    p.setPlayerEyeHeight(this.trackedHeight)
  }

  /** The hand closed on a stick: on squeezing the side trigger, the stick that is in the fist. */
  private catchWithHand(): void {
    const player = this.player!
    let withController = false
    let withHands = false
    for (const hand of HANDS) {
      const fist = player.puno[hand]
      if (fist.get_has_tracking_data()) withController = true
      if (player.manoDesnuda(hand) != null) withHands = true
      const squeezed = isGrabbing({ valor: fist.get_float(ACTION.agarre), clic: fist.is_button_pressed(ACTION.agarreClic), pellizco: false })
      const edge = squeezed && !this.gripped[hand]
      this.gripped[hand] = squeezed
      if (!edge || this.round == null) continue
      const pose = player.poseDelPuno(hand)
      if (pose == null) continue
      const point = this.machineRig.to_local(pose.origin)
      const stick = stickInHand(this.round.catchable(this.run.paused), [point.x, point.y, point.z])
      if (stick != null) this.catchStick(stick, hand, this.isBehindAtFist(pose.origin))
    }
    // Hands and no controllers: the pinch is shown (`playingBareHanded`).
    this.run.setBareHanded(withHands && !withController)
  }

  /** The mouse click of this frame, if there is one: the first stick its ray crosses. */
  private catchWithMouse(): void {
    const click = this.click
    this.click = null
    if (click == null || this.round == null) return
    const origin = this.machineRig.to_local(click.origin)
    const towards = Vector3.SUBTRACT(this.machineRig.to_local(Vector3.ADD(click.origin, click.dir)), origin).normalized()
    const stick = stickOnRay(this.round.catchable(this.run.paused), [origin.x, origin.y, origin.z], [towards.x, towards.y, towards.z])
    if (stick == null) {
      this.missedClicks++
      return
    }
    this.catchStick(stick, null)
  }

  /**
   * Whether the stick the fist catches (its global position) lies behind the head's back, for its
   * feat (`isBehindBack` in `feats.ts`). Only with a headset: with the mouse the camera always looks
   * at the machine.
   */
  private isBehindAtFist(fist: Vector3): boolean {
    const camera = this.player?.camara
    if (camera == null) return false
    const eyes = camera.global_position
    const forward = Vector3.SUBTRACT(camera.to_global(new Vector3(0, 0, -1)), eyes)
    return isBehindBack({ head: eyes, gaze: forward, stick: fist })
  }

  /** Catches a stick: the round lights it up, the run counts it and the hand that caught it vibrates. */
  private catchStick(stick: Stick, hand: HandSide | null, behind = false): void {
    const progress = this.round!.catchStick(stick.index, this.run.paused)
    if (progress == null) return
    // First the point and then the flourish, as on the web: the vibration cannot take the catch away.
    this.run.catchStick(progress, behind)
    this.sinceCatch = 0
    if (hand == null || this.player == null) return
    this.catchesPerHand[hand]++
    this.player.vibrar(catchPulses(hand, progress))
  }

  /**
   * The round: one per run and per reload of the endless run (`roundKey`), with the sticks placed
   * at the height of the hoop. The ones that touch the floor count as missed.
   */
  private advanceRound(delta: number): void {
    const p = this.run
    const key = roundKey(p.runId, p.stickSeed)
    const height = p.hoopHeight
    if (this.round == null || this.round.key !== key) this.round = new Round(key, p.stickSeed, p.activeStickCount, height)
    else this.round.place(p.activeStickCount, height)
    const speed = hoopFallSpeed(DIFFICULTY_SPEEDS[p.activeDifficulty], height)
    const events = this.round.advance(delta, { paused: p.paused, speed })
    for (let i = 0; i < events.missed.length; i++) p.missStick()
  }

  /** Everything that is painted, after the run and the round have advanced. */
  private paint(delta: number): void {
    const p = this.run
    this.machine.place(p.hoopHeight)
    this.sticks.paint(this.round, delta, p.gameState === 'menu')
    this.fairground.update(delta, p.streak)
    if (this.frames % HEADSET_REREAD_FRAMES === 0) this.scenery.releer()
    this.scenery.actualizar()

    const showing = this.driver === 'xr' || this.flatHints
    this.hints.update(delta, {
      showing,
      facts: { grab: p.score > 0, falling: p.gameState === 'playing' || (p.gameState === 'countdown' && p.countdown <= 1) },
      hoop: p.hoopHeight,
      hand: this.player?.manoBuena ?? 'right',
    })
    for (const hint of this.hints.visible()) this.hintsSeen.add(hint)
    for (const controller of this.controllersInHand) {
      controller.actualizar(delta)
      if (controller.visible) this.handsSeen.add(controller.mano)
    }
    this.ui.update(delta)
    // The crossed threshold is felt in the good hand, an instant after the catch that crossed it; the
    // colour and the pulse are the sign's, and the sound comes from the cues (`soundsBetween`).
    const crossed = this.ui.crossedThreshold
    if (crossed != null && this.player != null) this.player.vibrar(thresholdPulses(crossed, this.player.manoBuena))
    const step = this.ui.tutorial.step
    if (step != null) this.tutorialSeen.add(step)
  }

  /** The flat screenshots, and the report of the automatic player on ending. */
  private screenshots(delta: number): void {
    const p = this.run
    if (this.sinceCatch >= 0) this.sinceCatch += delta
    const save = (path: string, extra: object = {}) => {
      this.get_viewport()!.get_texture()!.get_image()!.save_png(path)
      print(`STICK-RUSH-SHOT ${path} ${JSON.stringify(extra)}`)
      this.get_tree().quit(0)
    }
    // Halfway through the run: a tenth after the second caught stick, with its flash in view.
    if (this.shotPath != null && p.score >= 2 && this.sinceCatch > 0.1) {
      save(this.shotPath, { points: p.points })
      this.shotPath = null
      return
    }
    if (this.shotTutorialPath != null && this.ui.tutorial.step != null && this.playingFrames > 30) {
      save(this.shotTutorialPath, { step: this.ui.tutorial.step })
      this.shotTutorialPath = null
      return
    }
    if (this.shotHintsPath != null && this.hints.visible().length >= 2 && ++this.menuFrames > 90) {
      save(this.shotHintsPath, { hints: this.hints.visible() })
      this.shotHintsPath = null
      return
    }
    if (this.shotMenuPath != null && (p.gameState === 'menu' || p.gameState === 'finished') && ++this.menuFrames > 20) {
      // Twenty frames: the MSDF labels are generated on the first draw.
      save(this.shotMenuPath, { phase: p.gameState })
      this.shotMenuPath = null
      return
    }
    const duel = p.duel
    if (this.shotDuelPath != null && p.gameState === 'finished' && duel != null && duelOver(duel) && ++this.menuFrames > 20) {
      save(this.shotDuelPath, { duel })
      this.shotDuelPath = null
      return
    }
    // The report waits half a second after the end: the pulses of the last catch are queued. With two
    // players, once the first round is over, the second one presses play (with `--shot-menu` it stays on the notice).
    if ((this.driver === 'bot' || this.sim != null) && p.gameState === 'finished' && this.shotPath == null && this.shotMenuPath == null) {
      this.sinceEnd += delta
      if (this.sinceEnd <= REPORT_WAIT) return
      if (duel != null && !duelOver(duel)) {
        this.sinceEnd = 0
        p.startGame()
        this.roundSeeds.push(p.stickSeed)
      } else if (this.shotDuelPath == null) this.reportAndQuit()
    }
  }

  /** Where the centre of the body of a stick is now, in global space. */
  private stickCentre(stick: Stick): Vector3 {
    const { top, bottom } = stickBody(stick)
    return this.machineRig.to_global(new Vector3((top[0] + bottom[0]) / 2, (top[1] + bottom[1]) / 2, (top[2] + bottom[2]) / 2))
  }

  /**
   * The stick to go for: one that is already halfway through its fall in time (the root of what it
   * has dropped, like `stickFallProgress`), except the one of the turn that is let go. `null` if none.
   */
  private stickInRange(): Stick | null {
    const round = this.round
    const p = this.run
    if (round == null || p.gameState !== 'playing') return null
    const order = fallOrder(round.sticks.length, p.stickSeed)
    // With two players, the second one lets one more get away (`SECOND_PLAYER_MISSED_TURN`).
    const skipped = [order[MISSED_TURN], ...(p.player === 1 ? [order[SECOND_PLAYER_MISSED_TURN]] : [])]
    return (
      round.catchable(p.paused).find((stick) => {
        if (stick.state !== 'falling' || skipped.includes(stick.index)) return false
        const travel = stick.layout.anchor[1] - STICK_MISS_Y
        const dropped = stick.layout.anchor[1] - stick.y
        return travel > 0 && Math.sqrt(Math.min(1, dropped / travel)) >= BOT_FALL
      }) ?? null
    )
  }

  /** The automatic player flat: a mouse click on the stick that is due, along the same path. */
  private driveBot(): void {
    const stick = this.stickInRange()
    if (stick == null || this.camera == null) return
    const origin = this.camera.global_position
    const aimPoint = this.stickCentre(stick)
    this.click = { origin, dir: Vector3.SUBTRACT(aimPoint, origin).normalized() }
  }

  /**
   * The automatic player with a headset: it moves the fake hands like real ones. It takes the fist
   * of the hand on the stick's side to it and, a frame later, squeezes the grip (the edge is what
   * catches). Halfway through the run it pushes the thumbstick of the free hand for a moment, which
   * seated turns the world.
   */
  private driveXrBot(): void {
    const sim = this.sim!
    const player = this.player!
    const free: HandSide = player.manoBuena === 'left' ? 'right' : 'left'
    this.framesXr++
    const height = this.has_meta('eyes') ? Number(this.get_meta('eyes')) : 1.6
    const eyes = new Vector3(0, height, 0)
    // Facing forward on entering, which is when the world is planted, and then towards where it is asked to look.
    const head = this.framesXr > 5 ? Basis.MULTIPLY(new Basis(Vector3.UP, this.lookLeft), new Basis(Vector3.RIGHT, -this.lookDown)) : Basis.IDENTITY
    sim.cabeza(new Transform3D(head, eyes))
    sim.manos[free].stick(this.framesXr === 120 ? 1 : 0, 0)

    const target = this.botTarget
    if (target != null) {
      target.frames++
      const stick = this.round?.sticks[target.index]
      const stillThere = stick != null && (stick.state === 'falling' || stick.state === 'hanging')
      if (!stillThere || target.frames > 2) this.botTarget = null
    }
    if (this.botTarget == null) {
      const stick = this.stickInRange()
      if (stick != null) {
        // The hand on the stick's side: the one that reaches without crossing over.
        const inWorld = this.scene.to_local(this.stickCentre(stick))
        this.botTarget = { index: stick.index, hand: inWorld.x < 0 ? 'left' : 'right', frames: 0 }
      }
    }
    for (const hand of HANDS) {
      const going = this.botTarget?.hand === hand
      // At rest, in front of the chest; if it goes, the fist to the centre of the stick, in the origin's space.
      let where = Vector3.ADD(eyes, new Vector3(hand === 'left' ? -0.2 : 0.2, -0.45, -0.3))
      if (going) where = player.origen.to_local(this.stickCentre(this.round!.sticks[this.botTarget!.index]))
      sim.manos[hand].poner(new Transform3D(Basis.IDENTITY, where))
      // Squeeze the frame after arriving: the edge of that frame is the one that catches.
      sim.manos[hand].agarre(going && this.botTarget!.frames >= 1 ? 1.0 : 0.0)
    }
  }

  /**
   * Which phase the run is in (`menu`, `countdown`, `playing`, `finished`, and `quit` with the
   * question in front): for the test scenes in GDScript, which do not see the JS objects.
   */
  phase(): string {
    const p = this.run
    return p.prompt ?? (p.gameState as RunPhase)
  }

  run_mode(): string {
    return this.run.gameMode
  }

  in_challenge(): boolean {
    return this.run.inChallenge
  }

  run_seed(): number {
    return this.run.seed
  }

  /** What the goal sign says right now, one line per row, or empty if it is not hung. */
  goal_sign(): string {
    const sign = this.ui.sign
    return sign.node.visible ? sign.panel.escritos.map((e) => e.texto).join('\n') : ''
  }

  /** The layout of the round in progress (turn and anchor of each stick): two equal ones are the same. */
  round_layout(): string {
    return (this.round?.sticks ?? []).map((stick) => `${stick.layout.delay.toFixed(4)}:${stick.layout.anchor.map((v) => v.toFixed(3)).join(',')}`).join(' ')
  }

  /** How many sticks have been caught, and how many clicks hit none: for the mouse scene. */
  caught(): number {
    return this.run.score
  }

  missed_clicks(): number {
    return this.missedClicks
  }

  /** What was chosen in the menu, for the mouse test scene. */
  selection(): string {
    const p = this.run
    return `${p.gameMode}:${p.activeDifficulty}:${p.endless ? 'endless' : p.activeStickCount}`
  }

  /** The correction of the hoop, for the mouse scene. */
  hoop_adjustment(): number {
    return this.run.hoopAdjustment
  }

  /**
   * Where a button of the ui (`play`, `exit`, `mode`…) falls on the screen, so that a test scene
   * presses it with the mouse as whoever plays would. `(-1, -1)` if it is not in view.
   */
  button_on_screen(id: string): Vector2 {
    const button = this.ui.aim.boton(id)
    if (button == null || this.camera == null || !button.nodo.is_visible_in_tree()) return new Vector2(-1, -1)
    return this.camera.unproject_position(button.nodo.global_position)
  }

  /**
   * Where a stick that is still hanging (the first one) falls on the screen, or `(-1, -1)`: so that
   * the mouse scene clicks on it, still, before and after the countdown.
   */
  stick_on_screen(): Vector2 {
    const stick = this.round?.sticks.find((s) => s.state === 'hanging')
    if (stick == null || this.camera == null) return new Vector2(-1, -1)
    return this.camera.unproject_position(this.stickCentre(stick))
  }

  /** What the test scene with a headset checks of the XR grammar. */
  private xrReport() {
    const player = this.player
    if (player == null) return null
    const sceneryState = player.estadoDelDecorado
    const world = player.mundo.global_transform.origin
    return {
      hand: player.manoBuena,
      rise: player.subida,
      placement: sceneryState.colocacion,
      turn: sceneryState.giro.yaw,
      world: { x: world.x, y: world.y, z: world.z },
      hoop: this.run.hoopHeight,
      catchesPerHand: this.catchesPerHand,
      vibrations: player.vibraciones.map((v) => ({ hand: v.mano, amplitude: Number(v.amplitud.toFixed(4)), seconds: v.segundos, t: Math.round(v.t) })),
      hints: [...this.hintsSeen],
      handsWithController: [...this.handsSeen].sort(),
      tutorial: [...this.tutorialSeen],
    }
  }

  private reportAndQuit(): void {
    const p = this.run
    const result = {
      outcome: p.outcome,
      points: p.points,
      score: p.score,
      resolved: p.resolved,
      misses: p.misses,
      sticks: p.activeStickCount,
      bestStreak: p.bestStreak,
      record: p.isRecord,
      best: p.bestPoints,
      seed: p.seed,
      frames: this.frames,
      usecAvg: Math.round(this.usecTotal / this.frames),
      usecMax: this.usecMax,
      usecPlayingAvg: this.playingFrames > 0 ? Math.round(this.usecPlaying / this.playingFrames) : 0,
      usecPlayingMax: this.usecMaxPlaying,
      wallMs: Time.get_ticks_msec() - this.startedMs,
      sfx: this.sfx.counts,
      variants: Object.fromEntries(SOUNDS.map((name) => [name, this.sfx.variantCount(name)])),
      music: { playing: this.music.playing, volume: Number(this.music.volume.toFixed(3)) },
      levels: volumeLevels(),
      results: this.results,
      // The two-player run, if it was being played: the points of each one, the seed each round
      // started with and what the pair has so far.
      duel: p.duel,
      seeds: this.roundSeeds,
      pair: getDuelTally(),
      machine: this.machine.pieces,
      fairground: this.fairground.counts,
      stickStates: (this.round?.sticks ?? []).map((stick) => stick.state),
      xr: this.xrReport(),
    }
    print(`STICK-RUSH-RESULT ${JSON.stringify(result)}`)
    this.set_process(false)
    this.sim?.quitar()
    if (this.harness) {
      this.set_meta('result', JSON.stringify(result))
      return
    }
    if (this.get_node_or_null('/root/XRcade') != null) this.exit()
    else this.get_tree().quit(p.score > 0 ? 0 : 1)
  }
}
