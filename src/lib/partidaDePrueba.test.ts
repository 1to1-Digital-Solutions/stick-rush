import { afterEach, describe, expect, it } from 'vitest'
import { exponerPartida, isPartidaRequested, type PartidaDePrueba } from './partidaDePrueba'

const api: PartidaDePrueba = { start: () => {}, score: () => {}, end: () => {}, cartel: () => null }

afterEach(() => {
  delete window.__partidaStickRush
})

describe('el gancho de la partida', () => {
  it('sin pedirlo no se deja nada', () => {
    expect(isPartidaRequested()).toBe(false)
    exponerPartida(api)
    expect(window.__partidaStickRush).toBeUndefined()
  })

  it('pedido, deja lo común en el objeto del test', () => {
    window.__partidaStickRush = {}
    expect(isPartidaRequested()).toBe(true)
    exponerPartida(api)
    expect(window.__partidaStickRush).toEqual(api)
  })
})
