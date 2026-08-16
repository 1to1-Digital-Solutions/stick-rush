import { afterEach, describe, expect, it } from 'vitest'
import { assetUrl, setAssetsBase } from './assets'

// La base es estado de módulo: sin devolverla a la raíz, un test le cambiaría
// las rutas al siguiente.
afterEach(() => setAssetsBase('/'))

describe('rutas de los ficheros estáticos', () => {
  it('cuelgan de la raíz mientras nadie diga otra cosa', () => {
    expect(assetUrl('hdri/plaza_pueblo_1k.exr')).toBe('/hdri/plaza_pueblo_1k.exr')
  })

  it('se mudan a donde las ponga quien monta el juego', () => {
    setAssetsBase('/juegos/stick-rush/')

    expect(assetUrl('textures/wood_nor_1k.jpg')).toBe(
      '/juegos/stick-rush/textures/wood_nor_1k.jpg',
    )
  })

  it('admiten una base sin barra final', () => {
    setAssetsBase('/juegos/stick-rush')

    expect(assetUrl('webxr-profiles/')).toBe('/juegos/stick-rush/webxr-profiles/')
  })

  it('no duplican la barra cuando la ruta ya la trae', () => {
    setAssetsBase('/juegos/stick-rush/')

    expect(assetUrl('/hdri/plaza_pueblo_1k.exr')).toBe(
      '/juegos/stick-rush/hdri/plaza_pueblo_1k.exr',
    )
  })

  it('vuelven a la raíz con una base vacía', () => {
    setAssetsBase('   ')

    expect(assetUrl('hdri/plaza_pueblo_1k.exr')).toBe('/hdri/plaza_pueblo_1k.exr')
  })

  it('conservan el origen cuando la base es absoluta', () => {
    setAssetsBase('https://cdn.example.com/stick-rush')

    expect(assetUrl('hdri/plaza_pueblo_1k.exr')).toBe(
      'https://cdn.example.com/stick-rush/hdri/plaza_pueblo_1k.exr',
    )
  })
})
