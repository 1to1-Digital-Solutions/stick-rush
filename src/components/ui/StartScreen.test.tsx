import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider } from '../GameProvider'
import { PLAYER_COUNT_HINTS, PLAYER_COUNT_LABELS } from '../../lib/duel'
import { StartScreen } from './StartScreen'

// Sin visor no hay entrada al visor: lo que se prueba es qué pregunta el menú.
vi.mock('../xr/XRWrapper', () => ({ XRWrapper: () => null }))

/**
 * El menú de la web: la fila de contra quién sale solo en el desafío, que es la misma partida
 * para todos, y a dos lo que se enseña es lo que lleva la pareja y no el récord de nadie.
 */

afterEach(() => {
  cleanup()
  localStorage.clear()
})

async function abrir() {
  await act(async () => {
    render(
      <GameProvider>
        <StartScreen />
      </GameProvider>,
    )
  })
}

const modo = (nombre: string) => screen.getByRole('button', { name: new RegExp(`^${nombre}`) })

describe('el menú de la web, a dos', () => {
  it('solo el desafío pregunta contra quién: solo, o a dos pasándose el mando', async () => {
    await abrir()
    for (const nombre of ['Practice', 'Levels']) {
      fireEvent.click(modo(nombre))
      expect(screen.queryByText('Who you play against'), nombre).toBeNull()
    }

    fireEvent.click(modo('Challenge'))
    expect(screen.getByText('Who you play against')).toBeDefined()
    const solo = screen.getByRole('button', { name: new RegExp(`^${PLAYER_COUNT_LABELS[1]}`) })
    const aDos = screen.getByRole('button', { name: new RegExp(`^${PLAYER_COUNT_LABELS[2]}`) })
    expect(solo.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(PLAYER_COUNT_HINTS[2])).toBeDefined()

    fireEvent.click(aDos)
    expect(aDos.getAttribute('aria-pressed')).toBe('true')
    expect(solo.getAttribute('aria-pressed')).toBe('false')
  })

  it('a dos no enseña el récord de nadie, sino lo que lleva la pareja', async () => {
    localStorage.setItem('stick-rush:best-points:challenge', '321')
    localStorage.setItem('stick-rush:duel-tally', '{"wins":[2,1],"ties":1}')
    await abrir()
    fireEvent.click(modo('Challenge'))
    expect(screen.getByText(/Best score in/)).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${PLAYER_COUNT_LABELS[2]}`) }))
    expect(screen.queryByText(/Best score in/)).toBeNull()
    expect(screen.getByText('Duels won: 2–1 · tied: 1')).toBeDefined()
  })

  it('a dos y sin partidas todavía no dice nada', async () => {
    await abrir()
    fireEvent.click(modo('Challenge'))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${PLAYER_COUNT_LABELS[2]}`) }))
    expect(screen.queryByText(/Duels won/)).toBeNull()
  })
})
