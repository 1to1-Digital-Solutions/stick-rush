'use client'

import { useEffect, useState, Suspense, type ReactNode } from 'react'
import { countMount } from '../../lib/mountCount'
import { Environment } from '@react-three/drei'
import { useXR } from '@react-three/xr'
import { assetUrl } from '../../lib/assets'
import {
  BACKDROP_COLOR,
  HDRI_PATH,
  MACHINE_HEIGHT,
  MACHINE_RADIUS,
  PLAYER_OFFSET_Z,
} from '../../lib/gameConfig'
import { showsPlace } from '../../lib/settings'
import { entryPlacement, type HostAnchor } from '../../lib/hostAnchor'
import { useGame, type SceneryMode } from '../../lib/gameStore'
import { DECOR_POINTER_EVENTS, MENU_POINTER_ORDER } from '../../lib/pointers'
import { sceneryOf } from '../../lib/sceneryPreference'
import { PlayerHands } from '../xr/PlayerHands'
import { MachineSign } from '../xr/MachineSign'
import { XRCountdown } from '../xr/XRCountdown'
import { XRGazeAnchor } from '../xr/XRGazeAnchor'
import { XRDuelPanel, XRHud, XRQuitButton, XRQuitConfirm } from '../xr/XRHud'
import { XRMenu } from '../xr/XRMenu'
import { XRPlayerHeight } from '../xr/XRPlayerHeight'
import { XRSessionController } from '../xr/XRSessionController'
import { XRTutorial } from '../xr/XRTutorial'
import { Hints } from './Hints'
import { PrewarmShaders } from './PrewarmShaders'
import { Backdrop } from './Backdrop'
import { Fairground } from './Fairground'
import { SceneryFade } from './SceneryFade'
import { StickMachine } from './StickMachine'
import { Ground } from './Ground'
import { useGameMusic } from './useGameMusic'
import { useGameSound } from './useGameSound'
import { useDisposeMeshes } from './disposeInstances'
import { XRWorldHeight } from '../xr/XRWorldHeight'

/**
 * The whole game as THREE OBJECTS, with no Canvas and no session of its own.
 *
 * It is what gets mounted inside the Canvas of whoever hosts it —its own website or the
 * xrcade hall— and that is why there is no `<Canvas>`, nor `<XR>`, nor `<XROrigin>` here:
 * WebXR gives one session per document and that session is tied to the Canvas that
 * opened it, so whoever owns the Canvas owns the session. If the game
 * opened it, going back to the hall would close it, and going back to a hall that is a 2D
 * page means taking the headset off.
 *
 * No DOM can come in here: inside a Canvas only three objects
 * fit. The 2D menu and scoreboard stay in the game's website; inside the
 * headset their equivalents are `<XRMenu>` and `<XRHud>`, which are indeed geometry.
 */

/**
 * Scenery: fairground, backdrop, ground and environment lighting.
 *
 * The HDRI (a village square at night, CC0, served from `public/`) wraps
 * the scene, is projected onto the ground and gives it the warm light of the street lamps.
 * In front of that photo is the real fairground —stalls, garlands and Ferris wheel,
 * see `<Fairground>`—, which is what gives volume: a background photo does not change when
 * you move your head, and in the headset that shows right away.
 *
 * In AR neither fairground, nor backdrop, nor ground is drawn: the scenery is the
 * player's room and covering it would break the passthrough. The HDRI is indeed
 * kept, but only as a source of reflections (`background={false}`): without it the
 * machine would look flat and dull over the real room.
 */
