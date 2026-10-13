import { describe, expect, it } from 'vitest'
import { exitProblems, type PanelBox } from './exitCorner'
import { LINE_HEIGHT } from '../components/xr/canvasPanel'
import {
  RETAKE_DELTA,
  RETAKE_SECONDS,
  XR_HOOP_DOWN_OFFSET,
  XR_HOOP_UP_OFFSET,
  XR_MENU_EXIT_OFFSET,
  XR_MENU_MUSIC_OFFSET,
  XR_MENU_OPTIONS_OFFSET,
  XR_MENU_TUTORIAL_OFFSET,
  startTracking,
  trackHeight,
  worldRise,
  xrUiRise,
  xrUiRiseOverWorld,
  HINT_WIDTH,
  HINT_Y,
  XR_MENU_HIT,
  XR_MENU_SPOT,
  MENU_LABELS,
  MENU_TEXT,
  ROW_LABEL_RISE,
  XR_DIFFICULTY_ROW_Y,
  XR_ENDLESS_TOGGLE_OFFSET,
  XR_MENU_PLAY_HIT,
  XR_MENU_PLAY_OFFSET,
  XR_MODE_TOGGLE_OFFSET,
  XR_ROW_HIT_HEIGHT,
  XR_SCENERY_PICKER_OFFSET,
  XR_STICK_ROW_Y,
  menuLabelsFor,
  menuLabelText,
  XR_PLAYERS_TOGGLE_OFFSET,
  XR_DUEL_POSITION,
  XR_CONFIRM_POSITION,
  XR_HUD_PANEL,
  XR_HUD_POSITION,
  XR_HUD_WITH_SIGN,
  xrHudLayout,
  DIM_PER_SECOND,
  MENU_PANEL,
  STICK_BEHIND_MENU,
  XR_MENU_POSE,
  opacityToward,
  stickCoversMenu,
  menuHeadings,
  type Vec3,
} from './xrLayout'
import { MIN_EYE_HEIGHT, REFERENCE_EYE_HEIGHT, hoopHeightFor } from './hoopHeight'
import { MENU_DEGREES, degreesFromFront } from './menuTemplate'
import { translator } from './textos'
import { MAX_STICKS, PLAYER_OFFSET_Z, STICK_CORD_LENGTH, STICK_LENGTH, STICK_RADIUS } from './gameConfig'
import { EYE_HEIGHTS } from './panelReading'
import { buildStickLayout } from './stickLayout'
import { SWING_AMPLITUDE } from './stickSwing'

/**
 * Of the menu panel, only what is arithmetic can be checked without a headset:
 * where each button falls. It matters because in the headset you point freehand at a
 * metre, and two buttons a few centimetres apart are the same button: you see where
 * the ray points, not where the sensitive zone ends.
 *
 * The measurements are those of the boxes that `XRMenu.tsx` declares: the corner
 * buttons are 16 cm wide, so two centres at less than that distance really do
 * step on each other.
 */
const CORNER_BUTTON_WIDTH = 0.16

/** How much there is between two buttons of the same row, from centre to centre. */
function separation(a: readonly number[], b: readonly number[]): number {
  return Math.abs(a[0] - b[0])
}

describe('the corners of the menu panel', () => {
  it('puts the tutorial and the music one at each end of the hoop row', () => {
    expect(XR_MENU_TUTORIAL_OFFSET[1]).toBe(XR_MENU_MUSIC_OFFSET[1])
    expect(XR_MENU_TUTORIAL_OFFSET[0]).toBeLessThan(0)
    expect(XR_MENU_MUSIC_OFFSET[0]).toBeGreaterThan(0)
  })

  it('leaves the music far from the hoop arrows, which are its neighbours', () => {
    for (const arrow of [XR_HOOP_UP_OFFSET, XR_HOOP_DOWN_OFFSET]) {
      expect(separation(XR_MENU_MUSIC_OFFSET, arrow)).toBeGreaterThan(
        CORNER_BUTTON_WIDTH,
      )
    }
  })

  it('keeps exit and «Más opciones» each at one end of the bottom row', () => {
    // The rule that was already there: they are the two things that are costly to confuse.
    expect(XR_MENU_EXIT_OFFSET[1]).toBe(XR_MENU_OPTIONS_OFFSET[1])
    expect(separation(XR_MENU_EXIT_OFFSET, XR_MENU_OPTIONS_OFFSET)).toBeGreaterThan(0.5)
  })

  it('does not put the music in the bottom row, which is already full', () => {
    // There only fifteen centimetres were left between start and «Más opciones», which is
    // less than what a corner button measures.
    expect(XR_MENU_MUSIC_OFFSET[1]).not.toBe(XR_MENU_OPTIONS_OFFSET[1])
  })
})

