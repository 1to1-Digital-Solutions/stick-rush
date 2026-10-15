/**
 * Silhouettes of the icons of the immersive ui.
 *
 * In VR/AR there are no letters: drei's `<Text>` downloads the fonts from a CDN that the
 * CSP blocks, so each button is explained with a drawing. The first icons
 * were built by stacking primitives (a triangular prism next to a box) and in
 * the headset they could not be read: two parts close together are seen as two objects, not as one
 * figure. Here an icon is a **closed outline** —a single silhouette— from which the
 * geometry is taken; what is drawn is exactly what is seen.
 *
 * The points go in the normalised square [-1, 1], so the `size` of the
 * component is half the side of the icon and two icons with the same `size` are
 * seen at the same size. It lives in `lib` and not in the component because the shape can be
 * checked without a browser: that the roof crowns the house or that the tip of the
 * arrow is wider than the shaft are precisely the failures that were seen with the
 * headset on.
 */

/** Point of the outline, in the normalised square [-1, 1]. */
export type IconPoint = readonly [number, number]

/** A part of the icon: its outline and, if it has them, its holes. */
export type IconPath = {
  readonly outline: readonly IconPoint[]
  readonly holes?: readonly (readonly IconPoint[])[]
}

/** An icon is one or more independent parts. */
export type IconShape = readonly IconPath[]

/**
 * House: back to the menu.
 *
 * Silhouette in one part (roof, eaves and body) with the door as a hole. The
 * eaves stick out from the body so that the roof reads even if the icon is
 * five centimetres at a metre away.
 */
export const XR_HOME_ICON: IconShape = [
  {
    outline: [
      [0, 1],
      [1, 0.06],
      [0.66, 0.06],
      [0.66, -0.88],
      [-0.66, -0.88],
      [-0.66, 0.06],
      [-1, 0.06],
    ],
    holes: [
      [
        [-0.25, -0.84],
        [0.25, -0.84],
        [0.25, -0.16],
        [-0.25, -0.16],
      ],
    ],
  },
]

/**
 * Heart: one life.
 *
 * It is what the challenge mode puts at stake, and the only thing that explains it in the
 * headset: three lit hearts in the menu are the three lives you
 * start with, and on the scoreboard the ones that are left. It is drawn in one part —two lobes
 * at the top and a tip at the bottom— because at a metre away two half circles and a
 * triangle read as three loose objects, which is what already failed with the
 * first icons of the menu.
 */
export const XR_HEART_ICON: IconShape = [
  {
    outline: [
      [0, 0.471],
      [0.011, 0.533],
      [0.082, 0.682],
      [0.242, 0.835],
      [0.478, 0.904],
      [0.731, 0.842],
      [0.927, 0.66],
      [1, 0.409],
      [0.927, 0.143],
      [0.731, -0.107],
      [0.478, -0.335],
      [0.242, -0.544],
      [0.082, -0.726],
      [0.011, -0.856],
      [0, -0.904],
      [-0.011, -0.856],
      [-0.082, -0.726],
      [-0.242, -0.544],
      [-0.478, -0.335],
      [-0.731, -0.107],
      [-0.927, 0.143],
      [-1, 0.409],
      [-0.927, 0.66],
      [-0.731, 0.842],
      [-0.478, 0.904],
      [-0.242, 0.835],
      [-0.082, 0.682],
      [-0.011, 0.533],
    ],
  },
]

/**
 * Body of the speaker, common to the sound icon and the mute one: box and cone.
 *
 * The two states share a silhouette on purpose. What changes is what comes out
 * of the cone —waves or a cross—, so the button reads as the same control in two
 * positions and not as two different buttons.
 */
const SPEAKER_OUTLINE: readonly IconPoint[] = [
  [-0.95, -0.3],
  [-0.45, -0.3],
  [-0.05, -0.88],
  [-0.05, 0.88],
  [-0.45, 0.3],
  [-0.95, 0.3],
]

