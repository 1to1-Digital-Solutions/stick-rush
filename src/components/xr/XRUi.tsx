'use client'

import { EXIT_ARROW } from './canvasPanel'
import { PANEL_ORDER } from './buttonHighlight'
import { NO_RAYCAST } from '../raycast'

import { type ReactNode, useMemo, useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { Path, Shape, Vector2 } from 'three'
import {
  DIFFICULTY_COLORS,
  DIFFICULTY_ORDER,
  type Difficulty,
} from '../../lib/gameConfig'
import { PRESS_PULSE, pulseHaptics } from '../../lib/haptics'
import {
  XR_CHECK_ICON,
  XR_HEART_ICON,
  XR_HOME_ICON,
  XR_MUSIC_ICON,
  XR_MUSIC_OFF_ICON,
  XR_MUTED_ICON,
  XR_SOUND_ICON,
  XR_STAR_ICON,
  XR_TRIANGLE_CENTER,
  XR_TRIANGLE_ROTATION,
  sceneMountains,
  type IconShape,
  type TriangleTip,
} from '../../lib/xrIcons'

/**
 * UI parts for immersive sessions.
 *
 * In VR/AR there is no DOM, so menu, scoreboard and buttons are geometry. Everything
 * here is local: no fonts, no textures, nothing that goes out to the network.
 */

/** Background of the panels: dark and semi-transparent, legible over passthrough. */
export const PANEL_COLOR = '#0f1f2b'

/** Background panel. In AR it is what lifts the UI off the real wall. */
export function XRPanel({
  width,
  height,
  color = PANEL_COLOR,
  opacity = 0.82,
}: {
  width: number
  height: number
  color?: string
  opacity?: number
}) {
  return (
    /*
      **Without writing depth, and with its place in the order.** It is a transparent plane of
      a panel, and millimetres from the buttons it carries on top the depth sorting
      decides nothing reliable: it is enough to tilt the head towards a button on the edge for the
      background to be painted AFTER it and, writing depth, to wipe it out
      (see `buttonHighlight.tsx`).
    */
    <mesh position={[0, 0, -0.02]} renderOrder={PANEL_ORDER.back}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        color={color}
        transparent
        depthWrite={false}
        opacity={opacity}
        toneMapped={false}
      />
    </mesh>
  )
}

/** Colour of the halo that marks the pointed-at button. */
const HOVER_COLOR = '#7dd3fc'

/**
 * And the one it lights up with when squeezed, which is something other than pointing at it.
 *
 * The button **sinks and changes colour** instead of disappearing: it shrinks below its
 * resting size —which at one metre reads as it going inwards— and the halo goes from
 * this blue to white and rises in intensity. Reported with the headset on: «when the button is
 * pressed, the button should still be there (react well, as if sinking, changing
 * colour and so on, fine, but not disappearing)».
 */
const PRESSED_COLOR = '#ffffff'

/** What a squeezed button shrinks to, from the 1.08 it grows to when pointed at. */
const PRESSED_SCALE = 0.98
/** The light colour the icons are painted with on a dark plate. */
const ICON_COLOR = '#e2e8f0'

/**
 * Window, in milliseconds, during which a second press is ignored.
 * The two controllers can cross over the same button, and a grab usually
 * registers the ray pointer and the touch one almost at once.
 */
const DEBOUNCE_MS = 300

/**
 * 3D button.
 *
 * It accepts any pointer —the controller's ray, the hand or the mouse—, unlike
 * the sticks, which can only be caught with the hand: a menu that had to be
 * physically touched would be awkward to handle.
 *
 * Two decisions that come from testing it in the headset:
 *
 * - **It resolves on press, not on release.** `onClick` demands pressing and releasing
 *   on the same object; aiming freehand from one metre away, the ray
 *   leaves the button between one thing and the other and the press is lost. It is the
 *   same reason why `Stick` listens to `onPointerDown`.
 * - **The focus shows.** Without a controller model the player had no way of knowing
 *   what they were pointing at. Now the pointed-at button grows *and* lights up with a halo:
 *   shape and colour, never colour alone.
 * - **The press is felt.** Pointing from afar the hand touches nothing, so
 *   the controller gives a short tap when the button is activated (`PRESS_PULSE`). It is the
 *   only confirmation that does not depend on looking at the place where something has changed.
 *
 * The sensitive area is an invisible box bigger than the button's drawing:
 * pointing in the air, a target of the exact size of the icon is missed
 * constantly. Being invisible does not exclude it from raycasting —the pointers
 * of @pmndrs/pointer-events do not look at `visible`, only at whether there are listeners.
 */
export function XRPressable({
  position,
  rotation,
  onSelect,
  children,
  hitSize,
  disabled = false,
}: {
  position: [number, number, number]
  /**
   * Turn of the whole button. The buttons set aside to one side have to face
   * the player, and the turn goes here and not on the drawing so that the plate, the
   * icon, the focus halo and the sensitive area move together: turning only the
   * plate leaves the icon crossed with it and half the drawing is lost inside.
   */
  rotation?: [number, number, number]
  onSelect: () => void
  children: ReactNode
  hitSize: [number, number, number]
  disabled?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const lastFired = useRef(0)

  const handle = (event: ThreeEvent<PointerEvent | MouseEvent>) => {
    setPressed(true)
    event.stopPropagation()
    if (disabled) return

    const now =
      typeof performance !== 'undefined' ? performance.now() : lastFired.current
    if (now - lastFired.current < DEBOUNCE_MS) return
    lastFired.current = now

    // The tap goes before the action and not after: there are buttons that close the
    // session or change the whole scene, and with the session already ended the controller
    // does not vibrate. `pulseHaptics` never throws, so bringing it forward cannot
    // take the press down with it. Only when the button is really
    // activated: a disabled one or a repeated press confirm nothing.
    pulseHaptics(event, PRESS_PULSE)
    onSelect()
  }

  const active = hovered && !disabled
  const [hitWidth, hitHeight] = hitSize

  return (
    <group
      position={position}
      rotation={rotation}
      scale={pressed ? PRESSED_SCALE : active ? 1.08 : 1}
      onPointerDown={handle}
      onPointerOver={(event) => {
        event.stopPropagation()
        if (!disabled) setHovered(true)
      }}
      onPointerUp={() => setPressed(false)}
      onPointerOut={() => {
        setHovered(false)
        setPressed(false)
      }}
    >
      {children}

      {/* Focus halo: behind the drawing, to frame it without covering it.
          **Without writing depth and with its place in the order.** A transparent plane
          of a panel does write its depth unless it is told not to, and
          millimetres from its neighbours the depth sorting flips as
          soon as the head is tilted towards a button on the edge: then the halo was
          painted before the panel's background and erased it, and the button looked like a
          hole to the scene. The whole why, in `buttonHighlight.tsx`.
          Squeezed it lights up more and changes colour: it is the only thing that says, from
          inside, that the button has heard. */}
      <mesh position={[0, 0, -0.014]} visible={active || pressed} renderOrder={PANEL_ORDER.behind}>
        <planeGeometry args={[hitWidth * 0.98, hitHeight * 0.94]} />
        <meshBasicMaterial
          color={pressed ? PRESSED_COLOR : HOVER_COLOR}
          transparent
          depthWrite={false}
          opacity={pressed ? 0.55 : 0.34}
          toneMapped={false}
        />
      </mesh>

      <mesh visible={false}>
        <boxGeometry args={hitSize} />
      </mesh>
    </group>
  )
}

/**
 * Common signature of the icons. `size` is the characteristic measurement of the drawing in
 * metres —radius in the ones that come out of a primitive, half-side in the silhouettes—,
 * and each icon brings its own, chosen to weigh the same inside its button.
 */
type IconProps = {
  position?: [number, number, number]
  size?: number
  color?: string
}

/**
 * Half-side of the silhouettes, in metres: about five and a half centimetres of icon.
 * A single one for all of them, because they share a frame and that way they do not fall out of line
 * with each other; with less, the house was visibly smaller than the repeat
 * ring in the same row of buttons.
 */
const ICON_SIZE = 0.028

/** Thickness of the triangles, in metres: they are plates, not wedges. */
const TRIANGLE_THICKNESS = 0.01

/**
 * Filled triangle, facing the player and with the tip towards wherever asked.
 *
 * The turn and the recentring come from `@/lib/xrIcons`, where they are checked without a
 * browser: getting the turn right is all there is to do well here —a wrong
 * composition leaves the prism edge on and the symbol disappears— and by
 * eye it cannot be told from the good one until one puts the headset on.
 */
function XRTriangleIcon({
  tip,
  position = [0, 0, 0],
  size = ICON_SIZE,
  color = '#ffffff',
}: IconProps & { tip: TriangleTip }) {
  const [x, y, z] = position
  const [cx, cy] = XR_TRIANGLE_CENTER[tip]

  return (
    <mesh
      position={[x - cx * size, y - cy * size, z]}
      rotation={XR_TRIANGLE_ROTATION[tip]}
    >
      <cylinderGeometry args={[size, size, TRIANGLE_THICKNESS, 3]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

/**
 * «Play» triangle: the symbol for starting, without a language.
 *
 * `size` is the radius of the prism, so the drawing comes out somewhat taller than wide
 * (1.7 × 1.5 times that measurement). With the 0.05 of when it was seen edge on, the
 * triangle would now take up almost the whole plate of the button.
 */
export function XRPlayIcon({ size = 0.032, ...props }: IconProps) {
  return <XRTriangleIcon tip="right" size={size} {...props} />
}

/**
 * Two triangles and a stop: skip what is being watched and go to the end. It is the
 * same symbol as any player's, so it needs no explaining.
 */
export function XRSkipIcon({
  position = [0, 0, 0],
  size = 0.017,
  color = '#ffffff',
}: IconProps) {
  const [x, y, z] = position

  return (
    // Moved to the left: the two triangles and the stop take up from −1.55 to
    // 1.95 times `size`, so without this the drawing would be off-centre on its
    // plate compared with the one-piece icons.
    <group position={[x - size * 0.2, y, z]}>
      <XRPlayIcon position={[-size * 0.8, 0, 0]} size={size} color={color} />
      <XRPlayIcon position={[size * 0.7, 0, 0]} size={size} color={color} />
      <mesh position={[size * 1.75, 0, 0]}>
        <boxGeometry args={[size * 0.4, size * 1.9, 0.008]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

/**
 * The bars of a level: as many as its place on the scale and each one
 * taller than the previous, in the colour that level has throughout the game.
 *
 * They grow from `y = 0` upwards, so whoever places it decides from where.
 * It is shared by the menu's picker and the tutorial: the level has to look
 * the same where it is chosen and where it is recalled, or they would be two different things.
 */
export function XRDifficultyBars({
  difficulty,
  lit,
  position = [0, 0, 0],
  scale = 1,
}: {
  difficulty: Difficulty
  /** Lit (chosen level) or dimmed in the level's colour. */
  lit: boolean
  position?: [number, number, number]
  scale?: number
}) {
  const index = DIFFICULTY_ORDER.indexOf(difficulty)
  const color = DIFFICULTY_COLORS[difficulty]

  return (
    <group position={position} scale={scale}>
      {Array.from({ length: index + 1 }, (_, bar) => {
        const height = 0.028 + bar * 0.017
        return (
          <mesh
            key={bar}
            position={[(bar - index / 2) * 0.022, height / 2, 0.004]}
          >
            <boxGeometry args={[0.013, height, 0.008]} />
            <meshStandardMaterial
              color={lit ? '#ffffff' : color}
              emissive={lit ? '#ffffff' : color}
              emissiveIntensity={lit ? 0.7 : 0.25}
              toneMapped={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}

/**
 * Triangle pointing up or down: raise or lower the hoop. Where the tip
 * falls is the only thing that tells one button from the other.
 */
export function XRArrowIcon({
  size = 0.026,
  up,
  ...props
}: IconProps & { up: boolean }) {
  return <XRTriangleIcon tip={up ? 'up' : 'down'} size={size} {...props} />
}

/**
 * Icon drawn from a silhouette of `@/lib/xrIcons`.
 *
 * Stacking primitives (a triangular prism next to a box) did not work in the
 * headset: from one metre away two nearby pieces are seen as two objects and
 * not as one figure. A closed silhouette reads at a glance.
 *
 * `size` is half the side of the icon, because the silhouettes come
 * normalised to the [-1, 1] frame.
 */
function XRShapeIcon({
  icon,
  position = [0, 0, 0],
  size = ICON_SIZE,
  color = '#ffffff',
}: IconProps & { icon: IconShape }) {
  const shapes = useMemo(
    () =>
      icon.map(({ outline, holes }) => {
        const shape = new Shape(outline.map(([x, y]) => new Vector2(x, y)))
        for (const hole of holes ?? []) {
          shape.holes.push(new Path(hole.map(([x, y]) => new Vector2(x, y))))
        }
        return shape
      }),
    [icon],
  )

  return (
    <mesh position={position} scale={size}>
      <shapeGeometry args={[shapes]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

/** House: back to the game's menu, without leaving the session. */
export function XRHomeIcon(props: IconProps) {
  return <XRShapeIcon icon={XR_HOME_ICON} {...props} />
}

/** The exit arrow, as a flat shape: the same one that is painted on the canvases. */
const EXIT_SHAPE = (() => {
  const { tip, shaft, thickness, elbow, wings } = EXIT_ARROW
  const shape = new Shape()
  shape.moveTo(tip, 0)
  shape.lineTo(elbow, wings)
  shape.lineTo(elbow, thickness / 2)
  shape.lineTo(shaft, thickness / 2)
  shape.lineTo(shaft, -thickness / 2)
  shape.lineTo(elbow, -thickness / 2)
  shape.lineTo(elbow, -wings)
  shape.closePath()
  return shape
})()

/**
 * The arrow for **exiting the game**: back to the hall.
 *
 * **A single shape for the thirteen.** Each game said «exit» in its own way —the word
 * «Exit», a cross, a door, a door with an arrow— and the cross, besides, means «close
 * this» on several panels. Reported with the headset on: «it is not clear which one is the button to
 * exit the game: sometimes a square appears, other times it says "leave"… it should be
 * unified». The shape comes from `EXIT_ARROW`, the same one painted on their canvas by the
 * games that draw the menu with text.
 */
export function XRExitIcon({
  size = 0.05,
  color = ICON_COLOR,
}: {
  size?: number
  color?: string
}) {
  return (
    <mesh scale={size} raycast={NO_RAYCAST}>
      <shapeGeometry args={[EXIT_SHAPE]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

/** Loudspeaker with waves: the game has sound. */
export function XRSoundIcon(props: IconProps) {
  return <XRShapeIcon icon={XR_SOUND_ICON} {...props} />
}

/** Heart: a life, in the mode picker and on the scoreboard. */
export function XRHeartIcon(props: IconProps) {
  return <XRShapeIcon icon={XR_HEART_ICON} {...props} />
}

/** Level star. */
export function XRStarIcon(props: IconProps) {
  return <XRShapeIcon icon={XR_STAR_ICON} {...props} />
}

/** Colour of the earned star and of the missing one. */
export const XR_STAR_COLOR = '#fbbf24'
export const XR_STAR_SPENT_COLOR = '#3f4a5a'

/**
 * Three stars in a row, the earned ones filled. The missing ones are dimmed and
 * shrink: the state is told by size and not only by colour.
 */
export function XRStarsRow({
  stars,
  position = [0, 0, 0],
  size = 0.016,
  spacing = 0.045,
}: {
  stars: number
  position?: [number, number, number]
  size?: number
  spacing?: number
}) {
  return (
    <group position={position}>
      {Array.from({ length: 3 }, (_, index) => {
        const earned = index < stars
        return (
          <XRStarIcon
            key={index}
            position={[(index - 1) * spacing, 0, 0]}
            size={earned ? size : size * 0.7}
            color={earned ? XR_STAR_COLOR : XR_STAR_SPENT_COLOR}
          />
        )
      })}
    </group>
  )
}
/** Check mark: done. */
export function XRCheckIcon(props: IconProps) {
  return <XRShapeIcon icon={XR_CHECK_ICON} {...props} />
}

/** Loudspeaker with a cross: the game is muted. */
export function XRMutedIcon(props: IconProps) {
  return <XRShapeIcon icon={XR_MUTED_ICON} {...props} />
}

/** Musical note: the background music is playing. */
export function XRMusicIcon(props: IconProps) {
  return <XRShapeIcon icon={XR_MUSIC_ICON} {...props} />
}

/** Musical note with a cross: the music is off. */
export function XRMusicOffIcon(props: IconProps) {
  return <XRShapeIcon icon={XR_MUSIC_OFF_ICON} {...props} />
}

/**
 * Two mountains and a moon: the game's scenery.
 *
 * The mountains use the `up` turn from the triangles' table, not one of their own: the one they had
 * left the face to the front but with the vertex down, so two inverted wedges
 * and a moon were seen instead of a landscape. That table is checked against the real geometry of
 * three, which is the only thing that tells «points up» from «points down» without the headset on.
 *
 * What is NOT reused is `XR_TRIANGLE_CENTER`: it serves to centre an icon on its plate, and
 * here what has to coincide is the GROUND of the two mountains. Aligning them by their centre
 * would leave them floating at different heights, which is half a landscape.
 */
export function XRSceneIcon({
  position = [0, 0, 0],
  size = 0.04,
  color = '#ffffff',
}: IconProps) {
  return (
    <group position={position}>
      {sceneMountains(size).map(({ radius, x, y }, index) => (
        <mesh
          key={index}
          position={[x, y, 0]}
          rotation={XR_TRIANGLE_ROTATION.up}
        >
          <cylinderGeometry args={[radius, radius, TRIANGLE_THICKNESS, 3]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[size * 0.75, size * 0.85, 0]}>
        <circleGeometry args={[size * 0.2, 12]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** An empty frame: the real room, with no scenery on top. */
export function XRPassthroughIcon({
  position = [0, 0, 0],
  size = 0.04,
  color = '#ffffff',
}: IconProps) {
  const thickness = size * 0.16

  return (
    <group position={position}>
      {/* Four bars that leave the centre clear. */}
      {[
        [0, size * 0.9, size * 2, thickness],
        [0, -size * 0.9, size * 2, thickness],
        [-size, 0, thickness, size * 1.8],
        [size, 0, thickness, size * 1.8],
      ].map(([x, y, width, height], index) => (
        <mesh key={index} position={[x, y, 0]}>
          <boxGeometry args={[width, height, 0.008]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

/** Two arrows turning: repeat the run. An open ring with its tip. */
export function XRRepeatIcon({
  position = [0, 0, 0],
  size = 0.04,
  color = '#ffffff',
}: IconProps) {
  return (
    <group position={position}>
      <mesh>
        <torusGeometry args={[size, size * 0.22, 8, 20, Math.PI * 1.45]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[size, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[size * 0.42, size * 0.42, 0.01, 3]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** A chip of the players icon: its colour and how much it grows. */
export interface Chip {
  color: string
  /** How much the chip grows: the one of whoever has the controller is bigger. */
  scale?: number
}

/**
 * Who is playing: a chip on this side of the table, and another one opposite if there is someone else.
 *
 * It is the siblings' "against whom" icon (`XRPlayersIcon` of tower-tumble): the table between the
 * two chips and the one opposite on top, which is where whoever plays against you is. In the menu it says
 * **how many play**: one chip or two; on the scoreboard, **whose round it is**: the same pair,
 * with the one of whoever has the controller lit and grown —colour and size at once, so that colour is
 * not the only signal (WCAG 1.4.1)—.
 */
export function XRPlayersIcon({
  size,
  table,
  near,
  far,
  position,
}: {
  /** Measurement of a chip, in metres. */
  size: number
  /** Colour of the line that acts as the table between the two. */
  table: string
  /** The chip on this side: player 1. */
  near: Chip
  /** The one opposite, player 2, or `null` when playing alone. */
  far: Chip | null
  position?: [number, number, number]
}) {
  const gap = size * 1.6

  return (
    <group position={position}>
      {/* The table between the two: without it, two loose squares do not read as two people
          facing each other. */}
      <mesh>
        <boxGeometry args={[size * 2.6, size * 0.3, 0.005]} />
        <meshStandardMaterial color={table} emissive={table} emissiveIntensity={0.3} />
      </mesh>
      {[
        { chip: near, y: -gap },
        { chip: far, y: gap },
      ].map(({ chip, y }) =>
        chip == null ? null : (
          <mesh key={y} position={[0, y, 0.002]} scale={[chip.scale ?? 1, chip.scale ?? 1, 1]}>
            <boxGeometry args={[size * 1.2, size * 1.2, 0.006]} />
            <meshStandardMaterial color={chip.color} emissive={chip.color} emissiveIntensity={0.4} />
          </mesh>
        ),
      )}
    </group>
  )
}
