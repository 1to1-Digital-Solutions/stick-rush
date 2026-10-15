'use client'

import { useEffect } from 'react'
import { GameProvider } from '../components/GameProvider'
import { GameScene } from '../components/game/GameScene'
import { endXrSession } from '../components/xr/xrStore'
import { setAssetsBase } from '../lib/assets'
import type { ResultWithFeats } from '../lib/feats'
import type { Challenge } from '../lib/seed'
import { ExitProvider } from './exit'

export interface StickRushProps {
  /**
   * Where the game's static files hang from (the HDRI, the textures and the
   * controller profiles copied from `public/`). By default the root of the
   * site, which is where its own website serves them.
   */
  assetsBase?: string
  /**
   * Play a specific challenge of the hall: the challenge of the day, or the code of «reta mi puntuación».
   *
   * With it the scene goes **straight into a run of the challenge mode** —the mode of the
   * cabinet's record—, with Medium and thirteen sticks (`CHALLENGE_SETUP`) and without a lesson,
   * and the turn and the hesitation of each stick come from the seed: same seed, same sticks
   * falling in the same order and at the same time. It is read on mount: for another challenge,
   * mount it again.
   */
  challenge?: Challenge
  /**
   * Called **once** when each scored run ends, in any mode, with its points even if they are
   * not a record. Leaving the run halfway or exiting does not end it. It carries `feats` with
   * the API names first earned in the run, if there are any (`lib/feats.ts`).
   */
  onFinish?: (result: ResultWithFeats) => void
}

/**
 * The whole game **with its Canvas and its session**, ready to mount inside
 * any React application that wants a game page.
 *
 * It takes up whatever its container measures —give it a height— and knows nothing
 * about routes, layout or metadata: whoever mounts it decides where it lives and
 * what is around it.
 *
 * To mount it INSIDE a Canvas and a session that already exist —what xrcade's
 * immersive hall does, and what allows coming back without taking the headset
 * off— `<StickRushScene>` has to be used. This one opens its own session, and
 * only one fits in a document. The full contract is in
 * `docs/mounting-the-game.md`.
 */
export function StickRush({ assetsBase, challenge, onFinish }: StickRushProps) {
  // During the render and not in an effect: the scene asks for the HDRI and the
  // textures as soon as it mounts, that is, before any effect runs. Writing the
  // same base twice changes nothing, so repeating the render is harmless.
  if (assetsBase !== undefined) setAssetsBase(assetsBase)

  // Removing the game has to give the headset back to whoever mounted it: the
  // session does not close by itself when the tree unmounts (see `xr/xrStore.ts`).
  // Here and not in the scene because it is the edge of the mount, the same thing
  // `unmount()` promises.
  useEffect(() => () => endXrSession(), [])

  return (
    <GameProvider challenge={challenge} onFinish={onFinish}>
      {/* Here exiting is closing the session: this website is the game and there is
          nowhere to go back to. In the hall it means the opposite. */}
      <ExitProvider onExit={endXrSession}>
        <GameScene />
      </ExitProvider>
    </GameProvider>
  )
}
