/**
 * Stick Rush's headset icons as Godot meshes: the ones of the web's `XRUi.tsx`, with the shapes
 * of `lib/xrIcons.ts` as they are (the house, the heart, the star, the check mark, the mountains of
 * the scenery) and the parts the web draws with geometry (the triangles for play and for raising
 * and lowering, the frame of the room, the ring of the endless run, the repeat arrows).
 *
 * Everything comes out flat and unlit, with the kit's `shape` (`@kit/runtime/ui/mesh`), so it lights
 * up and goes dark with the button that carries it.
 */
import { Geometry2D, PackedVector2Array, Vector2, Vector3, type MeshInstance3D } from 'godot'

import { offset, arcTriangles, strokeTriangles } from '@kit/lib/ui/icons'
import type { Point2 } from '@kit/lib/ui/exit'
import { shape } from '@kit/runtime/ui/mesh'
import { RENDER_ORDER } from '@kit/runtime/ui/text3d'

import {
  XR_CHECK_ICON,
  XR_HEART_ICON,
  XR_HOME_ICON,
  XR_STAR_ICON,
  sceneMountains,
  type IconPoint,
  type IconShape,
} from '@/lib/xrIcons'

/** The triangles of an outline with no holes, through the engine's `triangulate_polygon`. */
function outlineTriangles(outline: readonly IconPoint[], scale: number): Point2[] {
  const points = new PackedVector2Array()
  for (const [x, y] of outline) points.append(new Vector2(x * scale, y * scale))
  const indices = Geometry2D.triangulate_polygon(points)
  const output: Point2[] = []
  for (let i = 0; i < indices.size(); i++) {
    const [x, y] = outline[indices.get(i)]
    output.push([x * scale, y * scale])
  }
  return output
}

/**
 * A shape of `xrIcons.ts` at `size` metres per unit. The holes (the door of the house) are
 * painted on top with `hole`, the colour of what lies behind: with a single colour per shape, that
 * is what lets it show.
 */
export function shapeIcon(iconShape: IconShape, size: number, color: string): MeshInstance3D {
  const triangles = iconShape.flatMap((path) => outlineTriangles(path.outline, size))
  return shape(triangles, color)
}

/** The holes of a shape, to paint them in the colour of the plate on top of it. */
export function shapeHoles(iconShape: IconShape, size: number, color: string): MeshInstance3D | null {
  const triangles = iconShape.flatMap((path) => (path.holes ?? []).flatMap((h) => outlineTriangles(h, size)))
  if (triangles.length === 0) return null
  // Above the shape it pierces: the drawings of a button all sit at the same distance.
  return shape(triangles, color, 1, RENDER_ORDER.texto)
}

export function homeIcon(size: number, color: string): MeshInstance3D {
  return shapeIcon(XR_HOME_ICON, size, color)
}

export function heartIcon(size: number, color: string): MeshInstance3D {
  return shapeIcon(XR_HEART_ICON, size, color)
}

export function starIcon(size: number, color: string): MeshInstance3D {
  return shapeIcon(XR_STAR_ICON, size, color)
}

export function checkIcon(size: number, color: string): MeshInstance3D {
  return shapeIcon(XR_CHECK_ICON, size, color)
}

/**
 * A triangle `2·radius` from side to side with its tip towards `tip` (the three-sided
 * `cylinderGeometry` of `XRTriangleIcon`), centred on its drawing like the web (`XR_TRIANGLE_CENTER`).
 */
export function arrowTriangles(radius: number, tip: 'up' | 'down' | 'right'): Point2[] {
  const a = Math.sqrt(3) / 2
  // An equilateral triangle inscribed in `radius`, tip up, shifted to centre the drawing.
  const up: Point2[] = [
    [0, radius * 0.75],
    [-a * radius, -radius * 0.75],
    [a * radius, -radius * 0.75],
  ].map(([x, y]) => [x, y] as Point2)
  if (tip === 'up') return up
  if (tip === 'down') return up.map(([x, y]) => [x, -y] as Point2)
  return up.map(([x, y]) => [y, -x] as Point2)
}

