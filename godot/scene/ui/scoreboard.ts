/**
 * Stick Rush's scoreboard in Godot: the web's headset one (`XRHud.tsx`), below the hoop
 * (`XR_HUD_POSITION`) so as not to cross the falling sticks.
 *
 * The same as the web and in the same place: **one token per stick** —green, big and raised the
 * caught one; red, small and sunk the missed one; grey the one still in play (`stickStatuses`)—, **the
 * streak** in diamonds on top (up to five), **the points bar** that fills towards the maximum possible
 * of that run with **the record mark** on the track (`scoreRatio`; endless, the streak against the
 * best streak), and below **the lives** of the challenge or, when a level ends, **its stars**. At the end,
 * the panel grows and carries **repeat** and **back to menu**.
 *
 * **In the run that counts for a medal it keeps quiet about what the sign above already says**
 * (`ui/sign.ts`), as on the web: no bar, no lives and none of the type of the end, which the
 * sign says with what was missing; the tokens, the streak and, at the end, the buttons remain
 * (`xrHudLayout`).
 *
 * **Here there is type**, and it is the only difference on purpose: the web does not write in the headset because
 * drei's font does not pass its security policy, so it only tells the end with tokens and
 * bars. In the engine the type is home-made, and the end panel grows at the top to say how it has
 * ended and the points, with the same sentences as the web's end screen (`HUD.tsx`). Sharing
 * is not the game's: the hall offers it on the way back.
 */
import { Node3D, Vector3, type MeshInstance3D } from 'godot'

import { arcTriangles } from '@kit/lib/ui/icons'
import { Button } from '@kit/runtime/ui/button'
import { shape, paint } from '@kit/runtime/ui/mesh'
import { Panel } from '@kit/runtime/ui/panel'
import type { PointerAim } from '@kit/runtime/ui/pointerAim'
import { RENDER_ORDER } from '@kit/runtime/ui/text3d'

import type { Lang } from '@/lib/settings'
import { LIFE_COLOR, MAX_STICKS } from '@/lib/gameConfig'
import { CHALLENGE_LIVES, anotherOfMode, type GameMode } from '@/lib/gameMode'
import type { Stars } from '@/lib/levels'
import type { Player } from '@/lib/duel'
import type { StickStatus } from '@/lib/stickLayout'
import { formatFigure, translator } from '@/lib/textos'
import { XR_HOME_ICON } from '@/lib/xrIcons'
import { xrHudLayout } from '@/lib/xrLayout'

import { homeIcon, heartIcon, starIcon, playersIcon, repeatIcon, shapeHoles, rectangle } from './icons'
import { COLORS } from './menu'

/** The tokens of the sticks (`TOKEN_SPACING`, `TOKEN_RADIUS`, `TOKEN_STYLE` of `XRHud.tsx`). */
const TOKEN_SPACING = 0.07
const TOKEN_RADIUS = 0.026
const TOKEN_STYLE: Record<StickStatus, { color: string; scale: number; rise: number }> = {
  caught: { color: '#22c55e', scale: 1.15, rise: 0.012 },
  missed: { color: '#dc2626', scale: 0.7, rise: -0.012 },
  pending: { color: '#475569', scale: 0.9, rise: 0 },
}
/** Lives (`LIFE_SPACING`, `LIFE_SIZE`, `LIFE_ROW_Y`, `LIFE_SPENT_COLOR`). */
const LIFE_SPACING = 0.05
const LIFE_SIZE = 0.019
const LIFE_ROW_Y = -0.105
const LIFE_SPENT_COLOR = '#3f4a5a'
/** The buttons of the end and their labels (`BUTTON_SPACING`, `BUTTON_HIT`, `FINAL_LABELS`). */
const BUTTON_SPACING = 0.36
const BUTTON_HIT = { width: 0.15, height: 0.11 } as const
/** Under each plate, what it does: an icon alone is only guessed with the headset on. */
export const FINAL_LABELS = { width: 4 * BUTTON_SPACING, y: -0.08, maxWidth: 2 * BUTTON_SPACING - 0.04 } as const

/** How much the end panel grows at the top for the type: how it has ended and the points. */
export const FINAL_RISE = 0.12
/** At what size each thing of the end is written. */
export const SCOREBOARD_FONT = { title: 0.03, points: 0.05, label: 0.047 } as const

/** What the scoreboard shows. */
export interface ScoreboardState {
  lang: Lang
  /** The mode played: the repeat button says «Otro reto» in the challenge and «Otra partida» in the others. */
  mode: GameMode
  finished: boolean
  tokens: readonly StickStatus[]
  streak: number
  /** How full the bar is and where the record mark goes, from 0 to 1 (0: no mark). */
  fill: number
  mark: number
  record: boolean
  lives: number | null
  /** The stars of the finished level, or `null`. */
  stars: Stars | null
  /** At the end: how it has ended, already translated, and the points. */
  title: string
  points: number
  /** With two players, who holds the controller; alone, `null`. */
  player?: Player | null
  /** The sign above already says the points and the lives: they are not repeated here. */
  onSign?: boolean
}

