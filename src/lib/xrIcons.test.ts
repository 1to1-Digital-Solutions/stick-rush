import { describe, expect, it } from 'vitest'
import { CylinderGeometry, Euler, Vector3 } from 'three'
import {
  XR_CHECK_ICON,
  XR_HEART_ICON,
  XR_HOME_ICON,
  XR_MUTED_ICON,
  XR_SOUND_ICON,
  XR_TRIANGLE_CENTER,
  XR_TRIANGLE_ROTATION,
  sceneMountains,
  type IconPoint,
  type IconShape,
  type TriangleTip,
} from './xrIcons'

/**
 * The icons of the immersive ui are the only thing that explains each button: without
 * fonts there is no label that will do, and a drawing that is not understood leaves the
 * player stuck inside the headset. What is checked here is the shape —that
 * the house has a roof, that the arrow has a tip, that the door is open—,
 * because it is exactly what failed on trying it with the headset on.
 */

type Polygon = readonly IconPoint[]

/** Points where the silhouette cuts a horizontal, sorted. */
function crossingsAtY(polygon: Polygon, y: number): number[] {
  return crossings(polygon, 1, y, 0)
}

/** Points where the silhouette cuts a vertical, sorted. */
function crossingsAtX(polygon: Polygon, x: number): number[] {
  return crossings(polygon, 0, x, 1)
}

function crossings(
  polygon: Polygon,
  axis: 0 | 1,
  at: number,
  other: 0 | 1,
): number[] {
  const hits: number[] = []
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    if (a[axis] === b[axis]) continue
    const t = (at - a[axis]) / (b[axis] - a[axis])
    if (t < 0 || t > 1) continue
    hits.push(a[other] + t * (b[other] - a[other]))
  }
  return hits.sort((p, q) => p - q)
}

/** How much the silhouette spans along a straight line. */
function span(hits: number[]): number {
  return hits.length < 2 ? 0 : hits[hits.length - 1] - hits[0]
}

/** Point inside the silhouette, by ray casting. */
function contains(polygon: Polygon, [px, py]: IconPoint): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const crosses =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

/** Do two segments cross? */
function segmentsCross(
  [ax, ay]: IconPoint,
  [bx, by]: IconPoint,
  [cx, cy]: IconPoint,
  [dx, dy]: IconPoint,
): boolean {
  const side = (
    px: number,
    py: number,
    qx: number,
    qy: number,
    rx: number,
    ry: number,
  ) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px))
  return (
    side(ax, ay, bx, by, cx, cy) !== side(ax, ay, bx, by, dx, dy) &&
    side(cx, cy, dx, dy, ax, ay) !== side(cx, cy, dx, dy, bx, by)
  )
}

function isSimple(polygon: Polygon): boolean {
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Adjacent sides share an end: touching there is normal.
      if (j === (i + 1) % n || i === (j + 1) % n) continue
      const cross = segmentsCross(
        polygon[i],
        polygon[(i + 1) % n],
        polygon[j],
        polygon[(j + 1) % n],
      )
      if (cross) return false
    }
  }
  return true
}

/** All the outlines of the icon, holes included. */
function paths(icon: IconShape): Polygon[] {
  return icon.flatMap((path) => [path.outline, ...(path.holes ?? [])])
}

/** Distance from a point to a centre. */
function radius([x, y]: IconPoint, [cx, cy]: IconPoint): number {
  return Math.hypot(x - cx, y - cy)
}

/** Ends of the icon along an axis. */
function bounds(icon: IconShape, axis: 0 | 1): [number, number] {
  const values = paths(icon)
    .flat()
    .map((point) => point[axis])
  return [Math.min(...values), Math.max(...values)]
}

const ICONS: [string, IconShape][] = [
  ['house', XR_HOME_ICON],
  ['sound', XR_SOUND_ICON],
  ['mute', XR_MUTED_ICON],
  ['life', XR_HEART_ICON],
  ['check', XR_CHECK_ICON],
]

