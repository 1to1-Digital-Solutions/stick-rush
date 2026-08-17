import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PLAYER_POSITION, PLAYER_OFFSET_Z } from '../lib/gameConfig'
import { assetUrl, setAssetsBase } from '../lib/assets'
import { ExitProvider, useExit } from './exit'

/**
 * Tests del contrato de ESCENA: lo que xrcade monta dentro de su Canvas.
 *
 * Lo que se protege es lo que rompe el salón inmersivo, y ninguna de las dos
 * cosas se ve en un test de pantalla:
 *
 * 1. Que la escena no abra ni cierre la sesión. WebXR da una sesión por
 *    documento, así que un juego que cierre la suya al irse arranca del visor
 *    a quien estuviera en el salón.
 * 2. Que mover el decorado en vez del jugador deje la geometría igual. Es lo
 *    que sustituye al `<XROrigin>` que el juego ya no puede poner, y si el
 *    signo estuviera del revés el aro aparecería al doble de distancia — algo
 *    que solo se nota con el visor puesto.
 */

// El mundo son objetos de three y jsdom no tiene WebGL: lo que se prueba aquí
// es el contrato del montaje, no lo que se dibuja.
vi.mock('../components/game/GameWorld', () => ({
  GameWorld: () => <div data-testid="mundo" />,
}))

const { endXrSession } = vi.hoisted(() => ({ endXrSession: vi.fn() }))
vi.mock('../components/xr/xrStore', () => ({
  getXrStore: () => ({ enterAR: vi.fn(), enterVR: vi.fn() }),
  endXrSession,
}))

const { StickRushScene } = await import('./StickRushScene')

afterEach(() => {
  cleanup()
  endXrSession.mockClear()
  setAssetsBase('/')
})

describe('la escena no manda sobre la sesión', () => {
  it('quitarla NO cierra la sesión inmersiva', () => {
    // Es la diferencia entera con `<StickRush>`: el salón es el dueño de la
    // sesión y volver a él tiene que dejársela abierta.
    const { unmount } = render(<StickRushScene onExit={() => {}} />)
    act(() => unmount())
    expect(endXrSession).not.toHaveBeenCalled()
  })

  it('salir es lo que diga quien la monta, no cerrar la sesión', () => {
    const onExit = vi.fn()
    function Salida() {
      const exit = useExit()
      return <button onClick={exit}>salir</button>
    }
    const { getByText } = render(
      <ExitProvider onExit={onExit}>
        <Salida />
      </ExitProvider>,
    )
    act(() => getByText('salir').click())
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(endXrSession).not.toHaveBeenCalled()
  })

  it('sin nadie que lo diga, salir cierra la sesión', () => {
    // El juego solo en su propia web: no hay a dónde volver.
    function Salida() {
      const exit = useExit()
      return <button onClick={exit}>salir</button>
    }
    const { getByText } = render(<Salida />)
    act(() => getByText('salir').click())
    expect(endXrSession).toHaveBeenCalledTimes(1)
  })

  it('la base de los estáticos llega antes de que se pida nada', () => {
    // Durante el render y no en un efecto: el HDRI se pide al montar la escena,
    // que es antes de que corra ningún efecto.
    render(<StickRushScene assetsBase="/juegos/stick-rush/" onExit={() => {}} />)
    expect(assetUrl('hdri.hdr')).toBe('/juegos/stick-rush/hdri.hdr')
  })
})

describe('mover el decorado equivale a mover al jugador', () => {
  /** Lo que `<GameWorld>` aplica al grupo del mundo. */
  const DESPLAZAMIENTO: [number, number, number] = [0, 0, -PLAYER_OFFSET_Z]

  it('el jugador acaba a la misma distancia del aro que antes', () => {
    // Antes: máquina en el origen y jugador en PLAYER_POSITION.
    // Ahora: jugador en el origen (lo pone el anfitrión) y máquina desplazada.
    const antes = PLAYER_POSITION.map((p) => 0 - p)
    const ahora = DESPLAZAMIENTO.map((d) => d - 0)
    expect(ahora).toEqual(antes)
  })

  it('el desplazamiento va hacia adelante, no hacia atrás', () => {
    // Con el signo cambiado el aro quedaría al doble de distancia y de espaldas
    // a la máquina: el fallo se vería solo con las gafas puestas.
    expect(DESPLAZAMIENTO[2]).toBeGreaterThan(0)
    expect(PLAYER_OFFSET_Z).toBeLessThan(0)
  })

  it('solo se mueve en profundidad', () => {
    // El jugador está centrado y a ras de suelo; si esto cambiara, el
    // desplazamiento dejaría de bastar y habría que revisar la escena entera.
    expect(PLAYER_POSITION[0]).toBe(0)
    expect(PLAYER_POSITION[1]).toBe(0)
  })
})
