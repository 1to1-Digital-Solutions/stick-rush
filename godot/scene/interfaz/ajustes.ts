/**
 * Los ajustes del salón que usa el juego en Godot: el idioma y los dos volúmenes.
 *
 * **No se eligen aquí, se leen.** Como en la web, idioma y volúmenes son del arcade y se dicen una
 * vez para todas las cabinas (`lib/ajustes.ts`): el hub los escribe y el juego los lee del mismo
 * guardado (`save/ajustes.json`, por las claves de siempre gracias al kit). El juego no tiene
 * deslizadores propios, igual que no los tiene en la web.
 *
 * - **El idioma** es la clave `xrcade:lang`. En la web viaja en una cookie para que el servidor
 *   pinte ya traducido (`ajustesCliente.ts`, de React); en el motor no hay servidor y se guarda
 *   como cualquier otro ajuste, con el mismo `parseLang` que lo valida.
 * - **Los volúmenes** son `xrcade:volume:sfx` y `xrcade:volume:ambience`, de 0 a 100, leídos con
 *   `readVolumes` de la web. Se leen **a cada sonido** (`niveles`, que es el enganche `levels` de
 *   `runtime/sfx.ts`): un cambio del hub vale para el siguiente golpe, sin reiniciar nada.
 */
import type { AudioLevels } from '@kit/sfx-core'

import { DEFAULT_LANG, parseLang, readVolumes, volumeFactor, type Lang } from '@/lib/ajustes'
import { createStoredPreference, gameStorage } from '@/lib/storage'

/** La clave del idioma en el guardado: la del salón (`ajustes.json`, campo `lang`). */
export const CLAVE_DEL_IDIOMA = 'xrcade:lang'

const idiomaGuardado = createStoredPreference<Lang>({
  key: CLAVE_DEL_IDIOMA,
  parse: parseLang,
  serialize: String,
})

/**
 * El idioma para esta sesión. `forzado` es el de la línea de órdenes (`-- --lang=es`), que sirve
 * para mirar un idioma sin tocar el guardado de nadie.
 */
export function idioma(forzado: string | null = null): Lang {
  if (forzado != null) return parseLang(forzado)
  try {
    return idiomaGuardado.get()
  } catch {
    return DEFAULT_LANG
  }
}

/** Avisa cuando alguien cambia el idioma guardado; devuelve cómo dejar de escuchar. */
export function alCambiarElIdioma(oyente: () => void): () => void {
  return idiomaGuardado.subscribe(oyente)
}

/**
 * Los niveles de sonido de ahora, en la escala de `runtime/sfx.ts` (de 0 a 1). Sin silencio
 * aparte: en el salón, apagar es bajar a cero (`Volumes` de `lib/ajustes.ts`).
 */
export function niveles(): AudioLevels {
  const volumenes = readVolumes(gameStorage())
  return { sfx: volumeFactor(volumenes.sfx), ambience: volumeFactor(volumenes.ambience), muted: false }
}
