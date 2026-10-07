import { describe, expect, it } from 'vitest'
import { enCalentamiento } from './calentamiento'

describe('el calentamiento', () => {
  const RETO = { ensenando: true, gameMode: 'challenge' as const, aDos: false, enReto: false }

  it('es el reto con la lección en marcha', () => {
    expect(enCalentamiento(RETO)).toBe(true)
  })

  it('sin lección, el reto cuenta desde el primer palo', () => {
    expect(enCalentamiento({ ...RETO, ensenando: false })).toBe(false)
  })

  it('nunca en el reto del día ni a dos', () => {
    expect(enCalentamiento({ ...RETO, enReto: true })).toBe(false)
    expect(enCalentamiento({ ...RETO, aDos: true })).toBe(false)
  })

  it('en la práctica y los niveles no hay medalla que proteger', () => {
    expect(enCalentamiento({ ...RETO, gameMode: 'practice' })).toBe(false)
    expect(enCalentamiento({ ...RETO, gameMode: 'levels' })).toBe(false)
  })
})