/**
 * Speaker with waves: the game sounds.
 *
 * The waves are two arcs concentric with the vertex of the cone, detached from it and
 * from each other: stuck together they merge into a blot and the icon stops being readable at a
 * metre, which is the failure the first icons of the menu already had.
 */
export const XR_SOUND_ICON: IconShape = [
  { outline: SPEAKER_OUTLINE },
  {
    outline: [
      [0.26, -0.49],
      [0.46, -0.28],
      [0.53, 0],
      [0.46, 0.28],
      [0.26, 0.49],
      [0.16, 0.34],
      [0.3, 0.19],
      [0.35, 0],
      [0.3, -0.19],
      [0.16, -0.34],
    ],
  },
  {
    outline: [
      [0.47, -0.83],
      [0.81, -0.48],
      [0.93, 0],
      [0.81, 0.48],
      [0.47, 0.83],
      [0.37, 0.68],
      [0.65, 0.39],
      [0.75, 0],
      [0.65, -0.39],
      [0.37, -0.68],
    ],
  },
]

/**
 * Speaker with a cross: the game is muted.
 *
 * The cross takes the place of the waves instead of crossing the speaker. Striking the
 * silhouette through with a bar of the same colour is not seen as a strike-through: it is seen as a
 * single blot, because the fill of the two parts is the same.
 */
export const XR_MUTED_ICON: IconShape = [
  { outline: SPEAKER_OUTLINE },
  {
    // Cross in one part: a plus sign turned 45°, with its four arms on the diagonal.
    outline: [
      [0.53, 0.23],
      [0.73, 0.43],
      [0.96, 0.21],
      [0.76, 0],
      [0.96, -0.21],
      [0.73, -0.43],
      [0.53, -0.23],
      [0.33, -0.43],
      [0.1, -0.21],
      [0.3, 0],
      [0.1, 0.21],
      [0.33, 0.43],
    ],
  },
]

/**
 * Musical note: the background music sounds.
 *
 * Head, stem and flag in a single part, with the stroke as thick as that
 * of the speaker: at a metre what is read is the silhouette, and a note of thin
 * lines falls apart before arriving.
 */
export const XR_MUSIC_ICON: IconShape = [
  {
    outline: [
      [-0.62, -0.5],
      [-0.62, -0.86],
      [-0.28, -0.86],
      [-0.28, -0.14],
      [-0.06, -0.14],
      [-0.06, 0.62],
      [0.5, 0.44],
      [0.5, 0.86],
      [-0.28, 1],
      [-0.28, -0.5],
    ],
  },
]

/**
 * The same note with a cross beside it: the music is off.
 *
 * The cross takes the place of the flag instead of crossing the note, for the same reason
 * as in the muted speaker: striking the silhouette through with a bar of the same fill
 * is seen as a blot, not as a strike-through.
 */
export const XR_MUSIC_OFF_ICON: IconShape = [
  {
    outline: [
      [-0.62, -0.5],
      [-0.62, -0.86],
      [-0.28, -0.86],
      [-0.28, -0.14],
      [-0.06, -0.14],
      [-0.06, 0.62],
      [0.5, 0.44],
      [0.5, 0.86],
      [-0.28, 1],
      [-0.28, -0.5],
    ],
  },
  {
    // Cross in one part: a plus sign turned 45°, with its four arms on the diagonal.
    outline: [
      [0.53, -0.23],
      [0.73, -0.03],
      [0.96, -0.25],
      [0.76, -0.46],
      [0.96, -0.67],
      [0.73, -0.89],
      [0.53, -0.69],
      [0.33, -0.89],
      [0.1, -0.67],
      [0.3, -0.46],
      [0.1, -0.25],
      [0.33, -0.03],
    ],
  },
]

/**
 * Level star: one part with five points. Full the one earned; the missing one
 * is painted switched off and smaller, so that it does not depend only on the colour.
 */
