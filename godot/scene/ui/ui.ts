/**
 * Stick Rush's ui in Godot, whole: the menu, the scoreboard, the countdown, back to menu
 * and its notice, ending the endless run and the tutorial, the goal sign, and the aim that
 * makes them pressable. What on the web `XRMenu`, `XRHud`, `MachineSign`, `XRCountdown` and
 * `XRTutorial` mount inside `XRGazeAnchor`.
 *
 * **With the headset, at the web's measurements** (`lib/xrLayout.ts`): the menu in the left column
 * —a metre and a half away, 30° from the front and enlarged (`XR_MENU_POSE`)—, the scoreboard below the hoop, back to menu
 * at the top left, the notice and the countdown in front and the tutorial above the scoreboard.
 * Everything hangs from `root`, in the player's world (which already stands where the hall lends it and turns with
 * the stick), and rises or drops with the player's eyes what the world has not already lowered
 * (`xrUiRiseOverWorld`). **One difference**: the web also carries it with the gaze (`XRGazeAnchor`,
 * with its dead zone); here it stays where the world was planted, as in the other ports.
 *
 * **Flat**, the web does not paint these panels —it puts its menu and its scoreboard in the DOM—; here there is no DOM,
 * so the same panels hang **from the camera** (`FLAT_PLACEMENTS`), close, so that nothing of
 * the scene gets in front.
 *
 * **The one in charge is the run** (`game/run.ts`, the web's `gameStore`): this only reads it to
 * paint and passes it what is pressed.
 */
import { Node3D, Transform3D, Vector3, type Camera3D, type InputEvent } from 'godot'

import type { Pointer } from '@kit/lib/ui/pointer'
import { PointerAim } from '@kit/runtime/ui/pointerAim'
import { MousePointer } from '@kit/runtime/ui/mouse'
import type { MandoEnLaMano } from '@kit/runtime/ui/tutorial'

import type { Lang, Scenery } from '@/lib/settings'
import { signPlacement } from '@/lib/machineSign'
import type { Medal } from '@/lib/goal'
import { startingLives } from '@/lib/gameMode'
import { nextMode } from '@/lib/gameMenu'
import { duelSummary } from '@/lib/duel'
import { getDuelTally } from '@/lib/duelTally'
import { scoreRatio } from '@/lib/scoring'
import { sceneryModeOf, sceneryOf } from '@/lib/sceneryPreference'
import { stickStatuses } from '@/lib/stickLayout'
import { translator } from '@/lib/textos'
import {
  XR_CONFIRM_POSITION,
  XR_COUNTDOWN_POSITION,
  XR_DUEL_POSITION,
  XR_HUD_POSITION,
  XR_TUTORIAL_POSITION,
  menuPoseFor,
  xrUiRiseOverWorld,
} from '@/lib/xrLayout'

import type { Run } from '../game/run'
import { onLangChange, currentLang } from '@kit/runtime/settings'
import { QuitNotice, FinishButton, QuitButton, Countdown, DuelPanel } from './notice'
import { SIGN, Sign } from './sign'
import { Scoreboard, FINAL_RISE, type ScoreboardState } from './scoreboard'
import { GameMenu, type MenuState } from './menu'
import { GameTutorial } from './tutorial'

/** What the ui asks of the scene, besides what it asks of the run. */
export interface GameScene {
  /** Back to the hall, or close the game. */
  exit(): void
}

/** The hall's scenery seen from the menu: what is chosen, whether there is a room and how to change it. */
export interface MenuScenery {
  readonly elegido: Scenery
  readonly hayHabitacion: boolean
  elegir(scenery: Scenery): void
}

/** The eye height the headset measures, and whether the hall asks to play at eye height. */
export interface PlayerEyes {
  height: number | null
  atEyeHeight: boolean
}

export interface UiOptions {
  /** Where it hangs: the player's world with a headset, or the scene. */
  parent: Node3D
  /** The flat camera, from which the mouse ray comes out and from which the panels hang. With a headset, `null`. */
  camera: Camera3D | null
  /** The headset's pointers (`XRPlayer.punteros()`), besides the mouse. */
  pointers?: readonly Pointer[]
  headset: boolean
  /** Language forced from the command line (`--lang=es`), to look without touching what is saved. */
  lang?: string | null
  /** Show the tutorial flat as well (`--tutorial`). */
  tutorial?: boolean
  /** The real controller of each hand, for the tutorial. */
  hands?: readonly MandoEnLaMano[]
  eyes?: () => PlayerEyes | null
  scenery?: MenuScenery
}

/** Where each panel hangs when flat, in camera space (`−Z` is towards the machine). */
export interface FlatPlacement {
  position: readonly [number, number, number]
  scale: number
}

