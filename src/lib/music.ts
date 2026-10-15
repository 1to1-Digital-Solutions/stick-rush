import { assetUrl } from './assets'

/**
 * The background music: where it is and at what volume it plays.
 *
 * It is the only thing in the game that is **not** synthesised. The effects come out of
 * oscillators because they are short and respond to what happens; a minute of music
 * made by hand would sound like what it is. So it is a file, and that is why it travels in
 * `public/`: never from a CDN, since the headset may be connected only to the
 * home network.
 */

/** The fairground loop, relative to the base of the static files. */
const MUSIC_PATH = 'audio/feria.mp3'

/**
 * At what volume it plays, from 0 to 1.
 *
 * Low on purpose: it is the background of the place, not the run. It has to be heard
 * when nothing is happening and disappear under the game as soon as there is one.
 */
export const MUSIC_VOLUME = 0.22

/** The URL the music is requested from, already with the base of whoever mounts the game. */
export function musicUrl(): string {
  return assetUrl(MUSIC_PATH)
}
