/**
 * Lo que Stick Rush ofrece a quien quiera montarlo: el juego y nada más.
 *
 * Todo lo demás —rutas, layout, metadatos, despliegue— es de la web que lo
 * envuelve (`src/app`), y de eso este punto de entrada no sabe nada. El
 * contrato de montaje, con lo que hay que hacer para consumirlo desde otra
 * aplicación, está en `docs/mounting-the-game.md`.
 */

export { StickRush, type StickRushProps } from './StickRush'
export { StickRushScene, type StickRushSceneProps } from './StickRushScene'
export { mountStickRush, type StickRushHandle } from './mount'
export type { Goal } from '../lib/goal'