function SceneBackdrop({ scenery }: { scenery: SceneryMode }) {
  const mode = useXR((state) => state.mode)
  // What is seen is said by the arcade's scenery (`xrcade:scenery`), with the rule
  // that the hall and the other games follow (`showsPlace`): the hall always
  // enters in augmented reality if the headset has it, so the type of
  // session does not say what was chosen. It only acts as a guard: outside an immersive
  // session there is no passthrough to reveal, and inside an `immersive-vr` one
  // neither —behind it there is no room, only black—. With the preference
  // remembered between visits, whoever left it on passthrough could open the
  // next session in VR and find themselves looking at nothing without knowing why.
  const isAR = !showsPlace(mode, sceneryOf(scenery))

  // What belongs only to the square is **hidden** in your room, not unmounted.
  // Unmounting disposes the materials, and the shaders that only they used are
  // compiled again on coming back: a hitch on every change of scenery, with the
  // headset on. Hidden, it is neither painted nor casts a shadow, and it is denied the pointers,
  // which do not look at whether something is seen.
  const onlyInTheSquare = { visible: !isAR, pointerEvents: isAR ? ('none' as const) : undefined }
  // The projected ground of the HDRI brings its own geometry and material, which fiber does not dispose on leaving.
  const ofTheEnvironment = useDisposeMeshes()

  return (
    <>
      {/* It is only seen while the HDRI loads; then the background replaces it.
          With `<color attach="background">` it was never seen: that shortcut attaches
          the colour to **its parent**, and here the parent is a group, where
          `background` means nothing —it does not fail, it does not warn, it simply does
          nothing—. So while the HDRI was coming down, what was up there was
          the black of the compositor. This one is indeed mounted and unmounted: it is the colour
          the image is cleared with, not a material, and it compiles nothing. */}
      {!isAR && <Backdrop color={BACKDROP_COLOR} />}
      <group {...onlyInTheSquare}>
        <Ground />
        <Fairground />
      </group>

      {/* A Suspense of its own: while the HDRI loads the rest of the scene is already
          seen, instead of the whole Canvas staying blank waiting for it. */}
      <Suspense fallback={null}>
        {/* The projected ground is always mounted and inside a group that is
            hidden, because drei mounts a different component with ground and without it:
            switching between the two threw away the ground mesh —and its shader— and
            disposed the texture of the HDRI, which had to be uploaded again. The
            reflection environment stays on in both sceneries. */}
        <group ref={ofTheEnvironment} {...onlyInTheSquare}>
          <Environment
            files={assetUrl(HDRI_PATH)}
            background={!isAR}
            environmentIntensity={1.4}
            // Projects the HDRI onto the ground too, so that the machine
            // stands on the cobbles of the square instead of on a plane of
            // colour with a visible cut against the horizon of the photo.
            ground={{ height: 1.6, radius: 14, scale: 45 }}
          />
        </group>
      </Suspense>
    </>
  )
}

/** The host's origin, for when it lends no anchor: the world stays there. */
const ORIGIN = { x: 0, z: 0 }

/**
 * Plants the world where and with what heading the host says.
 *
 * **Here the scenery is not anchored to the gaze**, unlike the other twelve: the machine
 * stays where the host puts the origin, shifted forwards to leave whoever
 * plays at their distance. Inside the hall that showed: the arc of cabinets is planted at
 * the feet of whoever came in and turned towards where they were looking, and the machine appeared at the −Z of the
 * room's calibration, that is, wherever it fell. With the lent anchor it comes out right where
 * the arc was.
 *
 * **It is planted once and stays.** A scenery that is repositioned while playing is what
 * makes aiming impossible. The only thing that releases it is recentring the room: then the reference
 * space moves as a whole, what was lent points to where there is nothing any more, and the world
 * goes back to the host's origin, which is what it did before this.
 */
function HostAnchored({ anchor, children }: { anchor?: HostAnchor; children: ReactNode }) {
  const [lent, setLent] = useState(anchor ?? null)
  const referenceSpace = useXR((state) => state.originReferenceSpace)

  useEffect(() => {
    if (referenceSpace == null) return
    const onRecentre = () => setLent(null)
    referenceSpace.addEventListener('reset', onRecentre)
    return () => referenceSpace.removeEventListener('reset', onRecentre)
  }, [referenceSpace])

  // With nothing lent the origin comes out and the group is the identity, which is the usual.
  const placement = entryPlacement(lent, ORIGIN, 0)

  return (
    // The height is not inherited: the host only knows about the ground (see `lib/hostAnchor.ts`).
    <group name="world-anchor" position={[placement.x, 0, placement.z]} rotation={[0, placement.yaw, 0]}>
      {children}
    </group>
  )
}

/** Plugs the scenery into what the player chooses in the immersive menu. */
function SceneryFadeBridge() {
  const { scenery } = useGame()

  return (
    <SceneryFade mode={scenery}>
      {(applied) => <SceneBackdrop scenery={applied} />}
    </SceneryFade>
  )
}

/**
 * Bridge between the state of the game and the sound.
 *
 * It is a hook and paints nothing, so being inside the Canvas makes no difference: the
 * sound goes with the run, not with the scene. It needs a component of its own
 * because hooks cannot be called loose.
 */
function GameSound() {
  useGameSound()
  // And the background music, for the same reason and in the same place.
  useGameMusic()
  return null
}

export interface GameWorldProps {
  /**
   * Whoever mounts the scene also puts DOM UI around it. Mounted in the
   * xrcade hall there is none of that —the hub puts no DOM—, so the
   * UI inside the scene is the only one there is and has to be placed and
   * seen even if there is no headset. Without this, the game was seen in the hub and there was no
   * way to start the run.
   */
  hasDomUi?: boolean
  /**
   * Where and with what heading to plant the world, if whoever mounts the scene knows: the
   * xrcade hall lends the anchor it has its arc of cabinets planted with.
   * Without it, the world stays at the origin the host puts.
   */
  anchor?: HostAnchor
}