export const XR_STAR_ICON: IconShape = [
  {
    outline: [
      [0, 1],
      [0.265, 0.364],
      [0.951, 0.309],
      [0.428, -0.139],
      [0.588, -0.809],
      [0, -0.45],
      [-0.588, -0.809],
      [-0.428, -0.139],
      [-0.951, 0.309],
      [-0.265, 0.364],
    ],
  },
]

/**
 * Check mark: done.
 *
 * It is a stroke with body and not a line: at a metre, a thin stroke disappears.
 */
export const XR_CHECK_ICON: IconShape = [
  {
    outline: [
      [-0.647, 0.272],
      [-0.246, -0.364],
      [0.65, 1],
      [0.938, 0.811],
      [-0.251, -1],
      [-0.938, 0.088],
    ],
  },
]

/**
 * The triangles of the menu —the start one, the ones to raise and lower the hoop— are not
 * silhouettes: they come from a three-sided prism (`cylinderGeometry` with three
 * segments), which is a solid part and not an outline. There the only thing that has
 * to be got right is the turn, and it is precisely what went wrong in the start button:
 * on composing two quarter turns, the axis of the prism ended up pointing to one
 * side, so instead of the play symbol its edge was seen, a sliver of
 * one centimetre.
 *
 * The prism is born with the axis vertical and a vertex at the front, so the
 * turn has to take that axis towards the player —so that the thickness faces
 * front and the drawing is seen whole— and the vertex towards where the tip falls.
 */
export type TriangleTip = 'up' | 'down' | 'right'

/** Turn that leaves the triangle facing front with the tip towards each side. */
export const XR_TRIANGLE_ROTATION: Record<
  TriangleTip,
  readonly [number, number, number]
> = {
  up: [-Math.PI / 2, 0, 0],
  down: [Math.PI / 2, 0, 0],
  // Facing front and then a quarter turn about the axis that looks at the player: the
  // tip goes from up to the right, as in any play button.
  right: [-Math.PI / 2, Math.PI / 2, 0],
}

/**
 * Where the centre of the drawing ends up relative to the axis of the prism, in units of
 * `size`.
 *
 * The tip comes out one radius from the axis and the opposite side stays at half, so
 * a triangle placed by its axis is seen shifted towards the tip. Whoever paints it
 * subtracts this so that at the same `position` all the icons fall in the same
 * place of their plate, as already happens with the silhouettes.
 */
export const XR_TRIANGLE_CENTER: Record<
  TriangleTip,
  readonly [number, number]
> = {
  up: [0, 0.25],
  down: [0, -0.25],
  right: [0.25, 0],
}

/**
 * The two mountains of the scenery icon, resting on the SAME ground line.
 *
 * It lives here and not in the component for the same reason as the rest: the shape is checked without
 * a browser. The two failures this icon can have —tip down, or one mountain floating
 * over the other— are exactly the ones that are not seen reading the JSX and are with the headset on,
 * which is the most expensive place to discover them.
 *
 * They are placed by the BASE and not by the centre: with the tip up, the base of a triangle
 * ends up half a radius below its axis, so two mountains of different radii centred
 * at the same height rest on different grounds.
 */
export type SceneMountain = { readonly radius: number; readonly x: number; readonly y: number }

/** Radius and horizontal position of each mountain, in units of `size`. */
const SCENE_MOUNTAINS: readonly { radius: number; x: number }[] = [
  { radius: 0.62, x: -0.5 },
  { radius: 0.48, x: 0.45 },
]

/** Height of the shared ground, in units of `size`: the base of the bigger mountain. */
const SCENE_GROUND = -0.31

export function sceneMountains(size: number): SceneMountain[] {
  return SCENE_MOUNTAINS.map(({ radius, x }) => ({
    radius: radius * size,
    x: x * size,
    y: (SCENE_GROUND + radius / 2) * size,
  }))
}
