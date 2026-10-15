/**
 * Stick Rush's menu in Godot: the web's headset panel (`XRMenu.tsx`), with the layout of
 * `lib/xrLayout.ts` without touching a measurement and the kit's buttons.
 *
 * The same as the web and in the same place:
 *
 * - **at the top**, the hoop: lower it, the gauge of how much travel is left and raise it, with the button to
 *   watch the tutorial again in the left corner;
 * - **the mode first**, which decides whether there is anything else to ask: with the hearts dark in
 *   practice, lit in the challenge and the stars in the levels; the round or endless, only in
 *   practice; **against whom, only in the challenge**, in the same slot —a single token or two
 *   facing each other, the siblings' icon—; and what is seen around, the square or your room (dark
 *   without augmented reality);
 * - **only practice asks** how many sticks —thirteen sticks in miniature, lit up to the
 *   chosen one— and at what speed —five chips with bars that grow, from green to red—; in the
 *   levels, the row of the sticks is the ladder, with its stars, and the speed is seen dark;
 *   the challenge is fixed and it is just pressing play;
 * - **at the bottom**, play in the middle and **exit in the bottom right corner**, the one of the sixteen
 *   (`exitCorner.ts`).
 *
 * What is neither the mode nor who plays is folded behind **«Más opciones»**, in the bottom left
 * corner, as on the web (`gameMenu.ts`): it opens folded and with the challenge there is no button.
 *
 * On top, in type, the names of the rows, the explanation of the mode and the name of «Más opciones»
 * (the web's `drawNames`, `MENU_LABELS`, `MENU_TEXT`, `HINT_Y`). Neither the web nor Godot carries
 * the mute and music buttons, which are the hall's volumes. The rest goes without type,
 * as on the web: each setting is said with what it means.
 *
 * Everything written is noted in `panel.escritos` to measure it with the web's instrument
 * (`ui.engine.test.ts`).
 */
import { Vector3, type MeshInstance3D, type Node3D } from 'godot'

import { piezasDelMando } from '@kit/lib/ui/tutorial'
import { Button } from '@kit/runtime/ui/button'
import { exitButton } from '@kit/runtime/ui/icons'
import { shape } from '@kit/runtime/ui/mesh'
import { Panel } from '@kit/runtime/ui/panel'
import { RENDER_ORDER } from '@kit/runtime/ui/text3d'
import type { PointerAim } from '@kit/runtime/ui/pointerAim'

import type { Lang } from '@/lib/settings'
import {
  DIFFICULTY_COLORS,
  DIFFICULTY_ORDER,
  LIFE_COLOR,
  MAX_STICKS,
  MIN_STICKS,
  STICK_COLOR,
  type Difficulty,
} from '@/lib/gameConfig'
import { CHALLENGE_LIVES, GAME_MODE_HINTS, type GameMode } from '@/lib/gameMode'
import { PLAYER_COUNT_HINTS, playsAsDuel, type PlayerCount } from '@/lib/duel'
import { optionsButton, isShown, type MenuRow } from '@/lib/gameMenu'
import { HOOP_ADJUST_RANGE } from '@/lib/hoopHeight'
import { LEVEL_COUNT, type Stars } from '@/lib/levels'
import { translator } from '@/lib/textos'
import { gameName } from '@/lib/menuTemplate'
import {
  MENU_PANEL,
  MENU_TEXT,
  MENU_TITLE,
  OPTIONS_WIDTH,
  HINT_WIDTH,
  HINT_Y,
  ROW_LABEL_RISE,
  XR_DIFFICULTY_ROW_Y,
  XR_DIFFICULTY_SPACING,
  XR_HOOP_GAUGE_OFFSET,
  XR_LEVEL_PICKER_SPACING,
  XR_MENU_HIT,
  XR_MENU_PLAY_HIT,
  XR_MENU_SPOT,
  XR_ROW_HIT_HEIGHT,
  XR_SCENERY_PICKER_OFFSET,
  XR_STICK_PICKER_SPACING,
  XR_STICK_ROW_Y,
  menuLabelsFor,
  menuLabelText,
  type Vec3,
} from '@/lib/xrLayout'