describe('the silhouettes are well formed', () => {
  for (const [name, icon] of ICONS) {
    it(`the ${name} fits in the normalised square`, () => {
      for (const polygon of paths(icon)) {
        for (const [x, y] of polygon) {
          expect(Math.abs(x)).toBeLessThanOrEqual(1)
          expect(Math.abs(y)).toBeLessThanOrEqual(1)
        }
      }
    })

    it(`the ${name} makes use of the whole square`, () => {
      // Without this, two icons with the same `size` would be seen at different
      // sizes and the row of buttons would look out of line.
      const [minX, maxX] = bounds(icon, 0)
      const [minY, maxY] = bounds(icon, 1)
      expect(maxX - minX).toBeGreaterThan(1.7)
      expect(maxY - minY).toBeGreaterThan(1.7)
    })

    it(`the ${name} is centred in its square`, () => {
      // The icon is placed by its origin, so if the silhouette goes off centre
      // inside the square the drawing leaves the centre of its plate. The slack
      // lets through the house resting on the floor of the square —the roof reaches
      // higher than the body— without it being noticed inside the button.
      const [minX, maxX] = bounds(icon, 0)
      const [minY, maxY] = bounds(icon, 1)
      expect(Math.abs(minX + maxX) / 2).toBeLessThan(0.1)
      expect(Math.abs(minY + maxY) / 2).toBeLessThan(0.1)
    })

    it(`the ${name} does not cross itself`, () => {
      // An outline that crosses itself triangulates the wrong way round and comes out with holes.
      for (const polygon of paths(icon)) {
        expect(isSimple(polygon)).toBe(true)
      }
    })
  }
})

describe('the house reads as a house', () => {
  const [front] = XR_HOME_ICON
  const outline = front.outline
  const body = span(crossingsAtY(outline, -0.5))

  it('the roof ends in a point over the body', () => {
    // Measured under the peak of the silhouette itself, not at a fixed height: if the
    // roof flattens, the icon becomes just any box.
    const peak = Math.max(...outline.map(([, y]) => y))
    expect(span(crossingsAtY(outline, peak - 0.1))).toBeLessThan(body / 3)
  })

  it('the eaves stick out from the body', () => {
    const eaves = Math.max(...outline.map(([x]) => Math.abs(x))) * 2
    expect(eaves).toBeGreaterThan(body)
  })

  it('the door opens in the facade, not outside', () => {
    const [door] = front.holes ?? []
    expect(door).toBeDefined()
    for (const point of door) {
      expect(contains(outline, point)).toBe(true)
    }
    // And at the bottom: a door at mid height is a window.
    expect(Math.max(...door.map(([, y]) => y))).toBeLessThan(0)
  })
})


describe('the life reads as a heart', () => {
  const [heart] = XR_HEART_ICON
  const outline = heart.outline

  it('has two separate lobes at the top', () => {
    // Without the notch in the centre a shield is left, which does not say "life". The
    // horizontal that goes above the valley cuts four times: it goes in and out
    // of each lobe.
    expect(crossingsAtY(outline, 0.6)).toHaveLength(4)
    expect(contains(outline, [0, 0.6])).toBe(false)
    expect(contains(outline, [-0.5, 0.6])).toBe(true)
    expect(contains(outline, [0.5, 0.6])).toBe(true)
  })

  it('ends in a point at the bottom', () => {
    // The heart is painted at four centimetres and three in a row: what
    // tells the silhouette apart from a circle is the tip.
    const waist = span(crossingsAtY(outline, 0.2))
    expect(span(crossingsAtY(outline, -0.7))).toBeLessThan(waist / 4)
  })

  it('is solid inside', () => {
    // A heart with a hollow outline is lost at a distance; the one of the menu is
    // told apart from the spent one by the colour of its fill, not by the silhouette.
    expect(contains(outline, [0, 0])).toBe(true)
    expect(contains(outline, [0, 0.4])).toBe(true)
  })
})

