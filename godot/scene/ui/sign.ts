/**
 * The goal sign in Godot: facing the player and under the machine, above the scoreboard
 * (`components/xr/GoalSign.tsx` and `components/xr/MachineSign.tsx`).
 *
 * **It says the same as the web's** because both read from `lib/goal.ts` —the mission and the
 * thresholds until the first stick, the threshold still missing with its bar, the lives and the sticks
 * left while playing, and what was missing at the end— and **it hangs in the same place**, which comes
 * from `lib/machineSign.ts`. It is painted to be read at `SIGN.distance` and is enlarged with the
 * real distance, so it takes up the same degrees as on the web.
 *
 * The celebration of a threshold is its own: the title says the medal («¡Bronce!»), it takes its colour
 * along with the bar and the sign grows and comes back (`celebrationPulse`). The short sound and the pulse in the hand are added by the
 * scene, with the medal that `update` returns.
 */
import { Node3D, Vector3, type MeshInstance3D } from 'godot'

import { plate } from '@kit/runtime/ui/mesh'
import { Panel } from '@kit/runtime/ui/panel'
import { RENDER_ORDER } from '@kit/runtime/ui/text3d'

import type { SignPlacement } from '@/lib/machineSign'
import { CELEBRATION_SECONDS, thresholdCrossed, celebrationPulse, type Medal, type GoalSignView } from '@/lib/goal'
import { COMMON_PALETTE } from '@/lib/commonPalette'

/** What those degrees of visual angle measure at that distance (`degrees` of `GoalSign.tsx`, with the `minTextHeight` of `legibility.ts`). */
function degrees(angle: number, distance: number): number {
  return (2 * distance * Math.tan((0.75 * Math.PI) / 180 / 2) * angle) / 0.75
}

/**
 * The goal sign (`GoalSign.tsx`): painted to be read at two metres
 * (`DRAW_DISTANCE`), 24° wide by 4.5° high (`SIGN_PANEL`), with the type of the
 * title at 1.4° and that of the detail at 1.2° (`SIGN_FONT`), and its margin, its spacing and its bar.
 */
export const SIGN = {
  distance: 2,
  width: degrees(24, 2),
  height: degrees(4.5, 2),
  title: degrees(1.4, 2),
  detail: degrees(1.2, 2),
  spacing: degrees(0.35, 2),
  bar: degrees(0.35, 2),
  usableWidth: degrees(24, 2) - 2 * degrees(0.5, 2),
  /** With three lines (the end with its `footer`), the type of `SIGN_FONT_WITH_FOOTER`. */
  withFooter: { title: degrees(1.2, 2), detail: degrees(1.0, 2), spacing: degrees(0.25, 2) },
} as const

/** What the sign measures per metre of reading distance (`signAspect`). */
export const SIGN_ASPECT = { width: SIGN.width / SIGN.distance, height: SIGN.height / SIGN.distance } as const

export class Sign {
  readonly panel: Panel
  readonly node: Node3D
  private readonly bar = new Node3D()
  private painted = ''
  private scale = 1
  /** The medal the player had in the previous frame: `undefined` until the first one. */
  private medal: Medal | null | undefined = undefined
  /** The threshold being celebrated and since when, in seconds. */
  private celebration: { medal: Medal; elapsed: number } | null = null

  constructor() {
    this.panel = new Panel({ ancho: SIGN.width, alto: SIGN.height, fondo: COMMON_PALETTE.background, opacidad: 0.88 })
    this.node = this.panel.nodo
    this.node.set_name('GoalSign')
    this.node.add_child(this.bar)
    this.node.visible = false
  }

  /** Hangs it where `signPlacement` says, at the size its distance asks for. */
  place(placement: SignPlacement): void {
    const [x, y, z] = placement.position
    this.node.position = new Vector3(x, y, z)
    this.node.rotation = new Vector3(placement.rotation[0], placement.rotation[1], placement.rotation[2])
    this.setScale(placement.distance / SIGN.distance)
  }

