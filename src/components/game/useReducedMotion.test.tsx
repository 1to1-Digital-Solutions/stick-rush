import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useReducedMotion } from './useReducedMotion'

/**
 * `matchMedia` de mentira: jsdom no lo implementa. Guarda los oyentes para
 * poder simular que el sistema cambia de preferencia con la página abierta.
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
  // Sin `globals` en la config de Vitest, Testing Library no limpia sola.
  cleanup()
  vi.unstubAllGlobals()
})

describe('useReducedMotion', () => {
  it('dice que no cuando el sistema no pide reducir el movimiento', () => {
    const media = stubMatchMedia(false)
    const { seen } = renderHook()

    expect(seen.current).toBe(false)
    expect(media.matchMedia).toHaveBeenCalledWith(
      '(prefers-reduced-motion: reduce)',
    )
  })

  it('dice que sí cuando la preferencia ya venía puesta', () => {
    stubMatchMedia(true)
    const { seen } = renderHook()

    expect(seen.current).toBe(true)
  })

  it('se entera si la preferencia cambia con la página abierta', () => {
    const media = stubMatchMedia(false)
    const { seen } = renderHook()

    media.set(true)
    expect(seen.current).toBe(true)

    media.set(false)
    expect(seen.current).toBe(false)
  })

  it('deja de escuchar al desmontarse', () => {
    const media = stubMatchMedia(false)
    const { view } = renderHook()
    expect(media.listenerCount).toBe(1)

    view.unmount()
    expect(media.listenerCount).toBe(0)
  })

  it('no se rompe en un navegador sin matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { seen } = renderHook()

    expect(seen.current).toBe(false)
  })
})