import {
  heartIcon,
  sceneryIcon,
  starIcon,
  arrowIcon,
  roomIcon,
  playersIcon,
  rectangle,
  endlessRingTriangles,
} from './icons'

/** What the plate of the menu takes up (`MENU_PANEL` of `xrLayout.ts`). */
export { MENU_PANEL }

/** The colours of `XRUi.tsx` and `XRMenu.tsx`. */
export const COLORS = {
  panel: '#0f1f2b',
  chip: '#1c2634',
  unlit: '#3d4654',
  dim: '#94a3b8',
  light: '#e2e8f0',
  star: '#fbbf24',
  spentStar: '#3f4a5a',
  blue: '#1d4ed8',
  challengeBackground: '#4c1d24',
  levelsBackground: '#3b2f0b',
  play: '#15803d',
  neutral: '#334155',
  grey: '#64748b',
  unlitHeart: '#55606f',
} as const

/** Height of the hoop gauge and the travel of its mark (`HOOP_GAUGE_HEIGHT`, `HOOP_GAUGE_TRAVEL`). */
const HOOP_GAUGE_HEIGHT = 0.085
const HOOP_GAUGE_TRAVEL = HOOP_GAUGE_HEIGHT / 2 - 0.014
/** Spacing and size of the hearts of the mode (`MODE_HEART_SPACING`, `MODE_HEART_SIZE`). */
const MODE_HEART_SPACING = 0.045
const MODE_HEART_SIZE = 0.016

/** What the menu shows: what is chosen and what is saved. */
export interface MenuState {
  lang: Lang
  mode: GameMode
  difficulty: Difficulty
  sticks: number
  endless: boolean
  /** The level that would be played and up to which one is unlocked. */
  level: number
  unlocked: number
  stars: readonly Stars[]
  /** The correction of the hoop's height, in metres. */
  hoopAdjustment: number
  /** Whether the headset gives the room: without it, the button goes dark. */
  room: boolean
  /** What is seen around. */
  scenery: 'scene' | 'passthrough'
  /** How many play: it only counts in the challenge (`playsAsDuel`). */
  players: PlayerCount
  /** Whether what is folded behind «Más opciones» has been asked for. It belongs to the ui: it opens folded. */
  moreOptions: boolean
}

export interface MenuActions {
  nextMode(): void
  chooseDifficulty(difficulty: Difficulty): void
  chooseSticks(sticks: number): void
  toggleEndless(): void
  /** Alone, or with two players passing the controller. */
  togglePlayers(): void
  /** Unfolds what is folded behind «Más opciones», or folds it again. */
  toggleOptions(): void
  chooseLevel(level: number): void
  chooseScenery(scenery: 'scene' | 'passthrough'): void
  /** +1 raises the hoop one step; −1 lowers it. */
  moveHoop(steps: 1 | -1): void
  watchTutorial(): void
  play(): void
  exit(): void
}

/** A web button box (place and size of its hit area), in panel coordinates. */
function boxOf(place: Vec3 | readonly [number, number], size: readonly [number, number, ...number[]]) {
  return { x: place[0], y: place[1], width: size[0], height: size[1] }
}

export class GameMenu {
  readonly panel: Panel
  readonly node: Node3D
  readonly buttons = new Map<string, Button>()
  private readonly plates = new Map<string, MeshInstance3D>()
  private readonly sticks: MeshInstance3D[] = []
  private readonly levelStars: MeshInstance3D[][] = []
  private readonly bars = new Map<Difficulty, MeshInstance3D[]>()
  private readonly hearts: MeshInstance3D[] = []
  private readonly modeStars: MeshInstance3D[] = []
  private readonly hoopRail: MeshInstance3D
  private readonly fullRing: MeshInstance3D
  private readonly halfRing: MeshInstance3D
  private readonly hoopMark: MeshInstance3D
  private readonly sceneryIcons = new Map<string, MeshInstance3D>()
  /** The icon of against whom: the table, the token on this side and the one opposite (two players only). */
  private readonly pair: MeshInstance3D[]

