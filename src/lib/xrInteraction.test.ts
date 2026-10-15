import { describe, expect, it } from 'vitest'
import {
  MACHINE_HEIGHT,
  MACHINE_RADIUS,
  PLAYER_OFFSET_Z,
  PLAYER_SHOULDER_HEIGHT,
  STICK_CORD_LENGTH,
  STICK_LENGTH,
  STICK_MISS_Y,
  distanceFromPlayer,
  machinePoint,
} from './gameConfig'
import {
  MAX_EYE_HEIGHT,
  MIN_EYE_HEIGHT,
  REFERENCE_EYE_HEIGHT,
} from './hoopHeight'
import { XR_ANCHOR_DEADZONE } from './xrAnchor'
import {
  canCatchStick,
  canCatchWithPointer,
  playingBareHanded,
} from './xrInteraction'
import { DIFFICULTY_ORDER, MAX_STICKS } from './gameConfig'
import {
  XR_COUNTDOWN_POSITION,
  XR_HUD_POSITION,
  XR_COLUMN,
  XR_MENU_DESK_POSE,
  XR_MENU_POSE,
  XR_MENU_POSITION,
  menuPoseFor,
  onMenu,
  XR_QUIT_POSITION,
  XR_QUIT_YAW,
  XR_TUTORIAL_POSITION,
  type Vec3,
  xrHoopDownPosition,
  xrHoopUpPosition,
  xrMenuExitPosition,
  xrMenuOptionsPosition,
  xrMenuTutorialPosition,
  xrModeTogglePosition,
  xrEndlessTogglePosition,
  XR_END_RUN_POSITION,
  xrSceneryPickerPosition,
  xrDifficultyOptionPosition,
  xrLevelOptionPosition,
  xrPlayButtonPosition,
  xrQuitButtonPosition,
  xrStickOptionPosition,
  xrTutorialNextPosition,
  xrTutorialSkipPosition,
  xrUiRise,
} from './xrLayout'

/**
 * The machine has to stay within what the player reaches with the hand.
 *
 * The sticks are no longer grabbed by pointing with the controller but by grabbing them, so the
 * geometry stops being an aesthetic matter: if the hoop moves away or goes up too
 * much, the sticks go by out of reach and the game becomes unplayable in the
 * headset without any desktop test noticing.
 */

/** Comfortable reach of an adult's arm from the shoulder, in metres. */
const ARM_REACH = 0.75

/** Centre of the stick hanging from the point `t` of the hoop, before starting to fall. */
function hangingStickCenter(t: number): [number, number, number] {
  const [x, y, z] = machinePoint(t)
  return [x, y - STICK_CORD_LENGTH - STICK_LENGTH / 2, z]
}

describe('the machine stays within reach of the hand', () => {
  it('the hoop stays above the head, without hitting it', () => {
    // Above a tall person standing, and below what would leave the
    // sticks hanging out of reach.
    expect(MACHINE_HEIGHT).toBeGreaterThan(1.85)
    expect(MACHINE_HEIGHT).toBeLessThan(2.1)
  })

  it('the sticks go by in front of the player at grabbing height', () => {
    // They travel from where they hang until they are missed: that whole strip has
    // to cross shoulder height to be able to grab them in flight.
    expect(MACHINE_HEIGHT).toBeGreaterThan(PLAYER_SHOULDER_HEIGHT)
    expect(STICK_MISS_Y).toBeLessThan(PLAYER_SHOULDER_HEIGHT)
  })

  it('no stick of the hoop is left outside the outstretched arm', () => {
    // It is measured from where the player really is, which is not the centre of the
    // hoop: they are one step behind (`PLAYER_OFFSET_Z`). The worst case is now the
    // front stick, the farthest one.
    for (let i = 0; i <= 20; i++) {
      expect(distanceFromPlayer(hangingStickCenter(i / 20))).toBeLessThanOrEqual(
        ARM_REACH,
      )
    }
  })

  it('the player is a mini-step behind the centre, without moving away from the sticks', () => {
    // «It is perfect; a mini-step back», with the headset. Behind the centre, the
    // sticks at the ends fall a little in front of them and not at the sides.
    expect(PLAYER_OFFSET_Z).toBeGreaterThan(0)
    // And a **mini** step: at −0.18 you started on top of the machine and a hand's breadth
    // backwards would leave the front sticks at the fingertips.
    expect(PLAYER_OFFSET_Z).toBeLessThan(0.15)
    expect(MACHINE_RADIUS + PLAYER_OFFSET_Z).toBeLessThan(ARM_REACH)
  })
})