/**
 * The panels when flat, with the web's camera (52° field of view): the menu on the left, letting the
 * machine be seen; while playing, the scoreboard at the top right (where the web has the points) and back at the top
 * left, outside the hoop; the question and the end, in the middle; the countdown, above the
 * machine; the tutorial (`--tutorial`), on the right; the goal sign, at the top in the middle, above
 * the machine (at the end it comes down with the end panel, just above it).
 */
export const FLAT_PLACEMENTS = {
  menu: { position: [-0.55, 0, -1.25], scale: 1 },
  scoreboard: { position: [0.72, 0.5, -1.4], scale: 0.7 },
  final: { position: [0, -0.02, -1.3], scale: 1 },
  quit: { position: [-0.95, 0.48, -1.4], scale: 1 },
  finish: { position: [0.95, 0.12, -1.4], scale: 1 },
  notice: { position: [0, 0, -1.2], scale: 1 },
  // With two players, above the end: the notice to pass the controller or who wins.
  duel: { position: [0, 0.4, -1.3], scale: 0.8 },
  count: { position: [0, 0.18, -1.4], scale: 1 },
  // The sign measures at that distance what it measures at the drawing one: the same degrees as with the headset.
  sign: { position: [0, 0.56, -1.4], scale: 1.4 / SIGN.distance },
  finalSign: { position: [0, 0.13, -1.3], scale: 1.3 / SIGN.distance },
  tutorial: { position: [0.8, -0.1, -1.6], scale: 0.8 },
} as const satisfies Record<string, FlatPlacement>

export class GameUi {
  readonly aim: PointerAim
  readonly mouse: MousePointer | null
  /** What rises with the eyes, with a headset. */
  readonly root: Node3D
  readonly menu: GameMenu
  readonly scoreboard: Scoreboard
  /** The goal sign, above the scoreboard. */
  readonly sign: Sign
  /** The medal threshold crossed in the last frame, so that the scene makes it sound and be felt. */
  crossedThreshold: Medal | null = null
  readonly quit: QuitButton
  readonly finish: FinishButton
  readonly notice: QuitNotice
  readonly duel: DuelPanel
  readonly count: Countdown
  readonly tutorial: GameTutorial
  private readonly headset: boolean
  private readonly camera: Camera3D | null
  private readonly forcedLang: string | null
  private readonly flatTutorial: boolean
  private readonly eyes: () => PlayerEyes | null
  private readonly scenery: MenuScenery | null
  private readonly stopListening: () => void
  private paintedMenu = ''
  /** What is folded behind «Más opciones», asked for: it belongs to the ui, and the menu opens folded again. */
  private moreOptions = false
  private paintedScoreboard = ''
  private paintedNotice = ''
  private paintedDuel = ''
  private flatPlaced = ''

  constructor(
    private readonly run: Run,
    private readonly scene: GameScene,
    options: UiOptions,
  ) {
    this.headset = options.headset
    this.camera = options.camera
    this.forcedLang = options.lang ?? null
    this.flatTutorial = options.tutorial ?? false
    this.eyes = options.eyes ?? (() => null)
    this.scenery = options.scenery ?? null
    this.mouse = options.camera == null ? null : new MousePointer(options.camera)
    this.aim = new PointerAim([...(this.mouse == null ? [] : [this.mouse]), ...(options.pointers ?? [])])

    this.root = new Node3D()
    this.root.set_name('Ui')
    options.parent.add_child(this.root)

    const p = run
    this.menu = new GameMenu(
      {
        nextMode: () => p.setGameMode(nextMode(p.gameMode)),
        chooseDifficulty: (d) => p.setDifficulty(d),
        chooseSticks: (n) => p.setStickCount(n),
        toggleEndless: () => p.setEndless(!p.endless),
        togglePlayers: () => p.setPlayers(p.players === 2 ? 1 : 2),
        toggleOptions: () => {
          this.moreOptions = !this.moreOptions
        },
        chooseLevel: (n) => p.setLevel(n),
        chooseScenery: (mode) => this.scenery?.elegir(sceneryOf(mode)),
        moveHoop: (steps) => p.adjustHoop(steps),
        watchTutorial: () => p.startGame({ tutorial: true }),
        play: () => p.startGame(),
        exit: () => this.scene.exit(),
      },
      this.aim,
    )
    this.root.add_child(this.menu.node)
    this.scoreboard = new Scoreboard({ repeat: () => p.startGame(), backToMenu: () => p.resetGame() }, this.aim)
    this.root.add_child(this.scoreboard.node)
    this.sign = new Sign()
    this.root.add_child(this.sign.node)
    this.quit = new QuitButton(() => p.askToQuit(), this.aim)
    this.root.add_child(this.quit.node)
    this.finish = new FinishButton(() => p.endRun(), this.aim)
    this.root.add_child(this.finish.node)
    this.notice = new QuitNotice({ leave: () => p.resetGame(), keepGoing: () => p.keepPlaying() }, this.aim)
    this.root.add_child(this.notice.node)
    this.duel = new DuelPanel()
    this.root.add_child(this.duel.node)
    this.count = new Countdown()
    this.root.add_child(this.count.node)
    this.tutorial = new GameTutorial({ next: () => p.nextTutorialStep(), skip: () => p.finishTutorial() }, this.aim, options.hands)
    this.root.add_child(this.tutorial.view.nodo)

    if (this.headset) {
      const pose = menuPoseFor(true)
      this.menu.node.position = new Vector3(...pose.position)
      this.menu.node.rotation = new Vector3(0, pose.yaw, 0)
      this.menu.node.scale = new Vector3(pose.scale, pose.scale, pose.scale)
      this.scoreboard.node.position = new Vector3(...XR_HUD_POSITION)
      this.sign.place(signPlacement())
      this.notice.node.position = new Vector3(...XR_CONFIRM_POSITION)
      this.duel.node.position = new Vector3(...XR_DUEL_POSITION)
      this.count.node.position = new Vector3(...XR_COUNTDOWN_POSITION)
      // In front of the scoreboard: the tutorial's opaque background covers it where they cross, as on the web.
      this.tutorial.view.nodo.position = new Vector3(XR_TUTORIAL_POSITION[0], XR_TUTORIAL_POSITION[1], XR_TUTORIAL_POSITION[2] + 0.03)
    }

    // If the hall changes the language with the game open, it is repainted on the next frame.
    this.stopListening = onLangChange(() => {
      this.paintedMenu = ''
      this.paintedScoreboard = ''
      this.paintedNotice = ''
      this.paintedDuel = ''
    })
    this.update(0)
  }