  constructor(actions: MenuActions, aim: PointerAim) {
    this.panel = new Panel({ ancho: MENU_PANEL[0], alto: MENU_PANEL[1], fondo: COLORS.panel, opacidad: 1 })
    this.node = this.panel.nodo

    // The hoop: lower, the gauge and raise.
    for (const [id, up] of [['hoopDown', false], ['hoopUp', true]] as const) {
      const b = this.add(id, boxOf(XR_MENU_SPOT[id], XR_MENU_HIT[id]), () => actions.moveHoop(up ? 1 : -1))
      this.plate(b, id, 0.1, 0.085, COLORS.chip)
      b.dibujo(arrowIcon(0.026, up ? 'up' : 'down', '#ffffff'), '#ffffff')
    }
    const [gx, gy] = XR_HOOP_GAUGE_OFFSET
    this.hoopRail = rectangle(0.012, HOOP_GAUGE_HEIGHT, COLORS.chip, gx, gy)
    this.hoopRail.position = new Vector3(0, 0, 0.004)
    this.node.add_child(this.hoopRail)
    this.hoopMark = rectangle(0.05, 0.009, STICK_COLOR)
    this.node.add_child(this.hoopMark)

    // Watch the tutorial again: the controller in miniature, still.
    const tutorial = this.add('tutorial', boxOf(XR_MENU_SPOT.tutorial, XR_MENU_HIT.tutorial), () => actions.watchTutorial())
    this.plate(tutorial, 'tutorial', 0.11, 0.095, COLORS.neutral)
    for (const piece of piezasDelMando(null, 0.075)) tutorial.dibujo(shape(piece.triangulos, COLORS.light), COLORS.light)

    // The mode, with what it puts at stake.
    const mode = this.add('mode', boxOf(XR_MENU_SPOT.mode, XR_MENU_HIT.mode), () => actions.nextMode())
    this.plate(mode, 'mode', 0.17, 0.1, COLORS.chip)
    const width = (CHALLENGE_LIVES - 1) * MODE_HEART_SPACING
    for (let i = 0; i < CHALLENGE_LIVES; i++) {
      const heart = mode.dibujo(heartIcon(MODE_HEART_SIZE, LIFE_COLOR), LIFE_COLOR)
      heart.position = new Vector3(i * MODE_HEART_SPACING - width / 2, 0, 0.004)
      this.hearts.push(heart)
      const star = mode.dibujo(starIcon(0.016, COLORS.star), COLORS.star)
      star.position = new Vector3((i - 1) * MODE_HEART_SPACING, 0, 0.004)
      this.modeStars.push(star)
    }

    // Round or endless, only in practice.
    const endless = this.add('endless', boxOf(XR_MENU_SPOT.endless, XR_MENU_HIT.endless), () => actions.toggleEndless())
    this.plate(endless, 'endless', 0.13, 0.1, COLORS.chip)
    this.fullRing = endless.dibujo(shape(endlessRingTriangles(true), '#ffffff'), '#ffffff')
    this.halfRing = endless.dibujo(shape(endlessRingTriangles(false), COLORS.grey), COLORS.grey)

    // Against whom, only in the challenge: in the slot of endless, with its same box.
    const players = this.add('players', boxOf(XR_MENU_SPOT.endless, XR_MENU_HIT.endless), () => actions.togglePlayers())
    this.plate(players, 'players', 0.13, 0.1, COLORS.chip)
    this.pair = playersIcon(0.016, '#ffffff', '#ffffff', '#ffffff').map((part) => {
      players.dibujo(part, '#ffffff')
      return part
    })

    // The square or your room.
    for (const [i, scenery] of (['scene', 'passthrough'] as const).entries()) {
      const [sx, sy] = XR_SCENERY_PICKER_OFFSET
      const id = `scenery:${scenery}`
      const b = this.add(id, { x: sx + i * 0.15 - 0.075, y: sy, width: 0.14, height: 0.12 }, () => actions.chooseScenery(scenery))
      this.plate(b, id, 0.12, 0.1, COLORS.chip)
      const icon = scenery === 'scene' ? sceneryIcon(0.028, '#ffffff') : roomIcon(0.028, '#ffffff')
      this.sceneryIcons.set(id, b.dibujo(icon, '#ffffff'))
    }

    // The sticks: thirteen in miniature, lit up to the chosen one.
    const sticksWidth = (MAX_STICKS - 1) * XR_STICK_PICKER_SPACING
    for (let i = 0; i < MAX_STICKS; i++) {
      const howMany = i + 1
      const b = this.add(
        `sticks:${howMany}`,
        { x: i * XR_STICK_PICKER_SPACING - sticksWidth / 2, y: XR_STICK_ROW_Y, width: XR_STICK_PICKER_SPACING, height: XR_ROW_HIT_HEIGHT.sticks },
        () => actions.chooseSticks(howMany),
      )
      this.sticks.push(b.dibujo(rectangle(0.016, 0.11, STICK_COLOR), STICK_COLOR))
    }

    // The ladder of the levels, in the row of the sticks, with its stars on top.
    const levelsWidth = (LEVEL_COUNT - 1) * XR_LEVEL_PICKER_SPACING
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const level = i + 1
      const id = `level:${level}`
      const b = this.add(
        id,
        { x: i * XR_LEVEL_PICKER_SPACING - levelsWidth / 2, y: XR_STICK_ROW_Y, width: XR_LEVEL_PICKER_SPACING, height: XR_ROW_HIT_HEIGHT.sticks },
        () => actions.chooseLevel(level),
      )
      this.plates.set(id, b.dibujo(rectangle(0.03, 0.05, COLORS.unlit, 0, -0.02), COLORS.unlit, 1, { prioridad: RENDER_ORDER.placa }))
      const itsStars: MeshInstance3D[] = []
      for (let s = 0; s < 3; s++) itsStars.push(b.dibujo(rectangle(0.014, 0.008, COLORS.spentStar, 0, 0.03 + s * 0.016), COLORS.spentStar))
      this.levelStars.push(itsStars)
    }

