'use client'

import { GameProvider } from '../components/GameProvider'
import { GameWorld } from '../components/game/GameWorld'
import { setAssetsBase } from '../lib/assets'
import type { HostAnchor } from '../lib/hostAnchor'
import type { ResultWithFeats } from '../lib/feats'
import type { Goal } from '../lib/goal'
import { setGameName } from '../lib/menuTemplate'
import type { Challenge } from '../lib/seed'
import { ExitProvider } from './exit'

export interface StickRushSceneProps {
  /**
   * Where the game's static files hang from (the HDRI, the textures and the
   * controller profiles copied from `public/`). The host serves them, under
   * its own prefix: two games on the same origin would step on each other.
   */
  assetsBase?: string
  /**
   * Where and with what heading to plant the game's world, if whoever mounts
   * the scene knows it: xrcade's hall lends the anchor it has its arc of
   * cabinets planted with.
   *
   * **Without it, the world is planted in front of wherever one is looking on
   * entering**, which is the only thing known on the game's own website. Inside
   * the hall that is disorienting: reading the cabinets on the left forces a
   * turn of the head, and the game came out turned that way.
   */
  anchor?: HostAnchor
  /**
   * Take the player back to where they were. The game calls it from its
   * immersive UI; what going back means is decided by whoever mounts.
   */
  onExit: () => void
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
  /**
   * What has to be beaten: the game's three medal thresholds, the best of whoever plays and the
   * mode in which they count. With it, the sign above the scoreboard says which threshold is
   * missing and how much is left; without it, the mission and the record saved in this browser.
   */
  goal?: Goal
  /**
   * What the game is called in its menu: the `name` of the catalogue manifest, the one of the
   * hall's cabinet. Without it, the one in `package.json` capitalised, which is the same
   * (`menuTemplate.ts`).
   */
  name?: string
}

/**
 * Stick Rush as a SCENE: what is painted inside someone else's Canvas.
 *
 * It is the contract with which xrcade mounts a game inside its hall. It creates
 * no Canvas, neither opens nor closes the immersive session and paints not a
 * single DOM tag: only three objects. That way, entering the game and going back
 * to the hall are mounting and unmounting a piece of scene, and the session does
 * not even notice — which is what allows going from a game to the hall without
 * taking the headset off.
 *
 * To mount it with its 2D UI and its own session —what a normal web page
 * wants— there is `<StickRush>`, which is this scene with a Canvas around it.
 *
 * The full contract, in `docs/mounting-the-game.md`.
 */
export function StickRushScene({ assetsBase, anchor, onExit, challenge, onFinish, goal, name }: StickRushSceneProps) {
  // During the render and not in an effect: the scene asks for the HDRI and the
  // textures as soon as it mounts, that is, before any effect runs. Writing the
  // same base twice changes nothing, so repeating the render is harmless.
  if (assetsBase !== undefined) setAssetsBase(assetsBase)
  // The same with the name: the menu reads it from the first frame.
  setGameName(name)

  return (
    <GameProvider challenge={challenge} onFinish={onFinish} goal={goal}>
      <ExitProvider onExit={onExit}>
        <GameWorld anchor={anchor} />
      </ExitProvider>
    </GameProvider>
  )
}