/**
 * The hit boxes are **invisible**, so one that steps on its neighbour is not seen:
 * it is noticed while playing, as a menu option that does not respond. It is what was reported from the
 * headset —«there are invisible objects that block menu options»—, and here it is measured.
 */
describe('the hit boxes of the menu do not step on each other', () => {
  const NAMES = Object.keys(XR_MENU_HIT)

  function box(name: string) {
    const [x, y] = XR_MENU_SPOT[name]
    const [width, height] = XR_MENU_HIT[name]
    return { x, y, width, height }
  }

  it('none gets into the one next to it', () => {
    for (let i = 0; i < NAMES.length; i++) {
      for (let j = i + 1; j < NAMES.length; j++) {
        const a = box(NAMES[i])
        const b = box(NAMES[j])
        const overlaps =
          Math.abs(a.x - b.x) * 2 < a.width + b.width && Math.abs(a.y - b.y) * 2 < a.height + b.height
        expect(overlaps, `${NAMES[i]} steps on ${NAMES[j]}`).toBe(false)
      }
    }
  })

  it('and none falls on top of the line that explains the mode', () => {
    // The line is centred, so only the buttons that go through its x band
    // can land on top of it.
    for (const name of NAMES) {
      const { x, y, width, height } = box(name)
      const withinItsWidth = Math.abs(x) * 2 < width + HINT_WIDTH
      const withinItsHeight = y - height / 2 < HINT_Y
      expect(withinItsWidth && withinItsHeight, `${name} falls on the mode line`).toBe(false)
    }
  })

  it('all fit inside the panel', () => {
    for (const name of NAMES) {
      const { x, y, width, height } = box(name)
      expect(Math.abs(x) + width / 2, `${name} sticks out at the side`).toBeLessThanOrEqual(
        MENU_PANEL[0] / 2,
      )
      expect(Math.abs(y) + height / 2, `${name} sticks out at the top or at the bottom`).toBeLessThanOrEqual(
        MENU_PANEL[1] / 2,
      )
    }
  })
})

describe('the world at the height of whoever plays', () => {
  it('standing nothing moves, whatever their height', () => {
    // It is what whoever has asked for nothing sees, which is almost everyone: the scene
    // exactly where it has always been.
    expect(worldRise(1.2, false)).toBe(0)
    expect(worldRise(1.6, false)).toBe(0)
    expect(worldRise(2.0, false)).toBe(0)
  })

  it('seated, the world goes down to the eyes', () => {
    // A seated player measures about a metre twenty of eye height: the world has to
    // go down the forty centimetres it lacks to reach them.
    expect(worldRise(1.2, true)).toBeCloseTo(-0.4, 10)
  })

  it('for whoever is taller it goes up, for the same reason', () => {
    expect(worldRise(1.8, true)).toBeCloseTo(0.2, 10)
  })

  it('without a good measurement nothing is made up', () => {
    // Without a floor in the reference space, or with the headset on the table, the
    // height is not a stature: you play with the scene where it was.
    for (const height of [null, undefined, Number.NaN, 0, 5]) {
      expect(worldRise(height, true)).toBe(0)
    }
  })
})

