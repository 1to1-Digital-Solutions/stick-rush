'use client'

import { Suspense, useMemo, useRef } from 'react'
import {
  GARLAND_BULBS_PER_SPAN,
  GARLAND_POST_COUNT,
  GARLAND_POST_HEIGHT,
  GARLAND_RING_RADIUS,
  garlandBulbs,
  ringSlots,
  type RingSlot,
  type Vec3,
} from '../../lib/sceneryLayout'
import { Crowd } from './Crowd'
import { FairMood, type FairMoodState } from './FairMood'
import { Bulb, FairPieces, type PieceCounts } from './FairPieces'
import { FairKit } from './FairKit'
import { FerrisWheel, WHEEL_PIECES } from './FerrisWheel'
import { useReducedMotion } from './useReducedMotion'

/**
 * The fairground venue the machine is set up in: stalls around,
 * garlands of bulbs strung between lampposts closing the circle from
 * above, a crowd between the stalls and a Ferris wheel at the back. The stalls, the
 * lampposts and their banners are pieces of the xrcade kit (`FairKit`); the
 * bulbs, the Ferris wheel and the crowd are made in code. The bulbs and the crowd respond to the streak
 * (`lib/fairMood.ts`), which reaches them through a ref and not through props: the venue is
 * not rendered again by anything that happens in the run.
 *
 * It is only painted with the scenery on. In passthrough the decor is the
 * player's room, and this would cover it (see `SceneBackdrop`).
 */

const GARLAND_BULB_RADIUS = 0.055

/**
 * What the garlands spend of the instance budget: the stretch of
 * bulbs that goes from each lamppost to the next. The lampposts spend
 * nothing from here: they are pieces of the kit, with their own `InstancedMesh`.
 */
const GARLAND_PIECES: PieceCounts = {
  boards: 0,
  poles: 0,
  bulbs: GARLAND_POST_COUNT * GARLAND_BULBS_PER_SPAN,
}

/**
 * Room to allocate in the three families of pieces (see `PieceCounts`). It comes from
 * what each bit of the venue declares, and not from a count by hand, so that
 * adding a cabin or a stretch does not make pieces disappear silently.
 */
const FAIR_PIECES: PieceCounts = {
  boards: GARLAND_PIECES.boards + WHEEL_PIECES.boards,
  poles: GARLAND_PIECES.poles + WHEEL_PIECES.poles,
  bulbs: GARLAND_PIECES.bulbs + WHEEL_PIECES.bulbs,
}

/** The tip of the lamppost, where the garlands are strung from. */
function postTop({ position }: RingSlot): Vec3 {
  return [position[0], GARLAND_POST_HEIGHT, position[2]]
}

/**
 * The stretches of bulbs between lamppost and lamppost. The lampposts are painted by
 * `FairKit` in the same places (`lib/fairKit.ts`), offset from
 * the stalls so that they do not end up covering one another.
 */
function Garlands() {
  const bulbs = useMemo(() => {
    const posts = ringSlots(
      GARLAND_POST_COUNT,
      GARLAND_RING_RADIUS,
      Math.PI / GARLAND_POST_COUNT,
    )
    return posts.flatMap((post, index) =>
      garlandBulbs({
        from: postTop(post),
        to: postTop(posts[(index + 1) % posts.length]),
      }),
    )
  }, [])

  return (
    <group>
      {bulbs.map((position, index) => (
        <Bulb
          key={`garland-bulb-${index}`}
          position={position}
          scale={GARLAND_BULB_RADIUS}
        />
      ))}
    </group>
  )
}

export function Fairground() {
  // The Ferris wheel is the only thing that moves here; with reduced motion it stays
  // stopped, like the sway of the sticks.
  const reducedMotion = useReducedMotion()
  const mood = useRef<FairMoodState>({ streak: 0 })

  return (
    <FairPieces limits={FAIR_PIECES} moodRef={mood}>
      <FairMood moodRef={mood} />
      {/* Its own Suspense: while the models download, the rest of the venue
          is already seen. */}
      <Suspense fallback={null}>
        <FairKit />
      </Suspense>
      <Garlands />
      <Crowd moodRef={mood} />
      <FerrisWheel spinning={!reducedMotion} />
    </FairPieces>
  )
}
