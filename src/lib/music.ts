import { assetUrl } from './assets'

/**
 * La música de fondo: dónde está y a qué volumen suena.
 *
 * Es lo único del juego que **no** está sintetizado. Los efectos salen de
 * osciladores porque son cortos y responden a lo que pasa; un minuto de música
 * hecho a mano sonaría a lo que es. Así que es un fichero, y por eso viaja en
 * `public/`: nunca desde un CDN, que el visor puede estar conectado solo a la
 * red de casa.
 */

/** El bucle de la feria, relativo a la base de los ficheros estáticos. */
const MUSIC_PATH = 'audio/feria.mp3'

/**
 * A qué volumen suena, de 0 a 1.
 *
 * Bajo a propósito: es el fondo del sitio, no la partida. Tiene que oírse
 * cuando no pasa nada y desaparecer debajo del juego en cuanto lo hay.
 */
export const MUSIC_VOLUME = 0.22

/** La URL de la que se pide la música, ya con la base de quien monte el juego. */
export function musicUrl(): string {
  return assetUrl(MUSIC_PATH)
}