/**
 * Horizontal angle of a point relative to the player's front (−Z), in
 * radians. Always positive: what matters is how much you have to turn, not which way.
 */
function gazeAngle([x, , z]: Vec3): number {
  return Math.abs(Math.atan2(x, -z))
}

/**
 * The menu without a headset, in front: what is checked here for it is what was checked for
 * the usual menu. In the headset it goes to the column on the left, further down.
 */
const DESK = XR_MENU_DESK_POSE

describe('the ui falls inside the field of view', () => {
  const elements: Array<[string, Vec3]> = [
    ['the menu', XR_MENU_DESK_POSE.position],
    ['the scoreboard', XR_HUD_POSITION],
    ['the back-to-menu button', XR_QUIT_POSITION],
    ['the leave-the-headset button', xrMenuExitPosition(DESK)],
    ['the «Más opciones» button', xrMenuOptionsPosition(DESK)],
    // The two settings of the middle row are set apart at the ends of the
    // panel so as not to be pressed by mistake, so they no longer fall on the axis of the
    // gaze and have to be checked like the rest.
    ['the mode switch', xrModeTogglePosition(DESK)],
    ['the endless switch', xrEndlessTogglePosition(DESK)],
    ['the scenery picker', xrSceneryPickerPosition(DESK)],
    ['the button to finish the endless run', XR_END_RUN_POSITION],
    // The row of the hoop setting is the highest of the panel, so it is the one that
    // would first go off the top of what is looked at without craning the neck.
    ['the button to lower the hoop', xrHoopDownPosition(DESK)],
    ['the button to raise the hoop', xrHoopUpPosition(DESK)],
    // The tutorial is shown with the run in progress, so its panel and its
    // two ways out answer to the same rules as everything else: if one of
    // the buttons ended up where it is not seen, the step could no longer be passed and
    // whoever did not manage to do it would be left locked in it.
    ['the tutorial', XR_TUTORIAL_POSITION],
    ['the button to skip the tutorial', xrTutorialSkipPosition()],
    ['the button to go on to the next step', xrTutorialNextPosition()],
    ['the button to see the tutorial again', xrMenuTutorialPosition(DESK)],
    // It is the first thing looked at after pressing «start», and it goes up and down with the
    // rest of the ui.
    ['the countdown', XR_COUNTDOWN_POSITION],
  ]

  /**
   * Eye heights that are played with: the two extremes that are accepted
   * as a person (see `hoopHeight.ts`), the reference one and one of someone
   * seated, which is the case that gave rise to all this.
   */
  const EYE_HEIGHTS = [
    MIN_EYE_HEIGHT,
    1.15,
    REFERENCE_EYE_HEIGHT,
    MAX_EYE_HEIGHT,
  ]

  /**
   * How much the tallest panel goes down below the point it hangs from, in
   * metres: the panels are drawn **centred** on their position, and the biggest is
   * the scoreboard one when a challenge run ends —result, row of lives
   * and row of buttons, 48 cm in total (`XRHud.tsx`)—. It is the gap that has to
   * be left free below so that nothing sinks into the floor.
   */
  const PANEL_DROP = 0.24

  it.each(elements)('%s can be looked at without the ui fleeing', (_, position) => {
    // The relation that really matters: if an element were beyond
    // the dead zone, looking at it would turn the whole set and the button would
    // escape from the ray just when trying to point at it. With margin, besides, so
    // that brushing the limit is not enough.
    expect(gazeAngle(position)).toBeLessThan(XR_ANCHOR_DEADZONE * 0.85)
  })

  it.each(elements)('%s stays at a comfortable height, whoever plays', (_, [, y]) => {
    // It is no longer an absolute height: the ui hangs from the player's eyes,
    // so what has to hold for any stature is the distance
    // *to those eyes* —above the waist and without craning the neck—. They are the
    // same numbers as when the panel was nailed (0.85 and 1.75), read
    // from the person it was placed with.
    for (const eyes of EYE_HEIGHTS) {
      const toEyes = y + xrUiRise(eyes) - eyes
      expect(toEyes).toBeGreaterThan(0.85 - REFERENCE_EYE_HEIGHT)
      expect(toEyes).toBeLessThan(1.75 - REFERENCE_EYE_HEIGHT)
    }
  })

  it.each(elements)('%s stays above the floor', (_, [, y]) => {
    // The other fence: following the eyes downwards cannot end up burying
    // the ui in the floor of whoever plays seated on it. The bottom edge
    // of the panel is measured and not the point it hangs from, which is what really
    // touches the floor: with the shortest player accepted as a person, the
    // scoreboard has **one centimetre** left, so this is the place where you
    // see whether a taller panel or lower heights eat up that margin.
    expect(y + xrUiRise(MIN_EYE_HEIGHT) - PANEL_DROP).toBeGreaterThan(0)
  })

  it('the back-to-menu button faces the player', () => {
    // It is set to one side, so it is the only one that turns. And it has to turn
    // exactly what its position asks for: edge-on, the plate narrows and its own
    // edge comes forward in front of the icon until it eats it.
    const [x, , z] = XR_QUIT_POSITION
    // Normal of the plate after the turn, in the horizontal plane.
    const normal = [Math.sin(XR_QUIT_YAW), Math.cos(XR_QUIT_YAW)]
    const toPlayer = [-x, -z]
    const reach = Math.hypot(...toPlayer)
    const alignment =
      (normal[0] * toPlayer[0] + normal[1] * toPlayer[1]) / reach

    expect(alignment).toBeCloseTo(1)
  })

  it.each(elements)('%s stays within reach of the ray, without sticking to the face', (_, [x, , z]) => {
    const distance = Math.hypot(x, z)
    // Closer than half a metre and you have to squint; farther than a metre and a half and
    // the small targets of the stick picker become impossible.
    expect(distance).toBeGreaterThan(0.5)
    expect(distance).toBeLessThan(1.5)
  })
})

