import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider } from '../GameProvider'
import { PLAYER_COUNT_HINTS, PLAYER_COUNT_LABELS } from '../../lib/duel'
import { GAME_MODE_HINTS, GAME_MODE_ORDER } from '../../lib/gameMode'
import { StartScreen } from './StartScreen'

// Without a headset there is no entrance to the headset: what is tested is what the menu asks.
vi.mock('../xr/XRWrapper', () => ({ XRWrapper: () => null }))

/**
 * The website's menu: the row of against whom shows only in the challenge mode, which is the same
 * run for everyone, and with two what is shown is what the pair has so far and not anyone's record.
 */

afterEach(() => {
  cleanup()
  localStorage.clear()
})

async function open() {
  await act(async () => {
    render(
      <GameProvider>
        <StartScreen />
      </GameProvider>,
    )
  })
}

const modeButton = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) })

describe('the website menu opens on the challenge', () => {
  it('with the challenge chosen, without asking for sticks or speed: Play without touching anything starts it', async () => {
    await open()

    expect(modeButton('Challenge').getAttribute('aria-pressed')).toBe('true')
    expect(modeButton('Practice').getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByText('Number of sticks')).toBeNull()
    expect(screen.queryByText('Difficulty')).toBeNull()
    expect(screen.getByRole('button', { name: 'Play' })).toBeDefined()
  })

  it('practice is one tap away, with its sticks and its speed behind «Más opciones»', async () => {
    await open()
    fireEvent.click(modeButton('Practice'))

    expect(modeButton('Practice').getAttribute('aria-pressed')).toBe('true')
    // It opens folded: the mode in view and the rest behind the button.
    expect(screen.queryByText('Number of sticks')).toBeNull()
    expect(screen.queryByText('Length')).toBeNull()
    const more = screen.getByRole('button', { name: 'More options' })
    expect(more.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(more)
    expect(screen.getByText('Number of sticks')).toBeDefined()
    expect(screen.getByText('Difficulty')).toBeDefined()
    expect(screen.getByText('Length')).toBeDefined()
    const fewer = screen.getByRole('button', { name: 'Fewer options' })
    expect(fewer.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(fewer)
    expect(screen.queryByText('Number of sticks')).toBeNull()
  })

  it('with the challenge or the levels there is nothing folded: not even the button', async () => {
    await open()
    expect(screen.queryByRole('button', { name: 'More options' })).toBeNull()
    fireEvent.click(modeButton('Levels'))
    expect(screen.queryByRole('button', { name: 'More options' })).toBeNull()
    expect(screen.getByText('Level')).toBeDefined()
  })

  it('the mode row starts with the challenge, the one that gives a medal, and is called like the cabinet', async () => {
    await open()
    const modeButtons = screen.getAllByRole('button').filter((b) => /^(Challenge|Practice|Levels)/.test(b.textContent ?? ''))
    expect(modeButtons.map((b) => b.textContent?.match(/^(Challenge|Practice|Levels)/)?.[0])).toEqual(['Challenge', 'Practice', 'Levels'])
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Stick Rush')
  })

  it('each level says its stars with the right plural, in both languages', async () => {
    localStorage.setItem('stick-rush:levels:unlocked', '3')
    localStorage.setItem('stick-rush:levels:stars', '1,2,0')
    await open()
    fireEvent.click(modeButton('Levels'))
    expect(screen.getByRole('button', { name: 'Level 1, 1 star' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Level 2, 2 stars' })).toBeDefined()
  })

  it('says of each mode whether it counts for a medal: only the challenge', async () => {
    await open()

    for (const mode of GAME_MODE_ORDER) expect(screen.getByText(GAME_MODE_HINTS[mode]), mode).toBeDefined()
    expect(modeButton('Challenge').textContent).toContain('Counts for a medal')
    expect(modeButton('Practice').textContent).toContain('No medal')
    expect(modeButton('Levels').textContent).toContain('No medal')
  })
})

describe('the website menu, for two', () => {
  it('only the challenge mode asks against whom: alone, or two passing the controller', async () => {
    await open()
    for (const name of ['Practice', 'Levels']) {
      fireEvent.click(modeButton(name))
      expect(screen.queryByText('Players'), name).toBeNull()
    }

    fireEvent.click(modeButton('Challenge'))
    expect(screen.getByText('Players')).toBeDefined()
    expect(PLAYER_COUNT_LABELS).toEqual({ 1: 'Solo', 2: 'Duel' })
    const solo = screen.getByRole('button', { name: new RegExp(`^${PLAYER_COUNT_LABELS[1]}`) })
    const duel = screen.getByRole('button', { name: new RegExp(`^${PLAYER_COUNT_LABELS[2]}`) })
    expect(solo.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(PLAYER_COUNT_HINTS[2])).toBeDefined()

    fireEvent.click(duel)
    expect(duel.getAttribute('aria-pressed')).toBe('true')
    expect(solo.getAttribute('aria-pressed')).toBe('false')
  })

  it('with two it does not show anyone\'s record, but what the pair has so far', async () => {
    localStorage.setItem('stick-rush:best-points:challenge', '321')
    localStorage.setItem('stick-rush:duel-tally', '{"wins":[2,1],"ties":1}')
    await open()
    fireEvent.click(modeButton('Challenge'))
    expect(screen.getByText(/Best score in/)).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${PLAYER_COUNT_LABELS[2]}`) }))
    expect(screen.queryByText(/Best score in/)).toBeNull()
    expect(screen.getByText('Duels won: 2–1 · tied: 1')).toBeDefined()
  })

  it('with two and no matches yet it says nothing', async () => {
    await open()
    fireEvent.click(modeButton('Challenge'))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${PLAYER_COUNT_LABELS[2]}`) }))
    expect(screen.queryByText(/Duels won/)).toBeNull()
  })
})