    // The speed: five chips with bars that grow.
    const speedsWidth = (DIFFICULTY_ORDER.length - 1) * XR_DIFFICULTY_SPACING
    DIFFICULTY_ORDER.forEach((difficulty, i) => {
      const id = `difficulty:${difficulty}`
      const b = this.add(
        id,
        { x: i * XR_DIFFICULTY_SPACING - speedsWidth / 2, y: XR_DIFFICULTY_ROW_Y, width: XR_DIFFICULTY_SPACING * 0.92, height: XR_ROW_HIT_HEIGHT.difficulty },
        () => actions.chooseDifficulty(difficulty),
      )
      this.plate(b, id, XR_DIFFICULTY_SPACING * 0.82, 0.13, COLORS.chip)
      const bars: MeshInstance3D[] = []
      for (let bar = 0; bar <= i; bar++) {
        const height = 0.028 + bar * 0.017
        const part = b.dibujo(rectangle(0.013, height, DIFFICULTY_COLORS[difficulty], (bar - i / 2) * 0.022, -0.04 + height / 2), DIFFICULTY_COLORS[difficulty])
        bars.push(part)
      }
      this.bars.set(difficulty, bars)
    })

    // «Más opciones», in the corner opposite the exit one: its name is written on top.
    const options = this.add('options', boxOf(XR_MENU_SPOT.options, XR_MENU_HIT.options), () => actions.toggleOptions())
    this.plate(options, 'options', OPTIONS_WIDTH, 0.1, COLORS.neutral)

    // Play, and exit in the corner.
    const play = this.add('play', boxOf(XR_MENU_SPOT.play, XR_MENU_PLAY_HIT), () => actions.play())
    this.plate(play, 'play', 0.32, 0.1, COLORS.play)
    play.dibujo(arrowIcon(0.032, 'right', '#ffffff'), '#ffffff')
    const exit = exitButton({
      caja: boxOf(XR_MENU_SPOT.exit, XR_MENU_HIT.exit),
      color: COLORS.neutral,
      opacidad: 1,
      flecha: COLORS.light,
      id: 'exit',
      alPulsar: () => actions.exit(),
    })
    this.panel.boton(exit)
    this.buttons.set('exit', exit)