describe('the ui adapts to the height of the player', () => {
  it('seated it goes down with them and standing it goes back to its place', () => {
    expect(xrUiRise(1.15)).toBeCloseTo(1.15 - REFERENCE_EYE_HEIGHT, 6)
    expect(xrUiRise(REFERENCE_EYE_HEIGHT)).toBeCloseTo(0, 6)
    expect(xrUiRise(1.85)).toBeGreaterThan(0)
  })

  it('follows the eyes fully, not halfway', () => {
    // It is the underlying decision: the panel is looked at, not stepped on, so what
    // has to be kept is its distance to the eyes. Following halfway, the
    // top row would be left above the head of whoever plays
    // seated, which is precisely what had to be fixed.
    const seated = xrUiRise(1.1)
    const standing = xrUiRise(1.8)
    expect(standing - seated).toBeCloseTo(0.7, 6)
  })

  it('without data from the headset the ui stays where it always is', () => {
    // It happens in the browser, in the first frames of the session and in the
    // headsets whose reference space does not measure from the floor. Making up a
    // stature there would move the menu for nothing.
    expect(xrUiRise(null)).toBe(0)
    expect(xrUiRise(undefined)).toBe(0)
  })

  it('an impossible measurement does not move the ui', () => {
    // The same fences the hoop uses: what cannot be the eye height
    // of a person is not a measurement, it is a misunderstood reference
    // space or a headset on top of the table.
    for (const value of [Number.NaN, 0, -1.5, 50, MIN_EYE_HEIGHT - 0.01]) {
      expect(xrUiRise(value)).toBe(0)
    }
  })
})

describe('a stick is grabbed with the hand, not by pointing', () => {
  it('the grab of the controller and the contact of the hand are valid', () => {
    expect(canCatchWithPointer('grab')).toBe(true)
    expect(canCatchWithPointer('touch')).toBe(true)
  })

  it('the ray is not: pointing from afar catches nothing', () => {
    // It is what tells this game apart from a shooter: the ray reaches any
    // distance and would turn catching the sticks into pointing and shooting. It is left
    // only for handling the menu.
    expect(canCatchWithPointer('ray')).toBe(false)
  })

  it('the mouse is still valid, which is how it is played on desktop', () => {
    expect(canCatchWithPointer('mouse')).toBe(true)
    // Mouse events do not always carry the pointer type.
    expect(canCatchWithPointer(undefined)).toBe(true)
  })

  it('a new pointer of the library can grab sticks by default', () => {
    // We prefer something unknown working to it no longer responding without
    // anyone noticing: the only case that is closed is the ray, explicitly.
    expect(canCatchWithPointer('lines')).toBe(true)
  })
})

