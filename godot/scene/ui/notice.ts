/**
 * What is pressed and read during the run, outside the scoreboard: the back-to-menu button, the one
 * that ends the endless run, the notice that asks before leaving it and the countdown. The web's
 * (`XRQuitButton`, `XRQuitConfirm` of `XRHud.tsx` and `XRCountdown.tsx`), with its measurements:
 *
 * - **Back to menu goes at the top left** (`XR_QUIT_POSITION`), turned towards the player
 *   (`XR_QUIT_YAW`): at chest height it fell where the hand goes for a stick. Also during
 *   the countdown, which is the last chance to change options.
 * - **Ending the endless run**, at the opposite end (`XR_END_RUN_POSITION`): they are the two
 *   ways out of the run and one on each side cannot be confused.
 * - **You do not leave all at once**: leaving loses what was done. The run stops and the question
 *   is asked in front, at eye level; while it is asked no stick falls. Keep playing goes on the right
 *   and bigger: it is the answer that loses nothing.
 * - **The countdown, without figures** like the web: one ring per second that goes dark, and the one
 *   about to fall beats.
 * - **With two players, the end of each round** (`DuelPanel`): the notice to pass the controller or who wins.
 */
import { Node3D, Vector3, type MeshInstance3D } from 'godot'

import { arcTriangles } from '@kit/lib/ui/icons'
import { Button } from '@kit/runtime/ui/button'
import { shape, paint } from '@kit/runtime/ui/mesh'
import { Panel } from '@kit/runtime/ui/panel'
import type { PointerAim } from '@kit/runtime/ui/pointerAim'
import { RENDER_ORDER } from '@kit/runtime/ui/text3d'

import type { Lang } from '@/lib/settings'
import { LIFE_COLOR } from '@/lib/gameConfig'
import { translator } from '@/lib/textos'
import { XR_HOME_ICON } from '@/lib/xrIcons'
import type { DuelSummary } from '@/lib/duel'
import {
  CONFIRM_BOXES,
  CONFIRM_TEXT,
  DUEL_TEXT,
  XR_CONFIRM_SIZE,
  XR_DUEL_SIZE,
  XR_END_RUN_POSITION,
  XR_END_RUN_YAW,
  XR_QUIT_POSITION,
  XR_QUIT_YAW,
  type Vec3,
} from '@/lib/xrLayout'

import { COUNTDOWN_SECONDS } from '../game/run'
import { shapeHoles, homeIcon, checkIcon } from './icons'
import { COLORS } from './menu'

/** A loose button, which hangs from no panel, in its place in the ui and turned towards the player. */
function looseButton(id: string, place: Vec3, turn: number, color: string, onPress: () => void): Button {
  const button = new Button({ id, caja: { x: 0, y: 0, width: 0.16, height: 0.14 }, z: 0, color, opacidad: 0, alPulsar: onPress })
  button.nodo.position = new Vector3(...place)
  button.nodo.rotation = new Vector3(0, turn, 0)
  return button
}

/** The web's plate (0.12 × 0.1), smaller than the hit area: what is seen of the button. */
function plate(color: string): MeshInstance3D {
  return shape([[-0.06, -0.05], [0.06, -0.05], [0.06, 0.05], [-0.06, -0.05], [0.06, 0.05], [-0.06, 0.05]], color)
}

export class QuitButton {
  readonly button: Button
  constructor(onPress: () => void, aim: PointerAim) {
    this.button = looseButton('quit', XR_QUIT_POSITION, XR_QUIT_YAW, COLORS.neutral, onPress)
    this.button.dibujo(plate(COLORS.neutral), COLORS.neutral, 1, { prioridad: RENDER_ORDER.placa })
    this.button.dibujo(homeIcon(0.028, '#ffffff'), '#ffffff')
    const door = shapeHoles(XR_HOME_ICON, 0.028, COLORS.neutral)
    if (door != null) this.button.dibujo(door, COLORS.neutral)
    aim.anadir(this.button)
  }

  get node(): Node3D {
    return this.button.nodo
  }
}

export class FinishButton {
  readonly button: Button
  constructor(onPress: () => void, aim: PointerAim) {
    this.button = looseButton('end-run', XR_END_RUN_POSITION, XR_END_RUN_YAW, COLORS.play, onPress)
    this.button.dibujo(plate(COLORS.play), COLORS.play, 1, { prioridad: RENDER_ORDER.placa })
    this.button.dibujo(checkIcon(0.028, '#ffffff'), '#ffffff')
    aim.anadir(this.button)
  }

  get node(): Node3D {
    return this.button.nodo
  }
}

export class QuitNotice {
  readonly panel: Panel
  readonly node: Node3D
  readonly leave: Button
  readonly keepGoing: Button

  constructor(actions: { leave(): void; keepGoing(): void }, aim: PointerAim) {
    this.panel = new Panel({ ancho: XR_CONFIRM_SIZE[0], alto: XR_CONFIRM_SIZE[1], fondo: COLORS.panel, opacidad: 1 })
    this.node = this.panel.nodo
    const boxOf = (box: { position: Vec3; size: Vec3 }) => ({ x: box.position[0], y: box.position[1], width: box.size[0], height: box.size[1] })
    this.leave = this.panel.boton(new Button({ id: 'confirm:leave', caja: boxOf(CONFIRM_BOXES.leave), color: COLORS.chip, alPulsar: () => actions.leave() }))
    this.keepGoing = this.panel.boton(new Button({ id: 'confirm:stay', caja: boxOf(CONFIRM_BOXES.stay), color: LIFE_COLOR, alPulsar: () => actions.keepGoing() }))
    aim.anadir(this.leave, this.keepGoing)
    this.node.visible = false
  }