export function GameWorld({ hasDomUi = false, anchor }: GameWorldProps) {
  // How many times the world is mounted, when someone is counting it (`lib/mountCount.ts`).
  // Mounting it twice on entering the session **is** the flicker reported from the headset.
  useEffect(() => {
    countMount('world')
  }, [])

  // THE WHOLE WORLD hangs from `XRWorldHeight`, which lowers it down to whoever plays if
  // they asked for it in the arcade's settings. It wraps the whole scene, lights
  // included: moving only the target would leave it floating over its scenery.
  return (
    <XRWorldHeight>
      {/* Starts/closes runs depending on the state of the immersive session. */}
      <XRSessionController />
      {/* Puts the hoop within reach of whoever wears the headset. */}
      <XRPlayerHeight />
      <GameSound />
      {/* The hands: the glove with controllers, the articulated hand without them. They go here and not in the
          store because the store belongs to whoever mounts, and the hall's does not draw hands. */}
      <PlayerHands />

      {/* The immersive UI does NOT hang from the player's origin, but from
          `<XRGazeAnchor always={!hasDomUi}>`, which plants it in front of their face: the -Z of the origin is
          set by the room's calibration, so coming in looking elsewhere
          left the menu behind the back, invisible and impossible to point at.
          It goes outside the world's group on purpose: it goes with the player, not with the
          scenery. */}
      {/* And it wins the ray whatever passes in front (`lib/pointers.ts`): the exit
          question comes up in the middle of the run, with sticks falling between the hand and the button, and there
          there are indeed sticks that can be caught. It is an order, not a distance. */}
      <XRGazeAnchor always={!hasDomUi} pointerEventsOrder={MENU_POINTER_ORDER}>
        <XRHud hasDomUi={hasDomUi} />
        {/* What has to be beaten, head-on: above the scoreboard and below where the sticks fall. */}
        <MachineSign hasDomUi={hasDomUi} />
        <XRMenu hasDomUi={hasDomUi} />
        <XRTutorial />
        <XRCountdown hasDomUi={hasDomUi} />
        <XRQuitButton hasDomUi={hasDomUi} />
        <XRQuitConfirm />
        <XRDuelPanel hasDomUi={hasDomUi} />
      </XRGazeAnchor>

      {/* THE WORLD, shifted to leave the player where they belong.
          The scene is drawn with the machine at the origin and the player
          one step behind the centre of the hoop (`PLAYER_OFFSET_Z`). Before, that was achieved by
          moving the player with `<XROrigin position={PLAYER_POSITION}>`, but
          the origin belongs to whoever mounts —the hall plants its arc of cabinets there— and
          two origins in the same session overlap. The scenery is moved the same
          distance in the opposite direction: the geometry the player sees is
          identical and the origin stays where its owner put it. */}
      <HostAnchored anchor={anchor}>
        {/* **The world is not there for the ray** (`lib/pointers.ts`): whoever plays is INSIDE
            the machine, so between their hand and the menu there are always crossbars, sticks and
            scenery. None of that listens to anything, but a host with a listener above
            —the hall— is enough for everything that hangs from it to count as touched. The only thing
            that turns back on is the stick that can be caught, and it says so itself. */}
        <group position={[0, 0, -PLAYER_OFFSET_Z]} pointerEvents={DECOR_POINTER_EVENTS}>
          <ambientLight intensity={0.35} />
          {/* Warm spotlight over the machine, like that of a fair stall at night. */}
          <pointLight
            position={[0, MACHINE_HEIGHT + 1, -MACHINE_RADIUS * 0.4]}
            intensity={16}
            color="#ffd479"
            distance={10}
            castShadow
          />
          {/* Cold fill from behind, to lift the machine off the dark background. */}
          <directionalLight position={[2.5, 4, 3]} intensity={0.35} color="#9fb6d6" />

          {/* The wood textures are loaded in here; with its own
              Suspense the machine appears as soon as they are there, without blocking the rest. */}
          <Suspense fallback={null}>
            <StickMachine />
          </Suspense>

          {/* The visual hints: where to stand, the stick that falls and what it is caught with. Next to the
              machine, because their script is written relative to the centre of the hoop, and outside what
              is remounted with every run: they are mounted once and turn themselves off. */}
          <Hints />

          {/* The scenery changes with the curtain closed, so that the jump between
              the square and the player's room is not seen. */}
          <SceneryFadeBridge />
        </group>
      </HostAnchored>
      {/* Warms up the shaders of the scene, and it goes HERE and not in the Canvas of the game's
          website: the hall mounts this and not that, so hanging from there nothing was
          prewarmed right where the game is really played. */}
      <PrewarmShaders />
    </XRWorldHeight>
  )
}