/** Mouth of the speaker: the waves come out from there, and there is the focus of their arcs. */
function speakerMouth(speaker: Polygon): IconPoint {
  return [Math.max(...speaker.map(([x]) => x)), 0]
}

describe('the sound reads as a speaker sounding', () => {
  const [speaker, near, far] = XR_SOUND_ICON
  const focus = speakerMouth(speaker.outline)
  const [mouthX] = focus

  it('the cone widens towards where the sound comes out', () => {
    // Without a cone it is a box, and a box is not a speaker.
    const back = span(crossingsAtX(speaker.outline, -0.9))
    const front = span(crossingsAtX(speaker.outline, mouthX - 0.05))
    expect(front).toBeGreaterThan(back * 2)
  })

  it('the waves come out of the speaker without sticking to it', () => {
    for (const wave of [near, far]) {
      const start = Math.min(...wave.outline.map(([x]) => x))
      expect(start).toBeGreaterThan(mouthX + 0.1)
    }
  })

  it('one wave goes outside the other, without overlapping', () => {
    const inner = Math.max(...near.outline.map((point) => radius(point, focus)))
    const outer = Math.min(...far.outline.map((point) => radius(point, focus)))
    expect(inner).toBeLessThan(outer)
  })

  it('the waves are arcs, not discs', () => {
    // Filled they would be two blots around the speaker; what reads as
    // sound is the gap between them.
    for (const wave of [near, far]) {
      expect(contains(wave.outline, focus)).toBe(false)
      // But the stroke of the arc does have body: at mid distance between its
      // two edges there is silhouette.
      const radii = wave.outline.map((point) => radius(point, focus))
      const middle = (Math.min(...radii) + Math.max(...radii)) / 2
      expect(contains(wave.outline, [focus[0] + middle, 0])).toBe(true)
    }
  })
})

describe('the mute reads as the same speaker silenced', () => {
  const [speaker, cross] = XR_MUTED_ICON
  const [mouthX] = speakerMouth(speaker.outline)
  const [minX, maxX] = bounds([cross], 0)
  const center: IconPoint = [(minX + maxX) / 2, 0]

  it('is the speaker of the sound icon, not another drawing', () => {
    // The two states are the same control: if the silhouettes of the speaker
    // drift apart, on toggling the button it looks as if it changes function.
    expect(speaker.outline).toEqual(XR_SOUND_ICON[0].outline)
  })

  it('the cross takes the place of the waves and does not cross the speaker', () => {
    // Striking the silhouette through with a bar of the same fill is not seen as a
    // strike-through: it is seen as a single blot.
    expect(minX).toBeGreaterThan(mouthX + 0.1)
  })

  it('the four arms of the cross go on the diagonal', () => {
    // Straightened it would be a plus sign, which reads as "add", not as "off".
    const arm = 0.3
    const diagonal = arm * Math.SQRT1_2
    for (const [dx, dy] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      expect(
        contains(cross.outline, [
          center[0] + dx * diagonal,
          center[1] + dy * diagonal,
        ]),
      ).toBe(true)
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      expect(
        contains(cross.outline, [center[0] + dx * arm, center[1] + dy * arm]),
      ).toBe(false)
    }
  })
})

