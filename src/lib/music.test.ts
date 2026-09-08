import { afterEach, describe, expect, it } from 'vitest'
import { setAssetsBase } from './assets'
import { MUSIC_VOLUME, musicUrl } from './music'

afterEach(() => setAssetsBase('/'))

describe('de dónde sale la música', () => {
  it('cuelga de la raíz cuando el juego se sirve solo', () => {
    expect(musicUrl()).toBe('/audio/feria.mp3')
  })

  it('y de donde diga quien lo monte dentro de otra web', () => {
    // Es lo que hace el salón de xrcade: copia los ficheros a su sitio y le
    // dice al juego dónde los ha dejado.
    setAssetsBase('/juegos/stick-rush')
    expect(musicUrl()).toBe('/juegos/stick-rush/audio/feria.mp3')
  })

  it('suena de fondo, no por encima de la partida', () => {
    expect(MUSIC_VOLUME).toBeGreaterThan(0)
    expect(MUSIC_VOLUME).toBeLessThan(0.4)
  })
})
