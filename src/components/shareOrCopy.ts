import { SHARE_TITLE } from '../lib/shareResult'

/**
 * Entregar el texto de la partida: la hoja de compartir del sistema si se abre, y el
 * portapapeles si no.
 *
 * Está aquí y no en `lib/` porque es la capa del navegador: lo que pide son las dos cosas
 * que `navigator` puede no traer. En `lib/` vive la lógica del juego, que tiene que correr
 * también fuera de un navegador —el motor del puerto a Godot no tiene `navigator`, ni
 * `window`, ni `document`—, y un módulo que los necesite ahí dentro es un módulo que ahí
 * no arranca. El texto que se entrega sí es del juego y se arma en `lib/shareResult.ts`.
 */

/** Cómo ha acabado el intento de compartir. */
export type ShareOutcome =
  /** Se abrió la hoja de compartir del sistema y siguió su curso. */
  | 'shared'
  /** No había con qué compartir (o no dejó): el texto quedó en el portapapeles. */
  | 'copied'
  /** El jugador cerró la hoja de compartir. No es un fallo. */
  | 'cancelled'
  /** Ni se pudo compartir ni copiar. */
  | 'unavailable'

/**
 * Lo que se necesita del navegador. Se declara aquí, en vez de pedir un
 * `Navigator` entero, para poder probar cada camino con un objeto de tres
 * líneas: los dos existen o no según el navegador, y ese es justo el caso que
 * hay que cubrir.
 */
export interface ShareTarget {
  share?: (data: { title?: string; text?: string }) => Promise<void>
  clipboard?: { writeText?: (text: string) => Promise<void> }
}

/** Cerrar la hoja de compartir llega como un `AbortError`. */
function isCancelled(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === 'AbortError'
}

/**
 * Comparte el texto, y si no se puede lo deja en el portapapeles.
 *
 * El plan B no es una cortesía: dentro de una sesión inmersiva la hoja de
 * compartir puede no abrirse —no hay dónde pintarla, o el navegador no
 * considera activación de usuario el gatillo de un mando—, y ahí un botón que
 * no hace nada es peor que no tener botón. Copiado, el texto sigue en el
 * portapapeles al quitarse el visor.
 *
 * Cancelar sí termina el intento: quien cierra la hoja ha decidido no
 * compartir, y copiarle el texto a escondidas sería hacer lo contrario de lo
 * que acaba de pedir.
 */
export async function shareOrCopy(
  text: string,
  target?: ShareTarget | null,
): Promise<ShareOutcome> {
  if (target?.share) {
    try {
      await target.share({ title: SHARE_TITLE, text })
      return 'shared'
    } catch (error) {
      if (isCancelled(error)) return 'cancelled'
      // Cualquier otro rechazo (sin permiso, sin activación, sin soporte real)
      // no cierra el intento: queda el portapapeles.
    }
  }

  const clipboard = target?.clipboard
  if (!clipboard?.writeText) return 'unavailable'
  try {
    await clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'unavailable'
  }
}