describe('the check reads as a check mark', () => {
  const [check] = XR_CHECK_ICON
  const outline = check.outline
  const elbow = outline.reduce((best, point) => (point[1] < best[1] ? point : best))

  it('the elbow falls at the bottom and to the left', () => {
    // With the vertex centred it would be a V, which does not say "done".
    expect(elbow[0]).toBeLessThan(0)
    expect(elbow[1]).toBeCloseTo(-1)
  })

  it('one arm is much longer than the other', () => {
    const tip = outline.reduce((best, point) => (point[0] > best[0] ? point : best))
    const start = outline.reduce((best, point) => (point[0] < best[0] ? point : best))
    const long = Math.hypot(tip[0] - elbow[0], tip[1] - elbow[1])
    const short = Math.hypot(start[0] - elbow[0], start[1] - elbow[1])
    expect(long).toBeGreaterThan(short * 1.5)
  })

  it('is a stroke with a gap, not a filled wedge', () => {
    // What is read at a metre is the broken line; filled inside it would be
    // a triangular blot, indistinguishable from the plane next to it.
    expect(contains(outline, [0, 0.4])).toBe(false)
    // But the stroke has body: on the line of the short arm there is silhouette.
    expect(contains(outline, [-0.8, 0.15])).toBe(true)
  })
})

/**
 * The triangles are not silhouettes: they are painted with a three-sided prism and the
 * only thing that has to be got right is the turn. It is checked here because by eye a
 * bad composition cannot be told apart from the good one in the code —and in the headset it can:
 * the start button showed the edge of the prism, one centimetre of thickness
 * instead of the play symbol—.
 */
describe('the triangles face the player', () => {
  const TIPS: TriangleTip[] = ['up', 'down', 'right']

  /** Where the tip of each one has to fall. */
  const TIP_DIRECTION: Record<TriangleTip, Vector3> = {
    up: new Vector3(0, 1, 0),
    down: new Vector3(0, -1, 0),
    right: new Vector3(1, 0, 0),
  }

  /** Corners of the prism as three generates it, of radius 1. */
  function prismCorners(): Vector3[] {
    const geometry = new CylinderGeometry(1, 1, 0.2, 3)
    const position = geometry.attributes.position
    const point = new Vector3()
    const unique = new Map<string, Vector3>()

    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i)
      // The centre of each cap falls on the axis and is not a corner.
      if (Math.hypot(point.x, point.z) < 0.5) continue
      // The loop is closed by repeating the first vertex with a hair of floating
      // point error, so it is rounded before counting it as different.
      const key = [point.x, point.y, point.z]
        .map((n) => (Math.abs(n) < 1e-6 ? 0 : n).toFixed(3))
        .join(':')
      unique.set(key, point.clone())
    }
    return [...unique.values()]
  }

  /**
   * The three corners of the drawing the player sees, in units of `size`: a
   * single face of the prism, already turned and repositioned by its centre.
   */
  function triangleCorners(tip: TriangleTip): Vector3[] {
    const rotation = new Euler(...XR_TRIANGLE_ROTATION[tip])
    const [cx, cy] = XR_TRIANGLE_CENTER[tip]
    return prismCorners()
      .filter((corner) => corner.y > 0)
      .map((corner) => corner.applyEuler(rotation).sub(new Vector3(cx, cy, 0)))
  }

  it('the prism of three is born vertical and with a vertex at the front', () => {
    // It is the convention everything else hangs from: if three changed where
    // it starts laying out the vertices, the turns here would take the
    // tip somewhere else without anything else noticing.
    const corners = prismCorners()
    expect(corners).toHaveLength(6)

    const front = corners.filter((corner) => corner.z > 0.99)
    expect(front).toHaveLength(2)
    for (const corner of front) expect(corner.x).toBeCloseTo(0)
  })

  it.each(TIPS)('«%s» leaves the thickness towards the player, not edge-on', (tip) => {
    // The axis of the prism is its thickness: looking at the player, the drawing is seen
    // whole; pointing to one side, the one-centimetre sliver the start button
    // had is seen.
    const axis = new Vector3(0, 1, 0).applyEuler(
      new Euler(...XR_TRIANGLE_ROTATION[tip]),
    )
    expect(Math.abs(axis.z)).toBeCloseTo(1)

    // And the drawing really takes up the two directions that are seen.
    const corners = triangleCorners(tip)
    for (const axisName of ['x', 'y'] as const) {
      const values = corners.map((corner) => corner[axisName])
      expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(1)
    }
  })

  it.each(TIPS)('«%s» points where its name says', (tip) => {
    const forward = TIP_DIRECTION[tip]
    const across = new Vector3(-forward.y, forward.x, 0)
    const corners = triangleCorners(tip)

    // A single corner goes ahead: that is the tip, and it falls on the axis.
    const ahead = corners.filter((corner) => corner.dot(forward) > 0)
    expect(ahead).toHaveLength(1)
    expect(ahead[0].dot(across)).toBeCloseTo(0)

    // The other two form the flat side, symmetric about that same axis.
    const behind = corners.filter((corner) => corner.dot(forward) < 0)
    expect(behind).toHaveLength(2)
    expect(behind[0].dot(across) + behind[1].dot(across)).toBeCloseTo(0)
  })

  it.each(TIPS)('«%s» ends up centred on its plate', (tip) => {
    // At the same `position`, a triangle and a silhouette have to fall in the
    // same place of the button: without repositioning it, the drawing shifts towards the tip
    // by a quarter of its size.
    const corners = triangleCorners(tip)
    for (const axis of ['x', 'y'] as const) {
      const values = corners.map((corner) => corner[axis])
      expect((Math.min(...values) + Math.max(...values)) / 2).toBeCloseTo(0)
    }
  })
})