describe('when it is measured again', () => {
  const step = (
    state: ReturnType<typeof startTracking>,
    height: number | null,
    seconds = 1 / 72,
  ) => trackHeight(state, height, 1, seconds)

  it('the first good measurement is used as is', () => {
    // Entering and seeing the world at eye height, not a scene rising
    // slowly from wherever.
    expect(step(startTracking(), 1.75).held).toBeCloseTo(1.75, 6)
  })

  it('without a good measurement nothing is touched', () => {
    const initial = startTracking()

    expect(step(initial, null)).toBe(initial)
    expect(step(initial, 0.3)).toBe(initial)
  })

  it('moving while playing does not move the world', () => {
    // Standing on tiptoe or crouching for something: the scene stays still,
    // otherwise the goal escapes just when you go to aim at it.
    let state = step(startTracking(), 1.7)
    for (let t = 0; t < 2; t += 1 / 72) state = step(state, 1.7 + RETAKE_DELTA * 0.8)

    expect(state.held).toBeCloseTo(1.7, 6)
  })

  it('a big and short change does not either', () => {
    let state = step(startTracking(), 1.7)
    for (let t = 0; t < RETAKE_SECONDS / 2; t += 1 / 72) state = step(state, 1.2)

    expect(state.held).toBeCloseTo(1.7, 6)
  })

  it('but sitting down in the middle of a run does', () => {
    let state = step(startTracking(), 1.7)
    for (let t = 0; t < RETAKE_SECONDS * 2; t += 1 / 72) state = step(state, 1.2)

    expect(state.held).toBeCloseTo(1.2, 6)
  })
})

describe('the ui when the world has already moved', () => {
  it('with the world still, the ui places itself on its own', () => {
    expect(xrUiRiseOverWorld(1.4, false)).toBeCloseTo(xrUiRise(1.4), 10)
  })

  it('with the world lowered, it is not corrected again', () => {
    // Adding the two corrections left the menu at knee height,
    // precisely for whoever can least crouch to look for it.
    expect(xrUiRiseOverWorld(1.2, true)).toBe(0)
    expect(xrUiRiseOverWorld(1.9, true)).toBe(0)
  })

  it('without a good measurement nothing moves, whatever is asked for', () => {
    expect(xrUiRiseOverWorld(null, true)).toBe(0)
    expect(xrUiRiseOverWorld(null, false)).toBe(0)
  })
})


/**
 * Where the exit falls, which until now depended on the game.
 *
 * The rule —bottom right, at the end of the row of the actions— and the why are in
 * `exitCorner.ts`, the same file in the thirteen. Here it is only given the layout of THIS panel,
 * translated into what the rule knows how to read.
 */
describe('the exit', () => {
  const asBox = (name: string): PanelBox => ({
    x: XR_MENU_SPOT[name][0],
    y: XR_MENU_SPOT[name][1],
    width: XR_MENU_HIT[name][0],
    height: XR_MENU_HIT[name][1],
  })

  it('is in the bottom right corner of the menu panel', () => {
    const names = Object.keys(XR_MENU_HIT)

    expect(
      exitProblems(
        asBox('exit'),
        names.filter((name) => name !== 'exit').map(asBox),
        { width: MENU_PANEL[0], height: MENU_PANEL[1] },
      ),
    ).toEqual([])
  })
})

describe('the names of the rows, depending on the mode', () => {
  const names = (mode: Parameters<typeof menuLabelsFor>[0], moreOptions = false) =>
    menuLabelsFor(mode, moreOptions).map(({ text }) => text)

  it('unfolded, practice and the levels name all their rows, without the against-whom one', () => {
    expect(menuLabelsFor('practice', true)).toEqual(MENU_LABELS.filter(({ text }) => text !== 'Players'))
    expect(menuLabelsFor('levels', true)).toEqual(MENU_LABELS.filter(({ text }) => text !== 'Players'))
  })

  it('folded, as the menu opens, only what belongs to the mode: in the levels, their ladder and their speed', () => {
    expect(names('practice')).toEqual(['Mode'])
    expect(names('levels')).toEqual(['Sticks', 'Speed', 'Mode'])
  })

  it('the challenge does not name rows it does not show: it is fixed, asks against whom and you hit start', () => {
    expect(names('challenge')).toEqual(['Mode', 'Players'])
    // It is a fixed run: what is folded is not shown even if asked for.
    expect(names('challenge', true)).toEqual(['Mode', 'Players'])
  })

  it('against whom goes in the gap of endless, which the challenge does not show, and the two-player notice where the exit one is', () => {
    expect(XR_PLAYERS_TOGGLE_OFFSET).toEqual(XR_ENDLESS_TOGGLE_OFFSET)
    expect(XR_DUEL_POSITION).toEqual(XR_CONFIRM_POSITION)
  })
})

