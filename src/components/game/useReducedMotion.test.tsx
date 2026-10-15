import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useReducedMotion } from './useReducedMotion'

/**
 * A fake `matchMedia`: jsdom does not implement it. It keeps the listeners to
 * be able to simulate the system changing preference with the page open.
 */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>()
  const media = {
    matches,
    addEventListener: (_: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      listeners.delete(listener),
  }
  const matchMedia = vi.fn(() => media)
  vi.stubGlobal('matchMedia', matchMedia)

  return {
    matchMedia,
    set(next: boolean) {
      media.matches = next
      act(() => listeners.forEach((listener) => listener()))
    },
    get listenerCount() {
      return listeners.size
    },
  }
}

function renderHook() {
  const seen = { current: null as boolean | null }

  function Probe() {
    seen.current = useReducedMotion()
    return null
  }

  const view = render(<Probe />)
  return { seen, view }
}

afterEach(() => {
  // Without `globals` in the Vitest config, Testing Library does not clean up by itself.
  cleanup()
  vi.unstubAllGlobals()
})

describe('useReducedMotion', () => {
  it('says no when the system does not ask to reduce motion', () => {
    const media = stubMatchMedia(false)
    const { seen } = renderHook()

    expect(seen.current).toBe(false)
    expect(media.matchMedia).toHaveBeenCalledWith(
      '(prefers-reduced-motion: reduce)',
    )
  })

  it('says yes when the preference was already set', () => {
    stubMatchMedia(true)
    const { seen } = renderHook()

    expect(seen.current).toBe(true)
  })

  it('finds out if the preference changes with the page open', () => {
    const media = stubMatchMedia(false)
    const { seen } = renderHook()

    media.set(true)
    expect(seen.current).toBe(true)

    media.set(false)
    expect(seen.current).toBe(false)
  })

  it('stops listening on unmounting', () => {
    const media = stubMatchMedia(false)
    const { view } = renderHook()
    expect(media.listenerCount).toBe(1)

    view.unmount()
    expect(media.listenerCount).toBe(0)
  })

  it('does not break in a browser without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { seen } = renderHook()

    expect(seen.current).toBe(false)
  })
})