  /** The language right now: the forced one or the hall's. */
  get lang(): Lang {
    return currentLang(this.forcedLang)
  }

  /** An input event: the mouse is handled by the aim. */
  handleInput(event: InputEvent): boolean {
    return this.mouse?.recibir(event) ?? false
  }

  /** Whether that pointer is over a button: then its click is the button's, not a stick. */
  pointsAt(pointer: string): boolean {
    return this.aim.apuntando(pointer) != null
  }

  /**
   * Escape (and B/Y or menu on the controller): in the menu it exits the game; with the question in front, it keeps going; at
   * the end, to the menu; playing or counting, it asks.
   */
  escape(): void {
    const p = this.run
    if (p.prompt != null) p.keepPlaying()
    else if (p.gameState === 'menu') this.scene.exit()
    else if (p.gameState === 'finished') p.resetGame()
    else p.askToQuit()
  }

  /** What the menu shows right now. */
  menuState(): MenuState {
    const p = this.run
    return {
      lang: this.lang,
      mode: p.gameMode,
      difficulty: p.activeDifficulty,
      sticks: p.stickCount,
      endless: p.endless,
      level: p.activeLevel,
      unlocked: p.unlockedLevel,
      stars: p.levelStars,
      hoopAdjustment: p.hoopAdjustment,
      room: this.scenery?.hayHabitacion ?? false,
      scenery: sceneryModeOf(this.scenery?.elegido ?? 'place'),
      players: p.players,
      moreOptions: this.moreOptions,
    }
  }

  /** What the scoreboard shows right now: that of `XRHud.tsx`, and the type of the end of `HUD.tsx`. */
  scoreboardState(): ScoreboardState {
    const p = this.run
    const t = translator(this.lang)
    const endless = p.endlessRun
    const finished = p.gameState === 'finished'
    const n = p.activeStickCount
    const record = p.bestPoints
    const fill = endless ? Math.min(1, p.streak / Math.max(record, p.streak, 1)) : scoreRatio(p.points, p.activeDifficulty, n)
    const mark = endless ? (record > 0 ? Math.min(1, record / Math.max(record, p.streak, 1)) : 0) : scoreRatio(record, p.activeDifficulty, n)
    const level = p.levelResult
    const title = p.levels
      ? `${t('Level')} ${p.activeLevel}`
      : p.isRecord
        ? t(endless ? 'Best streak!' : 'New record!')
        : p.gameMode !== 'challenge'
          ? t('Game over!')
          : p.outcome === 'cleared'
            ? t('Challenge cleared!')
            : t('You are out of lives')
    return {
      lang: this.lang,
      mode: p.gameMode,
      finished,
      tokens: stickStatuses(endless ? p.waveScore : p.score, endless ? p.waveResolved : p.resolved, n),
      streak: p.streak,
      fill,
      mark,
      record: p.isRecord,
      lives: startingLives(p.gameMode) == null ? null : p.lives,
      stars: finished && level != null ? level.stars : null,
      title,
      points: p.points,
      // While playing, whose round it is; at the end the notice to pass the controller says it, above.
      player: finished ? null : p.player,
      // With the goal sign above, the points and the lives are read there.
      onSign: p.signPhase != null,
    }
  }