export function arrowIcon(radius: number, tip: 'up' | 'down' | 'right', color: string): MeshInstance3D {
  return shape(arrowTriangles(radius, tip), color)
}

/** Two mountains on the same ground and the moon: the scenery (`XRSceneIcon`, `sceneMountains`). */
export function sceneryIcon(size: number, color: string): MeshInstance3D {
  const mountains = sceneMountains(size).flatMap(({ radius, x, y }) => offset(arrowTriangles(radius, 'up'), x, y + radius * 0.25))
  const moon = offset(arcTriangles(0, size * 0.2, 0, Math.PI * 2, 12), size * 0.75, size * 0.85)
  return shape([...mountains, ...moon], color)
}

/** An empty frame: the real room, with no scenery on top (`XRPassthroughIcon`). */
export function roomIcon(size: number, color: string): MeshInstance3D {
  const g = size * 0.16
  const bar = (x: number, y: number, width: number, height: number): Point2[] => [
    [x - width / 2, y - height / 2],
    [x + width / 2, y - height / 2],
    [x + width / 2, y + height / 2],
    [x - width / 2, y - height / 2],
    [x + width / 2, y + height / 2],
    [x - width / 2, y + height / 2],
  ]
  return shape(
    [
      ...bar(0, size * 0.9, size * 2, g),
      ...bar(0, -size * 0.9, size * 2, g),
      ...bar(-size, 0, g, size * 1.8),
      ...bar(size, 0, g, size * 1.8),
    ],
    color,
  )
}

/** The ring of the endless run: whole if it reloads, half if it ends (`EndlessToggle`). */
export function endlessRingTriangles(whole: boolean): Point2[] {
  return arcTriangles(0.016, 0.028, 0, whole ? Math.PI * 2 : Math.PI, 24)
}

/** Repeat the run: an open ring with its tip (`XRRepeatIcon`). */
export function repeatIcon(size: number, color: string): MeshInstance3D {
  const ring = arcTriangles(size * 0.7, size, Math.PI * 0.35, Math.PI * 1.6, 20)
  const end = Math.PI * 0.35
  const cx = Math.cos(end) * size * 0.85
  const cy = Math.sin(end) * size * 0.85
  const tip = offset(arrowTriangles(size * 0.4, 'down'), cx, cy)
  return shape([...ring, ...tip], color)
}

/** A stroke on the plane, of the given thickness: the bars that are not boxes. */
export function strokeIcon(path: readonly Point2[], thickness: number, color: string): MeshInstance3D {
  return shape(strokeTriangles(path, thickness), color)
}

/** A rectangle of `width × height` centred on `(x, y)`: the web's plates that are not a button. */
export function rectangle(width: number, height: number, color: string, x = 0, y = 0, priority: number = RENDER_ORDER.dibujo): MeshInstance3D {
  return shape(
    [
      [x - width / 2, y - height / 2],
      [x + width / 2, y - height / 2],
      [x + width / 2, y + height / 2],
      [x - width / 2, y - height / 2],
      [x + width / 2, y + height / 2],
      [x - width / 2, y + height / 2],
    ],
    color,
    1,
    priority,
  )
}

/**
 * The icon of against whom (`XRPlayersIcon` of `XRUi.tsx`): the table between the two tokens, the
 * one on this side (player 1) below and the one opposite (player 2) above, or none if playing alone.
 * It is the siblings' one (tower-tumble draws it the same in its port). Returns one mesh per part:
 * the table and each token, centred on its place, so that the one of whoever holds the controller can
 * grow without moving.
 */
export function playersIcon(side: number, table: string, near: string, far: string | null): MeshInstance3D[] {
  const gap = side * 1.6
  const parts = [rectangle(side * 2.6, side * 0.3, table)]
  for (const [color, y] of [[near, -gap], [far, gap]] as const) {
    if (color == null) continue
    const token = rectangle(side * 1.2, side * 1.2, color)
    token.position = new Vector3(0, y, 0)
    parts.push(token)
  }
  return parts
}