describe('the menu starts with the mode', () => {
  /** The rows from top to bottom, with what the tallest box of each one takes up in height. */
  const rows = [
    {
      name: 'mode',
      y: XR_MODE_TOGGLE_OFFSET[1],
      height: Math.max(XR_MENU_HIT.mode[1], XR_MENU_HIT.endless[1], XR_MENU_HIT.scenery[1]),
    },
    { name: 'sticks', y: XR_STICK_ROW_Y, height: XR_ROW_HIT_HEIGHT.sticks },
    { name: 'speed', y: XR_DIFFICULTY_ROW_Y, height: XR_ROW_HIT_HEIGHT.difficulty },
    { name: 'start', y: XR_MENU_PLAY_OFFSET[1], height: XR_MENU_PLAY_HIT[1] },
  ]

  it('the mode goes first under the hoop, and what practice asks, below', () => {
    expect(XR_ENDLESS_TOGGLE_OFFSET[1]).toBe(XR_MODE_TOGGLE_OFFSET[1])
    expect(XR_SCENERY_PICKER_OFFSET[1]).toBe(XR_MODE_TOGGLE_OFFSET[1])
    expect(rows.map(({ name }) => name)).toEqual(
      [...rows].sort((a, b) => b.y - a.y).map(({ name }) => name),
    )
  })

  it('no box of a row gets into the one below', () => {
    for (let i = 1; i < rows.length; i++) {
      const above = rows[i - 1]
      const below = rows[i]
      expect(above.y - above.height / 2, `${above.name} steps on ${below.name}`).toBeGreaterThan(
        below.y + below.height / 2,
      )
    }
  })

  it('the name of the sticks does not get into the mode row', () => {
    // The boxes of the mode row are real buttons; what there is between the bottom
    // rows are labels that are not pressed, and that is measured by `menu.legible.test.ts`.
    // The line measures more than the letter: it is measured with its line height, as the canvas notes it down.
    const nameTop = XR_STICK_ROW_Y + ROW_LABEL_RISE + MENU_TEXT.label / LINE_HEIGHT / 2
    expect(nameTop).toBeLessThan(rows[0].y - rows[0].height / 2)
  })
})

describe('the layout of the scoreboard', () => {
  it('without a sign it is the usual one: centred, with its row of lives or stars and taller at the end', () => {
    expect(xrHudLayout({ finished: false, row: false, sign: false })).toEqual({ height: XR_HUD_PANEL.run, centre: 0, content: 0.04 })
    expect(xrHudLayout({ finished: false, row: true, sign: false }).height).toBeCloseTo(XR_HUD_PANEL.run + XR_HUD_PANEL.livesRow)
    expect(xrHudLayout({ finished: true, row: false, sign: false })).toEqual({ height: XR_HUD_PANEL.finished, centre: 0, content: 0.1 })
    expect(xrHudLayout({ finished: true, row: true, sign: false }).height).toBeCloseTo(XR_HUD_PANEL.finished + XR_HUD_PANEL.livesRow)
  })

  it('with the sign above it shrinks to what it carries, and the tokens do not move at the end', () => {
    const playing = xrHudLayout({ finished: false, row: false, sign: true })
    const finished = xrHudLayout({ finished: true, row: false, sign: true })

    expect(playing.height).toBeLessThan(XR_HUD_PANEL.run)
    expect(finished.height).toBeLessThan(XR_HUD_PANEL.finished)
    expect(finished.content).toBe(playing.content)
    // Its top edge is the same playing as finished: the sign above is not touched.
    expect(finished.centre + finished.height / 2).toBeCloseTo(playing.centre + playing.height / 2)
    expect(xrHudLayout({ finished: false, row: true, sign: true })).toEqual(playing)
  })

  it('the panel wraps what it carries: the tokens and the streak, and at the end the buttons', () => {
    // The tokens (3 cm of radius, grown) and the diamonds of the streak, 6 cm above.
    const tokens = XR_HUD_WITH_SIGN.content
    for (const layout of [XR_HUD_WITH_SIGN.run, XR_HUD_WITH_SIGN.finished]) {
      expect(layout.centre + layout.height / 2).toBeGreaterThan(tokens + 0.06 + 0.012)
      expect(layout.centre - layout.height / 2).toBeLessThan(tokens - 0.045)
    }
    // The final buttons go 12 cm below the scoreboard and their box is 11 tall.
    expect(XR_HUD_WITH_SIGN.finished.centre - XR_HUD_WITH_SIGN.finished.height / 2).toBeLessThan(-0.12 - 0.055)
    // And the tokens and the buttons do not step on each other.
    expect(tokens - 0.045).toBeGreaterThan(-0.12 + 0.055)
  })

  it('and it does not go lower than the usual one: with the shortest player it stays above the floor', () => {
    const finished = xrHudLayout({ finished: true, row: false, sign: true })
    const theUsualOne = xrHudLayout({ finished: true, row: true, sign: false })
    const bottom = (layout: typeof finished) => XR_HUD_POSITION[1] + layout.centre - layout.height / 2 + xrUiRise(MIN_EYE_HEIGHT)

    expect(bottom(finished)).toBeGreaterThan(bottom(theUsualOne))
    expect(bottom(finished)).toBeGreaterThan(0)
  })
})

