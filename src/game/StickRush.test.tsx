import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assetUrl, setAssetsBase } from '../lib/assets'
import { StickRush } from './StickRush'
import { mountStickRush, type StickRushHandle } from './mount'

// La escena 3D necesita WebGL, que jsdom no tiene. Lo que se prueba aquí es el
// contrato de montaje —que el juego se monta fuera de su web, sin router ni
// layout, y que las opciones llegan—, no lo que se pinta dentro del Canvas.
vi.mock('../components/game/GameCanvas', () => ({
  GameCanvas: () => <div data-testid="escena" />,
}))

// El store de WebXR se crea fuera del árbol y sobrevive al desmontaje, así que
// lo que hay que comprobar aquí es la llamada. Que la sesión se cierre de
// verdad lo prueba `components/xr/xrStore.test.ts`.
const { endXrSession } = vi.hoisted(() => ({ endXrSession: vi.fn() }))
vi.mock('../components/xr/xrStore', () => ({
  getXrStore: () => ({ enterAR: vi.fn(), enterVR: vi.fn() }),
  endXrSession,
}))

afterEach(() => {
  cleanup()
  // Después de `cleanup()`, que al desmontar el juego cierra la sesión: así
  // cada test empieza sin las llamadas del anterior.
  endXrSession.mockClear()
  // La base de los ficheros estáticos es estado de módulo: sin devolverla a la
  // raíz, un test le cambiaría las rutas al siguiente.
  setAssetsBase('/')
})

describe('montar el juego desde fuera', () => {
  it('se monta sin router, sin layout y sin metadatos', () => {
    render(<StickRush />)

    // `getByRole` lanza si no está: el juego que no arranca fuera de su web se
    // queda sin menú, o revienta al renderizar.
    expect(screen.getByRole('heading', { name: 'STICK RUSH' }).tagName).toBe('H1')
    expect(screen.getByRole('button', { name: 'Play' })).toBeDefined()
  })

  it('deja los ficheros estáticos en la raíz mientras nadie diga otra cosa', () => {
    render(<StickRush />)

    expect(assetUrl('hdri/plaza_pueblo_1k.exr')).toBe('/hdri/plaza_pueblo_1k.exr')
  })

  it('busca los ficheros estáticos donde diga quien lo monta', () => {
    render(<StickRush assetsBase="/juegos/stick-rush/" />)

    expect(assetUrl('hdri/plaza_pueblo_1k.exr')).toBe(
      '/juegos/stick-rush/hdri/plaza_pueblo_1k.exr',
    )
  })

  it('llena el contenedor que le dan, sin ocupar la ventana por su cuenta', () => {
    const { container } = render(<StickRush />)
    const raiz = container.firstElementChild

    expect(raiz?.className).toContain('stick-rush')
    expect(raiz?.className).toContain('h-full')
    expect(raiz?.className).not.toContain('h-dvh')
  })

  it('al quitarlo devuelve el visor a quien lo montaba', () => {
    const { unmount } = render(<StickRush />)
    expect(endXrSession).not.toHaveBeenCalled()

    unmount()

    // Sin esto, el hub que desmonta el juego con las gafas puestas deja viva
    // una sesión atada a un Canvas que ya no existe: escena congelada y sin
    // forma de volver, porque WebXR solo da una sesión por documento.
    expect(endXrSession).toHaveBeenCalledTimes(1)
  })
})

describe('montar el juego sobre un elemento del DOM', () => {
  it('lo pinta dentro y lo quita al desmontarlo', () => {
    const contenedor = document.createElement('div')
    document.body.appendChild(contenedor)

    let juego: StickRushHandle | null = null
    act(() => {
      juego = mountStickRush(contenedor, { assetsBase: '/juegos/stick-rush/' })
    })

    expect(contenedor.textContent).toContain('STICK RUSH')
    expect(assetUrl('textures/wood_nor_1k.jpg')).toBe(
      '/juegos/stick-rush/textures/wood_nor_1k.jpg',
    )

    act(() => juego?.unmount())

    expect(contenedor.childNodes.length).toBe(0)
    contenedor.remove()
  })
})
