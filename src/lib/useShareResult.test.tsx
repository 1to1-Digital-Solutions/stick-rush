import { type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameProvider } from '../components/GameProvider'
import { COUNTDOWN_SECONDS, useGame } from './gameStore'
import { useShareResult } from './useShareResult'

/**
 * El cableado entre la partida y el texto que sale del dispositivo.
 *
 * Lo que se comprueba aquí es lo que no puede ver `shareResult.test.ts`: que el
 * texto lleve los datos de **esta** partida y el enlace de donde está servido el
 * juego, y que el aviso de haber compartido no se quede colgado en la siguiente.
 */

function wrapper({ children }: { children: ReactNode }) {
  return <GameProvider>{children}</GameProvider>
}

/** El juego y el botón de compartir, vistos a la vez. */
function renderShare() {
  return renderHook(
    () => ({ game: useGame(), share: useShareResult() }),
    { wrapper },
  )
}

let shared: { title?: string; text?: string }[]

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  shared = []
  // jsdom no trae hoja de compartir, así que la pone el test: es el camino
  // normal en un móvil y el que deja ver qué texto se manda.
  vi.stubGlobal('navigator', {
    share: async (data: { title?: string; text?: string }) => {
      shared.push(data)
    },
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Juega una partida entera de `total` palos atrapando `caught`. */
function playRound(
  current: { game: ReturnType<typeof useGame> },
  total: number,
  caught: number,
) {
  act(() => current.game.setStickCount(total))
  act(() => current.game.startGame())
  for (let second = 0; second < COUNTDOWN_SECONDS; second++) {
    act(() => void vi.advanceTimersByTime(1000))
  }
  for (let i = 0; i < total; i++) {
    act(() => {
      if (i < caught) current.game.catchStick(0)
      else current.game.missStick()
    })
  }
}

describe('compartir la partida recién jugada', () => {
  it('manda la puntuación conseguida y el enlace al juego', async () => {
    const { result } = renderShare()
    playRound(result.current, 5, 3)
    expect(result.current.game.gameState).toBe('finished')

    await act(async () => {
      await result.current.share.share()
    })

    expect(shared).toHaveLength(1)
    const text = shared[0].text ?? ''
    expect(text).toContain(
      `${result.current.game.points.toLocaleString('en-GB')} points`,
    )
    expect(text).toContain('3 of 5 sticks')
    expect(text).toContain(window.location.origin)
    expect(result.current.share.status).toBe('shared')
  })

  it('el aviso no sobrevive a la partida siguiente', async () => {
    // Si sobreviviera, la siguiente pantalla de fin diría "compartido" nada más
    // aparecer, anunciando algo que nadie ha hecho.
    const { result } = renderShare()
    playRound(result.current, 5, 3)
    await act(async () => {
      await result.current.share.share()
    })
    expect(result.current.share.status).toBe('shared')

    playRound(result.current, 5, 1)
    expect(result.current.share.status).toBe('idle')
  })
})
