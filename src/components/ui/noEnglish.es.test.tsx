import { act, cleanup, render } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HUD } from '../game/HUD'
import { GameProvider } from '../GameProvider'
import { LANG_COOKIE } from '../../lib/settings'
import { COUNTDOWN_SECONDS, useGame, type GameStore } from '../../lib/gameStore'
import { englishPhrases } from '../../lib/noEnglish'
import { TEXT_KEYS, texto } from '../../lib/textos'
import { StartScreen } from './StartScreen'

vi.mock('../xr/XRWrapper', () => ({ XRWrapper: () => null }))

/**
 * The Spanish version says nothing in English: the home page, the scoreboard while playing the
 * challenge and the final summary, painted with the game in Spanish, go through the shared detector
 * (`lib/noEnglish.ts`). It is what would catch a phrase written by hand in a component without going
 * through `t()`.
 */

const KEYS = TEXT_KEYS.map((key) => [key, texto('es', key)] as const)

/** What is read from the page: the text and what the screen reader says. */
function whatIsRead(): string {
  const labels = [...document.querySelectorAll('[aria-label],[title]')].map(
    (node) => `${node.getAttribute('aria-label') ?? ''} ${node.getAttribute('title') ?? ''}`,
  )
  return [document.body.textContent ?? '', ...labels].join('\n')
}

let game: GameStore | null = null
/** What whoever plays does, by hand: the store of the run the home page and the scoreboard paint. */
function Controls({ onPaint }: { onPaint: (store: GameStore) => void }) {
  const store = useGame()
  useEffect(() => {
    onPaint(store)
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

describe('in Spanish nothing in English slips through', () => {
  it('neither on the home page, nor playing the challenge, nor at its end', () => {
    render(
      <GameProvider>
        <Controls onPaint={(store) => void (game = store)} />
        <StartScreen />
        <HUD />
      </GameProvider>,
    )
    expect(document.body.textContent).toContain('Jugar')
    expect(englishPhrases(whatIsRead(), KEYS)).toEqual([])

    // The challenge, the mode that gives a medal, with the countdown used up second by second.
    act(() => game!.setGameMode('challenge'))
    act(() => game!.startGame())
    for (let second = 0; second < COUNTDOWN_SECONDS; second++) {
      act(() => void vi.advanceTimersByTime(1000))
    }
    expect(game!.gameState).toBe('playing')
    act(() => game!.catchStick(0.5))
    expect(document.body.textContent).toContain('Puntos')
    expect(englishPhrases(whatIsRead(), KEYS)).toEqual([])

    // It ends as in the store's tests: three sticks to the ground.
    for (let i = 0; i < 3; i++) act(() => game!.missStick())
    expect(game!.gameState).toBe('finished')
    expect(document.body.textContent).toContain('Otro reto')
    expect(englishPhrases(whatIsRead(), KEYS)).toEqual([])
  })
})
