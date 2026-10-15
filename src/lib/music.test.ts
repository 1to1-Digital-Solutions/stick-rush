import { afterEach, describe, expect, it } from 'vitest'
import { setAssetsBase } from './assets'
import { MUSIC_VOLUME, musicUrl } from './music'

afterEach(() => setAssetsBase('/'))

describe('where the music comes from', () => {
  it('hangs from the root when the game is served on its own', () => {
    expect(musicUrl()).toBe('/audio/feria.mp3')
  })

  it('and from wherever whoever mounts it inside another site says', () => {
    // It is what the xrcade hall does: it copies the files to its place and
    // tells the game where it has left them.
    setAssetsBase('/juegos/stick-rush')
    expect(musicUrl()).toBe('/juegos/stick-rush/audio/feria.mp3')
  })

  it('plays in the background, not over the run', () => {
    expect(MUSIC_VOLUME).toBeGreaterThan(0)
    expect(MUSIC_VOLUME).toBeLessThan(0.4)
  })
})