  /** How much it is enlarged over its drawing size: what the distance it is read at asks for. */
  setScale(scale: number): void {
    this.scale = scale
    this.node.scale = new Vector3(scale, scale, scale)
  }

  /** The medal whose threshold is being celebrated right now, or `null`. */
  get celebrating(): Medal | null {
    return this.celebration?.medal ?? null
  }

  /**
   * Paints what it says (`drawSign`) and runs the celebration. With no view, it hides.
   *
   * @returns The medal whose threshold has just been crossed in this frame, so that the scene makes
   *   it sound and be felt; `null` almost always.
   */
  update(view: GoalSignView | null, medal: Medal | null, lang: string, delta: number): Medal | null {
    // Freshly mounted there is nothing to celebrate: the threshold has not been seen being crossed.
    const crossed = this.medal === undefined ? null : thresholdCrossed(this.medal, medal)
    if (crossed != null) this.celebration = { medal: crossed, elapsed: 0 }
    else if (medal == null || (this.celebration != null && this.celebration.elapsed >= CELEBRATION_SECONDS)) this.celebration = null
    this.medal = medal

    this.node.visible = view != null
    const pulse = this.celebration == null ? 1 : celebrationPulse(this.celebration.elapsed)
    this.node.scale = new Vector3(this.scale * pulse, this.scale * pulse, this.scale * pulse)
    if (this.celebration != null) this.celebration.elapsed += delta
    if (view != null) this.paint(view, lang, this.celebrating)
    return crossed
  }

  private paint(view: GoalSignView, lang: string, celebration: Medal | null): void {
    const key = `${lang}|${celebration}|${JSON.stringify(view)}`
    if (key === this.painted) return
    this.painted = key
    const { panel } = this
    panel.borrarTextos()
    for (let i = this.bar.get_child_count() - 1; i >= 0; i--) {
      const child = this.bar.get_child(i)!
      this.bar.remove_child(child)
      child.queue_free()
    }

    // What there is gets laid out centred: a single line sits in the middle, not hanging from the top. With the
    // footer of the end there are three lines, with the type a little lower (`SIGN_FONT_WITH_FOOTER` on the web).
    const footer = view.footer ?? null
    const font = footer == null ? SIGN : SIGN.withFooter
    const rows = [
      font.title,
      ...(view.detail == null ? [] : [font.detail]),
      ...(footer == null ? [] : [font.detail]),
      ...(view.bar == null ? [] : [SIGN.bar]),
    ]
    let y = (rows.reduce((sum, row) => sum + row, 0) + font.spacing * (rows.length - 1)) / 2

    // While celebrating, the title says the medal: the colour alone is not understood.
    panel.escribir(celebration != null && view.cheer != null ? view.cheer : view.title, 0, y - font.title / 2, {
      alto: font.title,
      color: celebration != null ? COMMON_PALETTE[celebration] : view.subdued ? COMMON_PALETTE.mutedText : COMMON_PALETTE.text,
      anchoMax: SIGN.usableWidth,
    })
    y -= font.title + font.spacing

    for (const line of [view.detail, footer]) {
      if (line == null) continue
      panel.escribir(line, 0, y - font.detail / 2, { alto: font.detail, color: COMMON_PALETTE.mutedText, anchoMax: SIGN.usableWidth })
      y -= font.detail + font.spacing
    }

    if (view.bar != null) {
      const centre = y - SIGN.bar / 2
      this.add(plate(SIGN.usableWidth, SIGN.bar, COMMON_PALETTE.border, 1, RENDER_ORDER.placa), 0, centre)
      const filled = SIGN.usableWidth * view.bar
      const accent = celebration ?? view.medal
      if (filled > 0) {
        this.add(plate(filled, SIGN.bar, accent == null ? COMMON_PALETTE.accent : COMMON_PALETTE[accent], 1, RENDER_ORDER.dibujo), -SIGN.usableWidth / 2 + filled / 2, centre)
      }
    }
  }

  private add(node: MeshInstance3D, x: number, y: number): void {
    node.position = new Vector3(x, y, 0)
    this.bar.add_child(node)
  }
}