  /** Raises the ui with the eyes, what the world has not already lowered (`xrUiRiseOverWorld`). */
  private rise(): void {
    if (!this.headset) return
    const eyes = this.eyes()
    const rise = eyes == null ? 0 : xrUiRiseOverWorld(eyes.height, eyes.atEyeHeight)
    this.root.position = new Vector3(0, rise, 0)
  }

  /** One frame: the aim (which may change the phase) and then paint what is due. */
  update(delta: number): void {
    this.aim.actualizar()
    this.rise()
    const p = this.run
    const phase = p.gameState
    const lang = this.lang
    const asking = p.prompt != null

    this.menu.node.visible = phase === 'menu'
    if (phase === 'menu') {
      const state = this.menuState()
      const key = JSON.stringify(state)
      if (key !== this.paintedMenu) {
        this.menu.paint(state)
        this.paintedMenu = key
      }
    } else {
      this.paintedMenu = ''
      this.moreOptions = false
    }

    this.scoreboard.node.visible = phase !== 'menu'
    if (phase !== 'menu') {
      const state = this.scoreboardState()
      // It is only rewritten when it changes: redoing the labels every frame is the most expensive thing.
      const key = JSON.stringify(state)
      if (key !== this.paintedScoreboard) {
        this.scoreboard.paint(state)
        this.paintedScoreboard = key
      }
    } else this.paintedScoreboard = ''

    // The goal sign: what is due to be said and, on crossing a threshold, its celebration.
    this.crossedThreshold = this.sign.update(p.sign(lang), p.medal, lang, delta)

    const inRun = phase === 'playing' || phase === 'countdown'
    this.quit.node.visible = inRun
    this.finish.node.visible = p.endlessRun && phase === 'playing'
    this.notice.node.visible = asking
    if (asking && this.paintedNotice !== lang) {
      this.notice.write(lang)
      this.paintedNotice = lang
    }
    // With two players, at the end of each round: the notice to pass the controller or who wins.
    const duel = phase === 'finished' ? p.duel : null
    this.duel.node.visible = duel != null
    if (duel != null) {
      const summary = duelSummary(duel, getDuelTally(), lang)
      const key = JSON.stringify(summary)
      if (key !== this.paintedDuel) {
        this.duel.write(summary)
        this.paintedDuel = key
      }
    } else this.paintedDuel = ''
    this.count.show(phase === 'countdown' ? p.countdown : 0, delta)

    const shows = (this.headset || this.flatTutorial) && phase === 'playing'
    this.tutorial.update(shows ? p.tutorialStep : null, lang, p.bareHanded, delta)
    this.placeFlat()
  }

  /** When flat, each panel hung from the camera: it is only placed again when the phase changes. */
  private placeFlat(): void {
    const camera = this.camera
    if (this.headset || camera == null) return
    const finished = this.run.gameState === 'finished'
    if (this.flatPlaced === String(finished)) return
    this.flatPlaced = String(finished)
    const hang = (node: Node3D, placement: FlatPlacement, rise = 0) => {
      const [x, y, z] = placement.position
      const k = placement.scale
      node.global_transform = new Transform3D(camera.global_basis.scaled(new Vector3(k, k, k)), camera.to_global(new Vector3(x, y - rise * k, z)))
    }
    hang(this.menu.node, FLAT_PLACEMENTS.menu)
    // The end grows at the top: it is lowered by what it rises so that it stays in the middle.
    if (finished) hang(this.scoreboard.node, FLAT_PLACEMENTS.final, FINAL_RISE / 2)
    else hang(this.scoreboard.node, FLAT_PLACEMENTS.scoreboard)
    hang(this.quit.node, FLAT_PLACEMENTS.quit)
    hang(this.finish.node, FLAT_PLACEMENTS.finish)
    hang(this.notice.node, FLAT_PLACEMENTS.notice)
    hang(this.duel.node, FLAT_PLACEMENTS.duel)
    hang(this.count.node, FLAT_PLACEMENTS.count)
    // The sign carries its own scale (it grows and comes back when celebrating a threshold): it is hung and told.
    const sign = finished ? FLAT_PLACEMENTS.finalSign : FLAT_PLACEMENTS.sign
    hang(this.sign.node, { ...sign, scale: 1 })
    this.sign.setScale(sign.scale)
    hang(this.tutorial.view.nodo, FLAT_PLACEMENTS.tutorial)
  }

  /** Stops listening to what is saved: on leaving the scene. */
  release(): void {
    this.stopListening()
  }
}