/** The icon of who plays with two players: to the left of the lives, and how much the token of whoever plays grows. */
const PAIR = { x: -0.17, side: 0.011, grow: 1.3 } as const

export interface ScoreboardActions {
  repeat(): void
  backToMenu(): void
}

export class Scoreboard {
  readonly node: Node3D
  readonly panel: Panel
  readonly repeat: Button
  readonly menu: Button
  private readonly content: Node3D
  private readonly tokens: MeshInstance3D[] = []
  private readonly diamonds: MeshInstance3D[] = []
  private readonly track: MeshInstance3D
  private readonly fill: MeshInstance3D
  private readonly mark: MeshInstance3D
  private readonly hearts: MeshInstance3D[] = []
  private readonly stars: MeshInstance3D[] = []
  /** With two players, whose round it is: the table and the two tokens (`XRPlayersIcon` on the web's scoreboard). */
  readonly pair: Node3D
  private readonly pairTokens: MeshInstance3D[]
  private width = 0
  private height = 0

  constructor(actions: ScoreboardActions, aim: PointerAim) {
    // Opaque: translucent, in Godot it shows through much more than on the web (canvas at 0.72).
    this.panel = new Panel({ ancho: 1, alto: 1, fondo: COLORS.panel, opacidad: 1 })
    // Outside, the web's place; inside, the panel centred on its background, which is how the
    // instrument measures it: at the end it grows at the top and its centre rises.
    this.node = new Node3D()
    this.node.set_name('Scoreboard')
    this.node.add_child(this.panel.nodo)
    this.content = this.panel.nodo
    for (let i = 0; i < MAX_STICKS; i++) {
      const token = shape(arcTriangles(0, TOKEN_RADIUS, 0, Math.PI * 2, 20), TOKEN_STYLE.pending.color)
      this.content.add_child(token)
      this.tokens.push(token)
    }
    for (let i = 0; i < 5; i++) {
      const diamond = shape(
        [[0, -0.0085], [0.0085, 0], [0, 0.0085], [0, -0.0085], [0, 0.0085], [-0.0085, 0]],
        COLORS.star,
      )
      this.content.add_child(diamond)
      this.diamonds.push(diamond)
    }
    this.track = rectangle(1, 0.012, COLORS.chip, 0, 0, RENDER_ORDER.placa)
    this.fill = rectangle(1, 0.012, '#22c55e')
    this.mark = rectangle(0.005, 1, COLORS.star, 0, 0, RENDER_ORDER.texto)
    this.content.add_child(this.track)
    this.content.add_child(this.fill)
    this.content.add_child(this.mark)
    for (let i = 0; i < CHALLENGE_LIVES; i++) {
      const heart = heartIcon(LIFE_SIZE, LIFE_COLOR)
      this.content.add_child(heart)
      this.hearts.push(heart)
    }
    for (let i = 0; i < 3; i++) {
      const star = starIcon(0.02, COLORS.star)
      this.content.add_child(star)
      this.stars.push(star)
    }

    this.pair = new Node3D()
    this.content.add_child(this.pair)
    const [table, ...tokens] = playersIcon(PAIR.side, COLORS.dim, '#475569', '#475569')
    this.pair.add_child(table)
    for (const token of tokens) this.pair.add_child(token)
    this.pairTokens = tokens
    this.pair.visible = false

    this.repeat = this.panel.boton(new Button({ id: 'again', caja: { x: -BUTTON_SPACING, y: 0, ...BUTTON_HIT }, color: COLORS.play, alPulsar: () => actions.repeat() }))
    this.repeat.dibujo(repeatIcon(0.026, '#ffffff'), '#ffffff')
    this.menu = this.panel.boton(new Button({ id: 'home', caja: { x: BUTTON_SPACING, y: 0, ...BUTTON_HIT }, color: COLORS.neutral, alPulsar: () => actions.backToMenu() }))
    this.menu.dibujo(homeIcon(0.028, '#ffffff'), '#ffffff')
    const door = shapeHoles(XR_HOME_ICON, 0.028, COLORS.neutral)
    if (door != null) this.menu.dibujo(door, COLORS.neutral)
    aim.anadir(this.repeat, this.menu)
  }

