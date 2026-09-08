'use client'

/**
 * Si suena la música de fondo, recordado entre visitas.
 *
 * Va aparte del silencio (`mutePreference.ts`) a propósito: son dos decisiones
 * distintas. Hay quien quiere oír el juego y no el fondo, y quien pone el juego
 * de fondo y prefiere lo contrario. El silencio manda sobre las dos —callado no
 * suena nada— y esta solo apaga la música.
 *
 * **Solo se escribe el «sin música».** Con música se borra la clave en vez de
 * guardar un uno: se arranca con música, así que el almacenamiento solo tiene
 * algo cuando quien juega se aparta de eso. Y lo leído es entrada externa
 * —cualquiera puede editarla desde las herramientas del navegador—, así que
 * solo el valor exacto la apaga: un valor raro deja el juego sonando, que es
 * como se entra.
 *
 * Leer y escribir reciben el `Storage` por parámetro, así que la regla se
 * prueba sin navegador. Por encima hay un almacén al que React se suscribe con
 * `useSyncExternalStore`, igual que con el silencio.
 */

import { gameStorage } from './storage'

/** Dónde se recuerda. Con prefijo: el juego se monta dentro de otras webs. */
export const MUSIC_KEY = 'stick-rush:music'

/** Lo que se escribe cuando se deja el juego sin música. */
const OFF_VALUE = '0'

/** ¿Suena la música? */
export function readMusic(storage: Storage | null): boolean {
  if (storage == null) return true
  try {
    return storage.getItem(MUSIC_KEY) !== OFF_VALUE
  } catch {
    // Almacenamiento bloqueado: se arranca con música, como siempre.
    return true
  }
}

/**
 * Recuerda la preferencia, o la olvida cuando se vuelve a la música.
 *
 * @returns si quedó guardada. Un `false` no es un error: significa que este
 *   navegador no guarda nada y la preferencia tendrá que vivir en memoria.
 */
export function writeMusic(storage: Storage | null, music: boolean): boolean {
  if (storage == null) return false
  try {
    if (music) storage.removeItem(MUSIC_KEY)
    else storage.setItem(MUSIC_KEY, OFF_VALUE)
    return true
  } catch {
    // Cuota agotada o escritura prohibida: la preferencia dura lo que dure la
    // visita. No justifica ningún aviso.
    return false
  }
}

/** Quién quiere enterarse de que la preferencia ha cambiado. */
const listeners = new Set<() => void>()

/**
 * La preferencia cuando el navegador no deja guardarla, y `null` mientras sí.
 *
 * Sin esto, en modo privado el botón no haría nada: lo guardado no cambia, así
 * que la lectura devolvería siempre lo mismo y la música seguiría sonando por
 * más que se pulsara.
 */
let inMemory: boolean | null = null

/** Preferencia vigente. */
export function getMusic(): boolean {
  return inMemory ?? readMusic(gameStorage())
}

/**
 * Lo que ve el servidor al prerenderizar: no hay navegador, así que se supone
 * lo de entrada. El interruptor sí se prerenderiza —está en el selector—, y sin
 * esto el HTML del servidor y el del cliente diferirían.
 */
export function getServerMusic(): boolean {
  return true
}

/**
 * Suscripción para `useSyncExternalStore`.
 *
 * Se escucha además el evento `storage`, que es como el navegador cuenta que
 * **otra pestaña** ha tocado el almacenamiento.
 */
export function subscribeMusic(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

/** Cambia la preferencia y avisa a quien la esté mirando. */
export function saveMusic(music: boolean): void {
  inMemory = writeMusic(gameStorage(), music) ? null : music
  for (const listener of listeners) listener()
}
