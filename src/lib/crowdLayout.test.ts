import { describe, expect, it } from 'vitest'
import { GARLAND_RING_RADIUS, STALL_RING_RADIUS } from './sceneryLayout'
import {
  CROWD_COUNT,
  CROWD_HEIGHT_RANGE,
  CROWD_RING_JITTER,
  CROWD_RING_RADIUS,
  crowdSpots,
} from './crowdLayout'

describe('el público de la feria', () => {
  const spots = crowdSpots()

  it('son tantas figuras como dice el recuento, y siempre las mismas', () => {
    expect(spots).toHaveLength(CROWD_COUNT)
    expect(crowdSpots()).toEqual(spots)
  })

  it('se queda entre las guirnaldas y las casetas, sin pisar ni unas ni otras', () => {
    for (const { position: [x, , z] } of spots) {
      const distance = Math.hypot(x, z)
      expect(distance).toBeGreaterThanOrEqual(CROWD_RING_RADIUS - CROWD_RING_JITTER)
      expect(distance).toBeLessThanOrEqual(CROWD_RING_RADIUS + CROWD_RING_JITTER)
      expect(distance).toBeGreaterThan(GARLAND_RING_RADIUS)
      expect(distance).toBeLessThan(STALL_RING_RADIUS)
    }
  })

  it('cada figura mira a la máquina', () => {
    for (const { position: [x, , z], rotationY } of spots) {
      // El frente es +Z local; girado `rotationY` apunta a (sin, cos), y eso
      // tiene que ser la dirección hacia el centro.
      const toCenter = [-x, -z]
      const facing = [Math.sin(rotationY), Math.cos(rotationY)]
      const dot = toCenter[0] * facing[0] + toCenter[1] * facing[1]
      expect(dot).toBeGreaterThan(0.99 * Math.hypot(x, z))
    }
  })

  it('no hay dos figuras en el mismo sitio ni todas de la misma estatura', () => {
    const [low, high] = CROWD_HEIGHT_RANGE
    const heights = new Set<number>()
    for (let i = 0; i < spots.length; i++) {
      expect(spots[i].height).toBeGreaterThanOrEqual(low)
      expect(spots[i].height).toBeLessThanOrEqual(high)
      heights.add(Math.round(spots[i].height * 100))
      for (let j = i + 1; j < spots.length; j++) {
        const [ax, , az] = spots[i].position
        const [bx, , bz] = spots[j].position
        expect(Math.hypot(ax - bx, az - bz)).toBeGreaterThan(0.25)
      }
    }
    expect(heights.size).toBeGreaterThan(5)
  })

  it('sin gente no hay sitios', () => {
    expect(crowdSpots(0)).toEqual([])
  })
})