describe('the label of the mode row', () => {
  it('says «Modo» and which one is chosen: the one that counts for a medal is called by its name', () => {
    expect(menuLabelText('Mode', 'challenge', translator('en'))).toBe('Mode: Challenge')
    expect(menuLabelText('Mode', 'practice', translator('en'))).toBe('Mode: Practice')
    expect(menuLabelText('Mode', 'levels', translator('es'))).toBe('Modo: Niveles')
    expect(menuLabelText('Mode', 'challenge', translator('es'))).toBe('Modo: Reto')
  })

  it('the other labels say what they are, whatever is played', () => {
    for (const { text } of MENU_LABELS) {
      if (text !== 'Mode') expect(menuLabelText(text, 'challenge', translator('en'))).toBe(text)
    }
  })
})

describe('the menu of the headset is born facing front', () => {
  it(`at ${MENU_DEGREES}° or less from the gaze, at a metre and a half, and facing whoever plays`, () => {
    expect(degreesFromFront(XR_MENU_POSE.position)).toBeLessThanOrEqual(MENU_DEGREES)
    expect(Math.hypot(XR_MENU_POSE.position[0], XR_MENU_POSE.position[2])).toBeCloseTo(1.5)
    expect(XR_MENU_POSE.yaw).toBeCloseTo(Math.atan2(-XR_MENU_POSE.position[0], -XR_MENU_POSE.position[2]))
  })

  it('the control: at 55°, where it used to be, it would not pass', () => {
    const a = (55 * Math.PI) / 180
    expect(degreesFromFront([-Math.sin(a) * 1.5, REFERENCE_EYE_HEIGHT, -Math.cos(a) * 1.5])).toBeGreaterThan(MENU_DEGREES)
  })
})