  /** What the panel measures now. */
  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height }
  }

  /** Paints a state: the panel at its size, each token, the bar, the lives and, at the end, the type. */
  paint(state: ScoreboardState): void {
    const n = state.tokens.length
    const width = Math.max(n - 1, 0) * TOKEN_SPACING
    const finished = state.finished
    const onSign = state.onSign === true
    const lives = onSign ? null : state.lives
    const withRow = lives != null || state.stars != null
    this.width = Math.max(width + 0.2, finished ? FINAL_LABELS.width + 0.06 : 0)
    // The web's panel, and at the end what it grows at the top for the type. With the sign above
    // it does not grow: above is the sign, which is the one that says how it has ended.
    const layout = xrHudLayout({ finished, row: withRow, sign: onSign })
    const rise = finished && !onSign ? FINAL_RISE : 0
    this.height = layout.height + rise
    const centre = layout.centre + rise / 2
    this.panel.nodo.position = new Vector3(0, centre, 0)
    this.panel.fondo!.scale = new Vector3(this.width, this.height, 1)
    // The measurements of the content are the web's (its group at 0.1 at the end and at 0.04 while playing), from
    // the scoreboard's place: inside the panel, minus what its centre has risen.
    const y0 = layout.content - centre

    this.tokens.forEach((token, i) => {
      const stickStatus = state.tokens[i]
      token.visible = stickStatus != null
      if (stickStatus == null) return
      const style = TOKEN_STYLE[stickStatus]
      token.position = new Vector3(i * TOKEN_SPACING - width / 2, y0 + style.rise, 0.004)
      token.scale = new Vector3(style.scale, style.scale, 1)
      paint(token, style.color)
    })
    const diamonds = Math.min(state.streak, 5)
    this.diamonds.forEach((diamond, i) => {
      diamond.visible = diamonds >= 2 && i < diamonds
      diamond.position = new Vector3((i - (diamonds - 1) / 2) * 0.026, y0 + 0.06, 0.004)
    })
    const track = Math.max(width, 0.28)
    const barY = y0 - 0.055
    this.track.visible = !onSign
    this.fill.visible = !onSign
    this.track.scale = new Vector3(track, 1, 1)
    this.track.position = new Vector3(0, barY, 0.004)
    const filled = Math.max(track * state.fill, 0.001)
    this.fill.scale = new Vector3(filled, 1, 1)
    this.fill.position = new Vector3((filled - track) / 2, barY, 0.006)
    paint(this.fill, state.record ? COLORS.star : '#22c55e')
    this.mark.visible = state.mark > 0 && !onSign
    this.mark.scale = new Vector3(1, state.record ? 0.034 : 0.024, 1)
    this.mark.position = new Vector3(track * (state.mark - 0.5), barY, 0.008)

    this.hearts.forEach((heart, i) => {
      heart.visible = lives != null
      const spent = lives != null && i >= lives
      const k = spent ? 0.62 : 1
      heart.scale = new Vector3(k, k, 1)
      heart.position = new Vector3(i * LIFE_SPACING - ((CHALLENGE_LIVES - 1) * LIFE_SPACING) / 2, y0 + LIFE_ROW_Y, 0.004)
      paint(heart, spent ? LIFE_SPENT_COLOR : LIFE_COLOR)
    })
    this.stars.forEach((star, i) => {
      star.visible = state.stars != null
      const earned = state.stars != null && i < state.stars
      const k = earned ? 1 : 0.7
      star.scale = new Vector3(k, k, 1)
      star.position = new Vector3((i - 1) * 0.045, y0 + LIFE_ROW_Y, 0.004)
      paint(star, earned ? COLORS.star : COLORS.spentStar)
    })

    // With two players, whose round it is: the token of whoever holds the controller, lit and grown.
    const player = state.player ?? null
    this.pair.visible = player != null
    this.pair.position = new Vector3(PAIR.x, y0 + LIFE_ROW_Y, 0.004)
    this.pairTokens.forEach((token, i) => {
      const theirs = i === player
      const k = theirs ? PAIR.grow : 1
      token.scale = new Vector3(k, k, 1)
      paint(token, theirs ? '#22c55e' : '#475569')
    })

    // At the end: repeat and back to menu, in their web row (0.12 below its measurement).
    this.repeat.nodo.visible = finished
    this.menu.nodo.visible = finished
    this.repeat.nodo.position = new Vector3(-BUTTON_SPACING, -0.12 - centre, 0.02)
    this.menu.nodo.position = new Vector3(BUTTON_SPACING, -0.12 - centre, 0.02)

    const { panel } = this
    panel.borrarTextos()
    if (finished) {
      // The labels of the buttons, as on the web (`drawFinalLabels`).
      const t = translator(state.lang)
      const y = -0.12 - centre + FINAL_LABELS.y
      const font = { alto: SCOREBOARD_FONT.label, color: COLORS.light, anchoMax: FINAL_LABELS.maxWidth }
      panel.escribir(t(anotherOfMode(state.mode)), -BUTTON_SPACING, y, font)
      panel.escribir(t('Menu'), BUTTON_SPACING, y, font)
    }
    if (!finished || onSign) return
    const top = this.height / 2
    panel.escribir(state.title, 0, top - 0.04, { alto: SCOREBOARD_FONT.title, color: COLORS.light, anchoMax: this.width - 0.04 })
    panel.escribir(formatFigure(state.points, state.lang), 0, top - 0.09, {
      alto: SCOREBOARD_FONT.points,
      color: state.record ? COLORS.star : COLORS.light,
      anchoMax: this.width - 0.06,
    })
  }
}
