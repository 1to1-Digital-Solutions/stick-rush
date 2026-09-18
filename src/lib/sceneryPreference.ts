import type { Scenery } from './ajustes'
// Solo el tipo: se borra al compilar, así que no crea un ciclo real con el store aunque el
// store importe de aquí.
import type { SceneryMode } from './gameStore'

/**
 * El escenario del arcade, traducido a como lo llama este juego.
 *
 * **La preferencia no es de este juego.** Se guarda en `xrcade:scenery`, con los valores del
 * arcade (`place` y `room`), y la regla de cuándo se quita el decorado es `showsPlace`: las dos
 * en `lib/ajustes.ts`, la copia del puente con el salón; el hook y el cambio están en
 * `lib/ajustesCliente.ts`. Stick Rush llama a lo mismo `scene` y `passthrough` en todo su
 * código —el store, el fundido, el selector del menú—, así que la traducción se hace aquí, en
 * el borde, y el resto del juego no se entera de que el valor viene de otro sitio.
 *
 * **Por qué no tiene uno propio.** El salón entra siempre en `immersive-ar` cuando el visor la
 * tiene, así que el tipo de sesión no dice qué eligió quien juega. Con un escenario por juego,
 * quien eligiera «passthrough» en esta cabina entraría sin plaza aunque en el salón hubiera
 * elegido el sitio dibujado, y no habría forma de saber cuál de las dos manda.
 */

/** Cómo llama este juego al escenario del arcade: `place` es la plaza, `room` la habitación. */
export function sceneryModeOf(scenery: Scenery): SceneryMode {
  return scenery === 'room' ? 'passthrough' : 'scene'
}

/** Lo que se escribe en el arcade cuando se elige desde este juego. */
export function sceneryOf(mode: SceneryMode): Scenery {
  return mode === 'passthrough' ? 'room' : 'place'
}

/**
 * La clave del escenario propio del juego, que no escribe nadie.
 *
 * Si está en el navegador, se borra al montar el estado de la partida y **no se traslada** a la
 * del arcade: la elección que manda es la del salón. Dejarla no rompería nada —no la lee nadie—,
 * pero borrarla evita que quien mire el almacenamiento crea que hay dos preferencias.
 */
export const OWN_SCENERY_KEY = 'stick-rush:scenery'

/**
 * Olvida el escenario propio del juego.
 *
 * Aguanta un almacenamiento que no está o que lanza: no hay nada que olvidar, y el juego sigue
 * con el del arcade.
 */
export function forgetOwnScenery(storage: Pick<Storage, 'removeItem'> | null): void {
  try {
    storage?.removeItem(OWN_SCENERY_KEY)
  } catch {
    // Almacenamiento capado: tampoco se pudo guardar nada en esa clave.
  }
}