describe('the sticks that cover the menu of the headset are dimmed', () => {
  /** How much the foot of the hanging stick sways, added to its thickness: about three centimetres. */
  const SLACK = STICK_RADIUS + (STICK_CORD_LENGTH + STICK_LENGTH) * SWING_AMPLITUDE

  /** The points of the menu plate, in the machine's coordinates (whoever plays, `PLAYER_OFFSET_Z` behind). */
  function platePoints(eyeHeight: number): [number, number, number][] {
    const { position, yaw, scale } = XR_MENU_POSE
    const rise = xrUiRise(eyeHeight)
    const points: [number, number, number][] = []
    for (let i = 0; i <= 12; i++) {
      for (let j = 0; j <= 10; j++) {
        const lx = ((i / 12 - 0.5) * MENU_PANEL[0]) * scale
        const ly = ((j / 10 - 0.5) * MENU_PANEL[1]) * scale
        points.push([
          position[0] + Math.cos(yaw) * lx,
          position[1] + rise + ly,
          position[2] - Math.sin(yaw) * lx + PLAYER_OFFSET_Z,
        ])
      }
    }
    return points
  }

  /** Whether the stick that hangs from that hook crosses the line from the eyes to that point of the plate. */
  function crosses(hook: [number, number, number], eye: [number, number, number], point: [number, number, number]): boolean {
    const [gx, gy, gz] = hook
    const top = gy - STICK_CORD_LENGTH
    const bottom = top - STICK_LENGTH
    // Where the line goes closest to the axis of the stick, in plan view.
    const dx = point[0] - eye[0]
    const dz = point[2] - eye[2]
    const t = ((gx - eye[0]) * dx + (gz - eye[2]) * dz) / (dx * dx + dz * dz)
    if (t <= 0 || t >= 1) return false
    const y = eye[1] + t * (point[1] - eye[1])
    const closest = Math.hypot(eye[0] + t * dx - gx, eye[2] + t * dz - gz)
    return closest < SLACK && y <= top + SLACK && y >= bottom - SLACK
  }

  const CASES = EYE_HEIGHTS.flatMap((eyeHeight) =>
    Array.from({ length: MAX_STICKS - 4 }, (_, i) => ({ eyeHeight, sticks: i + 5 })),
  )

  it('no stick that stays whole is seen in front of the plate, at any height nor with any number of sticks', () => {
    for (const { eyeHeight, sticks } of CASES) {
      const eye: [number, number, number] = [0, eyeHeight, PLAYER_OFFSET_Z]
      const plate = platePoints(eyeHeight)
      for (const { anchor } of buildStickLayout(sticks, 1, hoopHeightFor({ eyeHeight }))) {
        if (stickCoversMenu(anchor)) continue
        expect(
          plate.some((point) => crosses(anchor, eye, point)),
          `${sticks} sticks, eyes at ${eyeHeight}: the stick at ${anchor.map((v) => v.toFixed(2)).join(', ')} covers the menu`,
        ).toBe(false)
      }
    }
  })

  it('and the ones that are dimmed did cover it: only those on that side, the front keeps hanging', () => {
    for (const { eyeHeight, sticks } of CASES) {
      const eye: [number, number, number] = [0, eyeHeight, PLAYER_OFFSET_Z]
      const plate = platePoints(eyeHeight)
      const hooks = buildStickLayout(sticks, 1, hoopHeightFor({ eyeHeight })).map((stick) => stick.anchor)
      const dimmed = hooks.filter((hook) => stickCoversMenu(hook))
      expect(dimmed.length, `${sticks} sticks`).toBeGreaterThan(0)
      expect(dimmed.length, `${sticks} sticks`).toBeLessThanOrEqual(Math.ceil(sticks / 2))
      expect(dimmed.some((hook) => plate.some((point) => crosses(hook, eye, point))), `${sticks} sticks`).toBe(true)
      // All from the front to the left, which is where the column is: those on the right, whole.
      for (const [x] of dimmed) expect(x).toBeLessThan(0.1)
    }
  })

  it('the plate takes up from almost the front to 61° to the left, with the margin', () => {
    const [from, to] = menuHeadings()
    expect(from).toBeGreaterThan(-3)
    expect(from).toBeLessThan(0)
    expect(to).toBeGreaterThan(60)
    expect(to).toBeLessThan(65)
  })

  it('the control: with the column on the right, the sticks on the right would cover it', () => {
    const [x, y, z] = XR_MENU_POSE.position
    const onTheRight = { ...XR_MENU_POSE, position: [-x, y, z] as Vec3, yaw: -XR_MENU_POSE.yaw }
    const rightStick = buildStickLayout(13, 1).find(({ anchor }) => anchor[0] > 0.3)!
    expect(stickCoversMenu(rightStick.anchor, onTheRight)).toBe(true)
    expect(stickCoversMenu(rightStick.anchor)).toBe(false)
  })

  it('they dim and come back little by little, in a quarter of a second', () => {
    expect(opacityToward(1, STICK_BEHIND_MENU, 0.1)).toBeCloseTo(0.6)
    expect(opacityToward(0.6, STICK_BEHIND_MENU, 1)).toBe(STICK_BEHIND_MENU)
    expect(opacityToward(STICK_BEHIND_MENU, 1, 0.1)).toBeCloseTo(0.55)
    expect(opacityToward(0.9, 1, 1)).toBe(1)
    expect(opacityToward(0.5, 1, -1)).toBe(0.5)
    expect(1 / DIM_PER_SECOND).toBeLessThanOrEqual(0.25)
  })
})