  /** Writes it in a language: the web's `drawNotice`. */
  write(lang: Lang): void {
    const t = translator(lang)
    const { panel } = this
    const width = XR_CONFIRM_SIZE[0] - 0.08
    panel.borrarTextos()
    panel.parrafo(t('Leave the game?'), 0, 0.1, { alto: CONFIRM_TEXT.title, color: COLORS.light, anchoMax: width })
    panel.parrafo(t('You lose what you have got so far.'), 0, 0.02, { alto: CONFIRM_TEXT.body, color: COLORS.dim, anchoMax: width })
    panel.escribir(t('Leave'), this.leave.caja.x, this.leave.caja.y, {
      alto: CONFIRM_TEXT.button,
      color: COLORS.light,
      anchoMax: this.leave.caja.width - 0.03,
      en: this.leave,
    })
    panel.escribir(t('Keep playing'), this.keepGoing.caja.x, this.keepGoing.caja.y, {
      alto: CONFIRM_TEXT.button,
      color: '#3b1d00',
      anchoMax: this.keepGoing.caja.width - 0.03,
      en: this.keepGoing,
    })
  }
}

/**
 * The end of a two-player round: **the notice to pass the controller** or, with both played, who
 * wins, the points of both and what the pair has so far. The web's `XRDuelPanel`, in the place of the
 * quit notice (`XR_DUEL_POSITION`), with the lines of its `drawDuel`; the scoreboard's buttons
 * stay below, and the play one starts the other player's round.
 */
export class DuelPanel {
  readonly panel: Panel
  readonly node: Node3D

  constructor() {
    this.panel = new Panel({ ancho: XR_DUEL_SIZE[0], alto: XR_DUEL_SIZE[1], fondo: COLORS.panel, opacidad: 1 })
    this.node = this.panel.nodo
    this.node.visible = false
  }

  /** Writes it: the sentences come already worded (`duelSummary`). */
  write(summary: DuelSummary): void {
    const { panel } = this
    const width = XR_DUEL_SIZE[0] - 0.04
    panel.borrarTextos()
    panel.escribir(summary.title, 0, 0.08, { alto: DUEL_TEXT.title, color: summary.winner != null ? COLORS.star : '#ffffff', anchoMax: width })
    if (summary.pass != null) {
      panel.escribir(summary.pass, 0, 0.015, { alto: DUEL_TEXT.body, color: '#4ade80', anchoMax: width })
      return
    }
    // One line per player: together in one they do not fit at the panel's type size.
    summary.lines.forEach((line, i) => {
      panel.escribir(line.text, 0, 0.025 - i * 0.045, {
        alto: DUEL_TEXT.body,
        color: line.player === summary.winner ? COLORS.star : COLORS.light,
        anchoMax: width,
      })
    })
    if (summary.tally != null) panel.escribir(summary.tally, 0, -0.08, { alto: DUEL_TEXT.body, color: COLORS.dim, anchoMax: width })
  }
}

/** The rings of the countdown (`RING_RADIUS`, `RING_GAP` of `XRCountdown.tsx`). */
const RING_RADIUS = 0.055
const RING_GAP = 0.135

export class Countdown {
  readonly node = new Node3D()
  private readonly rings: MeshInstance3D[] = []
  private clock = 0

  constructor() {
    this.node.set_name('Countdown')
    const width = (COUNTDOWN_SECONDS - 1) * RING_GAP
    const tube = RING_RADIUS * 0.16
    for (let i = 0; i < COUNTDOWN_SECONDS; i++) {
      const ring = shape(arcTriangles(RING_RADIUS - tube, RING_RADIUS + tube, 0, Math.PI * 2, 28), '#22c55e', 0.85)
      ring.position = new Vector3(i * RING_GAP - width / 2, 0, 0)
      this.node.add_child(ring)
      this.rings.push(ring)
    }
    this.node.visible = false
  }

  /** Shows the count (3, 2, 1) or nothing with 0: the spent ones, the running one beating and the ones left. */
  show(count: number, delta: number): void {
    this.node.visible = count > 0
    if (count <= 0) return
    this.clock += delta
    this.rings.forEach((ring, i) => {
      const second = COUNTDOWN_SECONDS - i
      if (count < second) {
        paint(ring, '#475569', 0.12)
        ring.scale = new Vector3(0.8, 0.8, 1)
      } else if (count === second) {
        const pulse = 0.5 + 0.5 * Math.sin(this.clock * Math.PI * 2)
        paint(ring, '#22c55e', 0.6 + pulse * 0.4)
        const k = 1.12 + pulse * 0.12
        ring.scale = new Vector3(k, k, 1)
      } else {
        paint(ring, '#22c55e', 0.85)
        ring.scale = Vector3.ONE
      }
    })
  }
}