describe('a stick is grabbed until it touches the floor', () => {
  it('grabbing it while it still hangs from the hoop is valid', () => {
    // Product decision: getting ahead of the stick is playing, not cheating. If
    // this case were closed the reflex bonus would have to be redone, which today
    // pays the maximum precisely for grabbing it before it falls.
    expect(canCatchStick('hanging', false)).toBe(true)
  })

  it('grabbing it in flight is valid, which is the normal case', () => {
    expect(canCatchStick('falling', false)).toBe(true)
  })

  it('the stick that already touched the floor is not picked up', () => {
    // It stays lying there so that the floor counts the misses, but it is scenery:
    // picking it up would erase a miss already done.
    expect(canCatchStick('missed', false)).toBe(false)
  })

  it('the stick already caught does not count again', () => {
    // The two controllers of the headset can reach the same stick in the same frame.
    expect(canCatchStick('caught', false)).toBe(false)
  })

  it('with the run stopped nothing is grabbed, whether it hangs or falls', () => {
    // The countdown comes in here: during those three seconds the sticks hang
    // in view and still, and without this guard the hoop was emptied with clicks before
    // the run started.
    expect(canCatchStick('hanging', true)).toBe(false)
    expect(canCatchStick('falling', true)).toBe(false)
  })
})

describe('the buttons of the headset panel', () => {
  it('back to the menu is where it is painted, without moving', () => {
    // The button is painted in one place and the box that picks up the press comes from
    // here: if they disagreed, the button would not respond and it would only be seen with the headset on.
    expect(xrQuitButtonPosition()).toEqual(XR_QUIT_POSITION)
  })

  it('start goes in the menu panel, below its centre', () => {
    const play = xrPlayButtonPosition()

    expect(play[0]).toBeCloseTo(XR_MENU_POSITION[0], 9)
    expect(play[1]).toBeLessThan(XR_MENU_POSITION[1])
    expect(play[2]).toBeCloseTo(XR_MENU_POSITION[2], 9)
  })

  it('the levels are laid out in a row and centred in the panel', () => {
    const total = 5
    const cells = Array.from({ length: total }, (_, i) => xrLevelOptionPosition(i + 1, total, DESK))
    const xs = cells.map(([x]) => x)

    expect(xs[0]).toBeLessThan(xs[total - 1])
    expect((xs[0] + xs[total - 1]) / 2).toBeCloseTo(DESK.position[0], 9)
    for (const [, y, z] of cells) {
      expect(y).toBe(cells[0][1])
      expect(z).toBe(DESK.position[2])
    }
  })

  it('a single level is put in the centre, without sticking out', () => {
    expect(xrLevelOptionPosition(1, 1, DESK)[0]).toBeCloseTo(DESK.position[0], 9)
  })

  it('the sticks of the picker go in a row and do not step on each other', () => {
    const sticks = Array.from({ length: MAX_STICKS }, (_, i) => xrStickOptionPosition(i, DESK))
    const xs = sticks.map(([x]) => x)

    expect(new Set(xs).size).toBe(MAX_STICKS)
    expect((xs[0] + xs[MAX_STICKS - 1]) / 2).toBeCloseTo(DESK.position[0], 9)
  })
})

describe('the difficulty tokens', () => {
  it('go in a row, centred and in the order of the menu', () => {
    const tokens = DIFFICULTY_ORDER.map((d) => xrDifficultyOptionPosition(d, DESK))
    const xs = tokens.map(([x]) => x)

    expect([...xs].sort((a, b) => a - b)).toEqual(xs)
    expect((xs[0] + xs[xs.length - 1]) / 2).toBeCloseTo(DESK.position[0], 9)
    for (const [, y] of tokens) expect(y).toBe(tokens[0][1])
  })
})

describe('who is playing: controllers or bare hands', () => {
  it('only hands connected: it is played with the hands', () => {
    expect(playingBareHanded(['hand', 'hand'])).toBe(true)
  })

  it('with a controller connected the controller rules, even if there are hands', () => {
    // The headset announces the controllers even if they are on the table, but also the other
    // way round: whoever has them in the hand usually has both things published.
    // What is shown has to be what is being held.
    expect(playingBareHanded(['controller', 'hand'])).toBe(false)
    expect(playingBareHanded(['controller', 'controller'])).toBe(false)
  })

  it('with nothing connected yet the controller is taken for granted', () => {
    // It is what most people bring, and it is the state of the first frame of the
    // session: starting by drawing a hand to change it straight away would be a
    // flicker in front of the face.
    expect(playingBareHanded([])).toBe(false)
  })

  it('what is neither controller nor hand does not count as hands', () => {
    // Gaze and screen touch are other WebXR input modes.
    expect(playingBareHanded(['gaze', 'screenInput'])).toBe(false)
  })
})

/**
 * The menu column in the headset: the common rule of the hall's games (`.claude/rules/xr.md`,
 * «La columna va lejos y a la izquierda, fuera de donde se juega»).
 */
