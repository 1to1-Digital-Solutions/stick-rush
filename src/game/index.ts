/**
 * What Stick Rush offers to whoever wants to mount it: the game and nothing else.
 *
 * Everything else —routes, layout, metadata, deployment— belongs to the website
 * that wraps it (`src/app`), and this entry point knows nothing about that. The
 * mounting contract, with what has to be done to consume it from another
 * application, is in `docs/mounting-the-game.md`.
 */

export { StickRush, type StickRushProps } from './StickRush'
export { StickRushScene, type StickRushSceneProps } from './StickRushScene'
export { mountStickRush, type StickRushHandle } from './mount'
export type { Goal } from '../lib/goal'
