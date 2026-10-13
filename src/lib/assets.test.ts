import { afterEach, describe, expect, it } from 'vitest'
import { assetUrl, setAssetsBase } from './assets'

// The base is module state: without returning it to the root, one test would
// change the paths of the next.
afterEach(() => setAssetsBase('/'))

describe('paths of the static files', () => {
  it('hang from the root as long as nobody says otherwise', () => {
    expect(assetUrl('hdri/plaza_pueblo_1k.exr')).toBe('/hdri/plaza_pueblo_1k.exr')
  })

  it('move to wherever the one mounting the game puts them', () => {
    setAssetsBase('/juegos/stick-rush/')

    expect(assetUrl('textures/wood_nor_1k.jpg')).toBe(
      '/juegos/stick-rush/textures/wood_nor_1k.jpg',
    )
  })

  it('accept a base without a trailing slash', () => {
    setAssetsBase('/juegos/stick-rush')

    expect(assetUrl('webxr-profiles/')).toBe('/juegos/stick-rush/webxr-profiles/')
  })

  it('do not double the slash when the path already brings it', () => {
    setAssetsBase('/juegos/stick-rush/')

    expect(assetUrl('/hdri/plaza_pueblo_1k.exr')).toBe(
      '/juegos/stick-rush/hdri/plaza_pueblo_1k.exr',
    )
  })

  it('go back to the root with an empty base', () => {
    setAssetsBase('   ')

    expect(assetUrl('hdri/plaza_pueblo_1k.exr')).toBe('/hdri/plaza_pueblo_1k.exr')
  })

  it('keep the origin when the base is absolute', () => {
    setAssetsBase('https://cdn.example.com/stick-rush')

    expect(assetUrl('hdri/plaza_pueblo_1k.exr')).toBe(
      'https://cdn.example.com/stick-rush/hdri/plaza_pueblo_1k.exr',
    )
  })
})