describe('the menu column goes far, to the left, near the front and outside the hoop', () => {
  const buttons: Array<[string, Vec3]> = [
    ['the centre', XR_MENU_POSITION],
    ['leave the headset', xrMenuExitPosition()],
    ['more options', xrMenuOptionsPosition()],
    ['the mode', xrModeTogglePosition()],
    ['endless', xrEndlessTogglePosition()],
    ['the scenery', xrSceneryPickerPosition()],
    ['lower the hoop', xrHoopDownPosition()],
    ['raise the hoop', xrHoopUpPosition()],
    ['see the tutorial again', xrMenuTutorialPosition()],
    ['start', xrPlayButtonPosition()],
    ['the first stick', xrStickOptionPosition(0)],
    ['the last stick', xrStickOptionPosition(MAX_STICKS - 1)],
  ]

  /** Which way it lies, in radians: positive to the left. */
  const azimuth = ([x, , z]: Vec3) => Math.atan2(-x, -z)

  it('its centre, a metre and a half from the eyes and to the left, without going past 30° from the front', () => {
    const [x, y, z] = XR_MENU_POSITION
    expect(Math.hypot(x, z)).toBeGreaterThanOrEqual(1.4)
    expect(Math.hypot(x, z)).toBeLessThanOrEqual(1.6)
    expect((azimuth(XR_MENU_POSITION) * 180) / Math.PI).toBeGreaterThan(0)
    expect((azimuth(XR_MENU_POSITION) * 180) / Math.PI).toBeLessThanOrEqual(30 + 1e-9)
    expect(y).toBe(REFERENCE_EYE_HEIGHT)
  })

  it('facing whoever plays', () => {
    const [x, , z] = XR_MENU_POSITION
    const normal = [Math.sin(XR_MENU_POSE.yaw), Math.cos(XR_MENU_POSE.yaw)]
    const towards = [-x, -z].map((v) => v / Math.hypot(x, z))
    expect(normal[0] * towards[0] + normal[1] * towards[1]).toBeCloseTo(1, 9)
  })

  it('only with a headset: without it —the hall on desktop— the menu stays in front', () => {
    expect(menuPoseFor(true)).toBe(XR_MENU_POSE)
    expect(menuPoseFor(false)).toBe(XR_MENU_DESK_POSE)
    expect(XR_MENU_DESK_POSE.yaw).toBe(0)
  })

  it('the button that opens it while playing goes on the same side', () => {
    expect(XR_QUIT_POSITION[0]).toBeLessThan(0)
    expect(XR_MENU_POSITION[0]).toBeLessThan(0)
  })

  it.each(buttons)('%s stays outside the hoop of the machine', (_, [x, , z]) => {
    // The hoop is centred one step in front of the player (`PLAYER_OFFSET_Z`) and the sticks
    // hang from it: the column cannot fall among them.
    expect(Math.hypot(x, z + PLAYER_OFFSET_Z)).toBeGreaterThan(MACHINE_RADIUS + 0.4)
  })

  it.each(buttons)('%s is looked at by turning the head, without the ui fleeing', (_, position) => {
    // Towards the left the dead zone of the anchoring is lengthened by how far aside the
    // column is (`XRGazeAnchor`); with margin, like the rest.
    expect(azimuth(position)).toBeGreaterThan(0)
    expect(azimuth(position)).toBeLessThan((XR_ANCHOR_DEADZONE + XR_COLUMN.azimuth) * 0.85)
  })

  it.each(buttons)('%s stays at a height that is looked at without craning the neck', (_, position) => {
    const [x, y, z] = position
    const degrees = (Math.atan2(y - REFERENCE_EYE_HEIGHT, Math.hypot(x, z)) * 180) / Math.PI
    expect(degrees).toBeLessThan(20)
    expect(degrees).toBeGreaterThan(-35)
  })

  it('the panel is enlarged and turns whole: a point of the panel falls where three paints it', () => {
    // Scaling and then turning around the vertical, which is what three does with the group.
    const [x, y, z] = onMenu(0.1, 0.2)
    const [cx, cy, cz] = XR_MENU_POSITION
    const s = XR_MENU_POSE.scale
    expect(y - cy).toBeCloseTo(0.2 * s, 9)
    expect(Math.hypot(x - cx, z - cz)).toBeCloseTo(0.1 * s, 9)
    // And what in the panel is on the right, whoever plays sees on the right.
    expect(azimuth([x, y, z])).toBeLessThan(azimuth(XR_MENU_POSITION))
  })
})
