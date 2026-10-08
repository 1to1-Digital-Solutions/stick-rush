import { act, cleanup, render } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HUD } from '../game/HUD'
import { GameProvider } from '../GameProvider'
import { LANG_COOKIE } from '../../lib/ajustes'
import { COUNTDOWN_SECONDS, useGame, type GameStore } from '../../lib/gameStore'
import { frasesEnIngles } from '../../lib/sinIngles'
import { TEXT_KEYS, texto } from '../../lib/textos'
import { StartScreen } from './StartScreen'

vi.mock('../xr/XRWrapper', () => ({ XRWrapper: () => null }))

/**
 * La versión española no dice nada en inglés: la portada, el marcador jugando el reto y el resumen
 * del final, pintados con el juego en español, pasan por el detector común (`lib/sinIngles.ts`). Es
 * lo que cazaría una frase escrita a mano en un componente sin pasar por `t()`.
 */

const CLAVES = TEXT_KEYS.map((clave) => [clave, texto('es', clave)] as const)

/** Lo que se lee de la página: el texto y lo que dice el lector de pantalla. */
function loQueSeLee(): string {
  const etiquetas = [...document.querySelectorAll('[aria-label],[title]')].map(
    (nodo) => `${nodo.getAttribute('aria-label') ?? ''} ${nodo.getAttribute('title') ?? ''}`,
  )
  return [document.body.textContent ?? '', ...etiquetas].join('\n')
}

let juego: GameStore | null = null
/** Lo que hace quien juega, a mano: el store de la partida que pintan la portada y el marcador. */
function Mando({ alPintar }: { alPintar: (store: GameStore) => void }) {
  const store = useGame()
  useEffect(() => {
    alPintar(store)
  })
  return null
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  document.cookie = `${LANG_COOKIE}=es; Path=/`
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  document.cookie = `${LANG_COOKIE}=; Path=/; Max-Age=0`
})

describe('en español no se escapa nada en inglés', () => {
  it('ni en la portada, ni jugando el reto, ni en su final', () => {
    render(
      <GameProvider>
        <Mando alPintar={(store) => void (juego = store)} />
        <StartScreen />
        <HUD />
      </GameProvider>,
    )
    expect(document.body.textContent).toContain('Jugar')
    expect(frasesEnIngles(loQueSeLee(), CLAVES)).toEqual([])

    // El reto, el modo que da medalla, con la cuenta atrás agotada segundo a segundo.
    act(() => juego!.setGameMode('challenge'))
    act(() => juego!.startGame())
    for (let segundo = 0; segundo < COUNTDOWN_SECONDS; segundo++) {
      act(() => void vi.advanceTimersByTime(1000))
    }
    expect(juego!.gameState).toBe('playing')
    act(() => juego!.catchStick(0.5))
    expect(document.body.textContent).toContain('Puntos')
    expect(frasesEnIngles(loQueSeLee(), CLAVES)).toEqual([])

    // Se acaba como en los tests del store: tres palos al suelo.
    for (let i = 0; i < 3; i++) act(() => juego!.missStick())
    expect(juego!.gameState).toBe('finished')
    expect(document.body.textContent).toContain('Otro reto')
    expect(frasesEnIngles(loQueSeLee(), CLAVES)).toEqual([])
  })
})