    aim.anadir(...this.buttons.values())
  }

  /** A button with the web's hit area and the plate transparent: what is seen is its drawing. */
  private add(id: string, area: { x: number; y: number; width: number; height: number }, onPress: () => void): Button {
    const button = new Button({ id, caja: area, color: COLORS.panel, opacidad: 0, alPulsar: onPress })
    this.panel.boton(button)
    this.buttons.set(id, button)
    return button
  }

  /** The web's plate, smaller than its hit area, as a drawing of the button, underneath the others. */
  private plate(button: Button, id: string, width: number, height: number, color: string): void {
    const plate = button.dibujo(rectangle(width, height, color), color, 1, { prioridad: RENDER_ORDER.placa })
    this.plates.set(id, plate)
  }

  button(id: string): Button {
    return this.buttons.get(id)!
  }

  /** Paints a state: which rows are seen, what is chosen, what goes dark and what is written. */
  paint(state: MenuState): void {
    const levels = state.mode === 'levels'
    const challenge = state.mode === 'challenge'
    // What is seen with the mode and the folding of now (`gameMenu.ts`), as on the web.
    const shows = (row: MenuRow) => isShown(row, state.mode, 'headset', state.moreOptions)
    const practice = shows('sticks')

    // «Más opciones»: with the challenge it is not there; unfolded, the plate lights up.
    const options = this.button('options')
    options.nodo.visible = optionsButton(state.mode, 'headset', state.moreOptions) != null
    options.colorDelDibujo(this.plates.get('options')!, state.moreOptions ? COLORS.blue : COLORS.neutral)

    // The hoop: at the limits, its button goes dark; the mark says how much is left.
    for (const id of ['hoopDown', 'hoopUp']) this.button(id).nodo.visible = shows('hoop')
    this.hoopRail.visible = shows('hoop')
    this.hoopMark.visible = shows('hoop')
    this.button('hoopDown').apagado = state.hoopAdjustment <= -HOOP_ADJUST_RANGE
    this.button('hoopUp').apagado = state.hoopAdjustment >= HOOP_ADJUST_RANGE
    const [gx, gy] = XR_HOOP_GAUGE_OFFSET
    this.hoopMark.position = new Vector3(gx, gy + (state.hoopAdjustment / HOOP_ADJUST_RANGE) * HOOP_GAUGE_TRAVEL, 0.006)

    // The mode.
    const mode = this.button('mode')
    mode.colorDelDibujo(this.plates.get('mode')!, challenge ? COLORS.challengeBackground : levels ? COLORS.levelsBackground : COLORS.chip)
    for (const [i, heart] of this.hearts.entries()) {
      heart.visible = !levels
      const k = challenge ? 1 : 0.75
      heart.scale = new Vector3(k, k, 1)
      mode.colorDelDibujo(heart, challenge ? LIFE_COLOR : COLORS.unlitHeart)
      this.modeStars[i].visible = levels
    }

    // Round or endless.
    const endless = this.button('endless')
    endless.nodo.visible = shows('endless')
    endless.colorDelDibujo(this.plates.get('endless')!, state.endless ? COLORS.blue : COLORS.chip)
    this.fullRing.visible = state.endless
    this.halfRing.visible = !state.endless

    // Against whom: with two players, the plate lights up as well as the second token coming out.
    const players = this.button('players')
    const twoPlayers = state.players === 2
    players.nodo.visible = shows('players')
    players.colorDelDibujo(this.plates.get('players')!, twoPlayers ? COLORS.play : COLORS.chip)
    this.pair.forEach((part, i) => {
      players.colorDelDibujo(part, twoPlayers ? '#ffffff' : COLORS.dim)
      if (i === 2) part.visible = twoPlayers
    })

    // Around.
    for (const scenery of ['scene', 'passthrough'] as const) {
      const id = `scenery:${scenery}`
      const b = this.button(id)
      b.nodo.visible = shows('around')
      const chosen = state.scenery === scenery
      const without = scenery === 'passthrough' && !state.room
      // Really off without augmented reality: by opacity and by colour, not only by colour.
      b.apagado = without
      b.colorDelDibujo(this.plates.get(id)!, chosen ? COLORS.blue : COLORS.chip)
      b.colorDelDibujo(this.sceneryIcons.get(id)!, without ? COLORS.grey : '#ffffff')
      // What is chosen comes out towards the viewer, as on the web (`position` with the `z` of what is chosen).
      b.adelanto = chosen ? 0.02 : 0
    }

    // The sticks, only in practice.
    this.sticks.forEach((stick, i) => {
      const howMany = i + 1
      const b = this.button(`sticks:${howMany}`)
      b.nodo.visible = practice
      b.apagado = howMany < MIN_STICKS
      const lit = howMany <= state.sticks
      stick.scale = new Vector3(1, lit ? 1 : 0.075 / 0.11, 1)
      stick.position = new Vector3(0, lit ? 0.008 : 0, stick.position.z)
      b.colorDelDibujo(stick, lit ? STICK_COLOR : COLORS.unlit)
    })

    // The ladder, only in the levels.
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const level = i + 1
      const b = this.button(`level:${level}`)
      b.nodo.visible = levels
      const locked = level > state.unlocked
      const chosen = level === state.level
      b.apagado = locked
      const cell = this.plates.get(`level:${level}`)!
      cell.scale = new Vector3(1, chosen ? 0.07 / 0.05 : 1, 1)
      b.colorDelDibujo(cell, chosen ? STICK_COLOR : locked ? COLORS.chip : COLORS.unlit)
      // What is chosen comes out towards the viewer, as on the web (`position` with the `z` of what is chosen).
      b.adelanto = chosen ? 0.02 : 0
      const earned = state.stars[i] ?? 0
      this.levelStars[i].forEach((star, s) => {
        star.visible = !locked
        b.colorDelDibujo(star, s < earned ? COLORS.star : COLORS.spentStar)
      })
    }

    // The speed: in practice it is chosen; in the levels the level's one is seen dark.
    for (const difficulty of DIFFICULTY_ORDER) {
      const b = this.button(`difficulty:${difficulty}`)
      b.nodo.visible = shows('speed') || levels
      const chosen = difficulty === state.difficulty
      b.apagado = levels && !chosen
      b.colorDelDibujo(this.plates.get(`difficulty:${difficulty}`)!, chosen ? DIFFICULTY_COLORS[difficulty] : COLORS.chip)
      for (const bar of this.bars.get(difficulty)!) b.colorDelDibujo(bar, chosen ? '#ffffff' : DIFFICULTY_COLORS[difficulty])
      b.adelanto = chosen ? 0.022 : 0
    }

    this.write(state)
  }

  /** The names of the rows and the explanation of the mode: the web's `drawNames`. */
  private write(state: MenuState): void {
    const t = translator(state.lang)
    const { panel } = this
    panel.borrarTextos()
    // The name of the cabinet, at the top left: a proper name, untranslated.
    panel.escribir(gameName(), MENU_TITLE.x, MENU_TITLE.y, {
      alto: MENU_TEXT.title,
      color: '#ffffff',
      alinear: 'left',
      anchoMax: MENU_TITLE.width,
    })
    for (const { text, x, y } of menuLabelsFor(state.mode, state.moreOptions)) {
      // The row of the mode says «Modo» and which one is chosen: «Modo: Reto».
      panel.escribir(menuLabelText(text, state.mode, t), x, y + ROW_LABEL_RISE, { alto: MENU_TEXT.label, color: COLORS.dim, anchoMax: 0.3 })
    }
    // With two players, the explanation is that of the two-player run: the mode is already said by its switch.
    const hint = playsAsDuel(state.mode, state.players) ? PLAYER_COUNT_HINTS[2] : GAME_MODE_HINTS[state.mode]
    panel.parrafo(t(hint), 0, HINT_Y, {
      alto: MENU_TEXT.hint,
      color: COLORS.dim,
      anchoMax: HINT_WIDTH,
      ancla: 'top',
    })
    // The name of «Más opciones», on its plate and in two lines, at the type size of the explanation.
    const options = optionsButton(state.mode, 'headset', state.moreOptions)
    if (options != null) {
      const [ox, oy] = XR_MENU_SPOT.options
      panel.parrafo(t(options), ox, oy, { alto: MENU_TEXT.hint, color: '#ffffff', anchoMax: OPTIONS_WIDTH, interlineado: 1.15 })
    }
  }
}