/**
 * The scenery icon had the textbook failure: the two mountains with the vertex pointing
 * down, that is two inverted wedges and a moon. It is checked against the real geometry of
 * three because by eye, in the code, a tip up and a tip down are written the same.
 */
describe('the mountains of the scenery icon', () => {
  const SIZE = 0.04

  /** The three corners of a mountain already turned and placed, in the player's plane. */
  function corners(m: { radius: number; x: number; y: number }): Vector3[] {
    const rotation = new Euler(...XR_TRIANGLE_ROTATION.up)
    const geometry = new CylinderGeometry(m.radius, m.radius, 0.01, 3)
    const position = geometry.attributes.position
    const point = new Vector3()
    const unique = new Map<string, Vector3>()
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i)
      if (Math.hypot(point.x, point.z) < m.radius * 0.5) continue
      if (point.y < 0) continue
      const turned = point.clone().applyEuler(rotation)
      // The signed zero counts as another corner if it is not normalised, same as above.
      const key = [turned.x, turned.y]
        .map((n) => (Math.abs(n) < 1e-6 ? 0 : n).toFixed(4))
        .join(':')
      unique.set(key, turned.add(new Vector3(m.x, m.y, 0)))
    }
    return [...unique.values()]
  }

  it('point upwards, not downwards', () => {
    for (const m of sceneMountains(SIZE)) {
      const ys = corners(m).map((c) => c.y)
      const peak = Math.max(...ys)
      const base = Math.min(...ys)
      // A mountain has ONE vertex at the top and TWO at the bottom. Upside down it is just the opposite,
      // and that count is what tells the two shapes apart.
      const above = ys.filter((y) => y > (peak + base) / 2)
      expect(above).toHaveLength(1)
    }
  })

  it('rest on the same ground', () => {
    // With different radii, centring them at the same height leaves them at different heights: one
    // mountain floating over the other is half a landscape.
    const bases = sceneMountains(SIZE).map((m) => Math.min(...corners(m).map((c) => c.y)))
    for (const base of bases) expect(base).toBeCloseTo(bases[0], 6)
  })

  it('the moon ends up above the two peaks', () => {
    // Otherwise, it is not a moon: it is a stone wedged in the hillside.
    const MOON_Y = SIZE * 0.85 - SIZE * 0.2
    for (const m of sceneMountains(SIZE)) {
      const peak = Math.max(...corners(m).map((c) => c.y))
      expect(MOON_Y).toBeGreaterThan(peak)
    }
  })
})
